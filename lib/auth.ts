import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getAccessibleBranches } from "./config";
import { getConfig } from "./github";

const ENABLE_GOOGLE = process.env.ENABLE_GOOGLE_LOGIN === "true" || process.env.ENABLE_GOOGLE_LOGIN === "1";

/**
 * Resolves a user group's passphrase, preferring an environment variable
 * over whatever's in projectpages.config. This lets teams keep the config
 * file (which lives in the docs repository) secret-free and set the real
 * passphrase per environment.
 *
 * Env var name: PROJECTPAGES_PASSPHRASE_<GROUPNAME> — the group name is
 * upper-cased and any non-alphanumeric character becomes an underscore.
 * Examples:
 *   userGroup "vaimo"            → PROJECTPAGES_PASSPHRASE_VAIMO
 *   userGroup "external-partner" → PROJECTPAGES_PASSPHRASE_EXTERNAL_PARTNER
 *
 * Falls back to `configPassphrase` when the env var is unset — so an
 * accidental miss doesn't silently lock everyone out of the docs.
 */
function resolveGroupPassphrase(groupName: string, configPassphrase: string): string {
  const envKey = `PROJECTPAGES_PASSPHRASE_${groupName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const fromEnv = process.env[envKey];
  return typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : configPassphrase;
}

export async function buildAuthOptions(): Promise<NextAuthOptions> {
  let sessionMaxAge = 7 * 24 * 60 * 60; // default: 7 days in seconds

  try {
    const config = await getConfig();
    sessionMaxAge = config.auth.sessionDurationDays * 24 * 60 * 60;
  } catch {
    // If config isn't reachable at auth setup time, fall back to default
  }

  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
      strategy: "jwt",
      maxAge: sessionMaxAge,
    },
    pages: {
      signIn: "/auth/signin",
      error: "/auth/error",
    },
    callbacks: {
      // Called after sign in (before jwt callback). Enforce allowed domain and
      // attach branch mapping for Google-authenticated users.
      async signIn({ user, account, profile }) {
        if (account?.provider === "google" && ENABLE_GOOGLE) {
          const email = (user as any).email ?? (profile as any)?.email;
          const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
          if (!allowedDomain) {
            console.error("GOOGLE_ALLOWED_DOMAIN is not configured");
            return false;
          }
          if (!email || !email.toLowerCase().endsWith("@" + allowedDomain.toLowerCase())) {
            console.warn("Rejected Google sign-in for email outside allowed domain:", email);
            return false;
          }

          // Attach google id to the user object so jwt callback can persist it.
          (user as any).google_id = account.providerAccountId;

          // Google sign-in has no user-group concept of its own, so grant access
          // to every configured branch (declared + discovered) rather than
          // scoping to a single group. This mirrors what passphrase auth
          // resolves to whenever every branch maps to the same group(s).
          try {
            const cfg = await getConfig();
            const accessibleBranches = cfg.branches.map((b) => b.name);
            if (accessibleBranches.length === 0) {
              console.warn("No branches configured; rejecting Google sign-in");
              return false;
            }

            const preferred = process.env.GOOGLE_DEFAULT_BRANCH;
            (user as any).userGroupName = cfg.userGroups[0]?.name ?? "";
            (user as any).branchName =
              preferred && accessibleBranches.includes(preferred) ? preferred : accessibleBranches[0];
            (user as any).accessibleBranches = accessibleBranches;
          } catch (err) {
            console.warn("Unable to read project config to determine accessible branches for Google users:", err);
            return false;
          }
        }
        return true;
      },

      async jwt({ token, user, trigger, session }) {
        // Initial sign-in: copy user group data into the token
        if (user) {
          if ((user as any).userGroupName) token.userGroupName = (user as any).userGroupName;
          if ((user as any).branchName) token.branchName = (user as any).branchName;
          if ((user as any).accessibleBranches) token.accessibleBranches = (user as any).accessibleBranches;
          if ((user as any).google_id) token.google_id = (user as any).google_id;
          if ((user as any).email) token.email = (user as any).email;
        }
        // Branch switch: validate and apply the requested branch
        if (trigger === "update" && session?.branchName) {
          const accessible = token.accessibleBranches ?? [];
          if (accessible.includes(session.branchName)) {
            token.branchName = session.branchName;
          }
        }
        return token;
      },
      async session({ session, token }) {
        session.branchName = (token.branchName as string) ?? "";
        session.userGroupName = (token.userGroupName as string) ?? "";
        session.accessibleBranches = (token.accessibleBranches as string[]) ?? [];
        // Expose Google identity info if present
        (session as any).google_id = (token as any).google_id ?? null;
        (session as any).email = (token as any).email ?? session.user?.email ?? null;
        return session;
      },
    },
    providers: [
      CredentialsProvider({
        name: "Passphrase",
        credentials: {
          passphrase: { label: "Passphrase", type: "password" },
        },
        async authorize(credentials) {
          const bypass = process.env.DEV_AUTH_BYPASS === "1";
          if (!bypass && !credentials?.passphrase) return null;

          let config;
          try {
            config = await getConfig();
          } catch {
            throw new Error("Unable to load configuration");
          }

          const userGroup = bypass
            ? config.userGroups[0]
            : config.userGroups.find(
                (g) => resolveGroupPassphrase(g.name, g.passphrase) === credentials!.passphrase,
              );
          if (!userGroup) return null;

          const accessibleBranches = getAccessibleBranches(userGroup.name, config);
          if (accessibleBranches.length === 0) return null;

          return {
            id: userGroup.name,
            name: "Project Pages User",
            email: "user@projectpages",
            userGroupName: userGroup.name,
            branchName: accessibleBranches[0], // default to first accessible branch
            accessibleBranches,
          };
        },
      }),
      // Add Google provider only when enabled and credentials are provided
      ...(ENABLE_GOOGLE && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? [
            GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            }),
          ]
        : []),
    ],
  };
}
