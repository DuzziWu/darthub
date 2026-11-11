# Task 002: Engine undo and correct operations

**Status**: pending
**Depends on**: [001]
**Retry count**: 0

## Description
Expose undo and correct as engine operations. Undo removes the last entered dart; correct replaces one recorded dart with a new value. Both re-derive the whole match state by replaying the ledger, so the score, the remaining total, the checkout possibilities, the turn order and every mode's own state come out correct. This task also enforces the rules that protect the record: a correction never moves a dart between players, and correcting a dart in a finished turn is possible but is written to an audit trail.

## Context
- Related files: `src/game-engine/types.ts`, `src/game-engine/GameEngine.ts`, `src/game-engine/index.ts`
- Patterns to follow: the error classes `GameEngineStateError` and `GameEngineValidationError` (`src/game-engine/types.ts:145`, `:153`) — use them for invalid input and invalid lifecycle state; the `recordThrow` guard style (`GameEngine.ts:64-70`).
- `src/game-engine/GameEngine.ts:62` — `recordThrow` shows the validation order: validate the input, then the lifecycle, then the player's turn.
- `src/game-engine/modes/StandardMode.ts:104` — a busting dart is rejected by the mode with `GameEngineStateError`. A correction can turn a later dart into a busting one; the replay must detect that and refuse the correction rather than produce an inconsistent state.
- The realtime layer (`src/realtime/GameStateMachine.ts`) wraps this engine. It does not need to expose undo/correct yet — but the engine API must not make that impossible later.
- Every mode is reachable through the same engine, so the operations are mode-agnostic.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it undoes the last entered dart`
- [ ] `it restores the state to exactly what it was before that dart was entered`
- [ ] `it undoes a dart that busted`
- [ ] `it undoes the dart that completed the match`
- [ ] `it refuses to undo when no dart has been entered`
- [ ] `it corrects a recorded dart with a new value`
- [ ] `it recalculates the score after a correction`
- [ ] `it recalculates the remaining total after a correction`
- [ ] `it recalculates the turn order after a correction`
- [ ] `it keeps the corrected dart with the player who threw it`
- [ ] `it never moves a corrected dart to another player`
- [ ] `it refuses to correct a dart that does not exist`
- [ ] `it refuses a correction that would leave a later dart busting`
- [ ] `it refuses a correction that would turn the corrected dart itself into a bust`
- [ ] `it refuses a correction on a completed match`
- [ ] `it records a correction of a finished turn in the audit trail`
- [ ] `it records a correction that changes who won a leg in the audit trail`
- [ ] `it does not record a correction of the turn in progress in the audit trail`
- [ ] `it leaves the ledger unchanged after a refused correction`

## Acceptance Criteria
- All requirements have passing tests.
- Undo and correct are mode-agnostic: no mode-specific code anywhere in the engine's undo/correct path.
- A refused correction changes nothing — the ledger and the state are untouched.
- The audit trail is JSON-safe and lists the corrected dart's index, the old value and the new value.
- Code follows project standards; no new runtime dependency.

## Implementation Notes

Design decisions already settled (do not re-open):

- `correctThrow(dartIndex, value)` takes the index of the dart in the ledger and the replacement value — `{ points, segment? }`, **not** `ThrowInput`, because `ThrowInput` carries a `playerId` (`types.ts:93`) which would contradict "the player comes from the ledger". The player comes from the ledger entry — never from the caller. That makes "a correction never moves a dart between players" structural rather than a check someone can forget.
- Both operations end in the same replay path as task 001. Do not add a second way to compute state.
- Undo removes the *last entered* dart in the ledger — which may be a bust. It is not a general "remove dart n" operation — that is what correct is for.
- **Undo is allowed on a completed match.** The match-winning dart is exactly the dart a player may have mis-tapped. `undoLastThrow` works while `status === "completed"`, and the replay simply no longer completes the match. A `correctThrow` on a completed match is still refused — rewriting a finished match's history is a different and larger problem, and the UI will not offer it.
- **A correction is refused when the replay it produces is not valid.** Three cases, all refused with a `GameEngineStateError`, all leaving the state and the ledger exactly as they were:
  1. the corrected dart itself would bust at that point in the replay, or
  2. a **later** recorded dart would now bust because the correction changed the score before it, or
  3. the dart index does not exist, or the match is already `completed`.
  Case 2 is real, not hypothetical — the darts are scored against a running total, so changing an early dart can invalidate a later one. A player who wants to change an early dart corrects forward, from the earliest dart they intend to change. Because the refusal is detected **before anything is committed**, "no state change on refusal" is provable by comparing the whole state, ledger included.
- A correction of a dart in a finished turn is allowed and recorded in an audit trail, as is a correction that changes who won a leg — that one changes the match result, not merely a score. A correction of a dart in the turn in progress is allowed and not audited. "Turn in progress" is derived from the replay's visit boundaries (task 001).
- The audit trail belongs in the engine's public state, not in the UI, so it survives a reload and is available to a future socket event.

Leave blank for the implementer.
