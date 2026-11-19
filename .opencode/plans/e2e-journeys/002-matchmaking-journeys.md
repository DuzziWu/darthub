# 002 — Matchmaking journeys: the queue, the pairing, the rating change

**Owning agents:** `backend` (E2.1) → `frontend` (E2.2) → `qa-engineer` (E2.3)
**Plan:** `.opencode/plans/e2e-journeys/_plan.md` → E2.1, E2.2, E2.3
**Created:** 2026-11-16
**Branch:** `cez/005e0185` · base `integration/opencode-team` `9343787`

---

## Scope

Turn the two `test.skip` placeholders in `e2e/matchmaking.spec.ts` into real journeys, and
build the queue they drive.

**In scope**

- A **queue transport** — a thin route over the pairing logic that already exists but is
  unreachable from the app (`src/realtime/matchmaking.ts:9-35` `PublicMatchmaker`, today
  imported **only** by `tests/unit/matchmaking.test.ts`).
- A **rating gateway that resolves a real session** instead of denying every request
  (`src/rating/ratingRuntime.ts:32`).
- The **lobby queue surface** — the "Find Match" button (`app/lobby/page.tsx:29-31`) becomes
  a control with a **searching** state and a **matched** state, and a rating readout joins
  the lobby and the dashboard.
- **Reporting a finished game** — nothing in the app reports one today:
  `recordGameResult` has exactly one production call site, the route handler itself
  (`src/rating/ratingRoutes.ts:113`). Without a report, the rating journey has no trigger.
- The **two journeys** in `e2e/matchmaking.spec.ts`, with the mock paths corrected to the
  routes the product actually has.

**Out of scope**

- The **socket game loop**. `src/realtime/GameStateMachine.ts:24` runs `NeutralScoreMode`,
  and no Playwright spec drives the socket server. The realtime server is a **separate
  process** (`src/realtime/server.ts:53,67-73`) that the app never starts, and the browser
  has no socket client — `socket.io-client` appears nowhere in `app/` or
  `src/components/`. This package drives the **queue seam**, not a live socket match.
- The **room system** — `src/realtime/GameRoom.ts` and `src/realtime/RoomRegistry.ts` are
  not rewritten.
- A **socket matchmaking event** — `REALTIME_EVENTS` (`src/realtime/types.ts:8-23`) has
  none, although `docs/API.md:104-105` documents one. The queue here is a **REST** seam.
- The **login journey** (`001`) — it is the prerequisite, not part of this package.
- The **career journey** (`003`).
- `docs/ROADMAP.md` — the parallel documentation task owns it.

---

## Files

### Step E2.1 — owned by `backend`

The queue transport and the rating gateway.

