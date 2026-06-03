import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { canUseChat, getBranchChatBackendUrl } from "@/lib/config";
import { renderMarkdown } from "@/lib/markdown";
import { consumeRateLimit } from "@/lib/chat-rate-limit";
import {
  openChatQueryStream,
  getChatBackendSettings,
  type ChatTurn,
  type ChatReference,
  type ChatStreamLine,
} from "@/lib/chat";

export const dynamic = "force-dynamic";

function rateLimitKey(req: NextRequest, userGroup: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `${userGroup}|${ip}`;
}

/**
 * DeepSeek (and similar reasoning models) prefix their answer with a
 * <think>…</think> block. End users should see only the answer, so we hide
 * everything up to and including the closing tag. While the block is still
 * open this returns "" so the UI keeps showing the "thinking" indicator, and a
 * partial opening tag split across chunks is waited out rather than flashed.
 */
function visibleAnswer(raw: string): string {
  const ls = raw.replace(/^\s+/, "");
  const close = ls.indexOf("</think>");
  if (close !== -1) {
    return ls.slice(close + "</think>".length).replace(/^\s+/, "");
  }
  if (ls.startsWith("<think>")) return "";
  if (ls.length < 7 && "<think>".startsWith(ls)) return "";
  return ls;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let config;
  try {
    config = await getConfig();
  } catch (err) {
    console.error("[chat] Failed to load config:", err);
    return NextResponse.json({ error: "Configuration error" }, { status: 500 });
  }

  if (!canUseChat(session.userGroupName, config, session.branchName)) {
    return NextResponse.json(
      { error: "Chat is not enabled for this branch" },
      { status: 403 },
    );
  }

  const backendUrl = getBranchChatBackendUrl(session.branchName, config);
  if (!backendUrl) {
    // canUseChat already covers this, but guard again so the type narrows
    // and so a config edge case can't fall through to the backend call.
    return NextResponse.json(
      { error: "Chat backend is not configured for this branch" },
      { status: 503 },
    );
  }

  const security = config.chat.security;

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rl = consumeRateLimit(
    rateLimitKey(req, session.userGroupName),
    security.rateLimit,
  );
  if (!rl.ok) {
    const window = rl.reason === "per-minute" ? "minute" : "hour";
    return NextResponse.json(
      {
        error: `Rate limit reached for this ${window}. Try again in ${rl.retryAfterSeconds}s.`,
        retryAfterSeconds: rl.retryAfterSeconds,
        reason: rl.reason,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let payload: { query?: unknown; history?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawQuery = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!rawQuery) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (rawQuery.length > security.maxQueryChars) {
    return NextResponse.json(
      {
        error: `Question is too long. Limit is ${security.maxQueryChars} characters; your message has ${rawQuery.length}.`,
        limit: security.maxQueryChars,
        actual: rawQuery.length,
      },
      { status: 413 },
    );
  }

  const incomingHistory: ChatTurn[] = Array.isArray(payload.history)
    ? payload.history
        .filter(
          (t): t is { role: string; content: string } =>
            !!t &&
            typeof t === "object" &&
            typeof (t as { role?: unknown }).role === "string" &&
            typeof (t as { content?: unknown }).content === "string",
        )
        .map<ChatTurn>((t) => ({
          role: t.role === "assistant" ? "assistant" : "user",
          content: t.content,
        }))
        .filter((t) => t.content.length <= security.maxQueryChars * 4)
    : [];

  // Keep only the most recent N turns to bound the prompt that reaches the LLM.
  const history =
    incomingHistory.length > security.maxHistoryTurns
      ? incomingHistory.slice(-security.maxHistoryTurns)
      : incomingHistory;

  // ── Stream from backend ───────────────────────────────────────────────────
  // We relay LightRAG's NDJSON stream to the browser so the answer appears
  // progressively. Our own wire format (also NDJSON) is one JSON object per
  // line with a "type" field: "references" | "delta" | "done" | "error".
  const startedAt = Date.now();
  const controller = new AbortController();
  const { timeoutMs } = getChatBackendSettings(backendUrl);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await openChatQueryStream(
      { query: rawQuery, history },
      backendUrl,
      controller.signal,
    );
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] Stream open failed:", msg);
    return NextResponse.json(
      { error: "Chat backend request failed", detail: msg },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const reader = upstream.body!.getReader();
      let buf = "";
      let raw = "";        // full upstream text, including any <think> block
      let emittedLen = 0;  // length of the visible answer already streamed
      let references: ChatReference[] = [];

      const emit = (obj: unknown) =>
        ctrl.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const handleLine = (line: string) => {
        const t = line.trim();
        if (!t) return;
        let obj: ChatStreamLine;
        try {
          obj = JSON.parse(t) as ChatStreamLine;
        } catch {
          return; // ignore malformed lines
        }
        if (Array.isArray(obj.references)) {
          references = obj.references;
          emit({ type: "references", references });
        } else if (typeof obj.response === "string" && obj.response) {
          raw += obj.response;
          // Emit only the newly-revealed slice of the answer (post-<think>).
          const visible = visibleAnswer(raw);
          if (visible.length > emittedLen) {
            emit({ type: "delta", text: visible.slice(emittedLen) });
            emittedLen = visible.length;
          }
        } else if (obj.error) {
          emit({ type: "error", error: String(obj.error) });
        }
      };

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? ""; // keep the incomplete trailing line
          for (const line of lines) handleLine(line);
        }
        if (buf.trim()) handleLine(buf); // flush any trailing line

        // Render the finished answer to sanitized HTML once (strips raw HTML
        // the LLM may emit), and send final references + stats.
        const answer = visibleAnswer(raw);
        const html = answer
          ? await renderMarkdown(answer, undefined, { safe: true })
          : "";
        emit({
          type: "done",
          html,
          references,
          stats: {
            responseTimeMs: Date.now() - startedAt,
            responseChars: answer.length,
            approxOutputTokens: Math.round(answer.length / 4),
            sourcesCount: references.length,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat] Stream relay failed:", msg);
        try {
          emit({ type: "error", error: msg });
        } catch {
          // stream already torn down
        }
      } finally {
        clearTimeout(timeout);
        ctrl.close();
      }
    },
    cancel() {
      controller.abort();
      clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Discourage proxy buffering so chunks reach the client promptly.
      "X-Accel-Buffering": "no",
    },
  });
}
