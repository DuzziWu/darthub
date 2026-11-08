# Task 020: Design JSON‑driven career‑mode quest system

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Define the JSON schema for quests, stages, rewards, and adaptive difficulty parameters. Create TypeScript types and a loader service.

## Context
- Files: `src/career/questSchema.ts`, `src/career/questLoader.ts`, sample quests in `src/career/quests/sample.json`.
- Follow the modular architecture (service + repository).

## Requirements (Test Descriptions)
- [x] `it validates a quest JSON against the schema` — `tests/unit/career/questSchema.test.ts`; 3 tests pass (valid quest, missing fields rejected, sample.json validates)
- [x] `it loads quests into memory on app start` — `tests/unit/career/questLoader.test.ts`; idempotent `load()` reads+validates JSON from `src/career/quests/`, caches registry, rejects invalid files; 9 tests pass
- [x] `it provides a function to fetch next quest based on player level` — `QuestLoader.getNextQuest(playerLevel, completedQuestIds?)`: lowest-`order` unlocked (`minLevel <= level`) uncompleted quest, null if locked/none; 10 tests pass
- [x] `it supports adaptive difficulty flags` — `QuestAdaptiveDifficulty` (`enabled`, `parameters`: winRateTarget/lossStreakThreshold/winStreakThreshold/targetAdjustmentStep; `flags`: relaxTargetsOnLoss, tightenTargetsOnWin, assistOnStreak), runtime-validated as an optional quest field; sample.json includes it; 9 tests pass

## Acceptance Criteria
- Unit tests cover schema validation and loading.
- Sample quest file passes validation.

## Implementation Notes
- `src/career/questSchema.ts` — domain types (`Quest`, `QuestStage`, `QuestObjective` with dart-specific objective types, `QuestRewards`, `QuestAdaptiveDifficulty{Parameters,Flags}`) plus hand-rolled runtime validator `validateQuest(unknown)` returning a discriminated `QuestValidationResult` with `errors: string[]` on failure. No external validation dependency.
- `src/career/questLoader.ts` — `createQuestLoaderService(questsDir?)` factory; default dir is the module-relative `src/career/quests/` (injectable for tests). Idempotent `load()` reads + validates all `*.json` files, sorts by `order`, caches registry; `getQuests()`, `getQuestById()`, and `getNextQuest(playerLevel, completedQuestIds?)` (lowest-`order` quest with `minLevel <= level` not yet completed, else null). Getters throw if called before `load()`.
- `src/career/quests/sample.json` — sample quest (stages, objectives, rewards, adaptive difficulty block); validates and loads.
- Tests: `tests/unit/career/questSchema.test.ts`, `tests/unit/career/questLoader.test.ts` (temp-dir based, no repo writes), shared fixture in `tests/unit/career/helpers/validQuestFixture.ts`.
- Verification: `npx vitest run tests/unit/career` → 9/9 pass; ESLint clean for career files; `tsc --noEmit` clean for career files (remaining repo typecheck errors are in other workers' files, unrelated).
- Seams for follow-ups: task 021 (progression API) can build on `getNextQuest`; task 022 (adaptive difficulty) consumes `QuestAdaptiveDifficulty.flags/parameters`.
- Not committed (per instructions).
