# 003 — Career journeys: the quest, the completion, the reward, the rating change

**Owning agents:** `backend` (E3.1) → `frontend` (E3.2) → `qa-engineer` (E3.3)
**Plan:** `.opencode/plans/e2e-journeys/_plan.md` → E3.1, E3.2, E3.3
**Created:** 2026-11-16
**Branch:** `cez/005e0185` · base `integration/opencode-team` `9343787`

---

## Scope

Turn the three `test.skip` placeholders in `e2e/career.spec.ts` into real journeys, and
build the quest surface they drive.

**In scope**

- A **reachable career API** — the routes `app/api/career/quest`, `/progress` and
  `/complete` exist, but their production gateway **denies every request**
  (`src/career/questRuntime.ts:33` builds `createBearerTokenAuthGateway()` with the default
  resolver `async () => null`). This package gives the gateway a real session resolver.
- A completion that **grants** something — `awardXp` (`src/career/progressionService.ts:59-80`)
  is dead code in production; `questService.completeQuest`
  (`src/career/questService.ts:87-144`) never calls it, so a completed quest currently
  rewards nothing and the "sees reward" journey would assert an empty reward.
- The **quest surface** — `app/career/page.tsx` replaces its "No active quest." / "No
  progress yet." empty states with the current quest, a progress value, a completion control
  and the reward.
- The **three journeys** in `e2e/career.spec.ts`, with the mock paths **and payloads**
  corrected to the real ones, and the progress assertion retargeted from a raw Tailwind
  class to a real element.

**Out of scope**

- **Durable** career progress. `prisma/schema.prisma` has no `CareerQuestProgress` model
  and `src/career/questRuntime.ts:29` uses the in-memory repository. The repository is a
  module singleton, so it survives the page reload the journey performs — but not a process
  restart. The durability work is a **separate** package; this one records the limitation.
- **Quest objectives evaluated against a played game.** The objectives
  (`src/career/questSchema.ts:10-17` — `matchWins`, `legsWon`, `checkout`, …) are never
  mapped onto a result; a quest advances because it was _completed_, not because the player
  did what it asked. That mapping is a **separate** piece of work.
- The **quest catalogue** — the six definitions under `src/career/quests/` and the loader
  (`src/career/questLoader.ts`) stay as they are; the page already reads them.
- The **adaptive difficulty hook** — `src/career/adaptiveEngine.ts` is not injected into
  the runtime quest service (`src/career/questRuntime.ts:32`); this plan does not change
  that.
- The **login journey** (`001`) and the **matchmaking journey** (`002`) — they are the
  prerequisites, not part of this package.
- `docs/ROADMAP.md` — the parallel documentation task owns it.

---

## Files

### Step E3.1 — owned by `backend`

The reachable seam.

| File                                                           | What changes                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/career/questRuntime.ts`                                   | The gateway gets a **real** token resolver (`:33`) instead of the default `async () => null` — the seam already exists in `src/auth/requireAuth.ts:32,60`. The in-memory progress repository (`:29`) is kept **on purpose**: it is a module singleton (`:37`) and survives the reload the journey performs. |
| `src/career/auth/authGateway.ts`                               | The resolver seam is named and typed so the runtime can inject the session verifier. The **contract** — `getCurrentUser(request)` returning the user id or `null` — does not change.                                                                                                                        |
| `src/career/questService.ts`                                   | `completeQuest` (`:87-144`) **grants** the quest's reward: it calls the progression seam, which today is never invoked from anywhere in production (`awardXp`, `src/career/progressionService.ts:59-80`, is dead code).                                                                                     |
| `src/career/progressionService.ts`                             | The award path is wired where it belongs, so the granted XP and coins reach the response. The exported functions keep their current names and shapes.                                                                                                                                                       |
| `tests/integration/career/questRouteAuth.test.ts` (**create**) | The seam is proved here: an authenticated request is answered, an anonymous one is **not**.                                                                                                                                                                                                                 |

**No other file may be touched by this step.** In particular **not** `prisma/schema.prisma`
and **not** `src/career/careerProgressRepository.ts` — the durability gap is recorded, not
closed here.

### Step E3.2 — owned by `frontend`

The quest surface.

| File                  | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/career/page.tsx` | The "Current Quest" and "Progress" sections (`:41-62`) stop being empty states and show the **current quest** and its **progress**; a **completion** control is added; completing it surfaces the **reward** in the real `QuestRewards { xp, coins, unlockedItems? }` shape (`src/career/questSchema.ts:60-64`). The progress indicator uses the token vocabulary — the raw `.bg-blue-600` selector the placeholder asserts is not a thing this app renders. |

**No other file may be touched by this step.**

### Step E3.3 — owned by `qa-engineer`

The journeys.

