/**
 * Thin client for a LightRAG-compatible chat backend. The backend URL is
 * supplied by the caller (resolved per-branch from projectpages.config in the
 * API routes); the rest of the settings (api key, mode, top_k, language
 * instruction, timeout) still come from env vars.
 */

export interface ChatBackendSettings {
  url: string;
  apiKey: string | null;
  mode: string;
  topK: number;
  chunkTopK: number;
  languageInstruction: string;
  timeoutMs: number;
}

export interface ChatReference {
  reference_id?: string;
  file_path?: string;
  [key: string]: unknown;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatQueryInput {
  query: string;
  history?: ChatTurn[];
}

export interface ChatQueryResult {
  response: string;
  references: ChatReference[];
}

export interface ChatHealth {
  ok: boolean;
  status?: string;
  model?: string;
  error?: string;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getChatBackendSettings(url: string): ChatBackendSettings {
  return {
    url: normaliseUrl(url),
    apiKey: process.env.CHAT_API_KEY?.trim() || null,
    mode: (process.env.CHAT_QUERY_MODE ?? "naive").trim() || "naive",
    topK: envInt("CHAT_TOP_K", 40),
    chunkTopK: envInt("CHAT_CHUNK_TOP_K", 25),
    languageInstruction:
      process.env.CHAT_LANGUAGE_INSTRUCTION?.trim() ||
      "You MUST respond in English.",
    timeoutMs: envInt("CHAT_TIMEOUT_MS", 120_000),
  };
}

function buildHeaders(settings: ChatBackendSettings, json: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`;
  return headers;
}

async function withTimeout<T>(p: Promise<T>, ms: number, controller: AbortController): Promise<T> {
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkChatBackendHealth(url: string): Promise<ChatHealth> {
  const settings = getChatBackendSettings(url);
  const controller = new AbortController();
  try {
    const res = await withTimeout(
      fetch(`${settings.url}/health`, {
        method: "GET",
        headers: buildHeaders(settings, false),
        signal: controller.signal,
        cache: "no-store",
      }),
      Math.min(settings.timeoutMs, 10_000),
      controller,
    );
    if (!res.ok) {
      return { ok: false, error: `Backend responded with HTTP ${res.status}` };
    }
    const json = (await res.json()) as Record<string, unknown>;
    const status = typeof json.status === "string" ? (json.status as string) : undefined;
    const cfg = (json.configuration as Record<string, unknown> | undefined) ?? {};
    const model = typeof cfg.llm_model === "string" ? (cfg.llm_model as string) : undefined;
    if (status && status !== "healthy") {
      return { ok: false, status, model, error: `Backend status: ${status}` };
    }
    return { ok: true, status, model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function runChatQuery(
  input: ChatQueryInput,
  url: string,
): Promise<ChatQueryResult> {
  const settings = getChatBackendSettings(url);

  const conversation_history = (input.history ?? [])
    .filter((t) => t.content?.trim())
    .map((t) => ({ role: t.role, content: t.content }));

  const body = {
    query: input.query,
    mode: settings.mode,
    top_k: settings.topK,
    chunk_top_k: settings.chunkTopK,
    include_references: true,
    response_type: "Multiple Paragraphs",
    user_prompt: settings.languageInstruction,
    ...(conversation_history.length > 0 ? { conversation_history } : {}),
  };

  const controller = new AbortController();
  const res = await withTimeout(
    fetch(`${settings.url}/query`, {
      method: "POST",
      headers: buildHeaders(settings, true),
      body: JSON.stringify(body),
      signal: controller.signal,
    }),
    settings.timeoutMs,
    controller,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Chat backend returned HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
    );
  }

  const json = (await res.json()) as { response?: string; references?: ChatReference[] };
  return {
    response: json.response ?? "",
    references: Array.isArray(json.references) ? json.references : [],
  };
}
