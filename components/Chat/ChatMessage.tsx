"use client";

import { useMemo, useState } from "react";

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
  role: "user" | "assistant";
  content: string;
  html?: string;
  references?: Reference[];
  stats?: ChatStats;
  pending?: boolean;
  error?: string;
}

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "75%" : "100%",
          width: isUser ? undefined : "100%",
          background: isUser ? "var(--color-chat-user-bg)" : "transparent",
          color: "var(--color-grey-900)",
          border: "none",
          borderRadius: isUser ? "10px" : 0,
          padding: isUser ? "0.6rem 0.95rem" : "0.85rem 1.1rem",
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          whiteSpace: isUser ? "pre-wrap" : undefined,
          wordBreak: "break-word",
        }}
      >
        {isUser ? (
          message.content
        ) : message.pending ? (
          <Typing />
        ) : message.error ? (
          <ErrorBlock text={message.error} />
        ) : (
          <AssistantBody message={message} />
        )}
      </div>
    </div>
  );
}

function AssistantBody({ message }: { message: Message }) {
  const html = message.html;
  return (
    <>
      {html ? (
        <div
          className="prose"
          style={{ maxWidth: "100%" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
      )}
      <References refs={message.references ?? []} />
      <AssistantToolbar message={message} />
    </>
  );
}

function References({ refs }: { refs: Reference[] }) {
  const visible = useMemo(
    () => refs.filter((r) => r.file_path).slice(0, 25),
    [refs],
  );
  if (visible.length === 0) return null;
  return (
    <div
      style={{
        marginTop: "0.75rem",
        paddingTop: "0.5rem",
        borderTop: "1px dashed var(--color-grey-300)",
        fontSize: "0.75rem",
        color: "var(--color-grey-700)",
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
          color: "var(--color-grey-500)",
          marginBottom: "0.3rem",
        }}
      >
        Sources
      </div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {visible.map((r, i) => (
          <li key={`${r.reference_id ?? i}-${r.file_path}`} style={{ marginBottom: "0.15rem" }}>
            <code
              style={{
                background: "var(--color-grey-100)",
                border: "1px solid var(--color-grey-300)",
                borderRadius: "3px",
                padding: "0 0.3rem",
                fontSize: "0.75rem",
              }}
            >
              {r.file_path}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantToolbar({ message }: { message: Message }) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canCopy = !!message.content;
  const stats = message.stats;

  async function onCopy() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function onDownload() {
    if (!canCopy) return;
    const blob = new Blob([message.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `chat-answer-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        marginTop: "0.75rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.4rem",
      }}
    >
      <ToolbarButton onClick={onCopy} disabled={!canCopy}>
        {copied ? "Copied" : "Copy as markdown"}
      </ToolbarButton>
      <ToolbarButton onClick={onDownload} disabled={!canCopy}>
        Download as markdown
      </ToolbarButton>
      {stats && (
        <ToolbarButton onClick={() => setStatsOpen((v) => !v)} active={statsOpen}>
          Answer statistics <Caret open={statsOpen} />
        </ToolbarButton>
      )}
      {stats && statsOpen && <StatsPanel stats={stats} />}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        background: active ? "var(--color-grey-300)" : "var(--color-white)",
        color: "var(--color-grey-700)",
        border: "1px solid var(--color-grey-300)",
        borderRadius: "999px",
        padding: "0.25rem 0.7rem",
        fontSize: "0.75rem",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden
      style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
    >
      <path d="M1.5 3.5 5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatsPanel({ stats }: { stats: ChatStats }) {
  const seconds = (stats.responseTimeMs / 1000).toFixed(1);
  return (
    <div
      style={{
        flexBasis: "100%",
        marginTop: "0.5rem",
        background: "var(--color-white)",
        border: "1px solid var(--color-grey-300)",
        borderRadius: "6px",
        padding: "0.6rem 0.85rem",
        fontSize: "0.75rem",
        color: "var(--color-grey-700)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.4rem 1.2rem",
      }}
    >
      <Stat label="Response time" value={`${seconds}s`} />
      <Stat
        label="Output length"
        value={`${stats.responseChars.toLocaleString()} chars`}
      />
      <Stat
        label="Approx. output tokens"
        value={`~${stats.approxOutputTokens.toLocaleString()}`}
      />
      <Stat label="Sources retrieved" value={String(stats.sourcesCount)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <span
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontSize: "0.625rem",
          color: "var(--color-grey-500)",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--color-grey-900)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ErrorBlock({ text }: { text: string }) {
  return (
    <div style={{ color: "#a23434", fontSize: "0.875rem" }}>
      <strong>Couldn’t reach the assistant.</strong>
      <div style={{ marginTop: "0.25rem", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div
      aria-label="Assistant is thinking"
      style={{ display: "flex", gap: "0.3rem", alignItems: "center", padding: "0.15rem 0" }}
    >
      <Dot delay={0} />
      <Dot delay={0.15} />
      <Dot delay={0.3} />
      <style>{`
        @keyframes chat-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--color-grey-500)",
        animation: `chat-dot 1.2s ${delay}s infinite ease-in-out`,
      }}
    />
  );
}
