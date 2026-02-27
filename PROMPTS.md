# Codex Prompts

- Implement the planned username + password auth system with D1 sessions and HTTP-only cookies.
- Explain how to implement a login system, how to store logged-in state, and whether to use JWT.
- Clarify what �username-only� means and whether it includes a password.
- Plan username + password auth and also explain how to set up display-name-only auth.
- Choose and confirm: username + password, session table in D1, and login dialog on the main screen.
- Explain session cookies vs JWT, cookie expiration, and revocation behavior.
- Explain cookie parsing logic (rest operator, optional chaining) and JSON parsing error handling.
- Explain the password hashing and verification logic (scrypt, base64 helpers, constant-time compare).
- Explain session expiry refresh and session deletion behavior.
- Discuss renaming a D1 database and what�s required to migrate data.
- Explain foreign keys in D1/SQLite and whether inserts fail with missing referenced rows.
- Explain how to implement username changes with password confirmation and rename history.
- Explain how to sync username changes across chat rooms using Durable Objects.
- Explain how to prevent UI flicker during auth checks on initial load.
- Explain why navigating to the same route does not refresh in React Router.
