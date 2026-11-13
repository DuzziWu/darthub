# Task 102: Add the `/login` page and the guest entry point

**Status**: pending
**Depends on**: 100
**Retry count**: 0

## Description
Auth.js is configured to redirect unauthenticated users to `/login`, and that route does not exist — there is no `app/login` directory. There is no sign-up page and no way to start a guest session from the browser either, so no browser user can obtain a session at all. That blocks every bearer-token capability: ratings, career progress, friends, privacy, and the realtime handshake in task 104. This task builds the sign-in surface the auth services already implement.

## Context
- Related files: `app/login/page.tsx` (new), `src/auth/nextauth.ts`, `src/auth/authService.ts`, `src/auth/guest.ts`, `src/auth/session.ts`, `src/components/shell/*`, `src/components/game/classes.ts`
- `src/auth/nextauth.ts:32` — `pages: { signIn: "/login" }`. The route is referenced and missing.
- `src/auth/nextauth.ts` — two Auth.js credential providers exist: `email` (calls `loginUser`) and `guest` (no credentials, calls `createGuestSession`). Both `authorize` functions are already implemented. **The server side is done; only the page is missing.**
- `src/auth/guest.ts` — `createGuestSession` returns `{ guest, sessionToken, migrationToken }`. The plaintext `migrationToken` is handed to the client exactly once; only its sha256 hash is stored. The link-guest flow needs it, so the guest flow must keep it.
- `src/auth/session.ts` — issues and verifies HS256 bearer tokens; `requireAuth` reads `Authorization: Bearer <token>`.
- The Auth.js session cookie and the bearer token are issued by the same services. The browser should use the cookie session for navigation, and keep the bearer token for API calls.
- Design system: `src/components/game/classes.ts` holds the shared button classes (`PRIMARY_ACTION`, `SECONDARY_ACTION` style constants used across pages); `app/globals.css` holds the token layer (`--color-ink`, `--color-brass`, `--color-board`, `--space-*`, `--radius-*`).

## Requirements (Test Descriptions)
- [ ] `it renders the sign-in form on the login page`
- [ ] `it offers a sign-up form for a new account`
- [ ] `it offers a guest session entry point`
- [ ] `it signs a user in with an email and password`
- [ ] `it signs a new user up with an email and password`
- [ ] `it starts a guest session and keeps the migration token`
- [ ] `it shows an error when the credentials are rejected`
- [ ] `it redirects to the dashboard after a successful sign-in`
- [ ] `it renders the login page at the path Auth.js redirects to`
- [ ] `it keeps the guest migration token available for the link-guest flow`

## Acceptance Criteria
- `/login` renders and works; the Auth.js `signIn` page resolves to it.
- A browser user can sign in, sign up and start a guest session.
- The guest flow retains the plaintext migration token for the later link-guest call.
- The page uses the existing design tokens and the shared button classes — no parallel component language.
- Unit tests cover the page's rendering and its error states.
- The page is accessible: labels are associated with inputs, the form submits on Enter, and the focus order is sensible.

## Implementation Notes

**Prefer a server component for the shell and a client component for the form.** The page itself needs no data; the form needs interactivity. Split them: `app/login/page.tsx` (server) renders the layout and mounts the client form.

**Use Auth.js's `signIn` from `next-auth/react` for the credential providers.** Both providers exist and their `authorize` functions are implemented. Calling `signIn("email", { email, password, redirectTo: "/dashboard" })` is the intended path — it exercises the real service through the real provider, and it sets the session cookie.

**The guest provider takes no credentials.** `signIn("guest")` with no arguments. It creates a fresh anonymous session server-side and returns the user. The guest's plaintext `migrationToken` is **not** returned by the Auth.js provider — `authorize` returns only `{ id, name, email: null }`. So the client cannot obtain the migration token from the Auth.js guest provider.

That is a real constraint, and it decides the design: the guest entry point must call the guest service directly, not through Auth.js. Two options:

- *Preferred*: add a small route (e.g. `POST /api/auth/guest`) that calls `createGuestSession` and returns `{ sessionToken, migrationToken, guestId }`. The client stores the bearer token and the migration token. This is the honest design — the migration token is the guest's proof of ownership and the client needs it.
- *Alternative*: have the Auth.js guest provider stash the migration token in the JWT claims. This requires a custom `jwt` callback and is more machinery for the same result.

Prefer the route. It also gives the realtime handshake a token to use (task 104).

**Do not invent a separate registration mechanism.** `authService.registerUser` creates the user and returns a session token. The sign-up form should post to a route that calls it, or use the same email provider if the provider can create accounts. The current `email` provider's `authorize` only calls `loginUser`, so **sign-up needs its own path** — a `POST /api/auth/register` route calling `authService.registerUser` and returning the session token. The route already exists in spirit: `app/api/auth/link-guest/route.ts` calls `registerUser`.

**The session cookie and the bearer token.** After signing in, the browser has an Auth.js cookie session for navigation. The API routes want `Authorization: Bearer`. The simplest correct approach is to have the login response carry the bearer token and store it in the client (memory or `sessionStorage`), and send it with API calls. Do not put it in `localStorage` — the token grants API access and `localStorage` survives session end; `sessionStorage` does not.

**The guest entry point must be honest about what it is.** A guest has no email and cannot recover the account later without the migration token. The UI must say so and must offer the upgrade path (which task 101 makes atomic). A guest session that cannot be upgraded is a dead end, and the user must not discover that only after playing for an hour.

**Keep the page consistent with the rest of the app.** The lobby, dashboard and career pages each use the same `PRIMARY_ACTION` / `SECONDARY_ACTION` class constants and the `font-display` / `font-body` / `font-caption` type scale. The login page is a first impression of the same product and must not look like a different application.
