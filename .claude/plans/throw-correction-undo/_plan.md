# Plan: Throw Correction & Undo

## Created
2026-11-10

## Status
ready

## Objective
Let a player undo the dart they just entered, and correct any already-entered dart by tapping it, with the score, the remaining total, the checkout possibilities and the whole game state recalculated correctly for every game mode — in the local single-device match views.

## Related Issues
none

## Discovery Notes

Targeted analysis of the existing throw entry and the game-engine data model (no full-repo scan).

**The engine keeps no throw history.** `MatchState` (`src/game-engine/types.ts:52`) carries `matchId`, `status`, `players`, `currentPlayerId`, `throwsInCurrentTurn`, `throwCount` and `modeData` — but no record of *what was thrown*. `GameEngine.recordThrow` (`src/game-engine/GameEngine.ts:62`) mutates a draft and hands back a snapshot; the throws themselves are gone. Therefore undo/correct cannot be implemented as UI-only bookkeeping: the engine must own a throw ledger, or there is nothing to replay.

**The engine rejects a bust; the UI records it separately.** In x01, `StandardMode.applyThrow` (`src/game-engine/modes/StandardMode.ts:104`) throws `GameEngineStateError` for a busting dart, and `GameEngine.recordThrow` propagates it with the state untouched (`throwCount` unchanged — asserted at `tests/unit/game-engine/modes/StandardMode.test.ts:118`). The visit chip is then drawn from the view's own `visits` map (`src/components/x01/X01MatchView.tsx:186`). So today there are **two** records of a visit: the engine's `throwCount`, and the UI's `VisitEntry[]`. That duplication is the "doppelte Verbuchung" the request calls out, and it is the root cause of the risk.

Verified by probe against the current code:
- A busting dart leaves `throwCount`, `throwsInCurrentTurn`, `currentPlayerId` and the score **completely untouched** — the engine treats a rejected dart as if it never happened.
- The engine does **not** consume a dart slot on a bust: after one counted dart plus one bust, `throwsInCurrentTurn` is still 1.
- The view nevertheless treats a bust as **ending the visit**: `X01MatchView.tsx:142` opens a fresh visit when the previous entry was a bust, and the bust chip replaces the visit's darts (`X01MatchView.tsx:186`).
- So after a bust the engine and the view disagree about the visit length — today the view shows one chip (`BUST`) while the engine counts one dart.

This is the single most important thing the ledger must settle. A ledger that records a bust as a dart that "counted nothing" would still disagree with the view's "a bust ends the visit" rule. The ledger must therefore record, per dart, both the **attempt** (player, points, segment) and the **outcome** (counted, or busted), and must define explicitly whether a bust consumes a dart slot. The plan's decision: **a bust is recorded in the ledger with a `bust` outcome, and it does not consume a dart slot** — matching the engine's current behaviour exactly, so that replay reproduces today's state bit for bit. The view's separate "a bust ends the visit" display rule then becomes a *view* concern over the ledger, not a second record of the darts. The existing test at `StandardMode.test.ts:114-119` (a bust leaves `throwCount` at 6 and `throwsInCurrentTurn` at 0) stays true, because `throwCount` counts *counted* darts while the ledger counts *entered* darts — two clearly named things.

**Four views duplicate the same visit bookkeeping.** `X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx` and `app/game/shanghai/page.tsx` each keep their own `VisitEntry[]`/`Record<string, VisitEntry[]>` and each re-implement record → visit → announcement. The four differ only in mode and player count.

**Modes are stateful and mode-specific, so correction cannot be a subtraction.** `CricketMode` keeps per-target marks in `modeData` and scores only when the thrower had the number closed but an opponent still had it open (`CricketMode.ts:112`); `AroundTheClockMode` advances a shared `currentTargetIndex`; `ShanghaiMode` advances a round and clears `roundRecords`; `StandardMode` runs `LegSetManager` and resets every player to `startScore` when a leg ends (`StandardMode.ts:137`). Subtracting a dart cannot restore these. Recomputing from a ledger by **replaying** the recorded darts through the mode's own `applyThrow` can, and does so identically for all five modes.

