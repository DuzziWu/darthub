# Plan: DartHub Product Completion

## Created
2026-11-13

## Status
ready

## Objective
Turn DartHub from a build that is green locally but **red in CI** into a product whose backend modules are actually reachable from the browser: CI green on every commit, the guest-to-account migration atomic, a real sign-in page, the shared undo/correct behaviour present in every match view, ratings and matchmaking wired end to end, the seven skipped Playwright placeholders either real or deleted, and the documentation matching the tree.

## Related Issues
none

## Discovery Notes

Verified against the tree at `f976114` (main, in sync with origin/main). Everything below was read from the code, not inferred.

**The build is green locally and red in CI.** `npm test` passes 96 files / 448 tests locally. Every CI run since `4695efe` concludes `failure`, always at the same step — `Test`. The extracted runner log names the cause exactly:

```
FAIL  tests/unit/ci-workflow.test.ts > ci > runs the end-to-end suite in its own job, with the browsers installed
AssertionError: no CI job runs the Playwright suite: expected undefined to be defined
 Test Files  1 failed | 95 passed (96)
```

The `e2e` job exists in the working tree but was never committed, because the token is `read:user, repo` and GitHub rejects workflow writes without the `workflow` scope. `tests/unit/ci-workflow.test.ts` asserts the job is present, so **the gate is working exactly as designed** — it is blocking a commit that CI itself must carry. This is the single highest-priority item: the repository currently cannot go green, and every later phase is validated by that same gate.

**The link-guest flow is not atomic, and the compensation does not exist.** `src/auth/linkGuestRoutes.ts` calls `authService.registerUser()` first, then `guestService.migrateGuestToUser()`. Both are individually transactional (`src/auth/authService.ts:70`, `src/auth/guest.ts:130`), but they are **two separate transactions**. If the migration fails — bad token, unknown guest, or a unique-violation on a rating row — the route returns 400 and the freshly registered user row **stays in the database**. The client is told the signup failed; the account now exists and blocks that email from ever being registered again (`authService.ts:73` refuses an existing email). The user cannot retry, and cannot log in either: the session token was never returned, and the password is theirs, so they *can* log in — but they were told the signup failed.

Note the failure is **not hypothetical**: `src/auth/prismaAuthRepository.ts:130` documents that `reassign` uses `updateMany` per table and that a unique violation on the same `(mode)` or `(sessionId)` rejects — the comment says so in as many words and defers the merge to "task 004". The Prisma path can therefore genuinely fail after the user row is committed.

**`app/login` does not exist, but Auth.js points at it.** `src/auth/nextauth.ts:32` sets `pages: { signIn: "/login" }`. There is no `app/login` directory. Any unauthenticated Auth.js redirect lands on a 404. There is also no sign-up page and no guest-session button, so a browser user cannot obtain a session of any kind.

**The shared undo/correct work is finished in the engine and one view only.** The engine has the ledger and the operations (`GameEngine.undoLastThrow` at `GameEngine.ts:131`, `GameEngine.correctThrow` at `GameEngine.ts:156`, plus `src/game-engine/throwLedger.ts`). The shared hook `src/components/game/useMatchHistory.ts` and the strip `src/components/game/ThrowHistoryControls.tsx` exist. **But `useMatchHistory` is consumed by exactly one view** — `app/game/cricket/page.tsx:59`. The other three still keep their own private visit bookkeeping:

- `app/game/around-the-clock/page.tsx`
- `app/game/shanghai/page.tsx`
- `src/components/x01/X01MatchView.tsx`

So 501, 301, Around The Clock and Shanghai have **no undo and no correction**, while Cricket does. The DevFlow task `DF-0002` is still `blocked` and the plan at `.claude/plans/throw-correction-undo/_plan.md` still lists tasks 003–008 as `pending`, even though 003 and the cricket wiring are in fact done. The plan and the ledger disagree with the tree.

