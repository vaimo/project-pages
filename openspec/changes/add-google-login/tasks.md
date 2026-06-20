## 1. Setup

- [x] 1.1 Add env vars to .env.example: ENABLE_GOOGLE_LOGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, GOOGLE_ALLOWED_DOMAIN
- [x] 1.2 Add passport-google-oauth20 (or configure next-auth if Next.js) to project dependencies

## 2. Backend Implementation

- [x] 2.1 Add auth routes: /auth/google and /auth/google/callback behind ENABLE_GOOGLE_LOGIN guard
- [x] 2.2 Implement Google strategy: verify callback checks email domain against GOOGLE_ALLOWED_DOMAIN
- [x] 2.3 Create or find user on successful auth; set google_id on user record and mark google_auth=true

> Note: This change implements session-only identity. Google identity (google_id, email) is attached to the NextAuth session/jwt but no persistent user record is created, per project decision.
- [x] 2.4 Reuse existing session/JWT issuance so Google-authenticated users receive same tokens/cookies
- [ ] 2.5 Add unit/integration tests for allowed and disallowed domains

## 3. Frontend Implementation

- [x] 3.1 Show "Sign in with Google" button when ENABLE_GOOGLE_LOGIN is true
- [x] 3.2 Implement redirect to /auth/google and handle post-login redirect

## 4. Dev and Deployment

- [x] 4.1 Update .env.example and documentation with instructions for obtaining Google credentials and setting callback URLs
- [ ] 4.2 Add staging/prod env entries for OAuth credentials and allowed domain
- [ ] 4.3 Manual test in staging with a test Google Workspace account

## 5. Optional QA and Rollout

- [ ] 5.1 Monitor auth logs and errors after rollout
- [ ] 5.2 Provide rollback steps (disable ENABLE_GOOGLE_LOGIN or remove credentials)
