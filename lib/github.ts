import { Octokit } from "@octokit/rest";
import { cache } from "react";
import { parseConfig, filterPaths, type ParsedConfig } from "./config";

let _octokit: Octokit | null = null;

function octokit(): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _octokit;
}

/** Splits "owner/repo" into { owner, repo }. Throws if DOCS_REPO is unset. */
function getDocsRepo(): { owner: string; repo: string } {
  const docsRepo = process.env.DOCS_REPO;
  if (!docsRepo) {
    console.error("[projectpages] DOCS_REPO environment variable is not set. The app cannot load any content without it.");
    throw new Error("DOCS_REPO is not configured");
  }
  const [owner, name] = docsRepo.split("/");
  if (!owner || !name) {
    console.error(`[projectpages] DOCS_REPO value "${docsRepo}" is not valid. Expected format: owner/repo`);
    throw new Error("DOCS_REPO is misconfigured");
  }
  return { owner, repo: name };
}

// ── Config ────────────────────────────────────────────────────────────────

let _configCache: { config: ParsedConfig; fetchedAt: number } | null = null;
const CONFIG_TTL_MS = 60_000; // 1 minute soft-cache between webhook-triggered rebuilds

export async function getConfig(): Promise<ParsedConfig> {
  const now = Date.now();
  if (_configCache && now - _configCache.fetchedAt < CONFIG_TTL_MS) {
    return _configCache.config;
  }

  const { owner, repo } = getDocsRepo();

  const configBranchEnv = process.env.CONFIG_BRANCH ?? "master,main";
  const branches = configBranchEnv.split(",").map((b) => b.trim()).filter(Boolean);

  let lastError: unknown;
  for (const branch of branches) {
    try {
      const { data } = await octokit().repos.getContent({
        owner,
        repo,
        path: "projectpages.config",
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== "file") continue;

      const config = parseConfig(Buffer.from(data.content, "base64").toString("utf-8"));
      _configCache = { config, fetchedAt: now };
      return config;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("projectpages.config not found in any configured branch");
}

/** Invalidate the in-memory config cache (called by the webhook handler). */
export function invalidateConfigCache(): void {
  _configCache = null;
}

// ── File tree ─────────────────────────────────────────────────────────────

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

export const getFilteredTree = cache(async (branch: string): Promise<{ entries: TreeEntry[]; config: ParsedConfig }> => {
  const config = await getConfig();
  const { owner, repo } = getDocsRepo();

  const { data } = await octokit().git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });

  const allPaths = (data.tree as TreeEntry[])
    .filter((e) => e.type === "blob")
    .map((e) => e.path);

  const allowed = new Set(filterPaths(allPaths, config));

  const entries = (data.tree as TreeEntry[]).filter(
    (e) => e.type === "blob" && allowed.has(e.path)
  );

  return { entries, config };
});

// ── File content ──────────────────────────────────────────────────────────

export interface FileContent {
  path: string;
  content: string;       // base64-encoded
  encoding: "base64";
  size: number;
  sha: string;
  lastCommit: {
    message: string;
    date: string;
    author: string;
  } | null;
}

export async function getFileContent(filePath: string, branch: string): Promise<FileContent> {
  const { owner, repo } = getDocsRepo();

  const { data } = await octokit().repos.getContent({
    owner,
    repo,
    path: filePath,
    ref: branch,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`${filePath} is not a file`);
  }

  // For files >1MB, repos.getContent returns empty content — fall back to the blob API
  let content = data.content;
  if (!content || (data as { encoding?: string }).encoding === "none") {
    const blob = await octokit().git.getBlob({ owner, repo, file_sha: data.sha });
    content = blob.data.content;
  }

  // Fetch the most recent commit that touched this file
  let lastCommit: FileContent["lastCommit"] = null;
  try {
    const commits = await octokit().repos.listCommits({
      owner,
      repo,
      path: filePath,
      sha: branch,
      per_page: 1,
    });
    if (commits.data.length > 0) {
      const c = commits.data[0];
      lastCommit = {
        message: c.commit.message.split("\n")[0], // first line only
        date: c.commit.author?.date ?? "",
        author: c.commit.author?.name ?? "",
      };
    }
  } catch {
    // non-fatal
  }

  return {
    path: data.path,
    content,
    encoding: "base64",
    size: data.size,
    sha: data.sha,
    lastCommit,
  };
}

/** Returns raw binary Buffer for a file — used for downloads. */
export async function getRawFileBuffer(filePath: string, branch: string): Promise<{ buffer: Buffer; name: string }> {
  const file = await getFileContent(filePath, branch);
  const buffer = Buffer.from(file.content, "base64");
  const name = filePath.split("/").pop() ?? filePath;
  return { buffer, name };
}

/** Returns the docs repo name (without the owner) — used to name downloads. */
export function getDocsRepoName(): string {
  return getDocsRepo().repo;
}

/**
 * Downloads the full Git archive (zipball) for a branch in a single GitHub API
 * call. GitHub pre-generates these per commit, so this is fast and always
 * matches the branch's current head. The returned bytes include GitHub's
 * top-level "owner-repo-sha/" wrapper folder — callers strip and re-pack.
 */
export async function downloadBranchZipball(branch: string): Promise<Buffer> {
  const { owner, repo } = getDocsRepo();
  const res = await octokit().repos.downloadZipballArchive({ owner, repo, ref: branch });
  return Buffer.from(res.data as ArrayBuffer);
}