Verified by probe — replay is deterministic for every mode, because each mode's state is a pure function of the dart sequence:
- **x01 leg boundary.** A leg win sets the winner's score to `startScore` again and resets every player (`StandardMode.ts:137`), and the leg/set progress lands in `modeData.legSet`. Replaying the same dart sequence reproduces the same progress, because `LegSetManager.recordLegWinner` is a pure function of the prior progress (`LegSetManager.ts:85`).
- **Cricket.** The score of a dart depends on the *other* players' marks at that moment, so a correction can change another player's score. Replay handles this correctly because it re-runs the darts in order, rebuilding the marks before each dart is scored.
- **Around the clock.** The shared `currentTargetIndex` advances only when the current target is hit; a miss leaves it alone. Replay reproduces it.
- **Shanghai.** The round advances when `totalDartsThisRound` reaches `players.length * 3`, and `roundRecords` is cleared on the advance. Replay reproduces it.
- **Neutral.** A plain sum. Replay reproduces it.

One consequence worth stating: because the darts are scored against a running total, changing an early dart can make a **later** dart bust that did not bust before. The plan's decision, stated once and applied everywhere: **such a correction is refused**, with the state and the ledger left untouched, rather than silently voiding a dart the player already threw. A player who wants to change an early dart corrects forward, from the earliest dart they intend to change.

**The realtime path is server-authoritative but has no client.** `GameStateMachine` (`src/realtime/GameStateMachine.ts:24`) wraps the same engine with `NeutralScoreMode`; `socketServer.ts:291` handles `throw:record`. No client in `src/`/`app/` consumes these events, so a socket-level undo would be an untested capability with no consumer.

**The design system already reserves the affordance.** `DESIGN.md:258` draws `[UNDO] [MENU]` in the throw strip of the match view. The z-index scale has a modal band (`design-system/darthub/MASTER.md:792`) but the repo has no dialog component and no Radix dependency, so the confirm step must follow the existing two-stage "armed segment" pattern rather than introduce a modal library.

**Mode-specific correction semantics.** For x01 the correction must respect the out rule (a corrected dart may or may not bust, and may win the leg). For the other modes the dart simply changes marks/progress/target, and a corrected dart can turn a later dart into a busting one — which the replay must detect and handle.

## Scope

### In Scope
- A throw ledger in the game engine: every entered dart recorded with its player, points, segment and visit position.
- Recalculation by replay: correcting or removing a dart re-derives the whole state through the mode's own `applyThrow`, so score, remaining, checkout possibilities, turn order, legs/sets and mode data all follow.
- Undo of the last entered dart.
- Tap-to-correct on an already-entered dart, then choose the replacement value.
- Player attribution is preserved by a correction: a corrected dart stays with the player who threw it.
- A correction of a dart in an already-completed turn is allowed, but requires explicit confirmation and is recorded in an audit trail.
- All five modes: `StandardMode` (501/301), `CricketMode`, `AroundTheClockMode`, `ShanghaiMode`, `NeutralScoreMode`.
- The four local match views, sharing one implementation.
- Desktop and mobile: the undo/correct controls work at the `md` breakpoint and below, where the board is a read-only preview and the dart pad is the input.
- Documentation: the game-engine README and the DevFlow project memory.

### Out of Scope
- The realtime Socket.IO layer. No client consumes it today, so undo/correct is added to the engine only. The engine API is designed so a future socket event is a thin wrapper.
- Any change to the bust rule, the out rules, the turn order or the scoring of any mode.
- Persisting a match across page reloads (not supported today).
- Reordering darts, deleting a dart other than the last one, or editing a dart after the match is over.
- shadcn/ui or any new runtime dependency.

## Success Criteria
- [ ] Every entered dart can be undone — including the match-winning dart — and the state after the undo equals the state before that dart was entered.
- [ ] Any entered dart can be corrected by tapping it, and the resulting state is identical to the state that would have existed had the corrected dart been the one entered.
- [ ] A correction preserves the dart's player; it can never move a dart between players.
- [ ] A refused correction changes neither the state nor the ledger.
- [ ] Correcting a dart in a completed turn requires confirmation and leaves an audit record; so does a correction that changes who won a leg.
- [ ] All five modes recalculate correctly under undo and correct.
- [ ] No dart is recorded twice: the ledger is the single record of the darts, and the views keep no second copy.
- [ ] Undo and correct are operable with keyboard and pointer, at desktop and at 390px width.
- [ ] Unit tests cover undo and correct for every mode; all tests pass.
- [ ] Documentation updated.
- [ ] Code follows project standards; lint, typecheck and format are clean.

