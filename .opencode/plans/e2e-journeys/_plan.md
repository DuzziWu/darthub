# Plan — E2E Journeys: Login, Matchmaking, Career

**Feature slug:** `e2e-journeys`
**Created:** 2026-11-16
**Branch:** `cez/005e0185` · base `integration/opencode-team` `9343787`
**Carried by:** `integration/opencode-team`
**Status table last updated:** 2026-11-16

---

## Objective

Make the three end-to-end journey groups — **login**, **matchmaking** and **career** —
verifiable in a real browser, and replace the seven `test.skip` placeholders that stand in
for them today with tests that assert real behaviour.

The seven placeholders are not a harness problem and not an environment gate. They are a
**missing-product** problem: the surfaces the journeys drive (a sign-in page, a matchmaking
queue, a quest completion) either do not exist or exist as inert placeholders. This plan
therefore names the missing prerequisites, fixes the order in which they are built, and
gives each work package an owner, a file list, acceptance criteria and a verification
command.

The order is fixed: **Login → Matchmaking → Career**. Career needs the most prerequisites
(registration, a signed-in player, a rating), so it goes last.

---

## Discovery notes

### The measured state of `e2e/` (2026-11-16, branch `cez/005e0185` @ `9343787`)

Measurement commands:

```bash
grep -rn "test.skip\|test.describe.skip" e2e/
wc -l e2e/*.spec.ts
```

Result — exactly **seven** hits, all `test.skip(...)`, **no** `test.describe.skip(...)`:

| Spec file                 | Lines | `test.skip` at | Skipped test titles                                                                                      |
| ------------------------- | ----- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `e2e/career.spec.ts`      | 73    | 15, 39, 69     | "shows career quest display", "completes a quest and sees reward", "records rating changes after a game" |
| `e2e/login.spec.ts`       | 69    | 15, 44         | "signs up a new user and logs in", "converts a guest session to a registered account"                    |
| `e2e/matchmaking.spec.ts` | 66    | 15, 47         | "joins a public matchmaking queue and is paired", "records rating changes after a game"                  |

The three files hold **0** active tests. The other six spec files hold **47** active tests
(`game-center` 18, `visual-qc` 9, `subpath-preview` 7, `hub-pages` 5, `score-entry` 4,
`start-match` 4) — **54 tests in total** across nine spec files. This matches the count
the roadmap carries (`docs/ROADMAP.md:105-106`).

### The stated reason for the skips is half outdated

All three spec headers say the same thing — _"Tests are skipped because the app requires a
running dev server (npm run dev) and the backend … services are not yet fully wired"_
(`e2e/login.spec.ts:6-12`, `e2e/matchmaking.spec.ts:6-12`, `e2e/career.spec.ts:6-12`).

