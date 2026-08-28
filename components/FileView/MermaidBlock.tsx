"use client";

import { useId, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface Props {
  code: string;
}

let mermaidReady = false;

/**
 * Palette cycled across sequence-diagram actor boxes so each participant
 * is visually distinct. Kept warm and editorial — sits inside the paper
 * palette rather than fighting it. `bg` / `border` pairs are matched for
 * legibility of the actor label rendered inside the box.
 */
const ACTOR_PALETTE = [
  { bg: "#ffe08a", border: "#7a5300" }, // ochre
  { bg: "#b8d69a", border: "#3d5a28" }, // sage
  { bg: "#f2b5a8", border: "#7d2a1c" }, // coral
  { bg: "#9dc4e8", border: "#1f4574" }, // sky
  { bg: "#c6a6e8", border: "#432575" }, // lilac
  { bg: "#f4c980", border: "#6a3a10" }, // amber
  { bg: "#8fc9c1", border: "#1e4a45" }, // teal
] as const;

function colorizeActors(root: SVGElement | HTMLElement) {
  const rects = Array.from(root.querySelectorAll<SVGRectElement>("rect.actor"));
  // Match top and bottom bars for the same participant so each column
  // reads as a single colour top and bottom.
  const tops = rects.filter((r) => r.classList.contains("actor-top"));
  const bottoms = rects.filter((r) => r.classList.contains("actor-bottom"));
  const n = Math.max(tops.length, bottoms.length, rects.length);
  for (let i = 0; i < n; i++) {
    const swatch = ACTOR_PALETTE[i % ACTOR_PALETTE.length];
    for (const r of [tops[i], bottoms[i]]) {
      if (!r) continue;
      // Mermaid's compiled CSS wins over the SVG `fill` attribute — apply the
      // colour via inline style with !important so it survives cascade.
      r.style.setProperty("fill", swatch.bg, "important");
      r.style.setProperty("stroke", swatch.border, "important");
      r.style.setProperty("stroke-width", "1.5", "important");
    }
  }
  // If neither top nor bottom split matched, fall back to raw cycle
  if (tops.length === 0 && bottoms.length === 0) {
    rects.forEach((rect, i) => {
      const swatch = ACTOR_PALETTE[i % ACTOR_PALETTE.length];
      rect.style.setProperty("fill", swatch.bg, "important");
      rect.style.setProperty("stroke", swatch.border, "important");
      rect.style.setProperty("stroke-width", "1.5", "important");
    });
  }

  // Flowchart / graph nodes — one distinct colour per node so multi-node
  // flowcharts also read as colourful, not monochrome.
  const nodes = Array.from(root.querySelectorAll<SVGElement>(
    ".node .basic.label-container, .node rect, .node polygon, .node circle, .node ellipse"
  ));
  const seenParents = new WeakSet<Element>();
  let m = 0;
  for (const el of nodes) {
    const parent = el.closest(".node");
    if (!parent || seenParents.has(parent)) continue;
    seenParents.add(parent);
    const swatch = ACTOR_PALETTE[m % ACTOR_PALETTE.length];
    el.style.setProperty("fill", swatch.bg, "important");
    el.style.setProperty("stroke", swatch.border, "important");
    m++;
  }
}

export default function MermaidBlock({ code }: Props) {
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiagram, setShowDiagram] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    import("mermaid").then(({ default: mermaid }) => {
      if (!mermaidReady) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: 'var(--font-sans), "DM Sans", -apple-system, sans-serif',
            fontSize: "14px",
            // Primary — soft cream card, ink border
            primaryColor: "#fff7e0",
            primaryTextColor: "#1a1811",
            primaryBorderColor: "#7a5300",
            // Secondary — sage green
            secondaryColor: "#e0edd4",
            secondaryTextColor: "#2a3620",
            secondaryBorderColor: "#4d6b3a",
            // Tertiary — dusty rose
            tertiaryColor: "#f3dcd8",
            tertiaryTextColor: "#3a1e1a",
            tertiaryBorderColor: "#8a3b30",
            // Lines & notes
            lineColor: "#4a3d20",
            noteBkgColor: "#fff1a8",
            noteBorderColor: "#a17d1a",
            noteTextColor: "#3a2d05",
            edgeLabelBackground: "#f7f4ec",
            // Actors (sequence diagrams)
            actorBkg: "#fff7e0",
            actorBorder: "#7a5300",
            actorTextColor: "#1a1811",
            actorLineColor: "#a19070",
            signalColor: "#4a3d20",
            signalTextColor: "#1a1811",
            labelBoxBkgColor: "#dae7f5",
            labelBoxBorderColor: "#3a5c88",
            labelTextColor: "#0f1e33",
            loopTextColor: "#1a1811",
            activationBkgColor: "#e5d9f7",
            activationBorderColor: "#5a3d8a",
            sequenceNumberColor: "#f7f4ec",
            // Clusters / subgraphs
            clusterBkg: "#f2eadc",
            clusterBorder: "#8a7a55",
            // State/pie
            pie1: "#f4b301",
            pie2: "#5a8fbb",
            pie3: "#d67055",
            pie4: "#7ba15a",
            pie5: "#9273b7",
            pie6: "#c88a3a",
            pie7: "#4d6b3a",
            pie8: "#a04a3a",
          },
          flowchart: { curve: "basis", padding: 24, htmlLabels: true },
          sequence: { actorMargin: 60, boxMargin: 12, messageMargin: 40, noteMargin: 12 },
        });
        mermaidReady = true;
      }
      mermaid
        .render(diagramId, code)
        .then(({ svg }) => { if (!cancelled) setSvg(svg); })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram");
        });
    });

    return () => { cancelled = true; };
  }, [code, diagramId]);

  // After the SVG renders, colorize actor/node fills using the palette
  useEffect(() => {
    if (!svg || !frameRef.current) return;
    colorizeActors(frameRef.current);
  }, [svg]);

  // Escape closes fullscreen
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <div style={{ position: "relative", margin: "2rem 0" }}>
      <div style={{ position: "absolute", top: "0.6rem", right: "0.6rem", display: "flex", gap: "0.35rem", zIndex: 2 }}>
        {svg && showDiagram && (
          <button
            onClick={() => setZoomed(true)}
            title="Open fullscreen (click, then scroll to zoom, drag to pan)"
            style={iconBtnStyle}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M1 4V1h3M11 4V1H8M1 8v3h3M11 8v3H8" />
            </svg>
            Zoom
          </button>
        )}
        <button
          onClick={() => setShowDiagram((v) => !v)}
          title={showDiagram ? "Show source" : "Show diagram"}
          style={iconBtnStyle}
        >
          {showDiagram ? "{ } Source" : "◇ Diagram"}
        </button>
      </div>

      {showDiagram ? (
        svg ? (
          <div
            ref={frameRef}
            className="mermaid-frame"
            dangerouslySetInnerHTML={{ __html: svg }}
            onDoubleClick={() => setZoomed(true)}
            title="Double-click to open fullscreen"
            style={{
              overflowX: "auto",
              padding: "2rem 1.5rem 1.5rem",
              background: "var(--color-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: "2px",
              textAlign: "center",
              cursor: "zoom-in",
              boxShadow: "0 1px 0 var(--color-rule-soft) inset",
            }}
          />
        ) : error ? (
          <pre style={errorStyle}>Mermaid parse error:{"\n"}{error}</pre>
        ) : (
          <div style={loadingStyle}>Rendering diagram…</div>
        )
      ) : (
        <pre style={sourceStyle}><code>{code}</code></pre>
      )}

      {zoomed && svg && <ZoomOverlay svg={svg} onClose={() => setZoomed(false)} />}
    </div>
  );
}