| File                 | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/career.spec.ts` | All three `test.skip` placeholders (`:15`, `:39`, `:69`) become real tests. The third one is **written from scratch** — its body today is two comments and no assertions (`:69-72`). The mock paths **and payloads** are corrected: `/api/career/quest` answers `{ user, quest, progress }` and `/api/career/complete` answers `{ user, progress, nextQuest }` (`src/career/questRoutes.ts:40-45,82-85`) — **not** the `currentQuest` / `completedQuest` / `rewards` shape the placeholder mocks (`e2e/career.spec.ts:20-23,45-52`), and **not** a `{ type: "badge" }` reward, which has no counterpart in the codebase. The progress assertion targets a real element instead of the raw Tailwind class `.bg-blue-600`; the stale header comment about `npm run dev` is removed. |

**No other file may be touched by this step.** In particular **not** `playwright.config.ts`.

---

## Dependencies (Abhängigkeit)

- **E3.1** depends on **E1.3** — the career page needs a **signed-in player**, and the page
  says so itself (`app/career/page.tsx:9-13`). The login journey must be green first.
  It also depends on **E2.3** by plan order.
- **E3.2** depends on **E3.1** — the page reads routes that answer only once the gateway
  resolves a real session.
- **E3.3** depends on **E3.2** — the spec asserts the surface. Its rating test additionally
  depends on the **report path E2.2** built: a finished game has to reach
  `POST /api/rating/game` for a rating to change.

---

## Acceptance criteria (Akzeptanzkriterien)

### E3.1 — reachable seam

1. `src/career/questRuntime.ts` resolves a **real** session token; a request with a valid
   token is answered and an anonymous request is **not** — the "denies everything" default
   (`src/career/questRuntime.ts:33`, `src/career/auth/authGateway.ts:18-33`) is gone from
   the production runtime.
2. The `AuthGateway` contract — `getCurrentUser(request)` returning the user id or `null`
   — is **unchanged**; the resolver is injected, not baked into the gateway.
3. `app/api/career/quest`, `/progress` and `/complete` keep their current paths and their
   current request and response shapes.
4. A completed quest **grants** its reward: `completeQuest`
   (`src/career/questService.ts:87-144`) calls the progression seam, so the granted XP and
   coins appear in the completion response. `awardXp`
   (`src/career/progressionService.ts:59-80`) is no longer dead code in production.
5. The in-memory progress repository stays (`:29`), and the **lack of durability** is
   recorded in the file's comment — the next reader must not mistake it for persistence.
6. The integration test proves the seam against an injected resolver and covers **both**
   the authenticated and the anonymous request.

### E3.2 — quest surface

7. The page shows the **current quest** — its name and its progress — read from the career
   route, not invented in the page.
8. A **completion** control exists, is reachable by role and name, and is a real button
   with a visible focus state.
9. Completing the quest changes the page's state — the quest advances or the page reports
   the completion — and the **reward** is surfaced.
10. The progress indicator uses the token vocabulary and carries a **text or accessible
    value** the test can read. No raw Tailwind colour class appears in the file.
11. The **Training** section (`:64-74`) and the quest catalogue it lists are unchanged.

### E3.3 — the journeys

12. `e2e/career.spec.ts` contains **0** `test.skip`
    (`grep -c "test.skip(" e2e/career.spec.ts` → `0`).
13. The quest journey asserts the **current quest** and a **progress** value that the test
    reads as text or as an accessible value — not as a raw Tailwind class.
14. The completion journey performs the completion action and asserts the **reward** and
    the changed quest state.
15. The third test — **written from scratch**, its body today being two comments
    (`:69-72`) — asserts the **rating change** after a game: the value before and the value
    after differ. Asserting that a rating is merely _present_ is not enough.
16. Every mocked endpoint is a route the product actually has — `/api/career/quest`,
    `/api/career/progress`, `/api/career/complete`, `/api/rating/…`.
17. The three tests share no state — no quest progress, no cookie, no row — so they pass
    under `fullyParallel: true` (`playwright.config.ts:5`).
18. The spec carries **no** stale comment about `npm run dev`.
19. The mocked **payloads** match the real answers: `{ user, quest, progress }` from
    `GET /api/career/quest` and `{ user, progress, nextQuest }` from
    `POST /api/career/complete` (`src/career/questRoutes.ts:40-45,82-85`). The placeholders'
    `currentQuest`, `completedQuest` and `rewards` keys are gone — no real response carries
    them.
20. The reward the journey asserts is the **granted value** — the XP and coins from
    `QuestRewards` (`src/career/questSchema.ts:60-64`) — read from the completion
    response. Asserting that a notice is _visible_ is not enough.
21. The rating journey reuses the **report path** E2.2 built: the client reports a finished
    game to `POST /api/rating/game`. It does not invent a second way of reporting a result.

---

## Verification command (Verifikationskommando)

```bash
# the seam (backend half)
npx vitest run tests/integration/career/questRouteAuth.test.ts

# the page (frontend half)
npm run typecheck && npm run lint && npm run format:check

# the journeys (qa half) — against the production build that playwright.config.ts owns
npx playwright test e2e/career.spec.ts
```

The Playwright command builds and serves the production build itself
(`playwright.config.ts:46-61`); the browser must be installed once locally with
`npx playwright install chromium` — it is **not** part of `npm ci`.

---

## Result (Ergebnis)

<!-- Filled in when the package is executed. The three steps are recorded separately,
     each with the command output that proves it. -->
