# Task 001: Throw ledger and replay in the game engine

**Status**: pending
**Depends on**: none
**Retry count**: 0

## Description
Give the game engine an ordered record of every dart entered, and make the match state derivable by replaying that record through the mode's own `applyThrow`. Today the engine keeps only `throwCount` and discards the darts themselves, so there is nothing to undo or correct. This task adds the ledger, the replay, and the ability to re-derive a state from an arbitrary ledger — the mechanism every later task builds on.

## Context
- Related files: `src/game-engine/types.ts`, `src/game-engine/GameEngine.ts`, `src/game-engine/index.ts`, `src/game-engine/modes/*.ts`, `src/game-engine/rules/*.ts`
- Patterns to follow: the existing draft/mutable pattern (`MutableMatchState`, `toMutableDraft`, `asMatchState` in `GameEngine.ts`); the mode seam (`DartGameMode` with `initializeMatch`, `configure`, `applyThrow`, `isMatchComplete`); JSON-safety of `MatchState` (asserted in `tests/unit/game-engine/GameEngine.test.ts:23`).
- `src/game-engine/GameEngine.ts:62` — `recordThrow` currently mutates a draft and discards the dart.
- `src/game-engine/types.ts:30` — `ThrowRecord` already carries `playerId`, `points`, `segment`; extend rather than duplicate it.
- Modes own all mode-specific state: `CricketMode` (marks in `modeData`), `AroundTheClockMode` (`currentTargetIndex`), `ShanghaiMode` (`currentRound`, `roundRecords`), `StandardMode` (`LegSetManager` progress, score reset on leg end).
- The engine is pure TypeScript: no DOM, React, Node or Socket.IO imports. It must stay importable in the browser and on the server.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it records every entered dart in the throw ledger`
- [ ] `it records the player, points and segment of each dart`
- [ ] `it records a busting dart without applying it to the score`
- [ ] `it leaves the score and the dart count unchanged when a dart busts`
- [ ] `it derives the same state by replaying the ledger as by recording the darts directly`
- [ ] `it replays the turn order and the dart counters identically`
- [ ] `it replays the match completion identically`
- [ ] `it re-derives the state from a ledger with a dart removed`
- [ ] `it re-derives the state from a ledger with a dart replaced`
- [ ] `it keeps the state JSON-safe when the ledger is present`
- [ ] `it exposes the ledger as part of the match state`

## Acceptance Criteria
- All requirements have passing tests.
- The ledger is part of the public state contract and is JSON-safe.
- Replay is the one and only way state is derived after a change; no mode-specific correction code exists.
- Existing engine and mode tests still pass unchanged — that is the proof that replay reproduces the current behaviour.
- Code follows project standards; no new runtime dependency.

**Test ownership.** The per-mode replay tests (cricket marks, the around-the-clock target index, shanghai rounds, x01 legs and sets) belong to **task 005**, not here — the test engineer owns them. Prove this task's behaviour in a scratch file under `.devflow/tmp/` and report the assertions so the test agent can port them. Do not create files under `tests/`.

## Implementation Notes

Design decisions already settled (do not re-open):

- The ledger lives in the engine and travels in `MatchState`, alongside `modeData`, so it survives to the client and the socket server. It holds only JSON-safe primitives.
- **Replay goes through the engine, not only through the mode.** Extract the body of `recordThrow` — from the draft through the completion check — into a private `applyToDraft(draft, record)` that owns the dart counters, the turn advance and the completion check. `recordThrow` becomes validate → applyToDraft → commit. **Replay calls `applyToDraft`**, because the turn order, the counters and the status are computed in `GameEngine.ts:73-86`, not in the mode. The mode keeps ownership of the scoring rules alone, which is what keeps the correction logic mode-agnostic.
- **Replay must not re-seed through `startMatch`.** `startMatch` applies the config to the mode and then discards it (`GameEngine.ts:38-56`), and it mints a new match id. The engine **retains** the validated player ids, the `MatchConfig` and the match id, and replay re-seeds from those: build the players as `startMatch` does, re-apply `mode.configure(config)`, apply `mode.initializeMatch(draft)`, then run `applyToDraft` per recorded dart in order. Without the retained configuration the mode falls back to its default checkout rule and replay computes different busts.
- **A bust needs a distinguishable signal.** The mode throws the same error class for a bust and for "player not in this match" (`StandardMode.ts:97` and `StandardMode.ts:104`), so replay could not tell them apart. Introduce `GameEngineBustError extends GameEngineStateError` in `src/game-engine/types.ts`, thrown only for the bust case. It must stay a `GameEngineStateError` subclass so `expect(...).toThrowError(GameEngineStateError)` and the `/bust/i` assertion at `tests/unit/game-engine/modes/StandardMode.test.ts:115` keep passing.
- **The ledger records entered darts; `throwCount` counts counted darts; `throwsInCurrentTurn` counts darts counted in the current turn.** All three keep their current meaning. A busting dart is entered (so it is in the ledger) but counted by none of them. This is why `tests/unit/game-engine/modes/StandardMode.test.ts:114-119` — a bust leaves `throwCount` at 6 and `throwsInCurrentTurn` at 0 — stays true **unchanged**. Do not "fix" that test, and do not try to make the ledger length equal `throwCount`.
- A bust does **not** consume a dart slot. This matches today's engine exactly (probed: one counted dart plus one bust leaves `throwsInCurrentTurn` at 1). The x01 view's separate rule that a bust *ends* the visit (`X01MatchView.tsx:141`) is a display rule over the ledger, not a second record of the darts — task 004 handles it.
- `recordThrow` keeps throwing for a busting dart, so the current call sites and the realtime error mapping keep working. The dart still lands in the ledger.
- The ledger records the player with each dart. A later correction reads the player from the ledger entry; it never accepts a player from the caller.
- **Do not store visit boundaries on the ledger entry.** A correction that turns a dart into a bust changes the dart counter, so a stored boundary goes stale. Derive the visit grouping from the replay and expose it on the derived state.
- **Clone the ledger** between the stored state and any draft, so a mode cannot mutate it by reference. `toMutableDraft`/`asMatchState` (`GameEngine.ts:184-208`) must carry it.
- **State the payload bound.** The ledger travels in `MatchState`, which is broadcast (`src/realtime/socketServer.ts:205`) and persisted to Redis (`src/realtime/RedisRoomStore.ts:78`). It grows with the darts of one match — roughly 150 for a 501 game — so it is bounded by the match.
- **Adding a field to `MatchState` breaks two test fixtures.** `MutableMatchState` is a mapped type over `MatchState` (`types.ts:138`), so the hand-written literals in `tests/unit/game-center/gameCenterPage.test.tsx:42` and `tests/unit/game-center/modeRegistry.test.ts:12` will no longer compile. They need the new field. Expect this; it is not a design problem, and the test agent owns those files.
- The replay must reproduce the x01 leg boundary exactly: a leg win resets **every** player's score to `startScore` and advances `modeData.legSet` (`StandardMode.ts:124-141`). Replay reproduces it because `applyToDraft` re-runs the mode's `applyThrow`, which calls `handleLegCompleted`, and `LegSetManager.recordLegWinner` is a pure function of the prior progress.
- The per-mode replay tests belong to task 005, not here. Prove your implementation in a scratch file under `.devflow/tmp/` and report the assertions so the test agent can port them. Do not create files under `tests/`.

Leave blank for the implementer.
