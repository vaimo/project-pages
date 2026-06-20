## Why

Add Google sign-in as an additional login method restricted to a single Google Workspace domain. This will let employees from our partner company sign in using their corporate Google accounts, reducing friction and account management overhead.

## What Changes

- Add Google OAuth 2.0 login flow to the authentication system.
- Restrict Google sign-ins to a single configurable domain (e.g., example.com) via environment variable.
- Expose a "Sign in with Google" button on the web login page; if a user signs in via Google and does not exist, create a user account with minimal profile.
- Avoid changes to existing local/email/password authentication; this is additive. No breaking changes.

## Capabilities

### New Capabilities
- `google-login`: Add Google OAuth login flow, restricted by domain, configurable via environment.

### Modified Capabilities
- 

## Impact

- Affected code: frontend login page, backend auth routes, user model creation flow.
- External dependencies: Google OAuth client credentials, Google Workspace domain restrict.
- Environments: Development should support enabling Google login via ENV_VAR; prod will need proper OAuth credentials and callback URLs.