## Task Overview
| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Throw ledger and replay in the game engine | - | pending |
| 002 | Engine undo and correct operations | 001 | pending |
| 003 | Shared throw-history UI: undo button, tappable darts, correction flow | 002 | pending |
| 004 | Wire the four match views to the shared undo/correct | 003 | pending |
| 005 | Engine tests: undo and correct across all five modes | 002 | pending |
| 006 | UI tests and mobile verification | 004 | pending |
| 007 | Documentation: engine README and DevFlow project memory | 004 | pending |
| 008 | Independent review of the whole change | 005, 006, 007 | pending |

## Architecture Notes

**The ledger lives in the engine, and state is derived by replay.** This is the central decision and everything else follows from it.

- `GameEngine` keeps an ordered list of recorded darts — player, points, segment — plus the visit boundaries.
- `MatchState` gains the ledger so it survives the round trip to the client and to the realtime server as JSON-safe data, consistent with how `modeData` already travels.
- Undo removes the last ledger entry and re-derives the state by replaying what remains. Correct replaces one entry and replays the whole ledger.
- Replay calls the mode's `applyThrow` for each dart in order, on a fresh draft seeded exactly as `startMatch` seeds it. The mode therefore stays the single owner of every mode-specific rule — cricket marks, the around-the-clock target index, shanghai rounds, x01 legs and sets all come out right without a single mode-specific line of correction code.

**A bust is a recorded dart that changed nothing.** Today the engine rejects a busting dart and the view remembers it separately. That split is the double-booking risk. Under the ledger, a busting dart is *recorded* with its outcome (bust) and contributes no score, exactly as today, so the engine's count and the visible visit finally come from one place.

**The ledger is entered darts; `throwCount` is counted darts.** The ledger records every dart the player entered, including one that busted. `throwCount` keeps its current meaning — the number of darts that counted. The two are different things and are named differently: the ledger is the history, `throwCount` is the score-relevant count. `throwsInCurrentTurn` also keeps its current meaning (darts counted in the current turn), so the existing assertions at `StandardMode.test.ts:114-119` — a bust leaves `throwCount` at 6 and `throwsInCurrentTurn` at 0 — remain true without being rewritten. The plan's task 001 states this explicitly so the implementer does not "fix" the test.

**Replay goes through the engine, not only through the mode.** The turn order, the dart counters and the completion status are computed in `GameEngine.recordThrow` (`src/game-engine/GameEngine.ts:73-86`), not in the mode. So the replay must re-run *that* logic, not just the mode's `applyThrow`. The engine therefore extracts `recordThrow`'s body into a private `applyToDraft(draft, record)` and replays through it. The mode keeps ownership of the scoring rules alone, which is what keeps the correction logic mode-agnostic.

**Replay must not re-seed through `startMatch`.** `startMatch` applies the match configuration to the mode and then discards it (`GameEngine.ts:38-56`), and it mints a new match id. A replay that re-seeded that way would silently fall back to the mode's default checkout rule and compute different busts. The engine retains the player ids, the configuration and the match id, and replay re-seeds from those.

**Adding a field to `MatchState` touches two test fixtures.** `MutableMatchState` is derived from `MatchState` by a mapped type (`types.ts:138`), so a new required field makes the two hand-written `MutableMatchState` literals in `tests/unit/game-center/gameCenterPage.test.tsx:42` and `tests/unit/game-center/modeRegistry.test.ts:12` fail to compile. They must gain the new field. This is called out in task 001 so it is not discovered as a surprise.

**One shared implementation for the four views.** The four views currently repeat the same record → visit → announce logic. The correction feature would multiply that duplication fourfold, so the visit bookkeeping is extracted into one shared module used by all four.

**Correction never crosses players.** `correctThrow` takes the dart index and the replacement value; the player is read from the ledger entry, not from the caller. That makes the attribution rule structural rather than a check that could be forgotten.

