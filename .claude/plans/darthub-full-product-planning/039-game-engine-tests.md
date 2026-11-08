# Task 039: Write comprehensive unit tests for the Dart game engine

**Status**: pending
**Depends on**: 038
**Retry count**: 0

## Description
Create Vitest test suites that cover all game‑engine functionality: 501/301 modes, Cricket, out rules, bust handling, leg/set aggregation, and edge cases (invalid throws, early wins, tie‑breaks).

## Context
- Test directory: `tests/game-engine/`.
- Import the engine and mode classes from `src/game-engine/`.

## Requirements (Test Descriptions)
- [ ] `it validates correct scoring for 501 and 301 including busts`
- [ ] `it validates Cricket scoring and closing logic`
- [ ] `it verifies each out rule (Double, Master, Straight) works as intended`
- [ ] `it correctly tracks leg wins and set progression`
- [ ] `it handles invalid inputs (negative scores, non‑numeric) with errors`

## Acceptance Criteria
- Test coverage for the engine module is ≥ 90%.
- All tests pass in a CI run.
