# Task 021: Implement basic quest loader and progression API

**Status**: completed
**Depends on**: 020
**Retry count**: 0

## Description
Create a service that loads quests from JSON files and exposes API endpoints to retrieve current quest, submit completion, and unlock next quest.

## Context
- Files: `src/career/questService.ts`, API routes `GET /api/career/quest`, `POST /api/career/complete`.
- Uses Prisma model `CareerQuestProgress` (to be added in Task 002).

## Requirements (Test Descriptions)
- [x] `it validates quest JSON files against the TypeScript schema before loading` — test: tests/unit/career/questService.test.ts. Validation itself implemented in task 020 (`questSchema.validateQuest` + `questLoader.load()` throwing `Invalid quest JSON`); `questService.getCurrentQuest` delegates to the loader and surfaces the rejection. GREEN on first run (dependency behaviour), verified by running the file.
- [x] `it records quest completion and updates progress` — test: tests/unit/career/questService.test.ts. `questService.completeQuest(userId, questId, outcome)` appends the quest id to `completedQuestIds`, updates win/loss streaks, resolves the next quest via `questLoader.getNextQuest`, sets `currentQuestId`, and persists through the `CareerProgressRepository` (in-memory implementation; Prisma wiring deferred — schema task 002 in flight).
- [x] `it unlocks the next quest based on adaptive difficulty` — tests: tests/unit/career/questService.test.ts, tests/unit/career/adaptiveDifficulty.test.ts. `AdaptiveDifficultyPolicy` seam with `createDefaultAdaptiveDifficultyPolicy()`: a just-unlocked quest's `adaptiveDifficulty` flags relax targets on a loss streak (`lossStreakThreshold`) or tighten them on a win streak (`winStreakThreshold`), producing `effectiveTargetAdjustment` persisted on the progress record (relax wins ties). Task 022 refines the hook.
- [x] `it returns error if quest ID is invalid` — test: tests/unit/career/questService.test.ts (service `completeQuest` throws `QuestNotFoundError`, naming the bad ID, when `questLoader.getQuestById` finds nothing); the `POST /api/career/complete` route maps that error to HTTP 404 with an error payload (tests/integration/career/questRoutes.test.ts).
- [x] `it respects user authentication` — tests: tests/integration/career/questRoutes.test.ts, plus the `AuthGateway` bearer seam in `src/career/auth/authGateway.ts` (unit-covered via the resolver contract in the route tests: GET/POST return 401 without an `Authorization: Bearer` token or with an unknown token, 200 with a known one; malformed POST body → 400). Real Auth.js provider wired in task 003 — the default gateway denies every token until then.

## Acceptance Criteria
- Integration tests with a test DB cover the full flow.
  - NOTE: no `CareerQuestProgress` model existed in `prisma/schema.prisma` when this task ran (task 002 still in flight), so no test DB could be used. Integration tests instead drive the real route handlers (`createCareerQuestRouteHandlers`) end-to-end over an in-memory repository. `src/career/repositories/prismaCareerProgressRepository.ts` implements the `CareerProgressRepository` interface against a structural `PrismaCareerProgressDelegate` (unit-tested with a fake delegate); task 002/022 wires it with `prisma.careerQuestProgress`. Prisma wiring deferred — schema task in flight.
- Quest progression persists across restarts.
  - Covered at the service/repository boundary: tests/integration/career/questRoutes.test.ts ("persists progression across a service restart") rebuilds the route handlers over the same repository and observes completed state; tests/unit/career/prismaCareerProgressRepository.test.ts proves upsert semantics for the Prisma-backed repository. True cross-process persistence lands when the Prisma repository replaces the in-memory default in `src/career/questRuntime.ts`.

## Implementation Notes
- New files: `src/career/questService.ts` (service + `QuestNotFoundError`), `src/career/careerProgressRepository.ts` (`CareerProgressRepository` interface, progress record contract, in-memory implementation), `src/career/repositories/prismaCareerProgressRepository.ts` (Prisma-backed implementation behind the interface), `src/career/adaptiveDifficulty.ts` (`AdaptiveDifficultyPolicy` seam + default policy for task 022), `src/career/auth/authGateway.ts` (bearer-token auth seam, task 003 replaces), `src/career/questRoutes.ts` (thin handler factory), `src/career/questRuntime.ts` (shared default runtime for the route files).
- API routes: task 001 created the App Router at the repo ROOT (`app/`), not `src/app`, so handlers live at `app/api/career/quest/route.ts` (GET) and `app/api/career/complete/route.ts` (POST). Handler bodies only authenticate, map `QuestNotFoundError` to 404, and delegate to `questService`.
- Reuses task 020 as directed (`questSchema.validateQuest`, `questLoader` `getQuestById`/`getNextQuest`); nothing about loading/validation was reimplemented. `questLoader.ts` default dir (`src/career/quests`) is the default loader for the runtime.
- Behavior decisions: `getCurrentQuest` returns the next not-completed quest eligible for the player's persisted `playerLevel` (default 1); POST body `won` defaults to `true` (completing a quest implies success) and is validated as boolean when provided; GET/POST payloads include `user`, `progress` and (`quest` | `nextQuest`), with `cache-control: no-store`.
- Test run: `npx vitest run tests/unit/career tests/integration/career` → 6 files, 27 tests, all passing. ESLint and Prettier clean on all new/edited career files. `npx tsc --noEmit` reports no errors in career/app files (remaining diagnostics are in `src/ai`, `src/realtime` — owned by other workers).