**Confirmation is a two-stage control, not a modal.** The repo has no dialog component and no Radix dependency. The correction flow therefore follows the existing armed-segment pattern: the tapped dart becomes the armed correction target, and the replacement is chosen with the same dart pad that enters a dart — the pad is already the pointer, touch and keyboard path on mobile.

**Recording limits and the audit trail.** A dart in a completed turn (a previous turn) may be corrected, but only after an explicit confirmation, and the correction is appended to an audit list. A dart in the turn in progress is corrected directly.

## API Contract

Pinned here so the backend and the frontend can be developed in parallel without either waiting on the other. The backend may refine the *internals*; these names and shapes are the contract.

### Engine (`src/game-engine/`)

```ts
// A dart as entered by a player, in the order it was entered.
export interface RecordedThrow {
  /** ID of the player who threw the dart. A correction never changes this. */
  readonly playerId: string;
  /** Points the dart was worth. */
  readonly points: number;
  /** Optional board segment hit by the dart. */
  readonly segment?: ThrowSegment;
  /** True when the dart busted: entered, but it counted for nothing. */
  readonly bust: boolean;
}
```

Visit boundaries are **not** stored on the ledger entry — a correction changes them, so a stored boundary goes stale. They are derived from the replay and exposed on the derived state.

`MatchState` gains two fields:

```ts
  /** Every dart entered in this match, oldest first. */
  readonly throws: readonly RecordedThrow[];
  /** Corrections made to darts outside the turn in progress. */
  readonly corrections: readonly CorrectionRecord[];
```

`CorrectionRecord` names the dart index, the previous value, the new value and the player. It is JSON-safe and empty until a correction happens.

`GameEngine` gains two operations:

```ts
  /** Removes the last entered dart and re-derives the state. */
  undoLastThrow(): MatchState;

  /**
   * Replaces one recorded dart's value and re-derives the state.
   * The player is taken from the recorded dart, never from the caller.
   * Throws GameEngineStateError when the correction is not allowed.
   */
  correctThrow(dartIndex: number, value: { points: number; segment?: ThrowSegment }): MatchState;
```

**How the state is re-derived (the heart of the design).** `GameEngine` extracts the body of `recordThrow` — from the draft through the completion check — into a private `applyToDraft(draft, record)` that owns the turn advance, the dart counters and the completion check. `recordThrow` becomes *validate → applyToDraft → commit*. **Replay calls `applyToDraft`**, not the mode's `applyThrow` directly, because the turn order, the dart counters and the completion status are computed in the engine, not in the mode. The mode keeps ownership of the scoring rules alone.

**Replay must not re-seed through `startMatch`.** `startMatch` applies the match configuration to the mode and then discards it, and it mints a new match id. So the engine **retains** the validated player ids, the `MatchConfig` and the match id from `startMatch`, and replay re-seeds from those: build the players as `startMatch` does, re-apply `mode.configure(config)`, apply `mode.initializeMatch(draft)`, then run `applyToDraft` for each recorded dart in order. Without the retained configuration the mode would fall back to its default checkout rule, and replay would silently compute different busts.

**A bust needs a distinguishable signal.** The mode throws the same error class for a bust and for a genuine failure, so replay could not tell them apart. The engine therefore introduces `GameEngineBustError extends GameEngineStateError`, thrown only for the bust case. It stays a `GameEngineStateError` subclass so every existing assertion on the error type and on the word "bust" keeps passing.

**Bust rule (unchanged from today).** A busting dart is entered — it is in the ledger with `bust: true` — but it counts for nothing: it does not change the score, does not increment `throwCount`, and does not consume a dart slot. `recordThrow` keeps throwing for a busting dart, so existing callers and the realtime error mapping keep working.

**The ledger and `throwCount` are deliberately different numbers.** The ledger counts *entered* darts; `throwCount` counts *counted* darts; `throwsInCurrentTurn` counts darts counted in the current turn. A bust is in the ledger and in neither counter. All three keep their current meanings, so `tests/unit/game-engine/modes/StandardMode.test.ts:114-119` stays true unchanged.

**Allowed corrections — one rule, stated once.** A correction is **refused**, changing neither the state nor the ledger, when: the index is out of range; the match is already `completed`; the replacement would make the corrected dart itself bust; or the replacement would make a **later** recorded dart bust that did not bust before. The last case is real — the darts are scored against a running total, so changing an early dart can invalidate a later one. The player corrects forward, from the earliest dart they intend to change. Because a refused correction is detected before anything is committed, "no state change on refusal" is provable by comparing the whole state.

