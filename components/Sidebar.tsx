"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavNode, NavFolder } from "@/lib/nav";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function hasImageChildren(node: NavFolder): boolean {
  return node.children.some(
    (c) => c.type === "file" && IMAGE_EXTS.has(c.name.split(".").pop()?.toLowerCase() ?? "")
  );
}

/**
 * Turns a raw path segment ("returns_lifecycle.md" / "product-catalog" /
 * "ECOM_FRONTEND") into a human-readable label. Strips a trailing `.md`,
 * splits on `_`/`-`/`.`, then capitalises words that are entirely lowercase
 * so acronyms like `SAP`, `ECOM`, `FRONTEND` survive intact.
 */
function prettyName(raw: string): string {
  const noExt = raw.replace(/\.(md|mdx)$/i, "");
  return noExt
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((w) => (/[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

const SIDEBAR_DEFAULT_WIDTH = 338;
const SIDEBAR_MIN_WIDTH = 140;
const SIDEBAR_MAX_WIDTH = 800;

interface SidebarProps {
  tree: NavNode[];
  isOpen: boolean;
  activePath?: string;
}

function useActivePath(): string {
  const pathname = usePathname();
  if (!pathname?.startsWith("/view/")) return "";
  return pathname
    .slice("/view/".length)
    .split("/")
    .map((s) => {
      try { return decodeURIComponent(s); } catch { return s; }
    })
    .join("/");
}

function FolderNode({ node, depth }: { node: NavFolder; depth: number }) {
  const storageKey = `vaimo:folder:${node.path}`;
  const activePath = useActivePath();
  const containsActive = activePath === node.path || activePath.startsWith(node.path + "/");

  // Seed open state from localStorage if present, else from whether this
  // folder contains the currently-viewed file. Recompute when active path changes.
  const [open, setOpen] = useState<boolean>(containsActive);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (saved !== null) setOpen(saved === "true" || containsActive);
    else setOpen(containsActive);
  }, [storageKey, containsActive]);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);

  const showGallery = hasImageChildren(node);
  const galleryHref = `/gallery/${node.path.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <li>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flex: 1,
            minWidth: 0,
            textAlign: "left",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: `0.42rem ${1.25 + depth * 0.85}rem`,
            fontSize: depth === 0 ? "0.6875rem" : "0.8125rem",
            fontFamily: "var(--font-sans)",
            fontWeight: depth === 0 ? 700 : 600,
            color: containsActive ? "var(--color-ink-90)" : "var(--color-ink-90)",
            textTransform: depth === 0 ? "uppercase" : "none",
            letterSpacing: depth === 0 ? "0.18em" : "0.005em",
            overflow: "hidden",
            transition: "color 0.15s, background 0.15s",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              flexShrink: 0,
              opacity: 0.6,
            }}
          >
            <polygon points="2,1 8,5 2,9" />
          </svg>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {prettyName(node.name)}
          </span>
        </button>
        {showGallery && (
          <Link
            href={galleryHref}
            title="Show all images in gallery"
            style={{
              flexShrink: 0,
              marginRight: "0.5rem",
              padding: "0.15rem 0.35rem",
              fontSize: "0.6rem",
              fontWeight: 600,
              color: "var(--color-ink-40)",
              border: "1px solid var(--color-rule)",
              borderRadius: "2px",
              textDecoration: "none",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            ⊞
          </Link>
        )}
      </div>
      {open && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {node.children.map((child) => (
            <NavItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileNode({ node, depth }: { node: NavNode & { type: "file" }; depth: number }) {
  const activePath = useActivePath();
  const href = `/view/${node.path.split("/").map(encodeURIComponent).join("/")}`;
  const isActive = node.path === activePath;

  return (
    <li>
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          padding: `0.38rem ${1.25 + depth * 0.85}rem`,
          fontSize: "0.8125rem",
          fontFamily: "var(--font-sans)",
          color: isActive ? "var(--color-ink-90)" : "var(--color-ink-70)",
          fontWeight: isActive ? 700 : 400,
          textDecoration: "none",
          borderLeft: isActive ? "3px solid var(--color-accent)" : "3px solid transparent",
          background: isActive ? "var(--color-accent-tint)" : "transparent",
          boxShadow: isActive ? "inset 0 -1px 0 var(--color-accent), inset 0 1px 0 var(--color-accent)" : "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {isActive ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ flexShrink: 0, color: "var(--color-accent-ink)" }}>
            <path d="M2.5 5.2l1.6 1.6L8 2.7" stroke="currentColor" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span
            aria-hidden
            style={{ width: "10px", flexShrink: 0, height: "1px", background: "var(--color-rule)" }}
          />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{prettyName(node.name)}</span>
      </Link>
    </li>
  );
}

function NavItem({ node, depth }: { node: NavNode; depth: number }) {
  if (node.type === "folder") return <FolderNode node={node} depth={depth} />;
  return <FileNode node={node} depth={depth} />;
}

export default function Sidebar({ tree }: SidebarProps) {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    };

    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width]);

  // Auto-scroll the active file into view on load
  useEffect(() => {
    const t = setTimeout(() => {
      const active = document.querySelector('aside[aria-label="Navigation"] a[style*="rgba(15, 14, 11"], aside[aria-label="Navigation"] a[style*="accent-tint"]');
      active?.scrollIntoView({ block: "center", behavior: "auto" });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        minHeight: "calc(100vh - var(--nav-height))",
        background: "var(--color-paper)",
        borderRight: "1px solid var(--color-rule)",
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        position: "sticky" as const,
        top: "var(--nav-height)",
        maxHeight: "calc(100vh - var(--nav-height))",
        boxSizing: "border-box",
      }}
      aria-label="Navigation"
    >
      <nav style={{ paddingTop: "0.75rem", paddingBottom: "2rem" }}>
        <div
          style={{
            padding: "0.85rem 1.25rem 0.6rem",
            borderBottom: "1px solid var(--color-rule)",
            marginBottom: "0.5rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "var(--color-ink-40)",
          }}
        >
          Contents
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tree.map((node) => (
            <NavItem key={node.path} node={node} depth={0} />
          ))}
        </ul>
      </nav>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "10px",
          height: "100%",
          cursor: "col-resize",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="6"
          height="24"
          viewBox="0 0 6 24"
          fill="var(--color-rule)"
          style={{ pointerEvents: "none", flexShrink: 0 }}
        >
          <circle cx="1.5" cy="4"  r="1.5" />
          <circle cx="4.5" cy="4"  r="1.5" />
          <circle cx="1.5" cy="10" r="1.5" />
          <circle cx="4.5" cy="10" r="1.5" />
          <circle cx="1.5" cy="16" r="1.5" />
          <circle cx="4.5" cy="16" r="1.5" />
          <circle cx="1.5" cy="22" r="1.5" />
          <circle cx="4.5" cy="22" r="1.5" />
        </svg>
      </div>
    </aside>
  );
}
