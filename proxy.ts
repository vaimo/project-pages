export { default as proxy } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     *   - /auth/* (sign-in, error pages)
     *   - /api/auth/* (NextAuth handlers)
     *   - /api/webhook/* (GitHub webhook — validated by signature, not session)
     *   - /api/raw/* (validates session OR a short-lived signed token itself —
     *     sandboxed guide iframes fetch their own assets via the token path,
     *     and have no session cookie to send)
     *   - /_next/* (Next.js internals)
     *   - /public files
     */
    "/((?!auth/|api/auth/|api/webhook/|api/raw(?:/|$)|_next/|favicon.ico|vaimo-logo).*)",
  ],
};
