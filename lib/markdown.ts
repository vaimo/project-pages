import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import mime from "mime";
import { signRawAssetToken } from "./rawAssetToken";
import { getRawFileBuffer } from "./github";
import type { Comment } from "./supabase";

export interface OutlineHeading { level: number; id: string; text: string; }
export type Frontmatter = Record<string, unknown>;

export interface RenderedMarkdown {
  html: string;
  frontmatter: Frontmatter | null;
}

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

// Media resources — hand-tested and confirmed to fetch successfully (200)
// but never actually render in a sandboxed-without-allow-same-origin iframe,
// the same way external scripts fetch but never execute. Inlined as data:
// URIs instead, which sidesteps the restriction entirely (no edge case left
// to hit, unlike a token URL that merely *should* work).
const DATA_URI_ATTR_BY_TAG: Record<string, string[]> = {
  img: ["src"],
  source: ["src"],
  audio: ["src"],
  video: ["src", "poster"],
};

// Resources with no reasonable way to inline (a nested page, a plugin
// object) stay on signed token URLs as a best effort — untested edge case,
// but low-impact for these guide files, which don't appear to use them.
const ASSET_ATTR_BY_TAG: Record<string, string[]> = {
  iframe: ["src"],
  embed: ["src"],
  object: ["data"],
};

function isExternalOrSpecialUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("#") ||
    url.startsWith("//") ||
    url.startsWith("/")
  );
}

function linkRel(node: any): string[] {
  const rel = node.properties?.rel;
  if (Array.isArray(rel)) return rel;
  return rel ? [rel] : [];
}

const IMAGE_PATH_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

