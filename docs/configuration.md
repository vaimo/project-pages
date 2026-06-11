# `projectpages.config` Reference

This YAML file must exist at the root of your documentation repository in the branch(es) configured by `CONFIG_BRANCH` (default: `master,main`). It does **not** need to be present in every content branch — the app reads it from a single designated branch on every request (with a 60-second in-memory cache).

The repository itself is identified by the `DOCS_REPO` environment variable set in the Project Pages deployment — **not** by anything inside this config file. See [Deployment → DOCS_REPO](./deployment.md#docs_repo) for details.

A ready-to-copy template is provided at [`projectpages.config.example`](../projectpages.config.example) in this repository.

---

## Full Example

```yaml
site:
  title: "My Project Docs"
  description: "Internal docs"

auth:
  sessionDurationDays: 7

userGroups:
  - name: vaimo
    passphrase: "replace-with-secret"
  - name: client
    passphrase: "replace-with-another-secret"

branches:
  - name: master
    userGroups:
      - vaimo
      - client
    comments:
      enabled: false

  - name: client
    userGroups:
      - client
    comments:
      enabled: false

include:
  - "**/*.md"
  - "**/*.csv"
  - "**/*.docx"
  - "**/*.vtt"
  - "**/*.srt"

exclude:
  - "drafts/**"
  - ".github/**"

# Consumed by the LightRAG chat backend's indexing pipeline, NOT by Project
# Pages itself. Controls which files are ingested into the knowledge base.
indexing:
  include:
    - "**/*.md"
    - "**/*.csv"
  exclude:
    - "additional_info/**"
    - "presentations-and-workshops/**"
```

---

## Fields

### `site`

| Field | Required | Description |
|---|---|---|
| `site.title` | Yes | Displayed in the browser tab and top nav |
| `site.description` | No | Subtitle shown on the home/index page |

### `auth`

| Field | Required | Description |
|---|---|---|
| `auth.sessionDurationDays` | No | Session lifetime in days after a successful passphrase login. Defaults to `7`. |

### `userGroups`

Defines the audiences that can access this portal. At least one entry is required. Each group has a name and a passphrase — users who enter the passphrase are authenticated as that group.

| Field | Required | Description |
|---|---|---|
| `userGroups[].name` | Yes | Identifier for the group (referenced by branches) |
| `userGroups[].passphrase` | Yes | Plain-text passphrase that authenticates a user as this group |

Passphrases must be unique across all groups. Treat this file as a secret.

### `branches`

A list of Git branches that Project Pages can serve. At least one entry is required.

| Field | Required | Description |
|---|---|---|
| `branches[].name` | Yes | The Git branch name (must exist in the repository) |
| `branches[].userGroups` | Yes | List of user group names that can access this branch |
| `branches[].comments.enabled` | No | Whether inline comments are enabled for this branch. Defaults to `false`. |
| `branches[].chat.backendUrl` | No | Base URL of the LightRAG-compatible chat service indexed over this branch's content. When present, the **Chat** tab appears in the top nav while this branch is active. Omit to hide chat on this branch. See [Chat](#chat) below for the rationale. |

**How it works:** When a user logs in, the app identifies their group by passphrase, then finds all branches that list that group. The user lands on the first accessible branch. If multiple branches are accessible, a branch switcher appears in the top nav so they can move between them without logging out.

### `include`

Required. A list of glob patterns. Only files matching at least one pattern are shown. Image files (`.png`, `.jpg`, etc.) and subtitle files (`.vtt`, `.srt`) are automatically included when `features.images` is enabled.

### `exclude`

Optional. A list of glob patterns. Files matching any pattern are hidden, even if they matched `include`. Evaluated after `include`.

### `features`

| Field | Required | Description |
|---|---|---|
| `features.images` | No | Auto-include image files in the file tree. Defaults to `true`. |

### `chat`

Opt-in conversational interface over the documentation. When enabled, a **Chat** tab appears in the top nav alongside **Docs** — but only on branches that declare their own `chat.backendUrl`.

| Field | Required | Description |
|---|---|---|
| `chat.enabled` | No | Master switch. Set `true` to allow the chat tab anywhere. Defaults to `false`. |
| `chat.title` | No | Heading shown above the welcome message on the chat page. Defaults to "Chat with the documentation". |
| `chat.welcome` | No | First-time welcome text rendered above the composer. |
| `chat.userGroups` | No | List of user groups allowed to use the chat. Omit to allow every group that has branch access. |
| `chat.security.maxQueryChars` | No | Reject user messages longer than this. Defaults to `4000`. |
| `chat.security.maxHistoryTurns` | No | Truncate conversation history sent to the backend to the last N turns. Defaults to `10`. |
| `chat.security.rateLimit.perMinute` | No | Per-session messages allowed per minute. Defaults to `30`. |
| `chat.security.rateLimit.perHour` | No | Per-session messages allowed per hour. Defaults to `300`. |

**Why backend URLs live on branches, not on `chat`:** LightRAG cannot switch corpora per query — each running LightRAG process is bound to one indexed corpus. Branches are typically different views of the docs (internal vs client) and need different answers, so each branch points at its own LightRAG instance via `branches[].chat.backendUrl`. The Chat tab is shown only when the *current* branch has a URL set; switching to a branch without one hides the tab. See [Deployment → Chat backends](./deployment.md) for the operational side.

Shared chat settings (API key, query mode, language instruction, timeout) live in environment variables — see [Deployment → Environment Variables](./deployment.md#environment-variables).

### `indexing`

Controls which files the **LightRAG chat backend ingests into its knowledge
base**. This is a separate concern from the top-level `include`/`exclude`,
which govern what Project Pages *displays*:

| | `include` / `exclude` (top level) | `indexing.include` / `indexing.exclude` |
|---|---|---|
| Controls | What the docs site **shows** | What the chat backend **indexes** |
| Read by | Project Pages | The LightRAG refresh sidecar's `prepare_data.py` |
| If omitted | `include` is required | Falls back to the indexer's built-in default (root docs + its known content folders) |

Keeping them separate lets the two diverge — e.g. display a polished draft in
the docs site without indexing it, or index internal notes you don't surface
in the UI. Project Pages ignores the `indexing` key entirely (it isn't
validated), so adding it never affects the site.

| Field | Required | Description |
|---|---|---|
| `indexing.include` | No | Allowlist of gitignore-style globs. Only matching files are eligible to index. Omit to use the indexer's default set. |
| `indexing.exclude` | No | Denylist applied after `include`. Matching files are never indexed. |

**Resolution order** (per file): the indexer's always-skip rules first (VCS
internals, the config file, `*-condensed.md`, `*.log`), then the file must
match `include`, then it must not match `exclude`.

**Glob semantics** (gitignore / gitwildmatch):

| Pattern | Matches |
|---|---|
| `/*.md` | `.md` files in the repo **root only** (leading `/` anchors) |
| `**/*.md` | `.md` files at **any** depth |
| `folder/**` | everything under `folder/` (the whole subtree) |
| `folder/sub/**` | everything under just that subfolder |
| `**/*-DRAFT.md` | any file ending `-DRAFT.md`, anywhere |

**Common recipes:**

```yaml
# 1. Denylist — index everything, exclude two working folders
indexing:
  include: ["**/*.md", "**/*.csv"]
  exclude:
    - "additional_info/**"
    - "presentations-and-workshops/**"

# 2. Allowlist — index ONLY specific folders
indexing:
  include:
    - "/*.md"                 # root docs
    - "transcripts/**"
    - "deliverables/**"

# 3. Include a folder but carve out a subfolder inside it
indexing:
  include: ["**/*.md", "**/*.csv", "research/**"]
  exclude: ["research/raw-dumps/**"]   # keep the folder, drop one subtree

# 4. Index a folder except its drafts, by filename pattern
indexing:
  include: ["**/*.md"]
  exclude:
    - "**/*-DRAFT.md"
    - "**/_scratch/**"
```

**Live de-indexing:** because the sidecar diffs each run against the previously
indexed set, *adding* an exclude for content that was already indexed removes it
from the knowledge base on the next push — no manual cleanup. Likewise, widening
`include` indexes the newly-eligible files on the next push.

> Requires the LightRAG chat backend + refresh sidecar deployment (the
> `branches[].chat.backendUrl` target). Without it, this section is inert.

---

## Path Resolution Rules

These apply to the top-level `include` / `exclude` (what Project Pages displays).
The `indexing` section follows the same glob syntax — see [`indexing`](#indexing).

1. Patterns use standard glob syntax (same as `.gitignore`).
2. `include` is evaluated first — a file must match at least one pattern to be considered.
3. `exclude` is applied next — matching files are removed regardless of `include`.
4. Empty directories (after filtering) are not shown in the sidebar.

---

## Troubleshooting

- The file must be named exactly `projectpages.config` (no extension) and live at the repository root.
- `site.title`, at least one `include` pattern, at least one `userGroups` entry, and at least one `branches` entry are required.
- The file is parsed as YAML — check indentation and quoting if you see parse errors in Vercel logs.
- Passphrases are compared exactly (case-sensitive, whitespace-sensitive).
- The repository being read is determined entirely by the `DOCS_REPO` env var in the app — there is no `source.repo` field in this config.
