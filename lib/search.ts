import matter from "gray-matter";
import JSZip from "jszip";
import { getFilteredTree, downloadBranchZipball } from "./github";
import { prettyName } from "./nav";

export interface SearchDoc {
  path: string;
  title: string;
  description: string;
  tags: string[];
  /** Full stripped markdown body — kept untruncated so matches anywhere in the page are found. */
  body: string;
}

export interface SearchResult {
  path: string;
  title: string;
  tags: string[];
  matchedTag: string | null;
  /** Match-centered excerpt from whichever field (description or body) actually matched the query. */
  snippet: string;
}

const MD_EXTS = new Set(["md", "mdx"]);

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SNIPPET_RADIUS = 90;
const SNIPPET_MAX = 180;

/** Returns a window of `text` centered on the first match of `q`, or null if `q` isn't found. */
function centeredSnippet(text: string, q: string): string | null {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + q.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

// One in-memory index per branch, rebuilt from a single zipball fetch (same
// trick the "download archive" route uses to avoid one GitHub API call per
// file). Soft TTL mirrors the config cache; the webhook handler also clears
// it outright on push so content updates don't wait out the TTL. In-flight
// builds are shared so a burst of concurrent searches (cold cache / just
// after a TTL expiry) triggers one zipball download, not one per request.
const _cache = new Map<string, { docs: SearchDoc[]; fetchedAt: number }>();
const _inflight = new Map<string, Promise<SearchDoc[]>>();
const SEARCH_INDEX_TTL_MS = 60_000;

export function invalidateSearchIndexCache(): void {
  _cache.clear();
  _inflight.clear();
}

export async function getSearchIndex(branch: string): Promise<SearchDoc[]> {
  const cached = _cache.get(branch);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < SEARCH_INDEX_TTL_MS) {
    return cached.docs;
  }

  const inflight = _inflight.get(branch);
  if (inflight) return inflight;

  const build = (async () => {
    try {
      const { entries } = await getFilteredTree(branch);

      const raw = await downloadBranchZipball(branch);
      const zip = await JSZip.loadAsync(raw);
      const byPath = new Map<string, JSZip.JSZipObject>();
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        // GitHub wraps everything in a top-level "owner-repo-sha/" folder.
        const rel = entry.name.slice(entry.name.indexOf("/") + 1);
        byPath.set(rel, entry);
      }

      const docs = await Promise.all(
        entries.map(async (entry): Promise<SearchDoc> => {
          const fileName = entry.path.split("/").pop() ?? entry.path;
          const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
          const fallback: SearchDoc = {
            path: entry.path,
            title: prettyName(fileName),
            description: "",
            tags: [],
            body: "",
          };

          if (!MD_EXTS.has(ext)) return fallback;

          const zipEntry = byPath.get(entry.path);
          if (!zipEntry) return fallback;

          try {
            const raw = await zipEntry.async("string");
            const parsed = matter(raw);
            const title = typeof parsed.data.title === "string" && parsed.data.title.trim()
              ? parsed.data.title
              : fallback.title;
            const description = typeof parsed.data.description === "string" ? parsed.data.description : "";
            const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [];
            const body = stripMarkdown(parsed.content);
            return { path: entry.path, title, description, tags, body };
          } catch {
            return fallback;
          }
        }),
      );

      _cache.set(branch, { docs, fetchedAt: Date.now() });
      return docs;
    } finally {
      _inflight.delete(branch);
    }
  })();

  _inflight.set(branch, build);
  return build;
}

// Non-overlapping score bands: every tier outranks any possible combination
// of all lower tiers (a doc can contribute at most one hit per tier), so
// relevance strictly follows title > tag > path > description > body.
const SCORE = {
  titleExact: 1_000_000,
  titleStarts: 500_000,
  titleContains: 250_000,
  tag: 100_000,
  path: 10_000,
  description: 1_000,
  body: 100,
};

/** Relevance scoring: title > tags > path > description > body text. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { doc: SearchDoc; score: number; matchedTag: string | null; snippet: string }[] = [];

  for (const doc of docs) {
    const titleL = doc.title.toLowerCase();
    const pathL = doc.path.toLowerCase();
    const descL = doc.description.toLowerCase();
    const bodyL = doc.body.toLowerCase();

    let score = 0;
    let matchedTag: string | null = null;

    if (titleL === q) score += SCORE.titleExact;
    else if (titleL.startsWith(q)) score += SCORE.titleStarts;
    else if (titleL.includes(q)) score += SCORE.titleContains;

    const tagHit = doc.tags.find((t) => t.toLowerCase().includes(q));
    if (tagHit) {
      score += SCORE.tag;
      matchedTag = tagHit;
    }

    if (pathL.includes(q)) score += SCORE.path;

    const descMatches = descL.includes(q);
    if (descMatches) score += SCORE.description;

    const bodyMatches = bodyL.includes(q);
    if (bodyMatches) score += SCORE.body;

    if (score === 0) continue;

    // Prefer a snippet from whichever field actually matched, so a
    // body-only hit doesn't surface an unrelated, unhighlighted description.
    let snippet = "";
    if (descMatches) {
      snippet = centeredSnippet(doc.description, q) ?? truncate(doc.description, SNIPPET_MAX);
    } else {
      const bodySnippet = bodyMatches ? centeredSnippet(doc.body, q) : null;
      snippet = bodySnippet ?? truncate(doc.description, SNIPPET_MAX);
    }

    scored.push({ doc, score, matchedTag, snippet });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, matchedTag, snippet }) => ({
      path: doc.path,
      title: doc.title,
      tags: doc.tags,
      matchedTag,
      snippet,
    }));
}
