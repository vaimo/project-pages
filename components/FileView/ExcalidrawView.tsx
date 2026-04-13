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

/**
 * Files created on excalidraw.com store bound text elements (text inside
 * containers) with x:0, y:0, width:0, height:0. The renderer uses these
 * stored values directly, so the text ends up at canvas origin and is
 * invisible. We fix by computing each text element's height from its font
 * metrics and respecting verticalAlign (middle/top/bottom) to position it
 * correctly inside its container.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixBoundTextPositions(data: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements = (data.elements as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elMap = new Map<string, any>(elements.map(e => [e.id, e]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixed = elements.map((el: any) => {
    if (el.type === "text" && el.containerId) {
      const container = elMap.get(el.containerId);
      if (container) {
        const lineCount = String(el.text ?? "").split("\n").length;
        const textHeight = (el.fontSize ?? 20) * (el.lineHeight ?? 1.25) * lineCount;
        const verticalAlign = el.verticalAlign ?? "middle";

        let y: number;
        if (verticalAlign === "top") {
          y = container.y;
        } else if (verticalAlign === "bottom") {
          y = container.y + container.height - textHeight;
        } else {
          y = container.y + (container.height - textHeight) / 2;
        }

        return { ...el, x: container.x, y, width: container.width, height: textHeight };
      }
    }
    return el;
  });

  return { ...data, elements: fixed };
}

interface Props {
  rawContent: string;
  fileName: string;
}

export default function ExcalidrawView({ rawContent, fileName }: Props) {
  let data: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  try {
    const parsed = parseExcalidrawData(rawContent, fileName);
    data = fixBoundTextPositions(parsed);
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
