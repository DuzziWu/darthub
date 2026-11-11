# Task 005: Engine tests — undo and correct across all five modes

**Status**: pending
**Depends on**: [002]
**Retry count**: 0

## Description
Prove the undo and correct behaviour for every game mode, not just x01. The modes differ in exactly the ways that make correction hard: cricket's score depends on other players' marks, around-the-clock advances a shared target, shanghai clears its round records, and x01 runs legs and sets and can bust. Each mode gets tests that undo and correct and assert the whole state comes out right.

## Context
- Related files: `tests/unit/game-engine/GameEngine.test.ts`, `tests/unit/game-engine/modes/*.test.ts`, `tests/unit/game-engine/rules/*.test.ts`, `tests/unit/game-engine/frameworkAgnostic.test.ts`
- Patterns to follow: the existing test style — `describe`/`it` with exact names, Vitest's `expect`, and helper functions at the top of the file (`startCricketMatch`, `throwDarts`, `passTurn` in `tests/unit/game-engine/modes/CricketMode.test.ts:29-48`).
- `tests/unit/game-engine/GameEngine.test.ts:23` — the JSON-safety assertion. The ledger must keep it true.
- `tests/unit/game-engine/modes/StandardMode.test.ts:114-119` — the bust case: a busting dart leaves the score and `throwCount` untouched. The ledger must not change that.
- `tests/unit/game-engine/frameworkAgnostic.test.ts` — asserts the engine imports nothing framework-specific. The new engine code must keep that true.
- `src/game-engine/modes/CricketMode.ts:112` — the scoring rule that depends on other players' marks.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it undoes the last dart in a cricket match and restores the marks`
- [ ] `it corrects a dart in a cricket match and restores the marks`
- [ ] `it corrects a dart in a cricket match and recalculates a score that depended on another player's marks`
- [ ] `it undoes the last dart in an around the clock match and restores the target`
- [ ] `it corrects a dart in an around the clock match and restores the target`
- [ ] `it undoes the last dart in a shanghai match and restores the round`
- [ ] `it corrects a dart in a shanghai match and restores the round`
- [ ] `it undoes the last dart in a 501 match and restores the remaining score`
- [ ] `it corrects a dart in a 501 match and restores the remaining score`
- [ ] `it corrects a dart that wins the leg and restores the leg count`
- [ ] `it undoes a dart that won a leg and restores the leg count`
- [ ] `it undoes the last dart in a neutral match and restores the score`
- [ ] `it undoes a dart recorded by a second player`
- [ ] `it leaves the engine free of framework imports after the change`
- [ ] `it keeps the match state JSON-safe after an undo`
- [ ] `it keeps the match state JSON-safe after a correction`

## Acceptance Criteria
- All requirements have passing tests.
- Every one of the five modes is covered — `StandardMode` (501 and 301), `CricketMode`, `AroundTheClockMode`, `ShanghaiMode`, `NeutralScoreMode`.
- The existing engine and mode tests still pass unchanged.
- The tests assert the *whole* state after an undo or correction, not a single field, so a partial recalculation fails the test.
- Tests live under `tests/unit/game-engine/`, mirroring the source structure.

## Implementation Notes

Design decisions already settled (do not re-open):

- The strongest form of the undo test is equivalence: capture the state before the last dart, undo, and assert the two states are equal. Use that shape wherever it applies.
- The cricket case where a correction changes *another* player's score is the sharpest test in this file — write it deliberately.
- Do not weaken an existing test to make the new behaviour fit. If an existing assertion contradicts the new design, that is a signal to stop and report, not to edit the test.

Leave blank for the implementer.