**The backend has a great deal of real capability that no page reaches.** Present and tested, but with no browser-facing consumer:

| Capability | Where it lives | Browser-facing consumer |
|---|---|---|
| Ratings (Elo + performance, per mode) | `src/rating/`, `app/api/rating/**` | **none** — no page calls `api/rating` |
| Matchmaking queue | `src/realtime/matchmaking.ts` | **none** — `/lobby` has two dead buttons |
| Socket.IO rooms | `src/realtime/socketServer.ts` | **none** — `socket.io-client` is imported only by tests |
| Privacy export/delete | `src/privacy/`, `app/api/privacy/**` | **none** |
| Friends | `src/friends/`, `app/api/friends/**` | **none** |
| Invites | `src/realtime/inviteService.ts` | **none** |
| Career progression | `src/career/progressionService.ts` | page reads quests only, never progress |

`app/lobby/page.tsx` renders "Find Match" and "Create Room" as bare `<button>` elements with no handlers. `app/dashboard/page.tsx` shows "No completed matches yet." — it never queries anything. `app/career/page.tsx` reads the quest catalogue but shows "No progress yet." without reading progress.

**The realtime server is not deployable.** `docker-compose.yml` has a commented-out `realtime` service block referencing `Dockerfile.realtime`, which **does not exist** (only `Dockerfile` exists). `src/realtime/server.ts` runs standalone via `npx tsx src/realtime/server.ts` — `tsx` is a devDependency, so that path does not work in the production image. The realtime server also has no authentication: `socketServer.ts` binds sockets to rooms from server state, and `requireAuth` is never applied to a socket handshake.

**Seven Playwright tests are `test.skip(...)` placeholders that mock the API.** `e2e/login.spec.ts`, `e2e/career.spec.ts`, `e2e/matchmaking.spec.ts` — 7 tests. They do not test the app; they assert against `page.route` mocks of routes that **do not exist** (`/api/matchmaking/**`, `/api/ratings/**`, a `/auth` page). Their own comments say they will pass "once the auth API routes are implemented" and "once the lobby page with matchmaking UI is implemented". A skipped test that mocks a non-existent endpoint is worse than no test: it looks like coverage and is not.

**The documentation drifts from the tree in ways the repo's own tests do not catch.** `docs/TESTING.md` claims "Coverage is measured on `vitest run --coverage`" and sets an 80% line-coverage target — but **no coverage provider is installed** (`@vitest/coverage-v8` is absent from `node_modules` and from `package.json`), so that command cannot run. It also claims "Playwright runs on demand and before release cuts", while the new CI job runs it on every push. `docs/ROADMAP.md` "Delivery Status" table still shows tasks 002, 007, 012, 018, 020, 026 as `in progress` and "others — pending", which is false: all 48 tasks are `completed` in `.claude/plans/darthub-full-product-planning/_plan.md`. `docs/DEPLOYMENT.md` §Verification Status admits the Docker path was never run live.

**Fourteen scratch files are tracked in the repository root** — `build_output.log`, `build_v2_output.log`, `eslint_v2_output.log`, `lint_output.log`, `prettier_v2_output.log`, `typecheck_output.log`, `typecheck_full_output.log`, `typecheck_v2_output.log`, `test_anticheat_focused_output.log`, `test_full_suite_output.log`, `test_invitation_output.log`, `test_invite_focused_output.log`, `test_latest_output.log`, and `p17.raw`. `tsconfig.tsbuildinfo` is tracked too, although `.gitignore` lists `*.tsbuildinfo`.

**Two environment facts constrain the work.** There is no Docker daemon in this container (`docker info` fails), so `tests/unit/dockerignore.test.ts` skips and no image can be built here — the Docker build is only verifiable in CI. And `npm run test:e2e` runs against a production standalone build, which is fast and deterministic here; `next dev` is not (the visual-QC specs took 8+ minutes and timed out against it).

## Scope

### In Scope

