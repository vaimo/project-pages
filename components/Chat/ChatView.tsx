"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatComposer from "./ChatComposer";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
} from "@/lib/chat-storage";

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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  references?: Reference[];
  stats?: ChatStats;
  pending?: boolean;
  error?: string;
}

interface HealthState {
  ok: boolean;
  reason?: string;
  error?: string;
  checking: boolean;
}

interface ChatViewProps {
  title: string;
  welcome: string;
  backendConfigured: boolean;
  maxQueryChars: number;
  branchName: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChatView({
  title,
  welcome,
  backendConfigured,
  maxQueryChars,
  branchName,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<HealthState>({ ok: false, checking: true });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from this branch's localStorage slot on first mount. Since the
  // chat page passes key={branchName} to ChatView, the component remounts on
  // every branch change — so this effect re-fires with the new branch's data.
  useEffect(() => {
    const stored = loadChatHistory(branchName);
    if (stored.length > 0) {
      setMessages(stored as Message[]);
    }
    setHydrated(true);
  }, [branchName]);

  // Persist whenever the conversation changes. We skip pending placeholders
  // (so a reload mid-response doesn't leave a stuck "typing" bubble) and
  // failed turns (clutter without value).
  useEffect(() => {
    if (!hydrated) return;
    const finalized = messages.filter((m) => !m.pending && !m.error);
    saveChatHistory(branchName, finalized);
  }, [messages, hydrated, branchName]);

  const checkHealth = useCallback(async () => {
    setHealth((h) => ({ ...h, checking: true }));
    try {
      const res = await fetch("/api/chat/health", { cache: "no-store" });
      const data = await res.json();
      setHealth({
        ok: !!data.ok,
        reason: data.reason,
        error: data.error,
        checking: false,
      });
    } catch (err) {
      setHealth({
        ok: false,
        reason: "network-error",
        error: err instanceof Error ? err.message : String(err),
        checking: false,
      });
    }
  }, []);

  useEffect(() => {
    if (backendConfigured) {
      void checkHealth();
    } else {
      setHealth({ ok: false, reason: "backend-missing", checking: false });
    }
  }, [backendConfigured, checkHealth]);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const history = messages
        .filter((m) => !m.pending && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: Message = { id: uid(), role: "user", content: trimmed };
      const placeholder: Message = {
        id: uid(),
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, history }),
        });
        const data = await res.json();
        if (!res.ok) {
          let errMsg: string;
          if (res.status === 429 && typeof data?.retryAfterSeconds === "number") {
            const window = data?.reason === "per-minute" ? "minute" : "hour";
            errMsg = `You're sending messages faster than the ${window}ly limit allows. Try again in ${data.retryAfterSeconds}s.`;
          } else if (res.status === 413) {
            errMsg =
              data?.error ??
              `Your message exceeds the configured limit of ${maxQueryChars} characters.`;
          } else {
            errMsg =
              data?.detail || data?.error || `Request failed (HTTP ${res.status})`;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? { ...m, pending: false, error: errMsg, content: "" }
                : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? {
                    ...m,
                    pending: false,
                    content: data.response ?? "",
                    html: typeof data.html === "string" ? data.html : undefined,
                    references: Array.isArray(data.references)
                      ? data.references
                      : [],
                    stats:
                      data.stats && typeof data.stats === "object"
                        ? (data.stats as ChatStats)
                        : undefined,
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, pending: false, error: errMsg, content: "" }
              : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [messages, sending],
  );

  const clear = useCallback(() => {
    if (sending) return;
    setMessages([]);
    clearChatHistory(branchName);
  }, [sending, branchName]);

  const isEmpty = messages.length === 0;
  const canSend = health.ok && !sending;

  const banner = useMemo(() => {
    if (health.checking) return null;
    if (health.ok) return null;
    return <HealthBanner health={health} onRetry={checkHealth} />;
  }, [health, checkHealth]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-grey-100)",
        minHeight: 0,
        position: "relative",
      }}
    >
      {banner}

      {!isEmpty && (
        <ClearConversationButton
          disabled={sending}
          onClick={clear}
        />
      )}

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          padding: "1.5rem 1rem 1rem",
        }}
      >
        <div
          style={{
            maxWidth: "780px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {isEmpty ? (
            <WelcomeCard title={title} welcome={welcome} />
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-grey-300)",
          background: "var(--color-white)",
          padding: "0.85rem 1rem",
        }}
      >
        <div
          style={{
            maxWidth: "780px",
            margin: "0 auto",
          }}
        >
          <ChatComposer
            disabled={!canSend}
            maxChars={maxQueryChars}
            placeholder={
              !backendConfigured
                ? "Chat backend is not configured on this deployment."
                : !health.ok
                ? "Chat backend is currently unavailable."
                : sending
                ? "Waiting for the assistant…"
                : "Ask a question about the documentation…"
            }
            onSend={sendMessage}
          />
        </div>
      </div>
    </div>
  );
}

function ClearConversationButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Clear conversation"
      style={{
        position: "absolute",
        top: "0.75rem",
        left: "0.75rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        background: "var(--color-white)",
        border: "1px solid var(--color-grey-300)",
        borderRadius: "999px",
        padding: "0.35rem 0.7rem 0.35rem 0.55rem",
        fontSize: "0.8125rem",
        color: "var(--color-grey-700)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        zIndex: 10,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M6 2.5h4M3 4.5h10M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Clear conversation
    </button>
  );
}

function WelcomeCard({ title, welcome }: { title: string; welcome: string }) {
  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-grey-300)",
        borderRadius: "8px",
        padding: "1.5rem 1.75rem",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--color-grey-900)",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          marginTop: "0.5rem",
          marginBottom: 0,
          color: "var(--color-grey-700)",
          fontSize: "0.9375rem",
          lineHeight: 1.55,
        }}
      >
        {welcome}
      </p>
    </div>
  );
}

function HealthBanner({
  health,
  onRetry,
}: {
  health: HealthState;
  onRetry: () => void;
}) {
  const message = (() => {
    switch (health.reason) {
      case "backend-missing":
        return "Chat is enabled in this site's configuration, but no chat backend URL is set for this branch. Ask an administrator to set chat.backendUrl on this branch in projectpages.config.";
      case "backend-down":
        return `The chat backend is currently unavailable${
          health.error ? ` (${health.error})` : ""
        }. You can keep reading the documentation while it recovers.`;
      case "disabled":
        return "Chat is not enabled for this knowledge base.";
      case "forbidden":
        return "Your account does not have access to chat for this knowledge base.";
      default:
        return health.error
          ? `Chat is unavailable: ${health.error}`
          : "Chat is unavailable.";
    }
  })();

  return (
    <div
      role="alert"
      style={{
        background: "#fff7d6",
        borderBottom: "1px solid #e9d27a",
        padding: "0.75rem 1.25rem",
        color: "#5b4500",
        fontSize: "0.875rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <span aria-hidden style={{ fontSize: "1rem" }}>⚠</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={health.checking}
        style={{
          background: "var(--color-grey-900)",
          color: "var(--color-white)",
          border: "none",
          padding: "0.3rem 0.7rem",
          borderRadius: "4px",
          fontSize: "0.75rem",
          cursor: health.checking ? "default" : "pointer",
        }}
      >
        {health.checking ? "Checking…" : "Retry"}
      </button>
    </div>
  );
}
