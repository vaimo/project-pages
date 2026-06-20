## ADDED Requirements

### Requirement: Google OAuth login
The system SHALL allow users to authenticate using Google OAuth 2.0 restricted to a single domain.

#### Scenario: Successful Google login for allowed domain
- **WHEN** a user initiates Google OAuth sign-in and completes Google's consent flow with an email in the allowed domain
- **THEN** the system SHALL create a user account if one does not exist, or associate the Google identity with an existing account having the same email, and sign the user in.

#### Scenario: Google login with disallowed domain
- **WHEN** a user signs in via Google with an email not in the configured allowed domain
- **THEN** the system SHALL reject the login and show an error explaining that only users from the allowed domain may sign in.

### Requirement: Configurable enable flag and domain
The system SHALL allow enabling Google login via an environment variable and SHALL use an environment variable to specify the allowed domain.

#### Scenario: Google login disabled
- **WHEN** ENABLE_GOOGLE_LOGIN is not set or is false
- **THEN** the UI SHALL NOT show the Google sign-in button and backend endpoints SHALL return 404 or redirect to the standard login flow.

#### Scenario: Allowed domain enforced
- **WHEN** GOOGLE_ALLOWED_DOMAIN is set to example.com
- **THEN** only accounts with email ending in @example.com SHALL be accepted via Google login.

### Requirement: Minimal user profile creation
When the system creates a new user from Google sign-in, it SHALL store at minimum: email, name, google_id, and mark the account as having google_auth.

#### Scenario: First-time Google sign-in
- **WHEN** a user from the allowed domain signs in for the first time
- **THEN** the system SHALL create a user record with the required fields and sign the user in.