- Getting CI green on every commit, including landing the Playwright job.
- Making the guest-to-account migration atomic (or explicitly compensating).
- A real `/login` page plus a guest-session entry point, so a browser user can hold a session.
- Wiring the shared undo/correct into the four remaining match views and reconciling the throw-correction plan/ledger with the tree.
- Making ratings, career progress and the lobby's matchmaking reachable from the UI.
- A socket client and a lobby that actually queues, pairs and plays.
- Replacing the seven skipped placeholder specs with real journeys, or deleting them.
- Untracking the scratch artifacts and correcting the documentation drift.
- Installing a coverage provider so the documented coverage claim becomes true.

### Out of Scope

- **Computer-vision hit detection.** Deferred by decision (`docs/DECISIONS.md` §Open Decisions). The stub keeps raising `NotImplementedInCvPhaseError`, and that is correct: no camera data exists to calibrate against. Revisit when a phone has been pointed at a board.
- **Redis-backed matchmaking persistence.** Deferred by decision (tasks 031/047 are listed `completed` but the decision log says the switch is open). `RedisRoomStore` is implemented and `USE_REDIS` selects it; it stays unused until real multiplayer load justifies it. **But** the `RedisRoomStore` must not be reachable in production by accident — see task 104.
- **Monetisation, regional rankings, chat.** Out of the MVP by decision.
- **A second server process for realtime.** Task 104 makes the realtime server deployable, but the socket server stays a separate process from Next.js; merging them is a bigger change than this plan needs.

### The boundary on "the backend must be reachable"

Reachability means **a browser user can trigger the capability and see its result**. It does not mean every API gets a bespoke screen. The rule this plan follows: for each module, add the smallest honest UI that exercises the real server path, and where no UI is warranted yet, say so in the module's README rather than leaving a dead button in the interface.

## Success Criteria

- `npm test` passes locally **and** every CI run on `main` concludes `success`, with both jobs green.
- The Playwright CI job exists on GitHub and runs the suite; the `ci-workflow` guard test passes without exclusions.
- A failed migration leaves **no** orphan user row, proven by a test that asserts the user's absence.
- `/login` exists, a browser can sign up, sign in and start a guest session, and the three auth journeys are covered by Playwright.
- Undo and correction work in **all five** match views, each covered by a test.
- A browser user can play a rated game and see their rating change, and see career progress on the career page.
- The lobby queues, pairs and enters a room over a real socket connection.
- No `test.skip` placeholder remains that mocks a route the app does not have.
- The repository root contains no scratch logs; `tsconfig.tsbuildinfo` is untracked.
- `docs/ROADMAP.md`, `docs/TESTING.md` and `docs/DECISIONS.md` describe the tree as it is.

## Task Overview

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 100 | Land the CI e2e job and get `main` green | - | pending |
| 101 | Make the link-guest migration atomic | 100 | pending |
| 102 | Add the `/login` page and the guest entry point | 100 | pending |
| 103 | Wire the shared undo/correct into the remaining four views | 100 | pending |
| 104 | Make the realtime server deployable and socket-authenticated | 100, 102 | pending |
| 105 | Wire ratings into the match and the dashboard | 101, 102 | pending |
| 106 | Make the lobby real: matchmaking queue and room join | 104 | pending |
| 107 | Wire career progress into the career page | 102 | pending |
| 108 | Replace the seven skipped specs with real journeys | 102, 105, 106, 107 | pending |
| 109 | Untrack scratch artifacts; install coverage; correct the docs | 100 | pending |
| 110 | Independent review of the whole change | 101–109 | pending |

## Architecture Notes

**The CI gate is the project's most valuable asset — it is also the current blocker.** `tests/unit/ci-workflow.test.ts` replays the workflow's `npm run` steps locally, so a broken gate fails before it reaches GitHub. That design caught the missing e2e job in the working tree. The plan therefore keeps the guard test exactly as it is and treats the workflow file, not the test, as the thing to fix. The workflow change is written, reviewed and staged; **it needs a token with the `workflow` scope to land.** If no such token is available, the fallback is to delete the guard's e2e assertion — and that fallback is explicitly out of scope for this plan, because it removes the project's ability to catch the next missing job.

