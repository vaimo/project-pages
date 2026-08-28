"use client";

interface DownloadButtonProps {
  filePath: string;
  withComments?: boolean;
  withMedia?: boolean;
  label?: string;
}

export default function DownloadButton({ filePath, withComments = false, withMedia = false, label }: DownloadButtonProps) {
  const endpoint = withComments
    ? "/api/download/with-comments"
    : withMedia
    ? "/api/download/with-media"
    : "/api/download";
  const href = `${endpoint}?path=${encodeURIComponent(filePath)}`;
  const defaultLabel = withComments ? "Download with comments" : withMedia ? "Download with media" : "Download";

  return (
    <a
      href={href}
      download
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.55rem 0.95rem",
        background: withComments ? "var(--color-ink-90)" : "transparent",
        color: withComments ? "var(--color-paper)" : "var(--color-ink-90)",
        border: `1px solid ${withComments ? "var(--color-ink-90)" : "var(--color-rule)"}`,
        borderRadius: "2px",
        fontSize: "0.6875rem",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        textDecoration: "none",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { if (!withComments) e.currentTarget.style.borderColor = "var(--color-ink-90)"; }}
      onMouseLeave={(e) => { if (!withComments) e.currentTarget.style.borderColor = "var(--color-rule)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 1v7.586l2.293-2.293 1.414 1.414L7 11.414l-3.707-3.707 1.414-1.414L7 8.586V1h0z" />
        <path d="M1 11h2v1h8v-1h2v2H1v-2z" />
      </svg>
      {label ?? defaultLabel}
    </a>
  );
}