**Undo is allowed on a completed match.** The match-winning dart is exactly the dart a player may have mis-tapped. `undoLastThrow` therefore works while `status === "completed"`, and the replay simply no longer completes the match. A `correctThrow` on a completed match is still refused — rewriting a finished match's history is a different and larger problem, and the UI will not offer it.

**Leg and set boundaries.** A leg win resets every player's score to `startScore` and advances `modeData.legSet` (`src/game-engine/modes/StandardMode.ts:124-141`). Replay reproduces that exactly, because `applyToDraft` re-runs the mode's `applyThrow`, which calls `handleLegCompleted`. A correction that changes who won a leg is permitted, and its effect is simply the re-derived state — but it **must** be recorded in the audit trail, because it changes the match result and not merely a score.

**Payload bound.** The ledger travels in `MatchState`, which is broadcast over the socket (`src/realtime/socketServer.ts:205`) and persisted to Redis (`src/realtime/RedisRoomStore.ts:78`). It grows with the number of darts in one match — roughly 150 for a 501 game — so it is bounded by the match and not unbounded. The ledger array must be **cloned** between the stored state and any draft, so a mode cannot mutate it by reference.

### Frontend (`src/components/game/`)

Each view owns its own `GameEngine` instance and its own `ThrowInputPad`, so the shared code is a **presentational** component plus a **view-level** hook — not a component that owns the engine.

```ts
// src/components/game/useMatchHistory.ts — used by each view, which owns the engine.
export function useMatchHistory(options: {
  engine: GameEngine | null;
  matchState: MatchState | null;
}): {
  /** The darts of the current visit, for the strip and the score sheet. */
  throws: readonly RecordedThrow[];
  /** The dart armed as the correction target, or null. */
  correctionTarget: number | null;
  /** True when the armed target needs an explicit confirmation first. */
  awaitingConfirmation: boolean;
  /** Arms a dart as the correction target. */
  selectThrow(dartIndex: number): void;
  /** Confirms a correction to a dart in a finished turn. */
  confirmCorrection(): void;
  /** Cancels the correction, changing nothing. */
  cancelCorrection(): void;
  /** Submits a dart: a correction when one is armed, otherwise a new throw. */
  submitThrow(input: { points: number; segment?: ThrowSegment }): void;
  /** Removes the last entered dart. */
  undo(): void;
  /** True when there is a dart to undo. */
  canUndo: boolean;
};
```

The shared presentational component takes plain props and owns no engine:

```ts
// src/components/game/ThrowHistoryControls.tsx
export function ThrowHistoryControls(props: {
  throws: readonly RecordedThrow[];
  correctionTarget: number | null;
  awaitingConfirmation: boolean;
  canUndo: boolean;
  onSelectThrow: (dartIndex: number) => void;
  onUndo: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element;
```

**The view owns the armed correction target** and routes the pad's `onThrow` to it: when a target is armed, the pad's value corrects that dart; when none is armed, the value is a new throw. The four views replace their own `visits`/`visit` state with this hook, so the engine's ledger is the only record of the darts.

## Risks & Mitigations
- **Replay changes every mode's state path.** A bug in replay would silently corrupt scores. Mitigation: replay is the *only* way state is produced after a change, and the existing mode tests stay green — which proves the replay reproduces the old behaviour exactly. New tests assert the before/after equivalence.
- **Cricket's scoring depends on other players' marks** (`CricketMode.ts:112`), so a correction can change another player's score. This is correct but surprising. Mitigation: the replay is the mechanism, so it falls out; the test asserts it explicitly.
- **Four views drift.** Mitigation: one shared module, and the four views change only in how they name their mode and players.
- **The correction UI could regress the design system.** Mitigation: the new controls reuse `classes.ts` tokens and the existing chip vocabulary (`VisitChips`), and the visual-QC pass checks 1440/1024/390.
- **The ledger enlarges `MatchState`**, which is broadcast over the socket. Mitigation: the ledger holds only primitives and is bounded by the darts of one match.
