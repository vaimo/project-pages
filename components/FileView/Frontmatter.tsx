import type { Frontmatter } from "@/lib/markdown";

interface Props {
  data: Frontmatter;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v);
}

function extractLinkText(md: string): string {
  const m = md.match(/\[([^\]]+)\]\(([^)]+)\)/);
  return m ? m[1] : md;
}

function extractLinkHref(md: string): string | null {
  const m = md.match(/\[([^\]]+)\]\(([^)]+)\)/);
  return m ? m[2] : null;
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-40)",
  margin: 0,
};

const VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.9375rem",
  lineHeight: 1.55,
  color: "var(--color-ink-90)",
  margin: 0,
};

function TagChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.25rem 0.7rem",
        border: "1px solid var(--color-ink-90)",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        color: "var(--color-ink-90)",
        letterSpacing: "0.02em",
        background: "var(--color-card)",
      }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const stable = /stable|active|live/i.test(status);
  const draft = /draft|wip/i.test(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.25rem 0.65rem",
        border: `1px solid ${stable ? "var(--color-accent-ink)" : "var(--color-rule)"}`,
        borderRadius: "2px",
        fontSize: "0.7rem",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: stable ? "var(--color-accent-ink)" : draft ? "var(--color-ink-70)" : "var(--color-ink-70)",
        background: stable ? "var(--color-accent-tint)" : "transparent",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: stable ? "var(--color-accent-ink)" : "var(--color-ink-40)",
        }}
      />
      {status}
    </span>
  );
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value == null) return <span style={{ ...VALUE_STYLE, color: "var(--color-ink-40)" }}>—</span>;

  if (key === "status" && typeof value === "string") return <StatusBadge status={value} />;

  if (key === "tags" && Array.isArray(value)) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {value.map((t, i) => <TagChip key={i} label={String(t)} />)}
      </div>
    );
  }

  if (value instanceof Date) {
    return <p style={VALUE_STYLE}>{formatDate(value.toISOString())}</p>;
  }

  if (isIsoDate(value)) {
    return <p style={VALUE_STYLE}>{formatDate(value)}</p>;
  }

  if (Array.isArray(value)) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {value.map((v, i) => {
          const s = String(v);
          const href = extractLinkHref(s);
          const text = extractLinkText(s);
          return (
            <li key={i} style={VALUE_STYLE}>
              {href ? (
                <a
                  href={href}
                  style={{ color: "var(--color-ink-90)", textDecoration: "underline", textDecorationThickness: "1px", textUnderlineOffset: "3px", textDecorationColor: "var(--color-rule)" }}
                >
                  {text}
                </a>
              ) : (
                <span>{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.8125rem",
          color: "var(--color-ink-70)",
          lineHeight: 1.5,
          background: "transparent",
          border: "none",
          whiteSpace: "pre-wrap",
          margin: 0,
          padding: 0,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </div>
    );
  }

  return <p style={VALUE_STYLE}>{String(value)}</p>;
}

const PRIORITY_KEYS = ["title", "description", "type", "status", "timestamp", "tags"];

/**
 * Arrays with many items or long entries (e.g. `related`, `applies_to`) don't
 * fit the compact 220px-min grid used for scalar fields — they get their own
 * full-width row below.
 */
function isWideArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length > 4) return true;
  return value.some((v) => String(v).length > 45);
}

export default function Frontmatter({ data }: Props) {
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  const primary = keys.filter((k) => PRIORITY_KEYS.includes(k));
  const secondary = keys.filter((k) => !PRIORITY_KEYS.includes(k));

  const title = typeof data.title === "string" ? data.title : null;
  const description = typeof data.description === "string" ? data.description : null;

  const allKeys = [...primary.filter((k) => k !== "title" && k !== "description"), ...secondary];
  const gridKeys = allKeys.filter((k) => k !== "tags" && !isWideArray(data[k]));
  const wideKeys = allKeys.filter((k) => k !== "tags" && isWideArray(data[k]));
  const tagsKey = allKeys.includes("tags") ? "tags" : null;

  return (
    <aside
      aria-label="Document metadata"
      style={{
        position: "relative",
        margin: "0 0 2.5rem",
        padding: "1.75rem 0 1.5rem",
        borderTop: "1px solid var(--color-ink-90)",
        borderBottom: "1px solid var(--color-rule)",
      }}
    >
      {/* Editorial masthead tag */}
      <div
        style={{
          position: "absolute",
          top: "-0.55rem",
          left: 0,
          background: "var(--color-paper)",
          padding: "0 0.65rem 0 0",
          fontFamily: "var(--font-sans)",
          fontSize: "0.6875rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--color-ink-40)",
          fontWeight: 500,
        }}
      >
        At a glance
      </div>

      {title && (
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontVariationSettings: '"opsz" 96, "SOFT" 30',
            fontWeight: 400,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: "0 0 0.5rem",
            color: "var(--color-ink-90)",
          }}
        >
          {title}
        </h1>
      )}

      {description && (
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontVariationSettings: '"opsz" 20',
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "1.125rem",
            lineHeight: 1.5,
            color: "var(--color-ink-70)",
            margin: "0 0 1.5rem",
            maxWidth: "48rem",
          }}
        >
          {description}
        </p>
      )}

      {gridKeys.length > 0 && (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            columnGap: "2rem",
            rowGap: "1.25rem",
            margin: 0,
          }}
        >
          {gridKeys.map((key) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0 }}>
              <dt style={LABEL_STYLE}>{key.replace(/_/g, " ")}</dt>
              <dd style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{renderValue(key, data[key])}</dd>
            </div>
          ))}
        </dl>
      )}

      {tagsKey && (
        <div style={{ marginTop: gridKeys.length > 0 ? "1.5rem" : 0 }}>
          <dt style={{ ...LABEL_STYLE, marginBottom: "0.5rem" }}>Tags</dt>
          <dd style={{ margin: 0 }}>{renderValue("tags", data.tags)}</dd>
        </div>
      )}

      {wideKeys.map((key) => (
        <div key={key} style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid var(--color-rule)" }}>
          <dt style={{ ...LABEL_STYLE, marginBottom: "0.75rem" }}>{key.replace(/_/g, " ")}</dt>
          <dd style={{ margin: 0 }}>
            <WideArrayList items={data[key] as unknown[]} />
          </dd>
        </div>
      ))}
    </aside>
  );
}

function WideArrayList({ items }: { items: unknown[] }) {
  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        margin: 0,
        padding: 0,
        listStyle: "none",
      }}
    >
      {items.map((v, i) => {
        const s = String(v);
        const href = extractLinkHref(s);
        const text = extractLinkText(s);
        return (
          <li
            key={i}
            style={{
              ...VALUE_STYLE,
              display: "flex",
              alignItems: "baseline",
              gap: "0.55rem",
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: "14px",
                height: "1px",
                background: "var(--color-accent)",
                transform: "translateY(-4px)",
              }}
            />
            {href ? (
              <a
                href={href}
                style={{
                  color: "var(--color-ink-90)",
                  textDecoration: "underline",
                  textDecorationThickness: "1px",
                  textUnderlineOffset: "3px",
                  textDecorationColor: "var(--color-rule)",
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {text}
              </a>
            ) : (
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{text}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