**Atomic migration means one transaction, not two.** The correct fix is to compose both operations inside a single `repository.runInTransaction`. The repository seam already supports this: `runInTransaction` hands the callback an `AuthUnitOfWork`, and both `registerUser` and `migrateGuestToUser` are built on it. The refactor is to expose the *operations* separately from the *transaction wrapper* — e.g. `registerUserIn(tx, input)` and `migrateGuestToUserIn(tx, input)` — and have the public service methods call them inside their own `runInTransaction`. Then the route calls one new service method, `linkGuestToAccount`, that opens a single transaction covering both steps. If the migration throws, the user creation rolls back with it and no orphan row exists.

The Prisma implementation supports this directly: `prisma.$transaction(async (tx) => ...)` already yields a transaction-scoped client, and `createPrismaAuthRepository` builds its stores from whatever client it is handed — the `unitFor(client)` helper at `prismaAuthRepository.ts:196` is exactly the seam needed to build stores over a transaction client.

One caveat must be handled: **the in-memory test double does not roll back.** `createInMemoryAuthRepository`'s `runInTransaction` at `tests/support/inMemoryAuthRepository.ts:141` just calls `fn(unitForStore(store))` against the live maps — a throw mid-transaction leaves every write in place. If the atomicity is proven against that double, the test proves nothing. The double therefore needs real snapshot/restore semantics (copy the three maps on entry, restore on failure), and the atomicity test must assert against it. This is the part most likely to be faked by accident, so it is called out in task 101.

**The sign-in surface is the precondition for most other work.** Every capability behind a `Bearer` token — ratings, career progress, friends, privacy — is unreachable from a browser without a session. The `/login` page is therefore not a cosmetic addition; it is the door that tasks 105, 106 and 107 open. It must support the three things the auth services already implement: email sign-in, email sign-up, and a guest session. `src/auth/nextauth.ts` already wires two Auth.js credential providers (`email` and `guest`) whose `authorize` functions call `loginUser` and `createGuestSession` — the server side exists; only the page and its form are missing.

**The realtime server needs a Dockerfile, a process and an authenticated handshake.** Three distinct gaps:
1. *Deployability*: `docker-compose.yml` references a `Dockerfile.realtime` that does not exist, and `src/realtime/server.ts` is run with `tsx`, a devDependency absent from the production image. The realtime service needs its own build stage that compiles the TypeScript to JavaScript and a runner that executes the compiled output.
2. *Lifecycle*: it is a separate process from Next.js, so `docker-compose.yml` needs a real `realtime` service (not a comment) with its own healthcheck, replacing the commented block.
3. *Authentication*: `socketServer.ts` currently binds sockets to rooms without checking who the player is. The auth seam already exists — `requireAuth` verifies a `Bearer` token and `src/auth/session.ts` signs and verifies them — so the socket handshake should read the same token from the handshake `auth` payload and reject unauthenticated connections. This is a **security** task, not a polish task: an unauthenticated room store means anyone can join any room by code.

**Reachability should reuse the server-authoritative path, not invent a second one.** The realtime server already owns seat assignment, turn order, throw validation and anti-cheat (`src/realtime/antiCheatMiddleware.ts`). The browser client must therefore be a thin consumer: it sends intents and renders the server's authoritative state. It must **not** reimplement scoring in the client. The existing `src/components/x01/X01MatchView.tsx` already does exactly this for local play — it owns a `GameEngine` instance and renders `MatchState` — so the multiplayer view should mirror that structure rather than inventing a new one.

