"use client";

import { signOut } from "next-auth/react";
import BranchSwitcher from "./BranchSwitcher";
import SectionTabs from "./SectionTabs";

interface TopNavProps {
  siteTitle: string;
  onMenuToggle?: () => void;
  chatEnabled?: boolean;
}

export default function TopNav({ siteTitle, onMenuToggle, chatEnabled = false }: TopNavProps) {
  return (
    <header
      style={{
        height: "var(--nav-height)",
        background: "var(--color-paper)",
        borderBottom: "1px solid var(--color-rule)",
        display: "flex",
        alignItems: "center",
        padding: "0 1.75rem",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "saturate(140%) blur(8px)",
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        aria-label="Toggle navigation"
        style={{
          display: "none",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem",
          color: "var(--color-ink-70)",
        }}
        className="mobile-menu-btn"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect y="3" width="20" height="2" rx="1" />
          <rect y="9" width="20" height="2" rx="1" />
          <rect y="15" width="20" height="2" rx="1" />
        </svg>
      </button>

      {/* Monogram — V mark on an ochre disc */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
        <span
          aria-hidden
          style={{
            width: "34px",
            height: "34px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-ink-90)",
            color: "var(--color-paper)",
            borderRadius: "50%",
            fontFamily: "var(--font-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 20',
            fontWeight: 500,
            fontSize: "1.1rem",
            letterSpacing: "0",
            position: "relative",
          }}
        >
          V
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: "3px",
              right: "3px",
              width: "6px",
              height: "6px",
              background: "var(--color-accent)",
              borderRadius: "50%",
            }}
          />
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--color-ink-40)",
              marginBottom: "0.25rem",
            }}
          >
            Vaimo · Project Pages
          </span>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontVariationSettings: '"opsz" 36, "SOFT" 20',
              fontWeight: 500,
              fontSize: "1.05rem",
              color: "var(--color-ink-90)",
              letterSpacing: "-0.01em",
            }}
          >
            {siteTitle}
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {chatEnabled && <SectionTabs />}

      <BranchSwitcher />

      <button
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        style={{
          background: "transparent",
          border: "1px solid var(--color-rule)",
          borderRadius: "2px",
          padding: "0.45rem 0.95rem",
          fontSize: "0.75rem",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-ink-70)",
          cursor: "pointer",
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-ink-90)"; e.currentTarget.style.color = "var(--color-ink-90)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-rule)"; e.currentTarget.style.color = "var(--color-ink-70)"; }}
      >
        Sign out
      </button>
    </header>
  );
}