| File                                                      | What changes                                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/realtime/matchmakingRoutes.ts` (**create**)          | The queue route logic with **injected** dependencies, following `src/auth/linkGuestRoutes.ts:16-21,49`. It enqueues a player through `PublicMatchmaker` (`src/realtime/matchmaking.ts:9`) and reports the pairing state.  |
| `app/api/matchmaking/queue/route.ts` (**create**)         | The thin wiring: the production runtime supplies the matchmaker. The route path is `/api/matchmaking/queue` — the path the placeholder already mocks (`e2e/matchmaking.spec.ts:36`).                                      |
| `src/rating/ratingRuntime.ts`                             | The gateway gets a **real** token resolver instead of the default `async () => null` (`src/rating/ratingRuntime.ts:32` → the seam already exists in `src/auth/requireAuth.ts:32,60`). The route signatures do not change. |
| `tests/integration/matchmakingQueue.test.ts` (**create**) | The seam is proved here: enqueue, pair, and the queue state after the pairing.                                                                                                                                            |

**No other file may be touched by this step.** In particular **not**
`src/realtime/GameStateMachine.ts` and **not** `src/realtime/matchmaking.ts` — the pairing
logic is reused, not rewritten.

### Step E2.2 — owned by `frontend`

The queue surface.

| File                                                       | What changes                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/lobby/page.tsx`                                       | The "Find Match" button (`:29-31`) becomes a control that posts to the queue route and moves the page through a **searching** state into a **matched** state that names the room. The states are distinct and legible **without colour alone**, and the file gains the client boundary the interaction needs.                                                                                  |
| `app/dashboard/page.tsx`                                   | **Append** the rating readout. The page was already edited by **E1.2** (the signed-in player's name) — E2.2 adds a different block to the same file and changes nothing E1.2 wrote.                                                                                                                                                                                                            |
| `src/components/game/MatchResultReporter.tsx` (**create**) | The component that **reports a finished game** to `POST /api/rating/game`. It is a **new** file, so it collides with nothing. It posts the two player ids and the winner — and only then, once, for one result.                                                                                                                                                                                |
| `src/components/x01/X01MatchView.tsx`                      | **Mount the reporter.** The match view already knows the winner (`src/components/x01/X01MatchView.tsx:114,177,232-236`). **Cross-plan conflict:** the game-modes plan owns this file (M4 and M6), so **E2.2 runs after M4 and M6 have merged**. Only the mount point is contested — the reporter itself is new, and `GameResultBanner.tsx` (the game-modes plan's M5 file) is **not** touched. |
| `src/components/shell/navDestinations.ts`                  | **Not touched** — the lobby is already a destination (`:22`).                                                                                                                                                                                                                                                                                                                                  |

### Step E2.3 — owned by `qa-engineer`

The journeys.

| File                      | What changes                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/matchmaking.spec.ts` | Both `test.skip` placeholders (`:15`, `:47`) become real tests. The rating mock uses the **real** path `/api/rating/…` (singular) — the placeholder's `**/api/ratings/**` matches no route in the product. The stale header comment about `npm run dev` is removed. |

**No other file may be touched by this step.** In particular **not** `playwright.config.ts`.

---

## Dependencies (Abhängigkeit)

- **E2.1** depends on **E1.3** — the queue joins **two signed-in players**, so the login
  journey must be green before the queue can be exercised against real sessions.
- **E2.2** depends on **E2.1** — the control calls the route E2.1 shipped — and on
  **E1.2**, because `app/dashboard/page.tsx` was edited there. It also depends on the
  **game-modes plan's M4 and M6** having merged, because it mounts the reporter in
  `src/components/x01/X01MatchView.tsx`, a file those packages own.
- **E2.3** depends on **E2.2** — the spec asserts the surface.
- **E2.3 is a prerequisite of E3.1** — the career seam needs the login journey, and the
  queue journey must be settled before the next journey starts.

---

## Acceptance criteria (Akzeptanzkriterien)

### E2.1 — queue transport

1. `app/api/matchmaking/queue/route.ts` exports the handler and
   `src/realtime/matchmakingRoutes.ts` holds the logic with **injected** dependencies — the
   `app/api/**/route.ts` file wires the production runtime, the `src/**/route*.ts` file
   holds the behaviour.
2. The route **reuses** `PublicMatchmaker` (`src/realtime/matchmaking.ts:9`); the pairing
   logic is not duplicated and `src/realtime/matchmaking.ts` is not rewritten.
3. The queue reports a distinct **queued** state and a distinct **paired** state carrying
   the room id; an unmatched player never receives a room id.
4. `src/rating/ratingRuntime.ts` resolves a real session token; a request **without** a
   valid token is still rejected. The route signatures do not change.
5. The integration test proves the seam against an injected matchmaker and covers the
   queued, the paired and the rejected cases.

### E2.2 — queue surface

6. The "Find Match" control is a real button with an accessible name, and clicking it puts
   the lobby into a **searching** state that is visible without colour alone.
7. The **matched** state names the room; the **searching** state and the **matched** state
   are distinguishable, and neither is the empty-room state
   ("No public rooms right now.").
8. A rating readout is present on the lobby and on the dashboard, and it renders the value
   the server sent — never a placeholder such as `--`.
9. A **finished game is reported**: the reporter posts the two player ids and the winner
   to `POST /api/rating/game` exactly **once** per result, and not for a game that is
   still running. Without this, the rating journey has no trigger —
   `src/rating/ratingRoutes.ts:113` is the only production call site of `recordGameResult`.
10. The controls use the token vocabulary; no raw Tailwind colour class appears in the
    changed files.
11. `app/dashboard/page.tsx` keeps everything E1.2 wrote; E2.2 only appends.

### E2.3 — the journeys

12. `e2e/matchmaking.spec.ts` contains **0** `test.skip`
    (`grep -c "test.skip(" e2e/matchmaking.spec.ts` → `0`).
13. The queue journey clicks "Find Match", asserts the **searching** state, and then
    asserts the **matched** state **with the room id** — the room id is the assertion, not
    a generic "matched" word.
14. The rating journey asserts the rating **change**: the value before the game and the
    value after it differ by the expected amount. Asserting that a rating is merely
    _present_ is not enough.
15. Every mocked endpoint is a route the product actually has — `/api/matchmaking/queue`
    and `/api/rating/…` (singular).
16. The spec carries **no** stale comment about `npm run dev`.
17. The two tests share no state — no queue entry, no cookie, no row — so they pass under
    `fullyParallel: true` (`playwright.config.ts:5`).
18. The mocked rating payload matches the real route's answer — `GET /api/rating/:userId`
    answers a rating **profile** (`{ userId, mode, ...profile, perMode }`,
    `src/rating/ratingRoutes.ts:78`), not the `{ rating, change }` object the
    placeholder mocks (`e2e/matchmaking.spec.ts:51-53`).

---

## Verification command (Verifikationskommando)

```bash
# the seam (backend half)
npx vitest run tests/integration/matchmakingQueue.test.ts

# the page (frontend half)
npm run typecheck && npm run lint && npm run format:check

# the journeys (qa half) — against the production build that playwright.config.ts owns
npx playwright test e2e/matchmaking.spec.ts
```

The Playwright command builds and serves the production build itself
(`playwright.config.ts:46-61`); the browser must be installed once locally with
`npx playwright install chromium` — it is **not** part of `npm ci`.

---

## Result (Ergebnis)

<!-- Filled in when the package is executed. The three steps are recorded separately,
     each with the command output that proves it. -->