**Ratings are recorded by an endpoint that nothing calls.** `app/api/rating/game/route.ts` applies the Elo + performance update for a finished game. The local match views know when a match ends (`GameResultBanner` exists, and the engine reports completion). The natural wiring is: when a local match completes, the client posts the result to `/api/rating/game` with the session token. The rating then appears on the dashboard, which currently shows a hard-coded empty state.

**Career progress is read by the service but not by the page.** `src/career/progressionService.ts` and `app/api/career/progress/route.ts` exist. `app/career/page.tsx` reads the quest catalogue through the loader but shows "No progress yet." without ever asking for the player's progress. Wiring it is a matter of the page reading progress through the same route, gated on a session.

**The E2E specs must test the real server, and the fixtures must make that possible.** The seven skipped specs mock routes that do not exist. When they are un-skipped they must run against the real app, which means the app needs a way to authenticate and a way to reset state. The honest approach: a seeded test database (the Prisma migration exists at `prisma/migrations/20260101000000_init`) plus a test-only sign-in path, and no route mocking in the auth, career or matchmaking specs. Mocking is legitimate for a third-party service the project does not own; it is not legitimate for the project's own endpoints.

**The Playwright suite must keep running against a production build.** `playwright.config.ts` builds and starts the standalone server, and `next.config.ts` sets `output: "standalone"` so `next start` cannot serve the app. Any new spec inherits that. The CI job must therefore also run `npx prisma generate` before the build, because the Prisma client is not checked in and `npm ci` does not generate it — the same trap the Dockerfile's builder stage already handles.

## Risks & Mitigations

- **The workflow token is unavailable.** The `e2e` job cannot be pushed with a `repo`-scoped token. Mitigation: task 100 lands everything else first and leaves the workflow staged; if the scope cannot be granted, the honest outcome is a documented, still-red CI, not a weakened guard test. The failure must be visible, not silenced.
- **The in-memory repository does not roll back, so atomicity tests can pass falsely.** Mitigation: task 101 makes the double snapshot-and-restore before any atomicity assertion is written. The test must fail against the pre-fix code.
- **Multiplayer UI invites scope creep.** The lobby, the socket client and the room view can absorb unlimited time. Mitigation: task 106 has a fixed deliverable — queue, pair, join, play one match — and the room view may reuse the existing `MatchLayout`/`ScoreDisplay` components. Anything beyond one complete match is out of scope.
- **PostgreSQL is not available in this container.** The realtime, rating and career integration tests need a database; the repo has no database in CI either ("no live PostgreSQL exists in CI" per `prismaAuthRepository.ts`). Mitigation: the CI e2e job must provide a database service (GitHub Actions `services:` supports `postgres:16-alpine`) and the specs run against it. Until that exists, integration coverage stays at the repository-double level, and the plan says so rather than implying a live database was exercised.
- **Replacing seven skipped specs with real ones may expose unrelated defects.** That is the point of the task, but it can expand. Mitigation: each replacement is its own spec file with its own commit; a discovered defect is fixed in its own commit, not folded into the spec work.
- **Documentation drift recurs.** The repo already has a docs test (`tests/unit/docs/docs.test.ts`), but it did not catch the coverage claim or the roadmap status table. Mitigation: task 109 corrects the documents and, where a claim is mechanically checkable (coverage installed, Playwright in CI, task statuses accurate), adds the assertion.

## Commit Policy

One logical change per commit, in the order of the task table. Each commit must leave `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` green. The workflow commit (task 100) is the one exception to "CI green at every commit", because the e2e job it adds cannot run until the commit that introduces it is pushed — the guard test asserting the job's presence passes only after that push, so the first push is expected to be red and the second green. That is inherent to adding a CI job that its own guard test requires, and it resolves on the next commit.

## Related Documents

- [Architecture](../../docs/ARCHITECTURE.md)
- [Decision Log](../../docs/DECISIONS.md)
- [Testing Strategy](../../docs/TESTING.md)
- [Roadmap](../../docs/ROADMAP.md)
- [Throw Correction & Undo plan](../throw-correction-undo/_plan.md)
