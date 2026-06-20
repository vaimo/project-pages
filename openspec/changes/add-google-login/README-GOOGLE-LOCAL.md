# Local test: Google sign-in (session-only identity)

This guide helps you test Google sign-in locally before rolling it out. The implementation is session-only: Google identity (email, google_id) is attached to the NextAuth session/JWT and no persistent user records are created.

1) Create Google OAuth credentials

- Console: https://console.cloud.google.com/apis/credentials
- OAuth consent screen: set App name; add your email as test user if unverified.
- Create credentials → OAuth client ID → Web application.
- Authorized redirect URI: http://localhost:3000/api/auth/callback/google
- Note client ID and client secret.

2) Create .env.local from template

Copy the example and fill the values below in .env.local:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-CHANGEME

ENABLE_GOOGLE_LOGIN=true
NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=true

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/callback/google
GOOGLE_ALLOWED_DOMAIN=example.com
# Optional: GOOGLE_DEFAULT_BRANCH=master
```

3) Run locally

npm ci
npm run dev

Open: http://localhost:3000/auth/signin

4) Tests

- Allowed domain: Use a Google account matching GOOGLE_ALLOWED_DOMAIN (or set GOOGLE_ALLOWED_DOMAIN=gmail.com for testing with a personal account). Click "Sign in with Google" and expect success.
- Disallowed domain: Use a non-matching account; expect redirect to /auth/error and console.warn on server.

5) Inspect session

After sign-in, in browser console run:

```
await fetch('/api/auth/session').then(r => r.json()).then(console.log)
```

Look for branchName and google_id in the returned session.

6) Rollback

To disable Google login quickly, set ENABLE_GOOGLE_LOGIN=false and NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false in .env.local and restart the server.

7) Troubleshooting

- redirect_uri_mismatch: Ensure redirect URI set in Google console matches NEXTAUTH_URL + /api/auth/callback/google exactly.
- Consent screen: If the app is unverified, add test users or publish the consent screen during testing.

---

If you want, I can also add a small test scaffold (Playwright or node script) to exercise the signin button and check redirects. This will require a running local server and either a real Google OAuth client or ngrok-based public URL.
