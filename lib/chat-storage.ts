/**
 * localStorage-backed persistence for the chat conversation.
 *
 * Scope: per-browser-per-origin (localStorage's default). Persists across
 * tab switches, page reloads, and sign-out/sign-in cycles. Cleared when the
 * user explicitly hits "Clear conversation" or when the storage is wiped at
 * the browser level (e.g. clear-site-data, private-browsing close).
 *
 * The shape is versioned so the schema can change without leaking stale data.
 */

const STORAGE_KEY = "vaimo:chat:v1";
const STORAGE_VERSION = 1;
/** Cap to avoid pushing localStorage over its ~5 MB per-origin quota. */
const MAX_MESSAGES = 100;

interface Reference {
  reference_id?: string;
  file_path?: string;
}

interface ChatStats {
  responseTimeMs: number;
  responseChars: number;
  approxOutputTokens: number;
  sourcesCount: number;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  references?: Reference[];
  stats?: ChatStats;
}

interface StorageBlob {
  version: number;
  messages: StoredMessage[];
  updatedAt: number;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadChatHistory(): StoredMessage[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StorageBlob>;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.messages)) {
      return [];
    }
    return parsed.messages.filter(
      (m): m is StoredMessage =>
        !!m &&
        typeof m === "object" &&
        typeof (m as StoredMessage).id === "string" &&
        ((m as StoredMessage).role === "user" ||
          (m as StoredMessage).role === "assistant") &&
        typeof (m as StoredMessage).content === "string",
    );
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: StoredMessage[]): void {
  if (!hasStorage()) return;
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const blob: StorageBlob = {
      version: STORAGE_VERSION,
      messages: trimmed,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Quota errors / disabled storage / serialization failures — swallow.
    // Worst case, the conversation just isn't restored on the next visit.
  }
}

export function clearChatHistory(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
