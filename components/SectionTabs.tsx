"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB_DOCS_HREF = "/";
const TAB_CHAT_HREF = "/chat";

export default function SectionTabs() {
  const pathname = usePathname() ?? "/";
  const onChat = pathname === TAB_CHAT_HREF || pathname.startsWith(`${TAB_CHAT_HREF}/`);

  return (
    <div
      role="tablist"
      aria-label="Section"
      style={{
        display: "flex",
        alignItems: "stretch",
        height: "100%",
        marginRight: "0.5rem",
      }}
    >
      <Tab href={TAB_DOCS_HREF} label="Docs" active={!onChat} />
      <Tab href={TAB_CHAT_HREF} label="Chat" active={onChat} />
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      role="tab"
      aria-selected={active}
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0 0.9rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
        textDecoration: "none",
        borderBottom: active
          ? "2px solid var(--color-yellow)"
          : "2px solid transparent",
        marginBottom: "-1px",
        transition: "color 0.15s",
      }}
    >
      {label}
    </Link>
  );
}
