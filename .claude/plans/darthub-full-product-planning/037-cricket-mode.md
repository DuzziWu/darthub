# Task 037: Implement Cricket game mode in the engine

**Status**: completed
**Depends on**: 035
**Retry count**: 0

## Description
Add the Cricket variant to the core engine, handling the 20‑20‑19‑18‑17‑16‑Bull target set, marking hits, closing numbers, and scoring per the standard rules.

## Context
- File: `src/game-engine/modes/CricketMode.ts`.
- Reuse shared scoring utilities from the core engine.

## Requirements (Test Descriptions)
- [x] `it tracks hits on each target number and the bullseye`
- [x] `it correctly closes a number after three hits`
- [x] `it awards points for hits on already‑closed numbers of the opponent`
- [x] `it determines the winner when all numbers are closed and the higher score wins`

## Acceptance Criteria
- Cricket mode can be instantiated via the engine configuration.
- Comprehensive unit tests cover all scoring paths and edge cases.

## Implementation Notes
- Files: `src/game-engine/modes/CricketMode.ts` (mode + `CRICKET_TARGETS`, `CRICKET_BULL`, `MARKS_TO_CLOSE`, `CricketModeData`, `getCricketWinnerId`), tests in `tests/unit/game-engine/modes/CricketMode.test.ts` (self-contained helpers, no shared test utilities to avoid collisions with parallel mode worker).
- Seam extension (genuine gap, kept minimal): added optional `MatchState.modeData?: MatchModeData` (`Record<string, unknown>`, JSON-safe) in `src/game-engine/types.ts` and plumbed it through `toMutableDraft` (deep-copied per throw so earlier snapshots are never aliased/mutated) and `asMatchState` in `src/game-engine/GameEngine.ts`. All pre-existing engine tests stayed green (GameEngine / GameEngineValidation / frameworkAgnostic = 3 passed after every change).
- Used the `initializeMatch(draft)` hook (added by the parallel 501 worker between my reads) to seed all players' boards at 0 marks, so the very first snapshot carries the cricket state.
- Rules implemented: targets 20/19/18/17/16/15/Bull(25); dart points map to segments (e.g. 20=1 mark, 40=2 marks on 20, 60=3 marks on 20; 25=1 bull mark, 50=2 bull marks); values that are no cricket segment record nothing. `MARKS_TO_CLOSE = 3` (single triple or double bull closes in one dart; marks are tracked raw, closing is `>= 3`).
- Scoring = standard convention (not cut-throat), per resolved task note: thrower scores `marksGained x targetValue` (bull value 25, so an inner bull scores 50) when the thrower had the number closed *before* that dart and at least one opponent still has it open; the closing dart itself does not score; if every opponent has the number closed, hits stop scoring. Points land in the thrower's `totalPoints`.
- Winner (requirement 4): `getCricketWinnerId(state)` returns the first player with all targets closed whose score is at least every other player's; engine completion = that returning non-null, so a player closing everything while trailing on points keeps the match `inProgress`; equal-or-higher (tie) also wins since comparison is `>=`. Completion happens mid-turn (engine aborts the turn, `currentPlayerId = null`).
- Requirement 2 (`correctly closes a number after three hits`) passed on the implementation written for requirement 1: closing is a derived property of accurate mark tracking, no extra code was written for it.
- Acceptance: `new GameEngine(new CricketMode())` with `playerIds` (engine config) runs cricket end to end; state snapshots stay JSON-safe (verified via round trip in test 1), framework-agnostic scan in `frameworkAgnostic.test.ts` still clean.
- Did not modify `src/game-engine/index.ts` (contested by parallel 501 worker); cricket exports are importable from `@/game-engine/modes/CricketMode` directly. ESLint passes on all touched files; cricket typecheck clean.
- Verification evidence: `npx vitest run tests/unit/game-engine/modes/CricketMode.test.ts` -> 4/4 passed; combined run with the three core engine suites -> 4 files / 7 tests all passed.