async function toDataUri(repoRelative: string, branch: string): Promise<string | null> {
  try {
    const { buffer } = await getRawFileBuffer(repoRelative, branch);
    const type = mime.getType(repoRelative) ?? "application/octet-stream";
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Some guides embed their own structured data in a
 * `<script type="application/json">` tag (screenshot paths, hotspot
 * coordinates, etc.) that their own script reads and turns into DOM —
 * relative image paths in there are invisible to the HTML-attribute rewrite
 * pass above. Recursively rewrites any string value that looks like a
 * relative image path, regardless of which key it's under, so this
 * generalizes across guides without needing to know their JSON schema.
 */
async function rewriteImagePathsInJson(
  value: unknown,
  resolveRepoPath: (v: string) => string,
  branch: string,
): Promise<unknown> {
  if (typeof value === "string") {
    if (!IMAGE_PATH_RE.test(value) || isExternalOrSpecialUrl(value)) return value;
    const dataUri = await toDataUri(resolveRepoPath(value), branch);
    return dataUri ?? value;
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => rewriteImagePathsInJson(v, resolveRepoPath, branch)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await rewriteImagePathsInJson(v, resolveRepoPath, branch)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Rehype plugin: prepares a standalone HTML file for sandboxed iframe
 * embedding (no `allow-same-origin`, so the document has an opaque origin).
 * Hand-testing against this exact setup (sandbox="allow-scripts ..." with no
 * allow-same-origin) found that NEITHER external stylesheets NOR external
 * scripts work there: a `<link rel="stylesheet">` blocks the document's
 * render indefinitely, and a `<script src>` loads over the network (200 OK)
 * but silently never executes. Inline `<style>`/`<script>` content works
 * fine in both cases, so:
 *
 * - Same-repo `<link rel="stylesheet">` and `<script src>` tags are inlined
 *   with their fetched file content instead of referencing a URL.
 * - Media (img/source/audio/video) is hand-tested to fetch fine (200) but
 *   never actually paint in this sandbox either — inlined as base64 `data:`
 *   URIs, including relative image paths found inside a
 *   `<script type="application/json">` data island (some guides render
 *   themselves from inline JSON rather than plain HTML `<img>` tags).
 * - Remaining relative asset URLs (iframe/embed/object, plus any
 *   link/script that couldn't be inlined) fall back to signed
 *   /api/raw?path=...&branch=...&token=... URLs — a token standing in for
 *   the session cookie, which the iframe's opaque origin prevents the
 *   browser from sending. Untested for this restriction; low-impact if it
 *   turns out to apply here too, since these guides don't appear to use them.
 */
function rehypeRewriteAssetUrls(docFilePath: string, branch: string) {
  return async (tree: any) => {
    const docDir = docFilePath.includes("/")
      ? docFilePath.slice(0, docFilePath.lastIndexOf("/"))
      : "";
    const resolveRepoPath = (value: string) => path.posix.resolve("/" + docDir, value).slice(1);

    const inlineable: { node: any; url: string; as: "style" | "script" }[] = [];
    visit(tree, "element", (node: any) => {
      if (node.tagName === "link" && linkRel(node).includes("stylesheet")) {
        const href: string = node.properties?.href ?? "";
        if (href && !isExternalOrSpecialUrl(href)) inlineable.push({ node, url: href, as: "style" });
      } else if (node.tagName === "script") {
        const src: string = node.properties?.src ?? "";
        if (src && !isExternalOrSpecialUrl(src)) inlineable.push({ node, url: src, as: "script" });
      }
    });

    for (const { node, url, as } of inlineable) {
      const repoRelative = resolveRepoPath(url);
      try {
        const { buffer } = await getRawFileBuffer(repoRelative, branch);
        const text = buffer.toString("utf-8");
        if (as === "style") {
          node.tagName = "style";
          node.properties = {};
        } else {
          delete node.properties.src;
        }
        node.children = [{ type: "text", value: text }];
      } catch {
        // Leave the original tag in place — the generic rewrite pass below
        // will still point it at a (possibly non-functional) URL rather
        // than silently dropping the reference.
      }
    }

    const mediaNodes: { node: any; attr: string; value: string }[] = [];
    visit(tree, "element", (node: any) => {
      const attrs = DATA_URI_ATTR_BY_TAG[node.tagName];
      if (!attrs) return;
      for (const attr of attrs) {
        const value: string = node.properties?.[attr] ?? "";
        if (!value || isExternalOrSpecialUrl(value)) continue;
        mediaNodes.push({ node, attr, value });
      }
    });
    await Promise.all(
      mediaNodes.map(async ({ node, attr, value }) => {
        const dataUri = await toDataUri(resolveRepoPath(value), branch);
        if (dataUri) node.properties[attr] = dataUri;
      }),
    );

    visit(tree, "element", (node: any) => {
      const attrs = ASSET_ATTR_BY_TAG[node.tagName];
      if (!attrs) return;
      for (const attr of attrs) {
        const value: string = node.properties?.[attr] ?? "";
        if (!value || isExternalOrSpecialUrl(value)) continue;

        const repoRelative = resolveRepoPath(value);
        const token = signRawAssetToken(repoRelative, branch);
        node.properties[attr] =
          `/api/raw?path=${encodeURIComponent(repoRelative)}&branch=${encodeURIComponent(branch)}&token=${token}`;
      }
    });

    const jsonDataNodes: any[] = [];
    visit(tree, "element", (node: any) => {
      if (node.tagName === "script" && node.properties?.type === "application/json") jsonDataNodes.push(node);
    });
    for (const node of jsonDataNodes) {
      const text = (node.children ?? []).map((c: any) => c.value ?? "").join("");
      if (!text.trim()) continue;
      try {
        const data = JSON.parse(text);
        const rewritten = await rewriteImagePathsInJson(data, resolveRepoPath, branch);
        node.children = [{ type: "text", value: JSON.stringify(rewritten) }];
      } catch {
        // Not valid JSON — leave it untouched.
      }
    }
  };
}

/**
 * Rehype plugin: makes a standalone HTML file's links open in the parent
 * window. A srcDoc iframe has no URL of its own, so relative hrefs already
 * resolve against the parent page (`index.html` → `/view/<dir>/index.html`).
 * But a click navigates the sandboxed frame itself, where the app can't load,
 * and the frame goes blank. A `<base target="_top">` sends every link to the
 * parent window instead, including links a guide's script builds at runtime,
 * which no server-side href rewrite would see. Links with their own `target`
 * (e.g. `_blank`) keep it. Needs `allow-top-navigation-by-user-activation`
 * on the iframe sandbox.
 */
function rehypeOpenLinksInParent() {
  return (tree: any) => {
    let head: any = null;
    let base: any = null;
    visit(tree, "element", (node: any) => {
      if (node.tagName === "head" && !head) head = node;
      if (node.tagName === "base" && !base) base = node;
    });
    if (base) {
      if (!base.properties?.target) base.properties = { ...base.properties, target: "_top" };
      return;
    }
    if (!head) return;
    head.children = [
      { type: "element", tagName: "base", properties: { target: "_top" }, children: [] },
      ...(head.children ?? []),
    ];
  };
}

/**
 * Renders a standalone HTML file (e.g. an interactive content guide checked
 * into the docs repo) for sandboxed iframe embedding: parses it, rewrites
 * relative asset URLs to signed /api/raw URLs, points its links at the parent
 * window, and stringifies it back out.
 * Script/style content is left untouched — only tag attribute URLs are rewritten.
 */
export async function renderStandaloneHtml(raw: string, filePath: string, branch: string): Promise<string> {
  const file = await unified()
    .use(rehypeParse, { fragment: false })
    .use(rehypeRewriteAssetUrls, filePath, branch)
    .use(rehypeOpenLinksInParent)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(raw);
  return file.toString();
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
  return (await renderMarkdownWithFrontmatter(raw, filePath, options)).html;
}

export async function renderMarkdownWithFrontmatter(
  raw: string,
  filePath?: string,
  options?: RenderMarkdownOptions,
): Promise<RenderedMarkdown> {
  const allowDangerousHtml = options?.safe !== true;

  let body = raw;
  let frontmatter: Frontmatter | null = null;
  try {
    const parsed = matter(raw);
    body = parsed.content;
    if (parsed.data && Object.keys(parsed.data).length > 0) {
      frontmatter = parsed.data as Frontmatter;
    }
  } catch {
    body = raw;
  }

  // When the frontmatter provides a title, strip a leading H1 from the body if
  // it matches (case-insensitively, ignoring whitespace) — avoids the duplicate
  // "Title / Title" that most feature-overview docs would otherwise render.
  if (frontmatter && typeof frontmatter.title === "string") {
    const fmTitle = frontmatter.title.trim().toLowerCase();
    body = body.replace(/^\s*#\s+(.+?)\s*$/m, (match, heading: string) => {
      return heading.trim().toLowerCase() === fmTitle ? "" : match;
    });
  }

  const pipeline = remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml })
    .use(rehypeMermaid)
    .use(rehypeSlug);

  if (filePath) pipeline.use(rehypeRewriteImages, filePath);

  const result = await pipeline
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml })
    .process(body);

  return { html: result.toString(), frontmatter };
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
