import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { canUseChat, getBranchChatBackendUrl } from "@/lib/config";
import { renderMarkdown } from "@/lib/markdown";
import { consumeRateLimit } from "@/lib/chat-rate-limit";
import { runChatQuery, type ChatTurn } from "@/lib/chat";

export const dynamic = "force-dynamic";

function rateLimitKey(req: NextRequest, userGroup: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `${userGroup}|${ip}`;
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

  // ── Call backend ──────────────────────────────────────────────────────────
  const startedAt = Date.now();
  try {
    const result = await runChatQuery({ query: rawQuery, history }, backendUrl);
    const responseTimeMs = Date.now() - startedAt;
    // Use safe markdown: discard any raw HTML the LLM tries to emit.
    const html = result.response
      ? await renderMarkdown(result.response, undefined, { safe: true })
      : "";
    const chars = result.response.length;
    return NextResponse.json({
      response: result.response,
      html,
      references: result.references,
      stats: {
        responseTimeMs,
        responseChars: chars,
        approxOutputTokens: Math.round(chars / 4),
        sourcesCount: result.references.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] Query failed:", msg);
    return NextResponse.json(
      { error: "Chat backend request failed", detail: msg },
      { status: 502 },
    );
  }
}
