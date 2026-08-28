import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getFilteredTree, getFileContent } from "@/lib/github";
import { renderMarkdown, renderMarkdownWithFrontmatter, extractHeadings } from "@/lib/markdown";
import { convertDocxToHtml } from "@/lib/docx";
import { parse as parseCsv } from "csv-parse/sync";
import MarkdownView from "@/components/FileView/MarkdownView";
import CsvView from "@/components/FileView/CsvView";
import ImageView from "@/components/FileView/ImageView";
import SubtitleView from "@/components/FileView/SubtitleView";
import ExcalidrawView from "@/components/FileView/ExcalidrawView";
import DownloadButton from "@/components/DownloadButton";
import ExcalidrawPngButton from "@/components/ExcalidrawPngButton";
import CommentPanel from "@/components/Comments/CommentPanel";

type Props = { params: Promise<{ path: string[] }> };

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const MD_EXTS = new Set(["md", "mdx"]);
const DOCX_EXTS = new Set(["docx", "docm"]);
const SUBTITLE_EXTS = new Set(["vtt", "srt"]);

export default async function ViewPage({ params }: Props) {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) redirect("/auth/signin");

  const { path: segments } = await params;
  const filePath = segments.map(decodeURIComponent).join("/");

  // getFilteredTree is wrapped with React cache() — no extra network call vs layout
  const { entries, config } = await getFilteredTree(session.branchName);

  const entry = entries.find((e) => e.path === filePath);
  if (!entry) notFound();

  const file = await getFileContent(filePath, session.branchName);
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const fileName = filePath.split("/").pop() ?? filePath;
  const rawBuffer = Buffer.from(file.content, "base64");
  const isExcalidraw =
    fileName.endsWith(".excalidraw") ||
    fileName.endsWith(".excalidraw.md") ||
    fileName.endsWith(".excalidraw.json");

  const branchConfig = config.branches.find((b) => b.name === session.branchName);
  const commentsEnabled = branchConfig?.comments.enabled ?? false;
  let showComments = commentsEnabled;
  let hasRelativeImages = false;

  let rawContentForClient: string | null = null;
  let content: React.ReactNode;

  if (isExcalidraw) {
    rawContentForClient = rawBuffer.toString("utf-8");
    showComments = false;
    content = <ExcalidrawView rawContent={rawContentForClient} fileName={fileName} />;
  } else if (MD_EXTS.has(ext)) {
    const raw = rawBuffer.toString("utf-8");
    hasRelativeImages = /!\[[^\]]*\]\((?!https?:\/\/)(?!data:)[^\s)]+/.test(raw);
    const { html, frontmatter } = await renderMarkdownWithFrontmatter(raw, filePath);
    const headings = extractHeadings(html);
    content = <MarkdownView html={html} filePath={filePath} commentsEnabled={commentsEnabled} headings={headings} frontmatter={frontmatter} />;
  } else if (ext === "json") {
    const raw = rawBuffer.toString("utf-8");
    let formatted: string;
    try {
      formatted = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      formatted = raw;
    }
    const html = await renderMarkdown("```json\n" + formatted + "\n```", filePath);
    showComments = false;
    content = <MarkdownView html={html} filePath={filePath} commentsEnabled={false} />;
  } else if (ext === "csv") {
    const rows: Record<string, string>[] = parseCsv(rawBuffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      // Tolerate human-authored CSVs that don't quite hit RFC 4180:
      // stray quotes inside unquoted fields, and rows with the wrong
      // number of columns. One bad cell shouldn't 500 the whole page.
      relax_quotes: true,
      relax_column_count: true,
    });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    content = <CsvView headers={headers} rows={rows} />;
  } else if (DOCX_EXTS.has(ext)) {
    const html = await convertDocxToHtml(rawBuffer);
    content = <MarkdownView html={html} filePath={filePath} commentsEnabled={commentsEnabled} />;
  } else if (SUBTITLE_EXTS.has(ext)) {
    const raw = rawBuffer.toString("utf-8");
    content = <SubtitleView raw={raw} format={ext as "vtt" | "srt"} />;
  } else if (IMAGE_EXTS.has(ext)) {
    content = (
      <ImageView
        src={`/api/raw?path=${encodeURIComponent(filePath)}`}
        alt={fileName}
      />
    );
  } else {
    showComments = false;
    content = (
      <div
        style={{
          background: "var(--color-grey-100)",
          border: "1px solid var(--color-grey-300)",
          borderRadius: "6px",
          padding: "1.5rem",
          maxWidth: "480px",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, marginBottom: "0.25rem" }}>{fileName}</p>
        <p style={{ margin: "0 0 0.25rem", color: "var(--color-grey-700)", fontSize: "0.875rem" }}>
          {(file.size / 1024).toFixed(1)} KB
        </p>
        {file.lastCommit && (
          <p style={{ margin: "0 0 1rem", color: "var(--color-grey-700)", fontSize: "0.875rem" }}>
            Last updated {new Date(file.lastCommit.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {file.lastCommit.author}
          </p>
        )}
        <p style={{ margin: "0 0 1.5rem", color: "var(--color-grey-500)", fontSize: "0.875rem" }}>
          Preview not available for this file type.
        </p>
        <DownloadButton filePath={filePath} />
      </div>
    );
  }

  const breadcrumbs = filePath.split("/");

  return (
    <>
      <main style={{ flex: 1, padding: "1.5rem 2.5rem 4rem", overflowY: "auto", minWidth: 0 }}>
        {/* Top row — breadcrumb (left) + updated · author + downloads (right) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "2rem",
          }}
        >
          <nav
            aria-label="Breadcrumb"
            className="eyebrow"
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.4rem",
              fontSize: "0.625rem",
              minWidth: 0,
            }}
          >
            <span style={{ color: "var(--color-ink-70)" }}>Home</span>
            {breadcrumbs.map((part, i) => {
              const isLast = i === breadcrumbs.length - 1;
              const label = part.replace(/\.(md|mdx)$/i, "").split(/[_\-.]+/).filter(Boolean).map((w) => (/[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ color: "var(--color-rule)" }}>/</span>
                  <span style={{ color: isLast ? "var(--color-ink-90)" : "var(--color-ink-70)", fontWeight: isLast ? 600 : 500 }}>{label}</span>
                </span>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            {file.lastCommit && (
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.75rem",
                  color: "var(--color-ink-40)",
                  letterSpacing: "0.02em",
                }}
              >
                Updated {new Date(file.lastCommit.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                <span style={{ color: "var(--color-rule)", margin: "0 0.5rem" }}>·</span>
                <span style={{ color: "var(--color-ink-70)" }}>{file.lastCommit.author}</span>
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <DownloadButton filePath={filePath} />
              {isExcalidraw && rawContentForClient && (
                <ExcalidrawPngButton rawContent={rawContentForClient} fileName={fileName} />
              )}
              {hasRelativeImages && (
                <DownloadButton filePath={filePath} withMedia />
              )}
              {showComments && (
                <DownloadButton filePath={filePath} withComments label="Download with comments" />
              )}
            </div>
          </div>
        </div>

        {content}
      </main>

      {showComments && <CommentPanel filePath={filePath} />}
    </>
  );
}
