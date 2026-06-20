import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getAccessibleBranches } from "./config";
import { getConfig } from "./github";

const ENABLE_GOOGLE = process.env.ENABLE_GOOGLE_LOGIN === "true" || process.env.ENABLE_GOOGLE_LOGIN === "1";

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

          // Map Google users to a branch. Use GOOGLE_DEFAULT_BRANCH if set, otherwise
          // fall back to the first branch from projectpages.config.
          try {
            const cfg = await getConfig();
            const defaultBranch = process.env.GOOGLE_DEFAULT_BRANCH ?? cfg.branches[0]?.name;
            if (defaultBranch) {
              (user as any).branchName = defaultBranch;
              (user as any).accessibleBranches = [defaultBranch];
            }
          } catch (err) {
            console.warn("Unable to read project config to determine default branch for Google users:", err);
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
          if (!credentials?.passphrase) return null;

          let config;
          try {
            config = await getConfig();
          } catch {
            throw new Error("Unable to load configuration");
          }

          const userGroup = config.userGroups.find(
            (g) => g.passphrase === credentials.passphrase
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
