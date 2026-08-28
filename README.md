# Project Pages

A Next.js portal that turns a private GitHub repository into a clean, branded documentation site. Content is fetched live via the GitHub API. Access is controlled by passphrases — each user group can be granted access to one or more Git branches, so different audiences see different content from the same repository.

---

## How it works

1. You define Git branches in your docs repo (e.g. `master`, `client`), one per audience — or set `discoverBranches: true` and every branch is auto-exposed.
2. Each user group gets a passphrase. Passphrases can live in `projectpages.config`, or (recommended) in an environment variable named `PROJECTPAGES_PASSPHRASE_<GROUP>` so no secret ever ships in the docs repo.
3. A visitor enters their passphrase → the app resolves the user group → that group's accessible branches are exposed in a searchable top-nav switcher → the first branch's content is shown for the session.
4. Push to any branch → GitHub webhook fires → Vercel rebuilds → content is fresh.

```
docs-repo (GitHub)
  ├── master              ← full internal content
  ├── client              ← curated for the client
  └── projectpages.config ← user groups, branches, file filters
                            (passphrases can live in env instead)

Project Pages (Vercel)
  └── reads config → authenticates → serves the right branch per session
      └── Supabase: per-branch inline comments (optional)
```

---

## Features

- **Editorial UI** — warm cream paper, near-black ink, ochre accent. Fraunces (variable serif) + DM Sans + JetBrains Mono loaded via `next/font`. Split editorial sign-in cover, ink-on-paper top-nav masthead, sidebar that auto-expands and highlights the currently-viewed file.
- **Frontmatter rendering** — YAML frontmatter is parsed and rendered as an "At a glance" block above the content: serif title, italic description, metadata grid, tag chips, and full-width one-per-line sections for long arrays like `related` and `applies_to`. A duplicate `# Title` in the body is stripped when frontmatter carries the same title.
- **Filterable branch switcher** — search box with match highlighting, current branch pinned to the top, Enter selects the first match, Escape clears. Pairs with `discoverBranches: true` so the switcher can auto-list every branch on the repo.
- **Mermaid with zoom + colour** — fullscreen overlay via `createPortal` with wheel-zoom, drag-pan, HUD, and Escape-to-close. Participants in sequence diagrams and nodes in flowcharts are auto-cycled through a distinct colour palette so multi-actor diagrams read at a glance.

---

## Quick start (production)

```bash
cp .env.local.example .env.local
# fill in DOCS_REPO, GITHUB_TOKEN, NEXTAUTH_SECRET, NEXTAUTH_URL,
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_DEPLOY_HOOK_URL,
# GITHUB_WEBHOOK_SECRET
npm install
npm run dev
```

`DOCS_REPO` is the most critical variable — it tells the app which GitHub repository to load content from (e.g. `vaimo/my-docs-repo`). Everything else follows from it: config is read from that repo's default branch, and all file requests are served from whichever branch the user authenticates into. See [Deployment → DOCS_REPO](./docs/deployment.md#docs_repo) for the full explanation.

Then add a `projectpages.config` to your docs repository — copy [`projectpages.config.example`](./projectpages.config.example) as a starting point.

---

## Quick start (local, no config in the docs repository)

For local development you can skip the "config lives in the docs repo" round-trip entirely — point the app at a config file on disk and provide the passphrase via env:

```bash
cp .env.local.example .env.local
# add to .env.local:
#   DOCS_REPO=<your-org>/<your-docs-repo>
#   GITHUB_TOKEN=<a PAT with `repo` read scope>
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3000
#   PROJECTPAGES_LOCAL_CONFIG=/absolute/path/to/projectpages.config.local
#   PROJECTPAGES_PASSPHRASE_VAIMO=some-shared-secret

cp projectpages.config.example projectpages.config.local
# edit projectpages.config.local — leave the user group's passphrase
# empty (the env var wins), and set `discoverBranches: true` if you
# want every branch of your docs repo to appear in the switcher.

npm install
npm run dev
```

Content (file tree + Markdown bodies) still comes from GitHub via the API — only the config lookup is short-circuited. That means the docs repo stays clean (no `projectpages.config` committed) but you still need commits pushed to see them in the app.

`projectpages.config.local` is git-ignored in this repo (sibling of the local env file convention). Never commit it — it may hold real passphrases.

### Local-development environment variables

The full production list lives in [Deployment → Environment variables](./docs/deployment.md#environment-variables). These are the local-development toggles introduced alongside them:

| Variable | Purpose |
|---|---|
| `PROJECTPAGES_LOCAL_CONFIG` | Absolute path to a `projectpages.config`-shaped YAML file. When set, the app reads config from disk instead of the GitHub API — nothing needs to be committed to the docs repository. |
| `PROJECTPAGES_PASSPHRASE_<GROUP>` | Per-user-group passphrase override. Group name is upper-cased and non-alphanumerics become underscores — e.g. `vaimo` → `PROJECTPAGES_PASSPHRASE_VAIMO`, `external-partner` → `PROJECTPAGES_PASSPHRASE_EXTERNAL_PARTNER`. Wins over the config file when non-empty. Recommended so real secrets never live in the docs repo. |
| `DEV_AUTH_BYPASS` | Set to `1` to skip the passphrase check entirely and log in as the first user group. Development only — never set in production. |

### Auto-discover branches

Add a top-level flag to your `projectpages.config` (or `projectpages.config.local`):

```yaml
discoverBranches: true
```

When set, the config loader calls the GitHub `listBranches` API for `DOCS_REPO` and merges every branch into the branch list. Explicit `branches:` entries stay in place and act as templates for permissions/comments/chat; discovered branches inherit those settings from the first explicit entry. Fails soft — if the API call errors, the app falls back to the declared list.

Combined with the search-enabled top-nav switcher, this makes it easy to work across a repo with dozens of feature/chore branches without hand-listing each one.

---

## Documentation

| Topic | Description |
|---|---|
| [Architecture](./docs/architecture.md) | System diagram, repository relationship, branch-based content model, request flow |
| [Configuration](./docs/configuration.md) | `projectpages.config` field reference with examples |
| [Authentication](./docs/authentication.md) | Passphrase → branch resolution, JWT sessions, security notes |
| [Content Rendering](./docs/content-rendering.md) | File types, Markdown rendering, navigation layout |
| [Comments](./docs/comments.md) | Per-branch commenting, data model, download with comments |
| [API Routes](./docs/api.md) | All API endpoints with descriptions |
| [Deployment](./docs/deployment.md) | Vercel setup, environment variables, GitHub webhook, Supabase migrations, troubleshooting |
| [Design](./docs/design.md) | Vaimo brand tokens, typography, layout principles |
| [Project Structure](./docs/project-structure.md) | Directory layout and key file descriptions |
