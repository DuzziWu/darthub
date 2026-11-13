# Task 107: Wire career progress into the career page

**Status**: pending
**Depends on**: 102
**Retry count**: 0

## Description
The career page loads and validates the real quest catalogue, then shows "No progress yet." without ever asking the server for the player's progress. The progression service, the adaptive difficulty engine, the reward service and the progress API all exist and are tested; none of them is reachable from a browser. This task makes the career page show the player's actual progress.

## Context
- Related files: `app/career/page.tsx`, `app/api/career/progress/route.ts`, `app/api/career/quest/route.ts`, `app/api/career/complete/route.ts`, `src/career/questLoader.ts`, `src/career/questService.ts`, `src/career/progressionService.ts`, `src/career/rewardService.ts`, `src/career/adaptiveDifficulty.ts`, `src/career/quests/*`
- `app/career/page.tsx` — reads the quest catalogue through `createQuestLoaderService()` and validates every definition against the quest schema. Then it renders "No active quest." and "No progress yet." as fixed copy. The page's own comment explains: "there is no signed-in player behind this page yet, so the quest and progress sections show their empty states rather than an invented percentage or an unlocked quest nobody has earned."
- `src/career/quests/` — six quest definitions, real content.
- `app/api/career/progress/route.ts` — reads a player's quest progress. `app/api/career/complete/route.ts` — records a completed quest. `app/api/career/quest/route.ts` — quest detail.
- `src/career/auth/` — the career module's auth gateway seam, which `src/auth/requireAuth` is compatible with.
- The progression and reward services already apply the adaptive difficulty hook (task 022) and the unlock system (task 042).

## Requirements (Test Descriptions)
- [ ] `it shows the player progress from the progress route`
- [ ] `it shows the active quest when one is started`
- [ ] `it shows the empty state when the player has no progress`
- [ ] `it lists the quests the player has completed`
- [ ] `it lists the quests the player has unlocked`
- [ ] `it shows a locked quest as locked`
- [ ] `it starts a quest for the signed-in player`
- [ ] `it records a completed quest and awards its reward`
- [ ] `it does not show progress to a player who is not signed in`
- [ ] `it shows the progress of the signed-in player only`

## Acceptance Criteria
- The career page shows the signed-in player's real progress: active quest, completed quests, unlocked quests.
- The empty state is retained for a player who has none, and for a visitor who is not signed in.
- A quest can be started and completed through the real routes, and the reward is applied by the reward service.
- The adaptive difficulty and unlock rules stay in the services; the page only displays their outcome.
- The page keeps validating the quest catalogue through the loader, so a malformed quest file still fails the page.

## Implementation Notes

**The page's existing instinct is right — keep it.** The comment is explicit that the empty states exist because there is no signed-in player, *not* because the design wanted a blank page. This task supplies the signed-in player. The empty state must survive for the unsigned case and for the no-progress case; only the data-backed case changes. Do not replace a real empty state with a spinner that never resolves.

**The page is currently a server component that awaits the loader.** Adding progress means reading it server-side. Two options:

- *Preferred*: read the session server-side and fetch the progress from the service directly, mirroring how the page already reads the quests through the loader. The session cookie is available server-side; `identityFromClaims` turns it into an identity the progress service accepts.
- *Alternative*: make the page a client component that fetches `/api/career/progress` with the bearer token. Simpler, but it splits the data access across two mechanisms (server-side loader for quests, client-side fetch for progress).

Prefer the first — it keeps one mechanism, and it means the page renders with real data on the first paint instead of a loading state.

**Do not recompute the unlock rules in the page.** `progressionService.ts` owns progression and unlocking; `rewardService.ts` owns rewards; `adaptiveDifficulty.ts` owns the difficulty hook. The page asks the service what the state is and renders it. A page-side "is this quest unlocked?" check would be a second implementation of a rule that already exists, and it would drift.

**The career auth gateway is the seam.** `src/career/auth/` exists precisely so the career module does not depend on the auth module's internals. `src/auth/requireAuth.ts` states it is "Compatible with the existing `AuthGateway` seam in `src/career/auth`". Use the seam rather than reaching into the auth module directly, so the career module stays independent.

**Keep the quest catalogue validation.** The page loads and validates every quest definition before rendering. That is a deliberate guarantee: a malformed quest file fails the page rather than rendering a broken list. Do not replace the loader with a direct file read to "simplify" the fetch.

**The seven skipped career E2E specs exist for exactly this.** `e2e/career.spec.ts` has three skipped tests — quest display, quest completion and reward. This task is what makes them real; task 108 writes them. Design the page so those journeys are possible: a quest that can be started and completed, with the reward visible afterwards.