The first half is **wrong today**: the suite runs against a **production build**, not
`next dev` — `playwright.config.ts:21-45` documents exactly why (the dev server's
on-demand compilation stalls Playwright's actionability checks), and the base URL is
`http://localhost:3100` (`playwright.config.ts:11`). The second half is **right**, and this
plan is the inventory of it.

The skips are deliberate, not conditional: there is no `test.skip(condition)` expression
and no `process.env` guard anywhere in the three files.

### The harness facts the plan depends on

- `playwright.config.ts` owns **both** servers: the root build on **3100** and the prefixed
  build on **3111** (`playwright.config.ts:46-61`), each started by the config with a
  **300 s** budget (`playwright.config.ts:52,59`).
- `fullyParallel: true` (`playwright.config.ts:5`); CI runs **one** worker with **two**
  retries (`playwright.config.ts:7-8`).
- The browsers are **not** part of `npm ci`. CI installs them in a separate step —
  `npx playwright install --with-deps chromium` (`.github/workflows/ci.yml:66-67`).
- The e2e CI job has **no database service, no `DATABASE_URL` and no `AUTH_SECRET`**
  (`.github/workflows/ci.yml:44-78`). A journey that reaches a Prisma-backed route cannot
  pass in CI as the job stands.
- `src/camera/` is an **abstraction plus a smartphone stub**, not a running computer-vision
  pipeline: `ICameraService` / `ICameraProcessor` / `CameraDTO` are interfaces, and
  `SmartphoneCameraService` resolves a dummy fixed score (`src/camera/SmartphoneCameraService.ts:9,74,139`,
  `src/camera/index.ts:15-17`). Nothing in the three journeys touches it.
- **No page fetches any API.** `grep -rn "fetch(\|axios\|useSWR\|useQuery" app/ src/components/`
  returns **zero** hits. The client-side data-fetching pattern the journeys need does not
  exist yet; each frontend step introduces it, and each step may not introduce its own
  fetch library.

### Missing prerequisites — the honest inventory

This is the core of the plan. Each row is a prerequisite with its evidence and its owner.

#### Login (`e2e/login.spec.ts`)

| #   | Prerequisite                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                             | Owner                  | State                                                  |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| L1  | A sign-in page                                | `src/auth/nextauth.ts:32` sets `pages: { signIn: "/login" }`, but `app/` has **no** `login/` route — the configured sign-in page 404s.                                                                                                                                                                                                                                                               | `frontend`             | **missing**                                            |
| L2  | A registration transport                      | `src/auth/authService.ts:58-83` implements `registerUser`, but it has **no** route: the Auth.js `email` provider only _logs in_ (`src/auth/nextauth.ts:40-49`), and the one route that does register is the invitation-code path (`app/api/auth/invitation/route.ts:38-52`, `action: "register"`), which needs a code no page ever issues. There is no `app/api/auth/register/` route.               | `backend`              | **missing**                                            |
| L3  | An entry point into the auth flow             | `src/components/shell/navDestinations.ts:19-25` lists Home / Game Center / Lobby / Career / Dashboard — no auth destination. `app/page.tsx:15` renders only the `h1`.                                                                                                                                                                                                                                | `frontend`             | **missing**                                            |
| L4  | A control that starts a guest session         | `src/auth/guest.ts:109-144` `createGuestSession` and the `guest` credentials provider (`src/auth/nextauth.ts:51-61`) can create one; nothing in `app/` triggers it.                                                                                                                                                                                                                                  | `frontend`             | **missing**                                            |
| L5  | The guest → account conversion                | The **backend is mostly done**: `src/auth/linkGuestRoutes.ts` + `app/api/auth/link-guest/route.ts` exist, and `migrateGuestToUser` (`src/auth/guest.ts:146-179`) works. Two gaps remain: **no page offers the conversion**, and the one-time plaintext migration token (`src/auth/guest.ts:125-130`) is minted but **no route hands it to the client** — so the endpoint is unreachable in practice. | `backend` + `frontend` | **token hand-out missing**, UI missing                 |
| L6  | A signed-in player on `/dashboard`            | `app/dashboard/page.tsx:24-33` renders one empty state ("No completed matches yet.") and no name — there is no signed-in player behind it (`app/dashboard/page.tsx:7-11`).                                                                                                                                                                                                                           | `frontend`             | **missing**                                            |
| L7  | A session the browser can read                | Auth.js exposes `/api/auth/session` through `app/api/auth/[...nextauth]/route.ts`; the page does not read it.                                                                                                                                                                                                                                                                                        | `frontend`             | **missing**                                            |
| L8  | The placeholder's own assertions              | `e2e/login.spec.ts:29` expects the URL `/auth` — the product points at `/login`. `:28` expects a link named /sign up\|register\|login/i on `/`. `:17` mocks `**/api/auth/**`, a pattern that **also swallows** the Auth.js session probe `/api/auth/session`.                                                                                                                                        | `qa-engineer`          | **the placeholders must be rewritten, not un-skipped** |
| L9  | Somewhere for the browser to keep the session | **No application code writes a cookie** — `grep -rn "cookies()\|next/headers\|Set-Cookie" app/ src/` returns **zero** hits. The identity is a JWT string handed back in a JSON body (`src/auth/linkGuestRoutes.ts:81`, `src/auth/guest.ts:140`); the only cookie in play is Auth.js's own, from the catch-all handler.                                                                               | `backend` + `frontend` | **missing**                                            |

#### Matchmaking (`e2e/matchmaking.spec.ts`)

| #   | Prerequisite                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Owner                  | State                                   |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| M1  | A queue action that does something         | `app/lobby/page.tsx:29-31` renders a **"Find Match"** button — with **no handler**. The file is a server component with no client boundary and no queue state.                                                                                                                                                                                                                                                                                                                                                                                         | `frontend`             | **missing**                             |
| M2  | A queue endpoint                           | `app/api/` contains **no** `matchmaking/` route. The placeholders mock `**/api/matchmaking/**` (`e2e/matchmaking.spec.ts:17,36`) — a path the product does not have.                                                                                                                                                                                                                                                                                                                                                                                   | `backend`              | **missing**                             |
| M3  | The pairing logic reachable from the app   | `src/realtime/matchmaking.ts:9-35` `PublicMatchmaker` is imported **only** by `tests/unit/matchmaking.test.ts` — by no route, no socket server and no page. `REALTIME_EVENTS` (`src/realtime/types.ts:8-23`) has no enqueue/pair event either, although `docs/API.md:104-105` documents one.                                                                                                                                                                                                                                                           | `backend`              | **exists, unreachable**                 |
| M4  | The socket game loop                       | `src/realtime/GameStateMachine.ts:24` runs `NeutralScoreMode`, so the shipped x01 / Cricket / ATC / Shanghai modes are not reachable through the socket path; no Playwright spec drives the socket server. The realtime server is a **separate process** (`src/realtime/server.ts:53,67-73`, `npm run realtime`) that the app never starts, and the browser has **no socket client** — `socket.io-client` appears nowhere in `app/` or `src/components/`.                                                                                              | —                      | **out of scope** (see Scope)            |
| M5  | A rating readout                           | `app/lobby/page.tsx` shows the room list and the empty state only. The placeholder asserts a `/rating\|elo\|rank/i` text (`e2e/matchmaking.spec.ts:64`) that is not on the page.                                                                                                                                                                                                                                                                                                                                                                       | `frontend`             | **missing**                             |
| M6  | The rating route path and shape            | The placeholders mock `**/api/ratings/**` (`e2e/matchmaking.spec.ts:49`); the product has the **singular** `app/api/rating/[userId]/route.ts` and `app/api/rating/game/route.ts`. The mocked payload (`{ rating: 1500, change: +25 }`) is fictional too: the route answers a rating **profile** (`{ userId, mode, ...profile, perMode }`, `src/rating/ratingRoutes.ts:78`).                                                                                                                                                                            | `qa-engineer`          | **the placeholder's mock is fictional** |
| M7  | A rating change that a browser can trigger | Two gaps. **(a)** The production gateway **denies everything**: `src/rating/ratingRuntime.ts:32` builds `createBearerTokenAuthGateway()` with the default resolver `async () => null` (`src/rating/authGateway.ts`, `src/auth/requireAuth.ts:32,60`). **(b)** **No game ever triggers a rating change**: `recordGameResult` has exactly **one** production call site — the route handler itself (`src/rating/ratingRoutes.ts:113`). The realtime server, the game views and the engine never call it, and the client-side game never reports a result. | `backend` + `frontend` | **missing**                             |

#### Career (`e2e/career.spec.ts`)

| #   | Prerequisite                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owner                  | State                                       |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| C1  | A quest surface with progress                    | `app/career/page.tsx:41-62` renders "Current Quest" and "Progress" as **empty states** — "No active quest." (`:44`), "No progress yet." (`:57`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `frontend`             | **missing**                                 |
| C2  | A completion action                              | The page has no complete / finish / claim control; the placeholder clicks one (`e2e/career.spec.ts:62`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `frontend`             | **missing**                                 |
| C3  | A reward notification                            | `src/career/rewardService.ts:51-62` `createRewardService` exists but is imported **only** by `tests/unit/career/rewardService.test.ts`; nothing in `app/` surfaces a reward. **No XP is ever awarded either**: `awardXp` (`src/career/progressionService.ts:59-80`) is dead code in production — `questService.completeQuest` (`src/career/questService.ts:87-144`) never calls it, so a completed quest grants nothing at all. The real reward shape is `QuestRewards { xp, coins, unlockedItems? }` (`src/career/questSchema.ts:60-64`); the placeholder's `{ type: "badge", name: "Newcomer" }` has **no counterpart anywhere in the codebase**. | `backend` + `frontend` | **missing**                                 |
| C4  | A progress indicator in the token vocabulary     | The placeholder asserts `.bg-blue-600` (`e2e/career.spec.ts:36`) — a raw Tailwind class the token-only styling rule forbids and the app never renders (`app/career/page.tsx` uses `bg-brass` / `bg-raised`).                                                                                                                                                                                                                                                                                                                                                                                                                                        | `qa-engineer`          | **the placeholder's selector is fictional** |
| C5  | A reachable career API                           | `app/api/career/quest`, `app/api/career/progress` and `app/api/career/complete` exist as thin handlers — but the production gateway **denies everything**: `src/career/questRuntime.ts:33` uses `createBearerTokenAuthGateway()` with the default resolver (`src/career/auth/authGateway.ts:18-33`), so the routes answer **401**. The responses are `{ user, quest, progress }` (`src/career/questRoutes.ts:40-45`) and `{ user, progress, nextQuest }` (`:82-85`) — **not** the `currentQuest` / `completedQuest` / `rewards` shape the placeholder mocks (`e2e/career.spec.ts:20-23,45-52`).                                                     | `backend`              | **missing** (the seam exists)               |
| C6  | Durable progress                                 | `prisma/schema.prisma` has **no** `CareerQuestProgress` model; `src/career/questRuntime.ts:29` uses the in-memory repository (`src/career/careerProgressRepository.ts:66`). The repository is a module singleton (`:37`), so progress survives a page reload but not a process restart.                                                                                                                                                                                                                                                                                                                                                             | `backend`              | **sufficient for the journey**, not durable |
| C7  | A signed-in player                               | `app/career/page.tsx:9-13` states it: "there is no signed-in player behind this page yet".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `backend`              | **missing** (shared with L1–L7)             |
| C8  | The third placeholder                            | `e2e/career.spec.ts:69-72` has a body of **two comments** and no assertions — it must be **written**, not un-skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `qa-engineer`          | **missing**                                 |
| C9  | Quest objectives evaluated against a played game | The quest schema defines objectives (`src/career/questSchema.ts:10-17` — `matchWins`, `legsWon`, `checkout`, …), but **no code maps a played game onto them**. A quest advances because it was _completed_, not because the player did what it asked.                                                                                                                                                                                                                                                                                                                                                                                               | —                      | **out of scope** (see Scope)                |

### The strategy this plan prescribes

Two layers, with a clear division of proof:

1. **The page is proved by Playwright.** The browser journey drives the real UI against a
   **mocked transport** (`page.route`), exactly as all seven placeholders already do. None
   of the seven touches a database, and none must: the e2e CI job has no Postgres
   (`.github/workflows/ci.yml:44-78`). This keeps the suite runnable in the CI job that
   exists today.
2. **The seam is proved by Vitest.** The transport behind the page — registration, the
   matchmaking queue, the career quest service, the rating service — is covered by
   integration tests under `tests/integration/`, where a real repository can be injected.
   A Playwright test that mocks its own transport proves the **page**, not the **server**.

Consequence: a Playwright journey that only asserts "the page shows what the mocked
server sent" is close to a tautology. Every journey in this plan therefore asserts the
**page's own behaviour** — the state transition, the control, the resulting URL — and the
mock is the _input_, never the _assertion_.

The mocked payload must also be the **real** payload. Several of the placeholders mock a
shape the product never answers: the career endpoints answer `{ user, quest, progress }` and
`{ user, progress, nextQuest }` (`src/career/questRoutes.ts:40-45,82-85`), not the
`currentQuest` / `completedQuest` / `rewards` of `e2e/career.spec.ts:20-23,45-52`, and the
reward shape is `QuestRewards { xp, coins, unlockedItems? }`
(`src/career/questSchema.ts:60-64`), not a `{ type: "badge" }`. A mock that invents a
shape teaches the page a shape the server never sends.

---

## Scope

### In

- The seven `test.skip` placeholders in `e2e/career.spec.ts`, `e2e/login.spec.ts` and
  `e2e/matchmaking.spec.ts` replaced by real, asserting tests.
- The **minimum product surfaces** those journeys need, in the smallest honest form:
  a sign-in page and a registration transport, a matchmaking queue action and its endpoint,
  a quest-progress surface with a completion action that **grants** something, a client that
  **reports a finished game**, and a rating readout.
- The mock paths and selectors corrected to the **real** route paths and the **token**
  vocabulary.
- The spec headers corrected — they still claim the suite needs `npm run dev`.

### Out

- **No new test framework and no new dependency.** No `@playwright/test` plugins, no
  fixtures library, no mocking library — `page.route` is enough.
- **No change to `playwright.config.ts`, `vitest.config.ts` or the CI workflow** outside
  a `qa-engineer` package. The harness belongs to the `qa-engineer`; a package that needs
  it says so and names the harness owner.
- **No camera / computer-vision functionality.** `src/camera/` stays the abstraction plus
  the smartphone stub (`src/camera/index.ts:15-17`).
- **No socket-server rewrite.** The matchmaking journey drives the queue seam, not the
  full socket game loop; `NeutralScoreMode` (`src/realtime/GameStateMachine.ts:24`) stays
  as it is. The queue is a **REST** seam — `REALTIME_EVENTS` (`src/realtime/types.ts:8-23`)
  has no matchmaking event, and the browser has no socket client.
- **No evaluation of quest objectives against a played game.** The objectives
  (`src/career/questSchema.ts:10-17`) are not mapped onto a result anywhere; a quest
  advances because it was _completed_. That mapping is a separate piece of work.
- **No database-backed e2e.** The Postgres service, the migration step and the
  `AUTH_SECRET` for the e2e job are a **separate** piece of work; this plan keeps the
  journeys transport-mocked so they fit the CI job that exists.
- **No `docs/ROADMAP.md` edit.** The roadmap carries the matching status rows
  (`docs/ROADMAP.md:51-52,57-58,68-71,90-91,105-106`); the parallel documentation
  catch-up task owns that file. This plan only refers to it.
- **No change to the other six spec files.** They stay green and untouched.

---

## Success criteria

### Login

1. `e2e/login.spec.ts` contains **0** `test.skip` (`grep -c "test.skip(" e2e/login.spec.ts`
   → `0`).
2. `app/login/page.tsx` exists and renders a **labelled** email field and a **labelled**
   password field, so `page.getByLabel(/email/i)` and `page.getByLabel(/password/i)` resolve
   to exactly one element each.
3. The sign-up journey ends on `/dashboard` with the registered player's name visible.
4. The guest → account journey shows the registered state after the conversion and does
   **not** show the guest label any more.
5. Both journeys run against the **production build** served by `playwright.config.ts`
   and are green in the CI e2e job.

### Matchmaking

6. `e2e/matchmaking.spec.ts` contains **0** `test.skip`.
7. Clicking "Find Match" puts the lobby into a **searching** state, and the pairing moves
   it into a **matched** state that names the room.
8. The rating journey shows a rating before and a **different** rating after the game —
   the change is asserted, not the mere presence of a rating. A finished game is actually
   **reported** to the rating route: today nothing reports it, and
   `src/rating/ratingRoutes.ts:113` is the only production call site of `recordGameResult`.
9. The mocked rating endpoint uses the **real** path `/api/rating/…` (singular).

### Career

10. `e2e/career.spec.ts` contains **0** `test.skip`.
11. The career page shows the **current quest** and a **progress** value that the test can
    read as text or as an accessible value — not as a raw Tailwind class.
12. The completion journey shows the **reward** after the completion action, and the
    quest state changes.
13. The rating journey shows the rating change after a game.
14. The third career test — which today has an **empty body** (`e2e/career.spec.ts:69-72`)
    — is **written** and asserts real behaviour.
15. Every mocked **payload** matches the real route's response shape, not only the path:
    the career endpoints answer `{ user, quest, progress }` and
    `{ user, progress, nextQuest }` (`src/career/questRoutes.ts:40-45,82-85`), and the
    reward shape is `QuestRewards { xp, coins, unlockedItems? }`
    (`src/career/questSchema.ts:60-64`) — the placeholders' `currentQuest`,
    `completedQuest`, `rewards` and `type: "badge"` keys have no counterpart in the code.

### Across the plan

16. `npx playwright test` is green in the CI e2e job, with the three new spec files
    contributing **7** active tests and the total in `e2e/` rising from 54 to 54
    (47 active + 7 newly activated — the count of tests does not change, only their
    status).
17. `npm run lint`, `npm run format:check`, `npm run typecheck` and `npx vitest run` stay
    green after every step.
18. **No `test.skip` is introduced anywhere else** in `e2e/` — the count in `e2e/` is
    exactly **7** before the first step and exactly **0** after the last one.

---

## Ownership rules for this plan

1. **One owning agent per step.** The owner is accountable for the step's outcome.
2. **Area discipline.** `qa-engineer` owns `e2e/` and the harness (`playwright.config.ts`,
   `vitest.config.ts`, `tests/`). `backend` owns `src/auth/`, `src/realtime/`,
   `src/rating/`, `src/career/`, `app/api/` and `prisma/`. `frontend` owns `app/`
   (except `app/api/`) and `src/components/`. `game-engine` owns `src/game-engine/`,
   `src/board/`, `src/ai/`, `src/camera/` — **no step in this plan touches the engine**,
   `src/board/`, `src/ai/` or `src/camera/`.
3. **A step that spans two areas is split into two sequenced steps.** Each journey is
   three steps in a fixed order — **backend seam → frontend surface → the Playwright
   spec** — and the table's `Depends On` column names the predecessor.
4. **The Playwright step comes last in each journey.** A spec written against a surface
   that does not exist yet is a guess; the spec is written against the surface the
   frontend step shipped.
5. **`app/api/` belongs to `backend`.** The frontend steps never add a route; they call
   the routes the backend step shipped.
6. **The harness belongs to `qa-engineer`.** No step in this plan edits
   `playwright.config.ts` or `vitest.config.ts`. If a step needs the harness to change,
   that is a **separate `qa-engineer` package** named in that step's file list.
7. **Same-file conflicts are resolved by sequence, never by parallelism.** The single
   order **E1.1 → E1.2 → E1.3 → E2.1 → E2.2 → E2.3 → E3.1 → E3.2 → E3.3** resolves every
   overlap listed below.

### Same-file conflicts and their resolution

| File                                                           | Wanted by  | Owner of the file | Resolution                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/login.spec.ts`                                            | E1.3       | `qa-engineer`     | E1.3 only — the file is written once, after E1.1 and E1.2.                                                                                                                                                                                                                                                                                                                             |
| `e2e/matchmaking.spec.ts`                                      | E2.3       | `qa-engineer`     | E2.3 only.                                                                                                                                                                                                                                                                                                                                                                             |
| `e2e/career.spec.ts`                                           | E3.3       | `qa-engineer`     | E3.3 only.                                                                                                                                                                                                                                                                                                                                                                             |
| `app/login/page.tsx`                                           | E1.2       | `frontend`        | Created by E1.2. No other step touches it.                                                                                                                                                                                                                                                                                                                                             |
| `app/dashboard/page.tsx`                                       | E1.2, E2.2 | `frontend`        | **E1.2 → E2.2.** E1.2 adds the signed-in player's name; E2.2 appends the rating readout. Different blocks, same file.                                                                                                                                                                                                                                                                  |
| `app/lobby/page.tsx`                                           | E2.2       | `frontend`        | E2.2 only. The "Find Match" button becomes a client component.                                                                                                                                                                                                                                                                                                                         |
| `app/career/page.tsx`                                          | E3.2       | `frontend`        | E3.2 only.                                                                                                                                                                                                                                                                                                                                                                             |
| `src/auth/nextauth.ts`                                         | E1.1       | `backend`         | E1.1 only. The registration transport is added as a thin route over the existing `authService`, **not** as a third Auth.js provider. E1.1's **only** change to this file is the `guest` provider, which must surface the one-time migration token (`src/auth/guest.ts:125-130`) — without it `POST /api/auth/link-guest` is unreachable. The `email` provider (`:34-50`) is untouched. |
| `src/career/questRuntime.ts`, `src/career/auth/authGateway.ts` | E3.1       | `backend`         | E3.1 only.                                                                                                                                                                                                                                                                                                                                                                             |
| `src/rating/ratingRuntime.ts`                                  | E2.1       | `backend`         | E2.1 only.                                                                                                                                                                                                                                                                                                                                                                             |
| `src/components/x01/X01MatchView.tsx`                          | E2.2       | `frontend`        | **Cross-plan conflict.** The game-modes plan owns this file — M4 and M6 edit it (`.opencode/plans/game-modes-multiplayer/_plan.md:217,219`). E2.2 mounts the result reporter there, so **E2.2 runs after M4 and M6 have merged**. The reporter itself is a **new** file, so only the mount point is contested.                                                                         |
| `src/components/game/GameResultBanner.tsx`                     | —          | `frontend`        | **Not touched by this plan** — it is the game-modes plan's M5 file. The reporter is a separate component.                                                                                                                                                                                                                                                                              |
| `docs/ROADMAP.md`                                              | —          | **parallel task** | **Not touched by any step of this plan.**                                                                                                                                                                                                                                                                                                                                              |

### How the task table maps onto the package files

The table has **one row per sequenced step** — nine rows — because the status column is
the recovery mechanism and a step is the unit of work that is verified. The three package
files each own the three steps of one journey:

| Package file                  | Steps            |
| ----------------------------- | ---------------- |
| `001-login-journeys.md`       | E1.1, E1.2, E1.3 |
| `002-matchmaking-journeys.md` | E2.1, E2.2, E2.3 |
| `003-career-journeys.md`      | E3.1, E3.2, E3.3 |

---

## Task table

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Owner         | Files                                                                                                                                                                                                                                                  | Depends On                                                                                                                                                                                        | Status  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **E1.1** | **Login — the registration transport.** A thin route over the existing `authService.registerUser` (`src/auth/authService.ts:58-83`), following the established convention (`src/auth/linkGuestRoutes.ts` + `app/api/auth/link-guest/route.ts`): `src/auth/registerRoutes.ts` (new) and `app/api/auth/register/route.ts` (new). The handler takes injected dependencies so it needs no database in a test, validates the input, and never echoes the password. The `guest` credentials provider (`src/auth/nextauth.ts:51-61`) must also surface the **one-time migration token** (`src/auth/guest.ts:125-130`), without which `POST /api/auth/link-guest` is unreachable. Covered by a Vitest integration test.                     | `backend`     | **owned:** `src/auth/registerRoutes.ts` (create); `app/api/auth/register/route.ts` (create); `src/auth/nextauth.ts`; `tests/integration/registerUser.test.ts` (create)                                                                                 | none — first step of the plan                                                                                                                                                                     | pending |
| **E1.2** | **Login — the sign-in surface.** `app/login/page.tsx` (create): a sign-in **and** sign-up form with one labelled email field and one labelled password field, a guest-session control, and the guest → account conversion control. `app/page.tsx` and `src/components/shell/navDestinations.ts` gain the auth entry point; `app/dashboard/page.tsx` shows the signed-in player's name instead of only the empty state. The controls use the token vocabulary, never a raw Tailwind class.                                                                                                                                                                                                                                           | `frontend`    | **owned:** `app/login/page.tsx` (create); `app/page.tsx`; `src/components/shell/navDestinations.ts`; `app/dashboard/page.tsx`                                                                                                                          | **after E1.1** — the form posts to the route E1.1 shipped                                                                                                                                         | pending |
| **E1.3** | **Login — the real journey.** `e2e/login.spec.ts` loses both `test.skip` placeholders and becomes two asserting tests: sign up and land on `/dashboard` with the name visible; convert a guest session and see the registered state. The mock paths are corrected to the real endpoints (`/api/auth/register`, `/api/auth/session` — **not** the blanket `**/api/auth/**`), the URL expectation becomes the shipped `/login`, and the stale header comment about `npm run dev` is removed.                                                                                                                                                                                                                                          | `qa-engineer` | **owned:** `e2e/login.spec.ts`                                                                                                                                                                                                                         | **after E1.2** — the spec is written against the surface E1.2 shipped                                                                                                                             | pending |
| **E2.1** | **Matchmaking — the queue transport.** A thin route over the pairing logic that exists but is unreachable (`src/realtime/matchmaking.ts:9-35` `PublicMatchmaker`, today imported only by `tests/unit/matchmaking.test.ts`): `src/realtime/matchmakingRoutes.ts` (new) and `app/api/matchmaking/queue/route.ts` (new), so the lobby can enqueue and poll for a pairing. The rating gateway gets a real token resolver instead of the default `async () => null` (`src/rating/ratingRuntime.ts:32`), so the rating route can serve a browser session.                                                                                                                                                                                 | `backend`     | **owned:** `src/realtime/matchmakingRoutes.ts` (create); `app/api/matchmaking/queue/route.ts` (create); `src/rating/ratingRuntime.ts`; `tests/integration/matchmakingQueue.test.ts` (create)                                                           | **after E1.3** — the queue joins two signed-in players, so the login journey must be green first                                                                                                  | pending |
| **E2.2** | **Matchmaking — the queue surface.** `app/lobby/page.tsx`'s "Find Match" button (`app/lobby/page.tsx:29-31`) becomes a control that posts to the queue route, shows a **searching** state, and shows the **matched** state with the room; a rating readout joins the lobby and the dashboard. The **finished game is reported** to `POST /api/rating/game` — nothing reports it today, so the rating journey has no trigger without this.                                                                                                                                                                                                                                                                                           | `frontend`    | **owned:** `app/lobby/page.tsx`; `app/dashboard/page.tsx` (**append** — the rating readout); `src/components/game/MatchResultReporter.tsx` (create); `src/components/x01/X01MatchView.tsx` (**mount the reporter** — see the same-file conflict below) | **after E2.1** — the control calls the route E2.1 shipped. **After E1.2** — `app/dashboard/page.tsx` was edited by E1.2. **After the game-modes plan's M4 and M6** — `X01MatchView.tsx` is theirs | pending |
| **E2.3** | **Matchmaking — the real journey.** `e2e/matchmaking.spec.ts` loses both `test.skip` placeholders and becomes two asserting tests: join the queue, reach the matched state with a room; and a rating change after a game, asserting the **change** and not merely the presence of a rating. The rating mock uses the real path `/api/rating/…` (singular, not `**/api/ratings/**`).                                                                                                                                                                                                                                                                                                                                                 | `qa-engineer` | **owned:** `e2e/matchmaking.spec.ts`                                                                                                                                                                                                                   | **after E2.2**                                                                                                                                                                                    | pending |
| **E3.1** | **Career — the reachable seam.** The career API stops denying every request: `src/career/questRuntime.ts:33` gets a token resolver that verifies a real session (the seam already exists in `src/auth/requireAuth.ts:32,60`), so `app/api/career/quest`, `/progress` and `/complete` answer a signed-in browser. The completion **grants** something: `awardXp` (`src/career/progressionService.ts:59-80`) is dead code today — `completeQuest` never calls it — so the reward is wired into the completion path. The in-memory progress repository (`src/career/questRuntime.ts:29`) is kept — it is a module singleton and survives the reload the journey performs — and its **lack of durability** is recorded, not fixed here. | `backend`     | **owned:** `src/career/questRuntime.ts`; `src/career/auth/authGateway.ts`; `src/career/questService.ts`; `src/career/progressionService.ts`; `tests/integration/career/questRouteAuth.test.ts` (create)                                                | **after E2.3** — the career page needs a signed-in player, which the login journey delivers                                                                                                       | pending |
| **E3.2** | **Career — the quest surface.** `app/career/page.tsx` replaces the "No active quest." / "No progress yet." empty states with the **current quest**, a **progress** value and a **completion** control; the completion surfaces the **reward** in the real `QuestRewards { xp, coins, unlockedItems? }` shape. The progress indicator uses the token vocabulary — the raw `.bg-blue-600` selector the placeholder asserts is not a thing the app renders.                                                                                                                                                                                                                                                                            | `frontend`    | **owned:** `app/career/page.tsx`                                                                                                                                                                                                                       | **after E3.1** — the page reads the routes E3.1 made reachable                                                                                                                                    | pending |
| **E3.3** | **Career — the real journey.** `e2e/career.spec.ts` loses all three `test.skip` placeholders and becomes three asserting tests: the quest display, the completion with its reward, and the rating change after a game — the third is **written from scratch**, its body today being two comments. The mock paths **and payloads** are corrected to the real ones: `/api/career/quest` answers `{ user, quest, progress }` and `/api/career/complete` answers `{ user, progress, nextQuest }` (`src/career/questRoutes.ts:40-45,82-85`) — not the `currentQuest` / `completedQuest` / `rewards` shape the placeholder mocks. The progress assertion targets a real element rather than a raw Tailwind class.                         | `qa-engineer` | **owned:** `e2e/career.spec.ts`                                                                                                                                                                                                                        | **after E3.2**                                                                                                                                                                                    | pending |

---

## Dependencies

The order is not a preference; each arrow is a hard prerequisite.

```
E1.1 (registration transport)
  └─► E1.2 (sign-in surface)        the form has an endpoint to post to
        └─► E1.3 (login journey)    the spec is written against a shipped surface
              └─► E2.1 (queue transport)  the queue joins two signed-in players
                    └─► E2.2 (queue surface)
                          └─► E2.3 (matchmaking journey)
                                └─► E3.1 (reachable career seam)  needs a signed-in player
                                      └─► E3.2 (quest surface)
                                            └─► E3.3 (career journey)
```

- **E1.1 → E1.2** — a form that posts to a route that does not exist is a dead control.
- **E1.2 → E1.3** — the spec asserts the surface; the surface must exist first.
- **E1.3 → E2.1** — matchmaking pairs **two players**, so the login journey must be green
  before the queue can be exercised against signed-in sessions.
- **E2.2 → E2.3** — as E1.2 → E1.3.
- **E1.3 → E3.1** — the career page needs a **signed-in player**; the career page says so
  itself (`app/career/page.tsx:9-13`).
- **E3.1 → E3.2** — the page reads routes that answer only after E3.1.
- **E3.2 → E3.3** — as E1.2 → E1.3.

The `qa-engineer` steps are last in their journey because a spec written against a
surface that does not exist yet is a guess.

**One dependency crosses a plan boundary.** E2.2 mounts the result reporter in
`src/components/x01/X01MatchView.tsx`, a file the game-modes plan owns (M4 and M6).
**E2.2 runs after M4 and M6 have merged** into `integration/opencode-team`. The reporter
itself is a new file, so only the mount point is contested.

---

## Risks

| #   | Risk                                                                                                                                                                                                                                                                                                                                                                                                                          | Likelihood                                                                 | Impact                                                                             | Mitigation                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`test.skip` invites permanent skipping.** The placeholders have carried the journey for months and the e2e CI job is green anyway, so nothing forces them to be written.                                                                                                                                                                                                                                                    | **certain** — it is the current state                                      | high — the journey stays unverified indefinitely                                   | The success criteria count the skips explicitly (`grep -c "test.skip(" e2e/<file>` → 0 per file, 7 → 0 across `e2e/`); criterion 17 makes the total a checked number, not an intention.                                                                                                                                                          |
| 2   | **The Docker unit test is environment-bound, and a red `dockerignore` looks like a regression.** In this tree `tests/unit/dockerignore.test.ts:187-193` runs a **real** `docker build` under a hard **900 s** timeout (`{ timeout: 900_000 }`) on a 2-CPU host.                                                                                                                                                               | medium — it happens whenever another build shares the daemon               | medium — a false regression sends an implementer chasing a break that is not there | A red `dockerignore` is **contention, not a regression**: re-run `npx vitest run tests/unit/dockerignore.test.ts` **alone** before investigating. On branches where the live build became **opt-in** (`DART_DOCKER_BUILD=1`), the plain run skips it and prints the reason — run it alone with that flag. The file touches nothing in this plan. |
| 3   | **`npx playwright install` is not part of `npm ci`.** A local run without the browser fails with "Executable doesn't exist", which reads like a broken spec.                                                                                                                                                                                                                                                                  | **certain** without the step                                               | low — a confusing first run                                                        | CI installs the browser in its own step (`.github/workflows/ci.yml:66-67`); a local run needs `npx playwright install chromium` once. The plan's verification command says so.                                                                                                                                                                   |
| 4   | **The e2e CI job has no database and no `AUTH_SECRET`** (`.github/workflows/ci.yml:44-78`). A journey that reaches a Prisma-backed route fails in CI while passing locally.                                                                                                                                                                                                                                                   | medium — it is the moment a spec stops mocking its transport               | high — the e2e job goes red and the plan stalls                                    | The plan prescribes a **mocked transport** for every journey (see "The strategy this plan prescribes"); the seams are proved by Vitest integration tests, where a repository can be injected.                                                                                                                                                    |
| 5   | **`fullyParallel: true` (`playwright.config.ts:5`)** — the new specs run concurrently, so shared mutable state (one registered account, one server-side row) would make them flaky.                                                                                                                                                                                                                                           | low under the mocked strategy                                              | medium — intermittent red                                                          | Every journey uses its **own** test data; no spec depends on another; no database row is shared.                                                                                                                                                                                                                                                 |
| 6   | **The placeholders' mocks are fictional in path _and_ in payload** — `**/api/ratings/**` (no such route), `**/api/matchmaking/**` (no such route), `**/api/auth/**` (swallows the session probe); and the career payloads use `currentQuest` / `completedQuest` / `rewards` / `type: "badge"`, none of which the real endpoints answer. Un-skipping them verbatim would produce tests that pass without touching the product. | **certain** if the placeholders are merely un-skipped                      | high — false-green tests, the worst outcome                                        | Every package lists the corrected paths **and** the real payload shapes in its acceptance criteria; the mocked endpoint must be a route the product actually has, answering the shape it really answers.                                                                                                                                         |
| 7   | **The placeholders' header comments are wrong** — they say the suite needs `npm run dev` (`e2e/login.spec.ts:6-12`), which is false since the suite runs against a production build (`playwright.config.ts:21-45`). Leaving them misleads the next implementer.                                                                                                                                                               | **certain**                                                                | medium — a wrong premise drives the wrong fix                                      | Each package's file list includes the header comment of the spec it rewrites.                                                                                                                                                                                                                                                                    |
| 8   | **The career progress is not durable** — there is no `CareerQuestProgress` model in `prisma/schema.prisma`, and `src/career/questRuntime.ts:29` uses the in-memory repository. A journey that reloads the page is fine (the repository is a module singleton), but a journey that **restarts the server** loses the progress.                                                                                                 | medium                                                                     | medium — a journey that looks green in CI and red in production                    | E3.1 keeps the in-memory repository **on purpose** and records the limitation; the durability work is a separate package. The career journey asserts the **transition**, not the persistence.                                                                                                                                                    |
| 9   | **`docs/ROADMAP.md` is edited by a parallel documentation task.** This plan wants to reference it (and the roadmap already carries the matching rows, `docs/ROADMAP.md:105-106`).                                                                                                                                                                                                                                             | **certain**                                                                | medium — a lost edit or a merge conflict                                           | No step of this plan touches `docs/ROADMAP.md`; the roadmap is referenced, never edited.                                                                                                                                                                                                                                                         |
| 10  | **A journey degenerates into a tautology** — a test that asserts only "the page shows what the mock sent" proves nothing about the product.                                                                                                                                                                                                                                                                                   | medium                                                                     | high — green tests, no coverage                                                    | The division of proof is explicit: Playwright asserts the **page's behaviour** (the state transition, the control, the resulting URL); Vitest asserts the **seam**. Criterion 2, 4, 7, 8, 11 and 12 are written against behaviour, not against a payload.                                                                                        |
| 11  | **The plan's own inventory is wrong somewhere** — a `file:line` citation that moved, or a route that exists and was missed.                                                                                                                                                                                                                                                                                                   | low — every citation in this plan was read in the tree on 2026-11-16       | medium — a step builds the wrong thing                                             | Every package re-reads its own citations before editing, and the first acceptance criterion of each package is "the cited file and line still say what this plan says".                                                                                                                                                                          |
| 12  | **The rating journey has no trigger.** Nothing in the app reports a finished game — `src/rating/ratingRoutes.ts:113` is the only production call site of `recordGameResult` — so a journey that "plays a game" has nothing to play and nothing to report.                                                                                                                                                                     | medium — it surfaces only when the journey is written                      | high — the rating journey cannot be written at all                                 | E2.1 makes the route reachable and E2.2 makes the client report the result; the journey asserts the **change**, which fails loudly when the report never happens.                                                                                                                                                                                |
| 13  | **A completed quest grants nothing.** `awardXp` (`src/career/progressionService.ts:59-80`) is dead code — `completeQuest` never calls it — so a "reward" journey would assert an empty reward, and `rewardService` is imported only by a unit test.                                                                                                                                                                           | **certain** today                                                          | high — the reward journey is meaningless                                           | E3.1 wires the award into the completion path and E3.2 surfaces the real `QuestRewards` shape; the journey asserts the **granted value**, not the mere presence of a notice.                                                                                                                                                                     |
| 14  | **The guest → account conversion is unreachable.** The one-time migration token is minted (`src/auth/guest.ts:125-130`) but **no route hands it to the client**, so `POST /api/auth/link-guest` cannot be called by a browser.                                                                                                                                                                                                | **certain** today                                                          | high — the second login journey cannot be written                                  | E1.1 makes the `guest` provider surface the token; E1.2 keeps it and posts it; E1.3 asserts the conversion end to end.                                                                                                                                                                                                                           |
| 15  | **E2.2 touches a file the game-modes plan owns.** `src/components/x01/X01MatchView.tsx` is edited by M4 and M6 of `.opencode/plans/game-modes-multiplayer/`. Two plans editing one file is the failure mode the ownership rules exist to prevent.                                                                                                                                                                             | medium — the game-modes plan is mid-flight (M2/M3 in flight on 2026-11-16) | medium — a lost edit or a merge conflict                                           | E2.2 runs **after** M4 and M6 have merged; the reporter itself is a new file, so only the mount point is contested. The same-file conflict table names it.                                                                                                                                                                                       |

---

## Progress log

| Date       | Event                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Plan created                   | The seven `test.skip` placeholders in `e2e/career.spec.ts` (3), `e2e/login.spec.ts` (2) and `e2e/matchmaking.spec.ts` (2) were measured and turned into nine sequenced steps across three journey packages. **No `test.skip` was removed, no spec was written and no product feature was built** — this package is documentation only. The measurements (`grep -rn "test.skip\|test.describe.skip" e2e/` → 7 hits; `wc -l e2e/*.spec.ts` → 73 / 69 / 66 for the three files) match the counts the task order gave, and the roadmap's own rows (`docs/ROADMAP.md:105-106`: 9 spec files, 54 tests, 7 placeholders) agree.                                                                                                                                                                                                                                                                                                                |
| 2026-11-16 | Inventory verified in the tree | Every prerequisite in the "Missing prerequisites" tables was read first-hand at `9343787`: the missing `/login` route (`src/auth/nextauth.ts:32`), the missing registration transport (`src/auth/authService.ts:13` vs. `src/auth/nextauth.ts:44`), the inert "Find Match" button (`app/lobby/page.tsx:29-31`), the unreachable `PublicMatchmaker` (`src/realtime/matchmaking.ts:9`, imported only by `tests/unit/matchmaking.test.ts`), the career empty states (`app/career/page.tsx:41-62`), and the two **deny-everything** auth gateways (`src/rating/ratingRuntime.ts:32`, `src/career/questRuntime.ts:33`).                                                                                                                                                                                                                                                                                                                      |
| 2026-11-16 | Inventory cross-checked        | A read-only survey of the three journeys' prerequisites was run independently and **confirmed** the inventory above, and added four gaps the first pass had not named: **no page fetches any API** (`fetch(` → 0 hits in `app/` and `src/components/`); **no game ever reports a result** (`recordGameResult`'s only production call site is the route handler itself, `src/rating/ratingRoutes.ts:113`); **a completed quest grants nothing** (`awardXp` is dead code — `completeQuest` never calls it, `src/career/progressionService.ts:59-80`); and **the guest → account conversion is unreachable**, because the one-time migration token (`src/auth/guest.ts:125-130`) is minted but no route hands it to the client. The career payload shapes were also corrected — the endpoints answer `{ user, quest, progress }` and `{ user, progress, nextQuest }`, not the placeholders' `currentQuest` / `completedQuest` / `rewards`. |
| 2026-11-16 | Suite verified green           | The full suite was run in this worktree **after** the plan was written, as the proof that no application code was touched: `npx vitest run --reporter=dot` → **108 test files / 583 tests, all passed**, exit 0, 1246.22 s. `npx prettier .opencode/plans --check` → _"All matched files use Prettier code style!"_. `npx eslint .` → exit 0, no output. `git status --short` shows **only** the new `.opencode/plans/e2e-journeys/` directory — no tracked file was modified.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-16 | **Next step**                  | Execute E1.1 (`backend`, the registration transport) — the first step of the login journey. Nothing else may start before E1.1 is green.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |     |
