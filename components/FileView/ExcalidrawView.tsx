"use client";

import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-grey-500)", fontSize: "0.875rem" }}>
        Loading diagram…
      </div>
    ),
  }
);

export function parseExcalidrawData(raw: string, fileName: string): Record<string, unknown> {
  if (fileName.endsWith(".excalidraw.md")) {
    const match = raw.match(/%%\s*\n#\s*Drawing\s*\n```(?:json)?\n([\s\S]*?)\n```\s*\n%%/);
    if (!match) throw new Error("Could not find Excalidraw JSON block in .excalidraw.md");
    return JSON.parse(match[1]);
  }
  return JSON.parse(raw);
}

interface Props {
  rawContent: string;
  fileName: string;
}

export default function ExcalidrawView({ rawContent, fileName }: Props) {
  let data: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  try {
    data = parseExcalidrawData(rawContent, fileName);
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  if (parseError) {
    return (
      <div style={{ padding: "1rem", background: "var(--color-grey-100)", border: "1px solid var(--color-grey-300)", borderRadius: "6px", color: "var(--color-grey-700)", fontSize: "0.875rem" }}>
        Failed to parse diagram: {parseError}
      </div>
    );
  }

  return (
    <div style={{
      height: "calc(100vh - var(--nav-height) - 180px)",
      minHeight: "400px",
      border: "1px solid var(--color-grey-200)",
      borderRadius: "6px",
      overflow: "hidden",
    }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Excalidraw initialData={data as any} viewModeEnabled zenModeEnabled />
    </div>
  );
}
