# Task 108: Replace the seven skipped specs with real journeys

**Status**: pending
**Depends on**: 102, 105, 106, 107
**Retry count**: 0

## Description
Seven Playwright tests are `test.skip(...)` placeholders that mock API routes the application does not have. They assert against `/api/matchmaking/**`, `/api/ratings/**` and a `/auth` page — none of which exist. Their own comments say they will pass "once the auth API routes are implemented" and "once the lobby page with matchmaking UI is implemented". Tasks 102, 105, 106 and 107 supply those. This task replaces the placeholders with real journeys against the real server.

## Context
- Related files: `e2e/login.spec.ts`, `e2e/career.spec.ts`, `e2e/matchmaking.spec.ts`, `e2e/game-center.spec.ts`, `e2e/hub-pages.spec.ts`, `e2e/visual-qc.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- The seven skips: `login.spec.ts:15` and `:44`; `career.spec.ts:15`, `:39`, `:69`; `matchmaking.spec.ts:15` and `:47`.
- Every one of them uses `page.route(...)` to fulfil mocked responses. None exercises the application.
- The active specs — `game-center.spec.ts` (18 tests), `hub-pages.spec.ts` (5), `visual-qc.spec.ts` (9) — pass against a production build. 38 passed, 7 skipped, 0 failed.
- `playwright.config.ts` — the suite runs against a **production standalone build**: it runs `npm run build`, copies `public/` and `.next/static/` next to the standalone server, and starts `node .next/standalone/server.js` with `HOSTNAME=127.0.0.1`. `next start` cannot serve the app because `next.config.ts` sets `output: "standalone"`.
- The CI e2e job (task 100) provides a PostgreSQL service and runs `npm run db:deploy`.

## Requirements (Test Descriptions)
- [ ] `it signs up a new user and logs in`
- [ ] `it converts a guest session to a registered account`
- [ ] `it signs in with an existing account`
- [ ] `it starts a guest session and plays a match`
- [ ] `it shows a career quest`
- [ ] `it completes a quest and sees the reward`
- [ ] `it records rating changes after a game`
- [ ] `it joins a public matchmaking queue and is paired`
- [ ] `it shows the rating of the signed-in player on the dashboard`

## Acceptance Criteria
- **No `test.skip` remains** in `e2e/`. Either a journey is implemented and passing, or the placeholder is deleted.
- No spec mocks the application's own API. `page.route` may stub third-party services the project does not own; it must not stub `/api/auth/**`, `/api/rating/**`, `/api/career/**` or the realtime socket.
- Every spec passes against the production build, locally and in CI.
- The suite stays within a sensible runtime — the current active suite takes about 40 seconds; the new specs should not multiply that by an order of magnitude.
- The Playwright report artifact is uploaded on failure in CI.

## Implementation Notes

**Deleting a placeholder is an acceptable outcome.** The instruction is that no skipped test may remain that mocks a route the app does not have. If a journey turns out to be genuinely not implementable in this plan's scope, delete the placeholder and record why. A deleted test is honest; a skipped test that mocks a non-existent endpoint looks like coverage and is not.

**The auth journey needs a way to reset state.** A spec that signs up `testuser@example.com` will fail on the second run, because the first run already registered that email. The suite needs one of:

- a **unique identity per run** — generate the email from a timestamp or a random suffix. Simple, no fixtures needed, and it matches the "signs up a new user" intent exactly.
- a **database reset between runs** — truncate the tables before the spec. Cleaner assertions, but it needs a real database in CI and a reset hook.

Prefer the unique identity. It is simpler, it does not require the spec to have database access, and it does not make the spec order-dependent.

**The guest-to-account journey is the one that proves task 101.** `login.spec.ts:44` is "converts a guest session to a registered account". The guest flow yields a migration token (task 102), and the conversion posts it to `/api/auth/link-guest`. The spec must then assert the account exists and works — and, to prove atomicity, a second journey should attempt a conversion with a **wrong** migration token and assert the email can still be registered afterwards. That is the browser-level proof of task 101.

**The matchmaking journey needs two browser contexts.** Pairing requires two players. Playwright's `browser` fixture gives two independent contexts; both connect to the same realtime server and queue. The realtime server runs as a separate process from Next.js (task 104), so the spec must know both URLs. The `playwright.config.ts` `webServer` currently starts only the Next.js standalone server — the realtime server needs its own `webServer` entry, or a documented way to point at an already-running one.

**The realtime server must be reachable from the browser in CI.** The socket URL is not the same origin as the Next.js app, so the server's CORS configuration matters. `socketServer.ts` has `DEFAULT_CORS_ORIGINS` allowing loopback origins only — the CI host is `localhost`, so that matches, but the configured origin must include the exact origin the app is served from. Check this rather than assuming.

**Do not mock the socket.** A matchmaking spec that stubs the socket events proves nothing about matchmaking. The real queue, with two real clients, is the journey worth writing.

**Keep the specs fast and independent.** No `test.describe.serial`, no shared mutable state between tests, no ordering dependency. Each spec creates its own identity and its own room.

**The existing active specs must not regress.** `game-center.spec.ts`, `hub-pages.spec.ts` and `visual-qc.spec.ts` are the visual and structural guarantees. If the new pages change the dashboard, lobby or career layout, `visual-qc.spec.ts` may need updating — that is expected and legitimate, but it must be an intentional update, not an unexplained snapshot drift.

**Do not run the suite against `next dev`.** The dev server's on-demand compilation and hot-reload runtime stall Playwright's actionability checks; the visual-QC specs took 8+ minutes and timed out against it. The production standalone build runs the same specs in about 40 seconds. Any new spec inherits the production build from `playwright.config.ts`.
