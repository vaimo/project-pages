# Authentication

## Provider

**Shared passphrase per user group** via NextAuth.js `Credentials` provider. Any visitor who enters a correct passphrase is granted a session scoped to that group's accessible Git branches. There is no per-user identity — all users who know the same passphrase share the same access.

## How it works

Passphrases and permissions are declared in `projectpages.config`:

```yaml
userGroups:
  - name: vaimo
    passphrase: ""              # blank; the real one comes from env
  - name: client
    passphrase: ""

branches:
  - name: master
    userGroups: [vaimo, client]
  - name: internal
    userGroups: [vaimo]
```

At sign-in the app resolves the submitted passphrase to a user group, then exposes every branch that group is listed on:

```
User submits passphrase "abc123"
  └──▶ app resolves it to user group { name: "vaimo" }
         └──▶ accessible branches = [master, internal]
                └──▶ session JWT issued with:
                       userGroupName = "vaimo"
                       branchName = "master"       (first accessible branch)
                       accessibleBranches = [master, internal]
```

Once signed in the top-nav switcher lets the user hop between any of their accessible branches. The switcher is searchable and, with `discoverBranches: true`, auto-populates from the repo.

## Passphrase source (env override — recommended)

By default a passphrase is read from `projectpages.config` under `userGroups[].passphrase`. Because that file ships in the docs repository, it is not a secret-safe location. Prefer setting the real value in an environment variable:

```
PROJECTPAGES_PASSPHRASE_<GROUP>
```

The group name is upper-cased and any non-alphanumeric character becomes an underscore. Examples:

| Group | Env variable |
|---|---|
| `vaimo` | `PROJECTPAGES_PASSPHRASE_VAIMO` |
| `client` | `PROJECTPAGES_PASSPHRASE_CLIENT` |
| `external-partner` | `PROJECTPAGES_PASSPHRASE_EXTERNAL_PARTNER` |

**Precedence:** env value wins when set and non-empty; otherwise the config value is used unchanged. This means an accidental unset does not silently lock everyone out — the config value is still honoured.

Leave the config's `passphrase:` empty (or a placeholder) so committing the config never exposes a working secret.

## Session storage

Sessions use the **JWT strategy** (no database required). The token is stored in a secure, HTTP-only cookie and contains:

- `userGroupName` — the group the visitor authenticated as
- `branchName` — the currently-viewed branch
- `accessibleBranches` — the branches the group can switch between

Branch switches update `branchName` on the same token; the group and accessible-branches list stay pinned to whatever was resolved at sign-in.

## Session duration

Configured in `projectpages.config`:

```yaml
auth:
  sessionDurationDays: 7
```

Defaults to 7 days if omitted.

## Protected routes

All routes except `/api/auth/**` and `/auth/error` require a valid session. Unauthenticated requests are redirected to `/auth/signin`.

## Environment variables

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Random string used to sign and encrypt JWT tokens. Rotate this to invalidate all sessions. |
| `NEXTAUTH_URL` | Canonical URL of the deployment (e.g. `https://vaimopages.vercel.app`). Required by NextAuth for redirect construction. |
| `PROJECTPAGES_PASSPHRASE_<GROUP>` | Per-group passphrase override. See above. Recommended so real secrets never live in the docs repo. |
| `DEV_AUTH_BYPASS` | Set to `1` to skip the passphrase check entirely and log in as the first configured user group. **Development only — never set in production.** |

> The `AUTH_PASSPHRASE` environment variable used in earlier versions is no longer required. Passphrases are now defined per-user-group in `projectpages.config` and/or `PROJECTPAGES_PASSPHRASE_<GROUP>`.

## Security notes

- Passphrases are compared server-side only, inside the NextAuth credentials handler. They are never sent to the client.
- Prefer `PROJECTPAGES_PASSPHRASE_<GROUP>` for real values. Only put a plain-text passphrase in `projectpages.config` if you're comfortable with everyone with docs-repo access being able to read it.
- Rotating a passphrase (env var **or** config value) takes effect within the 60-second config cache window. Existing sessions remain valid until they expire naturally — the passphrase is only checked at sign-in, not per request.
- Rotating `NEXTAUTH_SECRET` invalidates **all** existing sessions immediately — users will need to re-enter their passphrase.
- `DEV_AUTH_BYPASS=1` accepts *any* input (including an empty string once the credentials handler is skipped upstream) as a valid login. It exists to speed up local iteration and must never be set on a public deployment.
