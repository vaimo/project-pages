"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
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
        background: "var(--color-grey-900)",
        borderBottom: "none",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
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
          color: "rgba(255,255,255,0.7)",
        }}
        className="mobile-menu-btn"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect y="3" width="20" height="2" rx="1" />
          <rect y="9" width="20" height="2" rx="1" />
          <rect y="15" width="20" height="2" rx="1" />
        </svg>
      </button>

      <Image src="/vaimo-logo-white.png" alt="Vaimo" width={120} height={32} priority />

      <span
        style={{
          color: "rgba(255,255,255,0.3)",
          fontWeight: 300,
          fontSize: "1.25rem",
          userSelect: "none",
        }}
      >
        /
      </span>

      <span
        style={{
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          fontSize: "0.9375rem",
        }}
      >
        {siteTitle}
      </span>

      <div style={{ flex: 1 }} />

      {chatEnabled && <SectionTabs />}

      <BranchSwitcher />

      <button
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        style={{
          background: "none",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "4px",
          padding: "0.35rem 0.85rem",
          fontSize: "0.875rem",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </header>
  );
}
