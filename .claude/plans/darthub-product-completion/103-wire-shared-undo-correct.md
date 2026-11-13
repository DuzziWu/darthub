# Task 103: Wire the shared undo/correct into the remaining four match views

**Status**: pending
**Depends on**: 100
**Retry count**: 0

## Description
The engine already owns the throw ledger and the undo/correct operations, and the shared hook and the presentational strip exist. But only one of the five match views uses them. 501, 301, Around The Clock and Shanghai keep their own private visit bookkeeping and therefore have no undo and no correction — a player can correct a dart in Cricket but not in 501. This task wires the remaining four views to the shared implementation and reconciles the stale plan and DevFlow ledger.

## Context
- Related files: `src/components/game/useMatchHistory.ts`, `src/components/game/ThrowHistoryControls.tsx`, `src/components/x01/X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, `app/game/page.tsx`, `app/game/301/page.tsx`, `src/game-engine/GameEngine.ts`, `src/game-engine/throwLedger.ts`
- `useMatchHistory` is consumed by exactly one file: `app/game/cricket/page.tsx:59`. `ThrowHistoryControls` likewise only in `app/game/cricket/page.tsx:167`.
- The three views with private bookkeeping: `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, `src/components/x01/X01MatchView.tsx`.
- `app/game/page.tsx` (501) and `app/game/301/page.tsx` both render `X01MatchView`, so fixing the x01 view covers both modes.
- `GameEngine.undoLastThrow` (`GameEngine.ts:131`), `GameEngine.correctThrow` (`GameEngine.ts:156`), `GameEngine.getVisits`, and `src/game-engine/throwLedger.ts` — the engine work is **done and verified present**. It is not rewritten by this task.
- `.claude/plans/throw-correction-undo/_plan.md` still lists tasks 001–008 as `pending`, although 001, 002 and 003 and the cricket wiring are in fact done.
- `.devflow/tasks/tasks.json` — `DF-0002` is `blocked`, `nextId` is 3.

## Requirements (Test Descriptions)
- [ ] `it offers undo in the 501 match view`
- [ ] `it offers undo in the 301 match view`
- [ ] `it offers undo in the around the clock match view`
- [ ] `it offers undo in the shanghai match view`
- [ ] `it corrects a recorded dart in the 501 match view`
- [ ] `it corrects a recorded dart in the around the clock match view`
- [ ] `it corrects a recorded dart in the shanghai match view`
- [ ] `it derives the visit chips from the engine ledger`
- [ ] `it shows the recorded darts as a tappable strip`
- [ ] `it confirms before correcting a dart from a finished visit`
- [ ] `it refuses to correct a dart beyond the recorded visit boundary`

## Acceptance Criteria
- All five match views offer undo and correction, driven by the shared hook and strip.
- The private per-view visit bookkeeping is **deleted**, not left in place beside the shared one. Two records of a visit is the exact double-booking the earlier plan identified as the root risk.
- The visit chips and the throw strip are derived from the engine ledger, so they cannot disagree with the engine.
- Each of the five views has a test that proves undo and correction work in it.
- The throw-correction plan and the `DF-0002` DevFlow task are reconciled with the tree: the plan's task statuses reflect what is done, and `DF-0002` is closed or given an accurate status.

## Implementation Notes

**Cricket is the reference implementation.** `app/game/cricket/page.tsx` already does this correctly: it calls `useMatchHistory({ engine, matchState })` and renders `<ThrowHistoryControls ... />`. Copy its structure exactly. Do not improve it in passing — the point of the task is that the other views become identical to it.

**Delete the private bookkeeping, do not just stop using it.** The three views each keep a `VisitEntry[]` or `Record<string, VisitEntry[]>` and their own record → visit → announcement logic. If that code stays, the next person editing it will reintroduce the divergence. Remove it and let the engine ledger be the only record of darts.

**The x01 view is shared by 501 and 301.** `app/game/page.tsx` and `app/game/301/page.tsx` both render `X01MatchView` with different `startScore` and `modeName`. Wiring `X01MatchView` covers both. Test both routes anyway — the task's success criteria name them separately, and the two routes differ in the score they start from.

**Bust handling differs per view.** `useMatchHistory` computes the current visit via `engine.getVisits().at(-1)` and derives visit indexes with `deriveVisitIndexes(matchState.throws, DARTS_PER_TURN)`. The `DARTS_PER_TURN` value and the visit-boundary rules come from the engine's own configuration. When porting to the around-the-clock and shanghai views, take the dart count from the mode's configuration rather than hard-coding 3, so a mode with a different turn length stays correct.

**Correcting a dart in cricket changes another player's marks.** The engine handles this by replay (`correctThrow` → `replay`), not by subtraction. This is already proven in the engine tests. The view's job is only to call it and render the result. Do not add any client-side score arithmetic to "fix" a perceived mismatch — that would reintroduce the double-booking.

**Reconcile the ledger honestly.** The plan at `.claude/plans/throw-correction-undo/_plan.md` lists 001–008 as pending. The truth is: 001 (ledger and replay), 002 (undo and correct operations), 003 (shared hook and strip) and 004 (wire the views — cricket only) are done; 005–008 are not. Update the plan's status column to reflect that, then mark 004 done once this task lands. Then update `.devflow/tasks/tasks.json`: `DF-0002` should no longer be `blocked` once its acceptance criteria are met, and `nextId` stays consistent.

**Do not touch the realtime socket handlers.** The engine API is designed so a future realtime undo is a thin wrapper, but the socket-level undo is out of scope for this plan and is documented as such in the plan file.
