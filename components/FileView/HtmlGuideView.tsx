interface HtmlGuideViewProps {
  html: string;
  title: string;
}

/**
 * Renders a standalone HTML file (e.g. an interactive Contentful component
 * guide) in a sandboxed iframe via srcDoc. `allow-same-origin` is
 * deliberately omitted so the guide's scripts run with an opaque origin —
 * no access to this app's cookies, session, or parent DOM — while
 * `allow-scripts`/`allow-forms`/`allow-popups` keep the guide itself
 * interactive. `allow-top-navigation-by-user-activation` lets a click on one
 * of the guide's links open that page in this window (the guide's links
 * target `_top`, see `renderStandaloneHtml`); a script cannot navigate the
 * window on its own.
 */
export default function HtmlGuideView({ html, title }: HtmlGuideViewProps) {
  return (
    <iframe
      srcDoc={html}
      title={title}
      sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
      style={{
        width: "100%",
        minHeight: "80vh",
        border: "1px solid var(--color-grey-300)",
        borderRadius: "4px",
        background: "#fff",
        display: "block",
      }}
    />
  );
}
