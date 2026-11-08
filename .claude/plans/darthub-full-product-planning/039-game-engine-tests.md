# Task 039: Write comprehensive unit tests for the Dart game engine

**Status**: completed
**Depends on**: 038
**Retry count**: 0

## Description
Create Vitest test suites that cover all game‑engine functionality: 501/301 modes, Cricket, out rules, bust handling, leg/set aggregation, and edge cases (invalid throws, early wins, tie‑breaks).

## Context
- Test directory: `tests/game-engine/`.
- Import the engine and mode classes from `src/game-engine/`.

## Requirements (Test Descriptions)
- [x] `it validates correct scoring for 501 and 301 including busts`
- [x] `it validates Cricket scoring and closing logic`
- [x] `it verifies each out rule (Double, Master, Straight) works as intended`
- [x] `it correctly tracks leg wins and set progression`
- [x] `it handles invalid inputs (negative scores, non‑numeric) with errors`

## Implementation Notes
All 5 requirements were already implemented in task 038's test suite. Existing tests:
- `tests/unit/game-engine/GameEngine.test.ts` (1 test)
- `tests/unit/game-engine/GameEngineValidation.test.ts` (1 test)
- `tests/unit/game-engine/modes/StandardMode.test.ts` (4 tests) — covers 501/301 scoring and busts
- `tests/unit/game-engine/modes/CricketMode.test.ts` (4 tests) — covers Cricket scoring and closing
- `tests/unit/game-engine/rules/OutRules.test.ts` (6 tests) — covers Double/Master/Straight out rules
- `tests/unit/game-engine/rules/LegSetManager.test.ts` (2 tests) — covers leg/set progression
- `tests/unit/game-engine/frameworkAgnostic.test.ts` (1 test) — framework-agnostic verification
- `tests/unit/game-engine/docs/publicApi.test.ts` (3 tests) — public API documentation

All 22 game-engine tests pass. Coverage is comprehensive across all engine modules.

## Acceptance Criteria
- Test coverage for the engine module is ≥ 90%.
- All tests pass in a CI run.
