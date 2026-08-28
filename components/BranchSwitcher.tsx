"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function BranchSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session || !session.accessibleBranches?.length) return null;

  // Only show the switcher if the user has more than one branch available
  const branches = session.accessibleBranches;
  const current = session.branchName;

  async function switchBranch(branch: string) {
    if (branch === current || switching) return;
    setSwitching(true);
    setOpen(false);
    await update({ branchName: branch });
    router.refresh();
    setSwitching(false);
  }

  // Fetch the archive ourselves (rather than a plain <a download>) so we can
  // show a spinner while the server builds the zip and revert once it's ready.
  async function downloadArchive() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/download/archive");
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filename =
        /filename="?([^"]+)"?/.exec(cd)?.[1] ?? `${current}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[projectpages] Archive download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          border: "1px solid var(--color-rule)",
          borderRadius: "2px",
          overflow: "hidden",
          whiteSpace: "nowrap",
          background: "transparent",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            background: "none",
            border: "none",
            padding: "0.45rem 0.85rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.7rem",
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-70)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ opacity: 0.7, flexShrink: 0 }}
          >
            <path d="M11.75 2.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm.75 2.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM4.25 13.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm.75 2.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM4.25 2.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm.75 2.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM5 5.5v5" />
            <path d="M5 5.5A3.5 3.5 0 0 0 8.5 9H10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "baseline" }}>
            <span style={{ color: "var(--color-ink-40)" }}>Branch</span>
            <strong style={{ color: "var(--color-ink-90)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "none" }}>{switching ? "…" : current}</strong>
          </span>
          {branches.length > 1 && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              style={{
                opacity: 0.5,
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
                flexShrink: 0,
              }}
            >
              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <span style={{ width: 1, background: "var(--color-rule)", flexShrink: 0 }} />

        <button
          type="button"
          onClick={downloadArchive}
          disabled={downloading}
          aria-label="Download entire repository"
          aria-busy={downloading}
          title="Download entire repository"
          style={{
            display: "flex",
            alignItems: "center",
            background: "none",
            border: "none",
            padding: "0 0.65rem",
            color: "var(--color-ink-70)",
            cursor: downloading ? "default" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (downloading) return;
            e.currentTarget.style.background = "var(--color-paper-alt)";
            e.currentTarget.style.color = "var(--color-ink-90)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "var(--color-ink-70)";
          }}
        >
          {downloading ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                flexShrink: 0,
                transformOrigin: "center",
                animation: "branch-dl-spin 0.7s linear infinite",
              }}
              aria-hidden="true"
            >
              {/* spinner: faint track + leading arc */}
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <style>{`@keyframes branch-dl-spin { to { transform: rotate(360deg); } }`}</style>
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              {/* download icon: arrow into tray */}
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8.53 10.78a.75.75 0 0 1-1.06 0L4.22 7.53a.75.75 0 0 1 1.06-1.06l1.97 1.97V1.75A.75.75 0 0 1 8 1z" />
              <path d="M2.5 9.75a.75.75 0 0 1 .75.75v2.25c0 .138.112.25.25.25h9a.25.25 0 0 0 .25-.25V10.5a.75.75 0 0 1 1.5 0v2.25A1.75 1.75 0 0 1 12.5 14.5h-9A1.75 1.75 0 0 1 1.75 12.75V10.5a.75.75 0 0 1 .75-.75z" />
            </svg>
          )}
        </button>
      </div>

      {open && branches.length > 1 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: "180px",
            background: "var(--color-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: "2px",
            boxShadow: "0 20px 40px rgba(15, 14, 11, 0.12)",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {branches.map((branch) => (
            <button
              key={branch}
              role="option"
              aria-selected={branch === current}
              onClick={() => switchBranch(branch)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                width: "100%",
                padding: "0.6rem 0.9rem",
                background: branch === current ? "var(--color-accent-tint)" : "transparent",
                border: "none",
                color: branch === current ? "var(--color-ink-90)" : "var(--color-ink-70)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                cursor: branch === current ? "default" : "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (branch !== current) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-paper-alt)";
              }}
              onMouseLeave={(e) => {
                if (branch !== current) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {branch === current && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ color: "var(--color-accent-ink)", flexShrink: 0 }}>
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {branch !== current && <span style={{ width: 10, flexShrink: 0 }} />}
              {branch}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
