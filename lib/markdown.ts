import path from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Comment } from "./supabase";

export interface OutlineHeading { level: number; id: string; text: string; }

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

export function extractHeadings(html: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const regex = /<h([1-4])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = decodeEntities(match[3].replace(/<[^>]+>/g, "")).trim();
    if (text) headings.push({ level: parseInt(match[1], 10), id: match[2], text });
  }
  return headings;
}

/**
 * Rehype plugin: transforms ```mermaid code blocks into
 * <div class="mermaid-placeholder" data-mermaid="...urlencoded...">
 * BEFORE rehype-highlight sees them, so they are never syntax-highlighted
 * and are easy to detect client-side.
 */
function rehypeMermaid() {
  return (tree: any) => {
    visit(tree, "element", (node: any, index: any, parent: any) => {
      if (!parent || index == null) return;
      if (node.tagName !== "pre" || node.children?.length !== 1) return;

      const codeEl = node.children[0];
      if (codeEl?.tagName !== "code") return;

      const classes: string[] = (codeEl.properties?.className as string[]) ?? [];
      if (!classes.includes("language-mermaid")) return;

      const code: string = (codeEl.children ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.value as string)
        .join("");

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["mermaid-placeholder"],
          "data-mermaid": encodeURIComponent(code),
        },
        children: [],
      };
    });
  };
}

/**
 * Rehype plugin: rewrites relative image src attributes to /api/raw?path=...
 * so images stored alongside the markdown file in the GitHub repo load correctly.
 */
function rehypeRewriteImages(docFilePath: string) {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "img") return;
      const src: string = node.properties?.src ?? "";
      if (!src) return;
      // Leave external URLs, data URIs, and server-absolute paths unchanged
      if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:") ||
        src.startsWith("/")
      ) return;

      const docDir = docFilePath.includes("/")
        ? docFilePath.slice(0, docFilePath.lastIndexOf("/"))
        : "";
      // path.posix.resolve handles ./, ../, and bare relative paths
      const resolved = path.posix.resolve("/" + docDir, src); // e.g. "/docs/folder/images/pic.png"
      const repoRelative = resolved.slice(1); // strip leading "/"
      node.properties.src = `/api/raw?path=${encodeURIComponent(repoRelative)}`;
    });
  };
}

export interface RenderMarkdownOptions {
  /**
   * If true, raw HTML embedded in the markdown is discarded instead of passed
   * through. Use for any content not authored by a trusted source — including
   * chat answers, where the LLM could be coaxed into emitting <script> etc.
   */
  safe?: boolean;
}

export async function renderMarkdown(
  raw: string,
  filePath?: string,
  options?: RenderMarkdownOptions,
): Promise<string> {
  const allowDangerousHtml = options?.safe !== true;
  const pipeline = remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml })
    .use(rehypeMermaid)
    .use(rehypeSlug);

  if (filePath) pipeline.use(rehypeRewriteImages, filePath);

  const result = await pipeline
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml })
    .process(raw);

  return result.toString();
}

/**
 * Generates a plain-text / markdown version of a file with comments
 * appended as footnotes. Used for the "Download with comments" endpoint.
 */
export function buildAnnotatedMarkdown(rawContent: string, comments: Comment[]): string {
  if (!comments.length) return rawContent;

  // Group top-level comments and their replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => !!c.parent_id);

  const threads = topLevel.map((c, idx) => ({
    ref: idx + 1,
    comment: c,
    replies: replies.filter((r) => r.parent_id === c.id),
  }));

  const footnotes = threads
    .map(({ ref, comment, replies: rs }) => {
      const anchor = comment.anchor ? `**On:** \`${comment.anchor}\`` : "**On:** (whole file)";
      const date = new Date(comment.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const header = `[${ref}] ${anchor}\n    **${comment.author_name}** — ${date}\n    ${comment.body}`;
      const replyLines = rs
        .map((r) => {
          const rDate = new Date(r.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          return `\n\n    ↳ **${r.author_name}** — ${rDate}\n      ${r.body}`;
        })
        .join("");
      return header + replyLines;
    })
    .join("\n\n");

  return `${rawContent}\n\n---\n\n## Comments\n\n${footnotes}\n`;
}