function ZoomOverlay({ svg, onClose }: { svg: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // After the SVG is injected via dangerouslySetInnerHTML, coerce it to fill
  // the container. Mermaid sets fixed width/height attrs that keep it small.
  // Depend on `mounted` too — the ref only attaches on the second render.
  useEffect(() => {
    if (!mounted) return;
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxHeight = "80vh";
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (svgRef.current) colorizeActors(svgRef.current);
  }, [svg, mounted]);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => Math.min(6, Math.max(0.3, s * (1 + delta))));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY, tx, ty };
  }, [tx, ty]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setTx(start.current.tx + (e.clientX - start.current.x));
    setTy(start.current.ty + (e.clientY - start.current.y));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  if (!mounted) return null;

  const overlay = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 12, 8, 0.92)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: "1.25rem",
          left: "1.25rem",
          right: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(255,255,255,0.75)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.75rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>Diagram — scroll to zoom · drag to pan · esc to close</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setScale((s) => Math.max(0.3, s * 0.85))} style={hudBtn}>−</button>
          <button onClick={reset} style={hudBtn}>{Math.round(scale * 100)}%</button>
          <button onClick={() => setScale((s) => Math.min(6, s * 1.2))} style={hudBtn}>+</button>
          <button onClick={onClose} style={hudBtn}>✕</button>
        </div>
      </div>

      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <div
          ref={svgRef}
          className="mermaid-zoom-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: dragging.current ? "none" : "transform 0.05s linear",
            transformOrigin: "center center",
            background: "var(--color-paper)",
            padding: "2rem 2.5rem",
            borderRadius: "2px",
            boxShadow: "0 60px 120px rgba(0,0,0,0.5)",
            width: "min(88vw, 1400px)",
            maxWidth: "88vw",
            maxHeight: "84vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        />
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

const iconBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.3rem 0.6rem",
  fontSize: "0.7rem",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  letterSpacing: "0.06em",
  background: "var(--color-paper)",
  border: "1px solid var(--color-rule)",
  borderRadius: "2px",
  cursor: "pointer",
  color: "var(--color-ink-70)",
};

const hudBtn: React.CSSProperties = {
  minWidth: "2.5rem",
  padding: "0.35rem 0.75rem",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "2px",
  color: "rgba(255,255,255,0.85)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.75rem",
  cursor: "pointer",
  letterSpacing: "0.05em",
};

const errorStyle: React.CSSProperties = {
  color: "#8b2c1f",
  background: "#fbeae5",
  border: "1px solid #e8bfb7",
  borderRadius: "2px",
  padding: "1rem",
  fontSize: "0.8125rem",
  whiteSpace: "pre-wrap",
  margin: 0,
  fontFamily: "var(--font-mono)",
};

const loadingStyle: React.CSSProperties = {
  padding: "3rem 1.5rem",
  color: "var(--color-ink-40)",
  fontSize: "0.8125rem",
  fontFamily: "var(--font-sans)",
  letterSpacing: "0.06em",
  textAlign: "center",
  background: "var(--color-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: "2px",
};

const sourceStyle: React.CSSProperties = {
  background: "var(--color-ink-90)",
  color: "var(--color-paper)",
  border: "none",
  borderRadius: "2px",
  padding: "2.75rem 1.5rem 1.5rem",
  fontSize: "0.8125rem",
  overflowX: "auto",
  margin: 0,
  lineHeight: 1.7,
  fontFamily: "var(--font-mono)",
};
