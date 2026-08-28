"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OutlineHeading } from "@/lib/markdown";

export default function OutlinePanel({ headings }: { headings: OutlineHeading[] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string, index: number) => {
    e.preventDefault();
    setActiveIndex(index);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
    }
  }, []);

  useEffect(() => {
    if (!open || headings.length === 0) return;

    // Find the last heading whose top edge is above the midpoint of the viewport —
    // that's the heading currently "in view" as the reader's focus point.
    let found = 0;
    for (let i = headings.length - 1; i >= 0; i--) {
      const el = document.getElementById(headings[i].id);
      if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.5) {
        found = i;
        break;
      }
    }

    setActiveIndex(found);

    // After React paints the panel, scroll it so the active item sits at ~20% from the top.
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      const item = itemRefs.current[found];
      if (!panel || !item) return;

      // offsetTop relative to the panel (handles any intermediate wrappers)
      const itemTop =
        item.getBoundingClientRect().top -
        panel.getBoundingClientRect().top +
        panel.scrollTop;

      panel.scrollTop = Math.max(0, itemTop - panel.clientHeight * 0.2);
    });
  }, [open, headings]);

  if (headings.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", top: "calc(var(--nav-height) + 5rem)", right: "1.5rem", zIndex: 90 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open ? (
        <div
          ref={panelRef}
          style={{
            width: "min(43vw, 420px)",
            maxHeight: "calc(100vh - var(--nav-height) - 1rem)",
            overflowY: "auto",
            background: "var(--color-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: "2px",
            boxShadow: "0 20px 40px rgba(15, 14, 11, 0.12)",
          }}
        >
          <div style={{ padding: "0.85rem 0" }}>
            <p
              className="eyebrow"
              style={{
                margin: "0 0 0.5rem",
                padding: "0 1rem",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.6rem",
              }}
            >
              <span>On this page</span>
              <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>{headings.length}</span>
            </p>
            {headings.map((h, i) => (
              <a
                key={i}
                ref={(el) => { itemRefs.current[i] = el; }}
                href={`#${h.id}`}
                onClick={(e) => handleClick(e, h.id, i)}
                className="outline-link"
                style={{
                  display: "block",
                  padding: "0.35rem 1rem",
                  paddingLeft: `calc(1rem + ${h.level - 1} * 0.85rem)`,
                  textDecoration: "none",
                  color: i === activeIndex ? "var(--color-ink-90)" : "var(--color-ink-70)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  fontWeight: h.level === 1 ? 600 : h.level === 2 ? 500 : 400,
                  lineHeight: 1.5,
                  borderRight: i === activeIndex
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
                  background: i === activeIndex ? "var(--color-accent-tint)" : undefined,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {h.text}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <button
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: "2px",
            padding: "0.4rem 0.85rem",
            fontSize: "0.6875rem",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--color-ink-70)",
            cursor: "default",
            whiteSpace: "nowrap",
          }}
        >
          ☰ Outline
        </button>
      )}
    </div>
  );
}
