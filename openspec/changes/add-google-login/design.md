## Context

The project currently supports local email/password authentication. We need to add Google OAuth 2.0 as an additional login option restricted to a single Google Workspace domain (e.g., partner.com). This should be additive and optional, controlled by environment variables so development can enable/disable it without changes to code. The feature will include creating a user record when a valid Google user signs in and their email domain matches the configured domain.

## Goals / Non-Goals

**Goals:**
- Add Google OAuth 2.0 login flow.
- Restrict sign-ins to a single domain configured via ENV (e.g., GOOGLE_ALLOWED_DOMAIN).
- Allow enabling/disabling Google login in development with an environment flag (e.g., ENABLE_GOOGLE_LOGIN=true).
- Create user accounts for first-time Google sign-ins with minimal profile (name, email, google_id).
- Keep existing auth flows unchanged.

**Non-Goals:**
- Support multiple domains or multi-tenant Google restrictions.
- Automatic role assignment beyond default user.
- Migrate existing accounts to Google-based auth.

## Decisions

1. Use Google OAuth 2.0 via passport.js (if Node/Express stack) or next-auth (if Next.js). Assuming this repo is a Node/Express app; if Next.js, adapt to next-auth instead.
   - Rationale: passport-google-oauth20 is simple, well-known, and fits express apps.
2. Configuration via environment variables:
   - ENABLE_GOOGLE_LOGIN (boolean)
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_CALLBACK_URL (or construct from app base URL)
   - GOOGLE_ALLOWED_DOMAIN (e.g., partner.com)
3. Backend endpoint /auth/google and /auth/google/callback to handle flow. After successful authentication, check domain and create or find user, then issue same session or JWT as existing flows.
4. Frontend: show "Sign in with Google" button when ENABLE_GOOGLE_LOGIN is true. The button starts OAuth redirect to /auth/google.

## Risks / Trade-offs

- Risk: Misconfigured callback URL or OAuth credentials will break sign-in. Mitigation: Provide clear ENV examples and local dev instructions.
- Trade-off: Using passport ties to express middleware; if the app uses a different stack, adapt to its auth solution (next-auth, omniauth, etc.).

## Migration Plan

1. Add env variables to development .env.example.
2. Implement backend oauth routes and user creation logic behind ENABLE_GOOGLE_LOGIN guard.
3. Add frontend button behind the same guard.
4. Test locally with Google OAuth credentials or using a development workaround (mock provider) if difficult.

## Open Questions

- Confirm whether the app uses Express or Next.js so we can pick passport.js or next-auth.
