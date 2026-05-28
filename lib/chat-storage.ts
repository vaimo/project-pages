/**
 * localStorage-backed persistence for the chat conversation.
 *
 * Scope: per-browser-per-origin (localStorage's default), keyed by branch name
 * so each branch retains its own conversation. Persists across tab switches,
 * page reloads, and sign-out/sign-in cycles. Cleared when the user explicitly
 * hits "Clear conversation" (current branch only) or when storage is wiped at
 * the browser level (e.g. clear-site-data, private-browsing close).
 *
 * The shape is versioned so the schema can change without leaking stale data.
 */

const STORAGE_KEY_PREFIX = "vaimo:chat:v2";
const STORAGE_VERSION = 2;
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

function keyFor(branchName: string): string {
  return `${STORAGE_KEY_PREFIX}:${branchName}`;
}

export function loadChatHistory(branchName: string): StoredMessage[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(branchName));
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

export function saveChatHistory(branchName: string, messages: StoredMessage[]): void {
  if (!hasStorage()) return;
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const blob: StorageBlob = {
      version: STORAGE_VERSION,
      messages: trimmed,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(keyFor(branchName), JSON.stringify(blob));
  } catch {
    // Quota errors / disabled storage / serialization failures — swallow.
    // Worst case, the conversation just isn't restored on the next visit.
  }
}

export function clearChatHistory(branchName: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(keyFor(branchName));
  } catch {
    // ignore
  }
}
