# Task 022: Add adaptive difficulty hook into career quests

**Status**: completed
**Depends on**: 021
**Retry count**: 0

## Description
Create a mechanism that adjusts quest difficulty based on player performance (e.g., success rate, rating). The hook modifies upcoming quest parameters.

## Context
- Files: `src/career/adaptiveEngine.ts`.
- Uses rating service (Task 006) to fetch current Elo.

## Requirements (Test Descriptions)
- [x] `it retrieves player Elo and selects appropriate difficulty tier`
- [x] `it escalates difficulty after consecutive successes`
- [x] `it de‑escalates after failures`
- [x] `it persists difficulty adjustments per user`
  > Note (verified 2026-11-07): adjustments persist through the existing `CareerProgressRepository` via additive optional fields on `CareerQuestProgressRecord` — `difficultyAdjustment` and `difficultyTier` (src/career/careerProgressRepository.ts). Cross-process persistence (Prisma `CareerQuestProgress` columns) is DEFERRED on purpose: `prisma/schema.prisma` is being revised by the task-005 worker and MUST NOT be touched here. Evidence: `tests/unit/career/adaptiveEngine.test.ts` "persists difficulty adjustments per user" asserts per-user isolated `difficultyAdjustment` / `difficultyTier` / loss-streak values stored via the in-memory repository; the Prisma repository becomes structurally compatible automatically once the model gains these optional columns.

## Acceptance Criteria
- Unit tests simulate various performance scenarios and verify difficulty changes.
- Hook integrates with quest completion flow.

**Status**: completed (2026-11-07)

### Verification Evidence
- `npx vitest run tests/unit/career tests/integration/career` → 8 files, 37 tests, all passing, including 9 new tests in `tests/unit/career/adaptiveEngine.test.ts` and 2 flow-integration tests in `tests/integration/career/adaptiveEngineFlow.test.ts`.
- Requirement tests verified RED first (module/API missing), GREEN with minimal implementation, refactored (config-resolution extraction) with tests staying green.
- `npx eslint` clean on all touched files; `npx tsc --noEmit` reports no errors in career files.
- Full-suite run intentionally SKIPPED per task constraints (parallel workers in flight; only career test paths were run).

## Implementation Notes
- `src/career/adaptiveEngine.ts`: `AdaptiveDifficultyEngine` service.
  - Rating seam: `RatingProvider { getElo(userId): number | null }` — the narrow seam for task 006 (not built yet). Default is `createNullRatingProvider()` returning `null`; tier selection then falls back to the `"unranked"` tier. Tier brackets: novice <1200, club ≥1200, competitive ≥1500, professional ≥1800 (`DIFFICULTY_TIERS`, `selectTierFromElo`).
  - Result feed: `recordResult({ userId, won, questId?, quest? })` updates persistent win/loss streaks, computes a cumulative fractional adjustment (escalate on wins ≥ `winStreakThreshold`, de-escalate on losses ≥ `lossStreakThreshold`, step `targetAdjustmentStep`, clamped to ±0.5, rounded to 6 decimals), and persists through `CareerProgressRepository`. A quest with enabled `adaptiveDifficulty` governs its own parameters/flags (`resolveAdaptiveConfiguration`); quests without one use engine defaults (`DEFAULT_ADAPTIVE_PARAMETERS`, `DEFAULT_ADAPTIVE_FLAGS` = both flags on, thresholds 2, step 0.1).
  - `resolveDifficultyTier(userId)` exposes the Elo→tier mapping.
- `src/career/careerProgressRepository.ts`: additive optional fields `difficultyAdjustment`, `difficultyTier` on `CareerQuestProgressRecord` (Prisma model columns deferred — see note on the persistence checkbox).
- `src/career/questService.ts`: new optional dep `adaptiveEngine`. When present, `completeQuest` feeds the outcome to the engine (upcoming quest passed so its flags govern) and supersedes the task-021 `adaptiveDifficultyPolicy`; without the dep the legacy streak + policy path is byte-for-byte unchanged and all pre-existing career tests stay green. The engine must share the service's `progressRepository`.
