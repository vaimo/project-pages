"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { prettyName } from "@/lib/nav";

interface SearchResult {
  path: string;
  title: string;
  tags: string[];
  matchedTag: string | null;
  snippet: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: "var(--color-accent-tint)",
          color: "var(--color-ink-90)",
          padding: "0 1px",
          borderRadius: "2px",
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

const LISTBOX_ID = "search-palette-listbox";
const optionId = (i: number) => `search-palette-option-${i}`;

export default function SearchPalette() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setError(false);
    setActiveIndex(0);
  }, []);

  // Global Cmd+K / Ctrl+K to open, regardless of which page/element has focus.
  useEffect(() => {
    if (!session) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [session]);

  // Focus the input and lock page scroll whenever the palette opens.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [open]);

  // Debounced search against the server-side index.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
        const data = await res.json();
        if (id === requestId.current) {
          setResults(data.results ?? []);
          setActiveIndex(0);
        }
      } catch (err) {
        console.error("[projectpages] Search request failed:", err);
        if (id === requestId.current) {
          setResults([]);
          setError(true);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open, retryTick]);

  const goTo = useCallback(
    (result: SearchResult) => {
      router.push(`/view/${result.path.split("/").map(encodeURIComponent).join("/")}`);
      close();
    },
    [router, close],
  );

  useEffect(() => {
    resultsRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Escape is handled at the dialog level (not just the input) so it still
  // closes the palette after focus moves to the Close button or a result.
  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") close();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) goTo(result);
    }
  }

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search documentation"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          background: "none",
          border: "1px solid var(--color-rule)",
          borderRadius: "2px",
          padding: "0.45rem 0.7rem",
          cursor: "pointer",
          color: "var(--color-ink-40)",
          fontFamily: "var(--font-sans)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-ink-40)"; e.currentTarget.style.color = "var(--color-ink-70)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-rule)"; e.currentTarget.style.color = "var(--color-ink-40)"; }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l4 4" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: "0.8125rem" }}>Search</span>
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            color: "var(--color-ink-40)",
            border: "1px solid var(--color-rule)",
            borderRadius: "2px",
            padding: "0.05rem 0.35rem",
            lineHeight: 1.4,
          }}
        >
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search documentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          onKeyDown={onDialogKeyDown}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 14, 11, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "min(14vh, 140px)",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(600px, calc(100vw - 2rem))",
              maxHeight: "min(70vh, 560px)",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: "4px",
              boxShadow: "0 30px 60px rgba(15, 14, 11, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.9rem 1.1rem",
                borderBottom: "1px solid var(--color-rule)",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: "var(--color-ink-40)", flexShrink: 0 }}>
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l4 4" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search by title, tag, or keyword…"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls={LISTBOX_ID}
                aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
                aria-autocomplete="list"
                aria-label="Search query"
                autoComplete="off"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.9375rem",
                  color: "var(--color-ink-90)",
                }}
              />
              <button
                onClick={close}
                aria-label="Close search"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-ink-40)",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-sans)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  padding: "0.2rem 0.4rem",
                  flexShrink: 0,
                }}
              >
                Esc
              </button>
            </div>

            <div ref={resultsRef} role="listbox" id={LISTBOX_ID} aria-label="Search results" style={{ overflowY: "auto", flex: 1 }}>
              {loading && (
                <div style={{ padding: "1.25rem 1.1rem", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-40)" }}>
                  Searching…
                </div>
              )}

              {!loading && error && (
                <div style={{ padding: "1.25rem 1.1rem", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-90)" }}>
                  Search is unavailable right now.
                  <br />
                  <button
                    onClick={() => setRetryTick((t) => t + 1)}
                    style={{
                      marginTop: "0.5rem",
                      background: "none",
                      border: "1px solid var(--color-rule)",
                      borderRadius: "2px",
                      padding: "0.3rem 0.65rem",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.75rem",
                      color: "var(--color-ink-70)",
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && query.trim() && results.length === 0 && (
                <div style={{ padding: "1.25rem 1.1rem", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-40)" }}>
                  No pages match &ldquo;{query}&rdquo;
                </div>
              )}

              {!loading && !query.trim() && (
                <div style={{ padding: "1.25rem 1.1rem", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-40)" }}>
                  Type to search page titles, tags, and content.
                </div>
              )}

              {results.map((result, i) => {
                const folder = result.path.includes("/") ? result.path.slice(0, result.path.lastIndexOf("/")) : "";
                const active = i === activeIndex;
                return (
                  <button
                    key={result.path}
                    id={optionId(i)}
                    role="option"
                    aria-selected={active}
                    data-index={i}
                    onClick={() => goTo(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "0.75rem 1.1rem",
                      background: active ? "var(--color-accent-tint)" : "transparent",
                      border: "none",
                      borderLeft: active ? "3px solid var(--color-accent)" : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.875rem", color: "var(--color-ink-90)" }}>
                        {highlightMatch(result.title, query)}
                      </span>
                      {result.matchedTag && (
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "0.6875rem",
                            fontWeight: 500,
                            color: "var(--color-accent-ink)",
                            background: "var(--color-accent-tint)",
                            border: "1px solid var(--color-accent)",
                            borderRadius: "999px",
                            padding: "0.05rem 0.55rem",
                          }}
                        >
                          {highlightMatch(result.matchedTag, query)}
                        </span>
                      )}
                    </div>
                    {folder && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-ink-40)", marginTop: "0.2rem" }}>
                        {folder.split("/").map(prettyName).join(" / ")}
                      </div>
                    )}
                    {result.snippet && (
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.8125rem",
                          color: "var(--color-ink-70)",
                          marginTop: "0.3rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {highlightMatch(result.snippet, query)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
