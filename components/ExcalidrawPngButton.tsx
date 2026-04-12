"use client";

import { parseExcalidrawData } from "@/components/FileView/ExcalidrawView";

interface Props {
  rawContent: string;
  fileName: string;
}

export default function ExcalidrawPngButton({ rawContent, fileName }: Props) {
  const handleDownload = async () => {
    let data: Record<string, unknown>;
    try {
      data = parseExcalidrawData(rawContent, fileName);
    } catch {
      console.error("Failed to parse Excalidraw data for PNG export");
      return;
    }

    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const blob = await exportToBlob({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: data.elements as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appState: { ...(data.appState as object), exportWithDarkMode: false } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      files: (data.files ?? null) as any,
      mimeType: "image/png",
    });

    const baseName = fileName.replace(/\.(excalidraw\.md|excalidraw\.json|excalidraw)$/, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = baseName + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.45rem 1rem",
        background: "var(--color-yellow)",
        color: "var(--color-grey-900)",
        border: "none",
        borderRadius: "4px",
        fontSize: "0.875rem",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 1v7.586l2.293-2.293 1.414 1.414L7 11.414l-3.707-3.707 1.414-1.414L7 8.586V1h0z" />
        <path d="M1 11h2v1h8v-1h2v2H1v-2z" />
      </svg>
      Download as PNG
    </button>
  );
}
