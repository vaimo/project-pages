# Deployment

## How auto-updates work

When someone pushes to the docs repository, the site automatically rebuilds:

1. GitHub sends a `push` webhook to `/api/webhook/github` on this app.
2. The handler verifies the request signature using `GITHUB_WEBHOOK_SECRET`.
3. It POSTs to `VERCEL_DEPLOY_HOOK_URL`, triggering a fresh Vercel deployment.

This means two things must be correctly configured for auto-updates to work: the GitHub webhook on the docs repository (pointing at this app's URL with the right secret), and the Vercel deploy hook URL stored as an environment variable. Both are covered in the [GitHub Webhook Setup](#github-webhook-setup) section below.

## Prerequisites

- A Vercel account connected to the `vaimo/project-pages` GitHub repository.
- A Supabase project (free tier is sufficient).
- A GitHub personal access token with read access to the docs repository. See [GitHub token setup](#github-token-setup) for the two supported token types and how to request approval in the Vaimo organisation.

## Local Development

```bash
cp .env.local.example .env.local
# fill in .env.local — see Environment Variables below
npm install
npm run dev
```

## Vercel Setup

1. Connect the `vaimo/project-pages` GitHub repo to a Vercel project.
2. Set all environment variables listed below under **Project → Settings → Environment Variables**.
3. The app builds on every push to `master` of the Project Pages repo.
4. It also builds when the docs repo receives a push (via the GitHub webhook → Vercel deploy hook).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DOCS_REPO` | Yes | `owner/repo` of the documentation repository (e.g. `vaimo/my-docs`). See below. |
| `CONFIG_BRANCH` | No | Comma-separated branch names to try when fetching `projectpages.config`. Defaults to `master,main`. |
| `GITHUB_TOKEN` | Yes | Personal access token with read access to `DOCS_REPO`. See [GitHub token setup](#github-token-setup). |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret shared with the GitHub webhook for signature validation |
| `NEXTAUTH_SECRET` | Yes | Random string for NextAuth JWT signing. Rotate to invalidate all sessions. |
| `NEXTAUTH_URL` | Yes | Canonical URL of the deployment (e.g. `https://vaimopages.vercel.app`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, never exposed to browser) |
| `VERCEL_DEPLOY_HOOK_URL` | Yes | Vercel deploy hook URL, called when docs repo receives a push |

---

### `DOCS_REPO`

This is the most important environment variable. It tells the app **which GitHub repository to use for all content**.

```
DOCS_REPO=vaimo/my-docs-repo
```

The value must be in `owner/repo` format. It controls three things:

1. **Where `projectpages.config` is read from** — the app fetches `projectpages.config` from the branch(es) listed in `CONFIG_BRANCH` (default: `master,main`), on every request (cached for 60 seconds).
2. **Where all file content is fetched from** — every file tree request, file view, image, and download is served from this repository, on the branch that matches the user's passphrase.
3. **What the `GITHUB_TOKEN` needs access to** — the token must have Contents: Read-only access to this exact repository.

If `DOCS_REPO` is not set when the app starts, all content requests will fail immediately. The app will render an error page and log a clear message to the server console. There is nothing inside `projectpages.config` that can override or substitute this value.

**One deployment = one repository.** If you need to serve a different knowledge-base repository, deploy a separate instance of the app with a different `DOCS_REPO` value.

---

### `CONFIG_BRANCH`

Comma-separated list of branch names the app will try, in order, when loading `projectpages.config` from the docs repository:

```
CONFIG_BRANCH=master,main
```

The app tries each branch left to right and uses the first one that returns the file successfully. If none of the listed branches contain the file, the app renders an error page.

**Default value:** `master,main` — covers both common default-branch naming conventions without any configuration needed.

**Why this matters:** `projectpages.config` only needs to live in one branch. All content branches (`release-docs`, feature branches, etc.) are served using the config fetched from whichever branch succeeds first here.

---

### Generating secrets

```bash
# GITHUB_WEBHOOK_SECRET
openssl rand -hex 32

# NEXTAUTH_SECRET
openssl rand -base64 32
```

### GitHub token setup

The `GITHUB_TOKEN` environment variable must hold a token with read access to `DOCS_REPO`. GitHub offers two token formats and either one works with Project Pages: a **fine-grained personal access token** (recommended) or a **classic personal access token**. The fine-grained token is scoped to a single repository with a minimal permission set; the classic token is faster to provision because it skips the Vaimo organisation approval step.

#### Option A — Fine-grained token (recommended)

A fine-grained token grants access to exactly one repository with exactly two read-only permissions, which is the principle of least privilege. In the Vaimo organisation, fine-grained tokens that target an organisation-owned repository must be approved by a GitHub organisation admin before the token becomes usable for that repository. The token is generated immediately, but its status stays **Pending** until an admin approves it. Plan for that delay when scheduling the deployment.

1. In GitHub, open the profile menu (top right) and go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
   - Direct URL: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Click **Generate new token** and fill in the form:
   - **Token name**: a descriptive identifier, e.g. `project-pages-access-to-<docs-repo>`.
   - **Resource owner**: select **vaimo**. This is what triggers the organisation approval flow.
   - **Expiration**: 366 days is the GitHub maximum. Set a calendar reminder to rotate before it lapses, since the site stops loading content the moment the token expires.
   - **Repository access**: choose **Only select repositories** and pick the single repository configured in `DOCS_REPO` (e.g. `vaimo/my-docs-repo`). Do not use *All repositories* or *Public repositories*.
3. Under **Permissions → Repository permissions**, click **Add permissions** and grant exactly these two:

   | Permission | Access |
   |---|---|
   | **Contents** | Read-only |
   | **Metadata** | Read-only (GitHub auto-selects this when any repository permission is granted) |

   Leave every other permission untouched. The app calls only `repos.getContent`, `git.getTree`, `git.getBlob`, and `repos.listCommits`, all of which are covered by Contents + Metadata read access.
4. Leave **Account permissions** empty.
5. Click **Generate token and request access**. GitHub creates the token in **Pending** state and notifies the Vaimo organisation admins.
6. Wait for an admin to approve the request. You will receive an email once approved, and the token's status changes from **Pending** to **Active** in your fine-grained tokens list.
7. After approval, open the token from the list and copy its value (`github_pat_...`). The value is shown only at copy time and cannot be retrieved later — if you lose it, regenerate the token.
8. Paste the value into Vercel as `GITHUB_TOKEN` and redeploy.

#### Option B — Classic token (no approval required)

A classic token authenticates as your user account directly, so it does not go through the organisation approval flow. The trade-off is that the `repo` scope it requires for private repository read access also covers every other private repository your account can read, so the token is broader than it needs to be. Use this option when you need to ship before an admin is available, then rotate to a fine-grained token once approval is in place.

1. In GitHub, open the profile menu (top right) and go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
   - Direct URL: [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token → Generate new token (classic)** and fill in the form:
   - **Note**: a description, e.g. `project-pages-access-to-<docs-repo>`.
   - **Expiration**: 90 days or longer. Set a calendar reminder to rotate.
   - **Select scopes**: tick only **`repo`**. This is the minimum scope GitHub offers for private repository read access via classic tokens.
3. Click **Generate token** at the bottom of the page.
4. Copy the token value (`ghp_...`) immediately. GitHub shows it once.
5. Paste the value into Vercel as `GITHUB_TOKEN` and redeploy.

The token is active the moment it is generated. No organisation approval is involved, because the token authenticates as your user account rather than as an organisation-scoped grant.

#### Which one should I use?

Choose the fine-grained token whenever the approval timeline allows. If you cannot wait for admin approval, deploy with a classic token first and replace it with a fine-grained token afterwards.

## GitHub Webhook Setup

The webhook tells this app whenever the docs repository is pushed so it can trigger a rebuild. Setup has two parts: creating a deploy hook in Vercel, then registering a webhook on the GitHub content repository.

### Part 1 — Create a Vercel deploy hook

1. Go to your Vercel project → **Settings → Git → Deploy Hooks**.
2. Enter a name (e.g. `github-content-push`) and set the branch to whatever the default branch of your Project Pages repo is (`main` or `master`).
3. Click **Create Hook** and copy the generated URL.
4. Add it as `VERCEL_DEPLOY_HOOK_URL` in **Vercel → Project → Settings → Environment Variables**.

### Part 2 — Register the webhook on the content repository

1. Go to the **docs repository** on GitHub.
2. Navigate to **Settings → Webhooks → Add webhook**.
3. Fill in each field as follows:

#### Payload URL

```
https://<your-vercel-domain>/api/webhook/github
```

Replace `<your-vercel-domain>` with the actual URL of your Project Pages deployment on Vercel (e.g. `https://project-pages-chi.vercel.app`). You can find this in your Vercel project dashboard.

#### Content type

Change the dropdown from the default `application/x-www-form-urlencoded` to **`application/json`**. This is required — the webhook handler parses the body as JSON and will reject payloads in any other format.

#### Secret

Paste the value of `GITHUB_WEBHOOK_SECRET` from your Vercel environment variables. If you haven't created one yet, generate it now:

```bash
openssl rand -hex 32
```

Set that value in two places: here in the GitHub webhook form, and as `GITHUB_WEBHOOK_SECRET` in **Vercel → Project → Settings → Environment Variables**. They must match exactly. The app uses this to verify every incoming request is genuinely from GitHub.

#### SSL verification

Leave **Enable SSL verification** selected (the default). Do not disable it.

#### Which events would you like to trigger this webhook?

Select **Just the push event**. The app reacts to pushes on any branch of the docs repository — it invalidates the config cache and triggers a Vercel redeploy so content stays fresh.

#### Active

Leave the **Active** checkbox ticked.

4. Click **Add webhook**. GitHub immediately sends a ping request — go to the webhook's **Recent Deliveries** tab and confirm there is a green tick. If you see a red cross, check that `GITHUB_WEBHOOK_SECRET` matches on both sides and that your Vercel deployment is live.

## Supabase Setup

Run the migrations in order in the **Supabase SQL editor**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_add_branch_to_comments.sql`

Credentials are in **Supabase → Project Settings → API**.

## Content Caching

GitHub API responses are cached in-memory for 60 seconds as a safety net between webhook-triggered rebuilds. The primary update mechanism is the webhook → Vercel redeploy, which clears all caches.

## Troubleshooting

### Build fails: `useSearchParams() should be wrapped in a suspense boundary`

Next.js 15 requires any component calling `useSearchParams()` to be a child of `<Suspense>`. Ensure `app/auth/signin/page.tsx` wraps the form component in `<Suspense>`.

### Sign-in redirects loop or sessions expire immediately

- Check that `NEXTAUTH_URL` exactly matches the URL being accessed (including `https://`).
- Check that `NEXTAUTH_SECRET` is set and non-empty. If rotated, all previous sessions are invalid.

### Content not updating after a push

1. Check the webhook delivery log in GitHub (**Settings → Webhooks → Recent Deliveries**).
2. Verify `GITHUB_WEBHOOK_SECRET` is identical in GitHub and Vercel.
3. Verify `VERCEL_DEPLOY_HOOK_URL` is set in Vercel (not just locally).
4. Check Vercel function logs (**Deployments → Functions**) for errors from `/api/webhook/github`.

### App shows "Unable to load content"

- Check server logs for a `[projectpages]` prefixed message — it will say exactly what is wrong.
- Most commonly: `DOCS_REPO` is not set, is set to an invalid format, or `GITHUB_TOKEN` lacks access.
- If the docs repo uses a non-standard default branch, set `CONFIG_BRANCH` to that branch name.

### GitHub API returns 401 or 404

- `GITHUB_TOKEN` has expired or was revoked. Generate a new one.
- Token does not have read access to `DOCS_REPO`.
- `DOCS_REPO` value is incorrect or the repository does not exist.

### Supabase comments not loading

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly.
- Ensure both migrations have been run.
- Check the Supabase dashboard logs for query errors.

### Passphrase accepted but wrong content shown

- Verify the `name` in `projectpages.config` exactly matches the Git branch name.
- Verify the branch exists in the docs repository.
- Check Vercel logs for GitHub API errors when fetching the tree.
