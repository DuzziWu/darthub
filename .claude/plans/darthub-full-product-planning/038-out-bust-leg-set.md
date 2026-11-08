# Task 038: Implement out rules, bust, checkout, leg and set logic

**Status**: completed
**Depends on**: 035, 036, 037
**Retry count**: 0

## Description
Add support for the following finishing rules and game flow features within the engine:
- **Double Out**, **Master Out**, **Straight Out** (selection per match).
- **Bust handling** (score would go below zero or not end on a valid checkout).
- **Checkout calculation** respecting the chosen out rule.
- **Leg** and **Set** aggregation (e.g., best of 5 legs, best of 3 sets).

## Context
- Files: `src/game-engine/rules/OutRules.ts`, `src/game-engine/rules/LegSetManager.ts`.
- Extend `GameEngine` to accept out‑rule configuration.

## Requirements (Test Descriptions)
- [x] `it enforces Double Out: a player can only finish on a double` (red→green via `tests/unit/game-engine/rules/OutRules.test.ts`; double-out strategy + optional `ThrowInput.segment`, all 036/037 tests green)
- [x] `it enforces Master Out: a player can finish on any double or bull` (master strategy added to `OUT_RULES`; a triple reaching zero is a bust, double 20 and bull 50 both finish)
- [x] `it enforces Straight Out: any score can finish the leg` (test passed immediately: "straight" is the default out rule and was necessarily implemented in requirement 1's GREEN to preserve 036 semantics — no new code; verified triple finish + segment-less finish both complete)
- [x] `it correctly handles bust scenarios according to the selected out rule` (added `isStrandedBust` ("stranded on 1" under double/master) to resolveRemaining; verified below-zero bust under all 3 rules, untouched-state after bust, and non-bust on 1 under straight)
- [x] `it tracks leg wins and set progression` (LegSetManager.ts pure best-of-N tracker persisted in StandardMode modeData under "legSet"; verified best-of-3-legs/best-of-2-sets and best-of-5/best-of-3 through engine and direct unit tests; score reset per leg, winner stays on 0 at match end)

## Acceptance Criteria
- Engine exposes configuration for out rule selection.
- Unit tests verify each rule across different start scores and bust situations.

## Implementation Notes

- New files: `src/game-engine/rules/OutRules.ts` (`OutRule` strategy interface + `DoubleOutRule`/`MasterOutRule`/`StraightOutRule`, `OUT_RULES` registry, `getOutRule(id, default "straight")`, `isDoubleScore`, `isValidSegmentScore` board facts), `src/game-engine/rules/LegSetManager.ts` (pure, JSON-safe best-of-N tracker: `LegSetConfig`, `LegSetProgress`, `LegSetOutcome`, `LEG_SET_MODE_DATA_KEY = "legSet"`), `src/game-engine/rules/index.ts` (barrel, pattern matched to `modes/index.ts`).
- Additive core changes: `types.ts` gains `ThrowSegment` ("single" | "double" | "triple" | "bull") and `OutRuleId` types, optional `segment` on `ThrowInput`/`ThrowRecord`, optional `outRule`/`legs`/`sets` on `MatchConfig`, and an optional `configure?(config: MatchConfig)` hook on `DartGameMode` (invoked by `GameEngine.startMatch` before `initializeMatch`). `GameEngine` forwards `segment` via a new `toThrowRecord` helper, calls `configure`, and rejects segment/points pairs that are not physically possible via `isValidSegmentScore` (`GameEngineValidationError`; segment-less throws stay unrestricted and 100% backwards compatible).
- `StandardMode` wiring: `StandardModeConfig` gains `outRule?`, `legs?`, `sets?`; the `resolveRemaining` seam was extended to `(remaining, points, segment?)` and now busts on (a) overshoot below zero, (b) reaching 0 with an invalid checkout segment for the active out rule, (c) landing on 1 under double/master ("stranded on 1"). Defaults are `straight` out + single leg/single set, which keeps every 036/037 semantic untouched (all their tests pass unchanged).
- Rule decision (documented on purpose): **Double Out requires a board double exactly** (`segment === "double"`, 2..40 even); the inner bull (50, `segment: "bull"`) finishes only under **Master Out**, per the requirement wording ("only finish on a double" vs "any double or bull"). A single bull (25) never finishes.
- Leg/set flow in `StandardMode`: when a leg checks out and legs/sets are configured, `LegSetManager.recordLegWinner` advances `legsWon`/`setsWon`/`matchWinnerId` persisted under `modeData["legSet"]`; every non-final leg resets all players to the start score, the leg winner stays on 0 when the match ends, and `isMatchComplete` keys off `matchWinnerId`. Winning a best-of-N round takes Math.floor(N/2)+1 wins (best of 1 = first win). Leg-completions still allow the remaining darts of the turn to be thrown by the same player (documented simplification; no server turn-forfeit needed, busts keep 036's reject-outright semantics).
- Configuration precedence: constructor (mode) options always win; `startMatch` `MatchConfig` values only fill gaps (`outRule`/`legs`/`sets`). Mode ids now carry additive suffixes, e.g. `x01-501-double-out-legsbo5-setsbo3`; plain `x01-501` unchanged.
- Exports: new `rules/index.ts` barrel; root `src/game-engine/index.ts` extended additively only (OUT_RULES, getOutRule, LegSetManager + new types). CricketMode, its tests, and the standard modes' behavior untouched.
- Verification evidence: `npx vitest run tests/unit/game-engine` → 8 files / 22 tests all passing (5 requirement tests + supporting segment-validation & MatchConfig-exposure tests + all 035/036/037 guard suites incl. frameworkAgnostic scan and docs/publicApi). `npx tsc --noEmit` → zero errors under `src/game-engine/` and its tests (remaining repo-wide tsc errors are pre-existing in other workers' trees: db-schema/camera/env tests). ESLint clean on engine files; Prettier-formatted (pre-existing warnings in CricketMode.ts and docs/publicApi.test.ts left alone as they belong to other workers). One extra RED→GREEN delivered for the acceptance criterion "Engine exposes configuration for out rule selection" via the `it exposes out-rule and leg/set configuration through MatchConfig` test. TDD hiccup noted honestly: while validating segments, three tests used `{points: 40, segment: "single"}` — physically impossible (40 is only a double); tests were corrected to real board physics, implementation was right.
