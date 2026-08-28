"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import CommentForm from "@/components/Comments/CommentForm";
import MermaidBlock from "./MermaidBlock";
import OutlinePanel from "./OutlinePanel";
import Frontmatter from "./Frontmatter";
import type { OutlineHeading, Frontmatter as FrontmatterType } from "@/lib/markdown";

interface Props {
  html: string;
  filePath: string;
  commentsEnabled?: boolean;
  headings?: OutlineHeading[];
  frontmatter?: FrontmatterType | null;
}

type Segment = { type: "html"; content: string } | { type: "mermaid"; code: string };

function splitMermaid(html: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /<div class="mermaid-placeholder" data-mermaid="([^"]+)"><\/div>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "html", content: html.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mermaid", code: decodeURIComponent(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: "html", content: html.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "html", content: html }];
}

const BLOCK_TAGS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH", "BLOCKQUOTE", "DT", "DD"]);

export default function MarkdownView({ html, filePath, commentsEnabled = true, headings = [], frontmatter = null }: Props) {
  const segments = splitMermaid(html);
  const articleRef = useRef<HTMLElement>(null);
  const [iconY, setIconY] = useState<number | null>(null);
  const [iconX, setIconX] = useState<number>(0);
  const [anchor, setAnchor] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formY, setFormY] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!commentsEnabled || formOpen) return;
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    const rect = articleRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIconY(e.clientY);
    setIconX(rect.right + 10);

    // Find the nearest block-level element to use as anchor text
    let el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    while (el && !BLOCK_TAGS.has(el.tagName)) {
      el = el.parentElement;
    }
    const text = el?.textContent?.trim() ?? "";
    setAnchor(text.slice(0, 500));
  }, [formOpen]);

  const handleMouseLeave = useCallback(() => {
    if (!formOpen) {
      hideTimer.current = setTimeout(() => setIconY(null), 200);
    }
  }, [formOpen]);

  // Cancel the hide timer when the cursor enters the icon
  const handleIconMouseEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Restart hide timer when cursor leaves the icon (without clicking)
  const handleIconMouseLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setIconY(null), 200);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // Scroll to hash on initial load and on hash changes
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const handleIconClick = useCallback(() => {
    if (iconY === null) return;
    setFormY(iconY);
    setFormOpen(true);
    setIconY(null);
  }, [iconY]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href?.startsWith("#")) return;
    e.preventDefault();
    const el = document.getElementById(href.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", href);
    }
  }, []);

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>
      <OutlinePanel headings={headings} />
      <article ref={articleRef} className="prose fade-up">
        {frontmatter && <Frontmatter data={frontmatter} />}
        {segments.map((seg, i) =>
          seg.type === "html" ? (
            <div key={i} dangerouslySetInnerHTML={{ __html: seg.content }} />
          ) : (
            <MermaidBlock key={i} code={seg.code} />
          )
        )}
      </article>

      {/* Floating comment icon — follows cursor Y, anchored to right of article */}
      {iconY !== null && (
        <button
          onMouseDown={handleIconClick}
          onMouseEnter={handleIconMouseEnter}
          onMouseLeave={handleIconMouseLeave}
          title="Comment on this line"
          style={{
            position: "fixed",
            left: iconX,
            top: iconY - 13,
            width: "26px",
            height: "26px",
            background: "var(--color-yellow)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            fontSize: "12px",
            pointerEvents: "auto",
          }}
        >
          ✎
        </button>
      )}

      {/* Inline comment form popup */}
      {formOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 60 }}
            onClick={() => setFormOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: Math.min(formY - 10, window.innerHeight - 260),
              left: iconX - 320,
              width: "300px",
              background: "var(--color-white)",
              border: "1px solid var(--color-grey-300)",
              borderRadius: "8px",
              padding: "1rem",
              zIndex: 70,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {anchor && (
              <p
                style={{
                  margin: "0 0 0.75rem",
                  fontSize: "0.75rem",
                  color: "var(--color-grey-600)",
                  fontStyle: "italic",
                  borderLeft: "3px solid var(--color-yellow)",
                  paddingLeft: "0.5rem",
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{anchor.length > 120 ? anchor.slice(0, 120) + "…" : anchor}&rdquo;
              </p>
            )}
            <CommentForm
              filePath={filePath}
              anchor={anchor || null}
              onSuccess={() => {
                setFormOpen(false);
                window.dispatchEvent(new CustomEvent("vaimo:commentAdded"));
              }}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
