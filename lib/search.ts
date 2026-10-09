import matter from "gray-matter";
import JSZip from "jszip";
import { getFilteredTree, downloadBranchZipball } from "./github";
import { prettyName } from "./nav";

export interface SearchDoc {
  path: string;
  title: string;
  description: string;
  tags: string[];
  excerpt: string;
}

export interface SearchResult extends SearchDoc {
  matchedTag: string | null;
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

// One in-memory index per branch, rebuilt from a single zipball fetch (same
// trick the "download archive" route uses to avoid one GitHub API call per
// file). Soft TTL mirrors the config cache; the webhook handler also clears
// it outright on push so content updates don't wait out the TTL.
const _cache = new Map<string, { docs: SearchDoc[]; fetchedAt: number }>();
const SEARCH_INDEX_TTL_MS = 60_000;

export function invalidateSearchIndexCache(): void {
  _cache.clear();
}

export async function getSearchIndex(branch: string): Promise<SearchDoc[]> {
  const cached = _cache.get(branch);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < SEARCH_INDEX_TTL_MS) {
    return cached.docs;
  }

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
        excerpt: "",
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
        const excerpt = stripMarkdown(parsed.content).slice(0, 400);
        return { path: entry.path, title, description, tags, excerpt };
      } catch {
        return fallback;
      }
    }),
  );

  _cache.set(branch, { docs, fetchedAt: now });
  return docs;
}

/** Simple relevance scoring: title > tags > path > description > body excerpt. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { doc: SearchDoc; score: number; matchedTag: string | null }[] = [];

  for (const doc of docs) {
    const titleL = doc.title.toLowerCase();
    const pathL = doc.path.toLowerCase();
    const descL = doc.description.toLowerCase();
    const excerptL = doc.excerpt.toLowerCase();

    let score = 0;
    let matchedTag: string | null = null;

    if (titleL === q) score += 100;
    else if (titleL.startsWith(q)) score += 60;
    else if (titleL.includes(q)) score += 40;

    const tagHit = doc.tags.find((t) => t.toLowerCase().includes(q));
    if (tagHit) {
      score += 50;
      matchedTag = tagHit;
    }

    if (pathL.includes(q)) score += 20;
    if (descL.includes(q)) score += 15;
    if (excerptL.includes(q)) score += 5;

    if (score > 0) scored.push({ doc, score, matchedTag });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, matchedTag }) => ({ ...doc, matchedTag }));
}
