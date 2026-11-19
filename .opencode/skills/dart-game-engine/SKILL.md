---
name: Dart Game Engine
description: Use when changing dart rules, game modes, scoring, out rules, legs and sets, the throw ledger, undo/correction replay, board geometry, hit resolution or the statistical AI opponent in src/game-engine, src/board, src/ai or src/camera. Covers the determinism contract, the edge cases that must be tested and the verification commands.
---

# Dart game engine (DartHub)

The engine is the heart of the product: it decides what the score is. It is
**pure TypeScript** and must stay that way — the same code runs in the browser
and on the authoritative server.

## The contract

| Rule                                                        | Why                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| No React, Next.js, Socket.IO, Node built-ins or DOM globals | One engine, many runtimes. Enforced by `tests/unit/game-engine/frameworkAgnostic.test.ts` |
| `MatchState` is JSON-safe                                   | It is broadcast over the socket and persisted to Redis                                    |
| State is derived by replay, never patched                   | Undo and correction must reproduce the original state exactly                             |
| One record of the darts (`state.throws`)                    | Two copies of the darts always drift apart                                                |
| Deterministic                                               | Same darts → same state, in every mode, on every machine                                  |
| The core holds no mode rules                                | Rules live in a `DartGameMode`; the core owns turn order only                             |

## Where things live

```text
src/game-engine/
  GameEngine.ts       core: startMatch, recordThrow, undoLastThrow, correctThrow, getState, getVisits
  types.ts            MatchState, RecordedThrow, DartGameMode, error classes, ThrowSegment
  throwLedger.ts      visit grouping and the ledger helpers
  NeutralScoreMode.ts shipped default mode
  modes/StandardMode.ts, CricketMode.ts, AroundTheClockMode.ts, ShanghaiMode.ts, registry.ts
  rules/OutRules.ts, LegSetManager.ts
  README.md           the engine contract — keep it in sync
src/board/boardGeometry.ts   board-plane geometry, hit resolution
src/board/boardSource.ts     board source selection
src/ai/engine.ts, config/*.json   statistical opponent, difficulties, personalities
src/camera/                  ICameraService seam, smartphone stub, vision scaffold
```

## Vocabulary you must use correctly

- **Ledger** — every dart that was _entered_, oldest first. A busting dart is
  in the ledger with `bust: true`.
- **`throwCount`** — darts that _counted_.
- **`throwsInCurrentTurn`** — darts counted in the turn in progress.
- **Visit** — a group of three darts, derived from the ledger, never stored on
  a dart (a correction would make a stored boundary stale).
- **Segment** — `"single" | "double" | "triple" | "bull"`. A throw without a
  segment cannot finish a leg under double or master out.

A bust: entered, scores nothing, does not consume a dart slot, does not
advance the turn, does not change the score. The ledger records it; the error
is the signal.

## Adding or changing a mode

1. Implement `DartGameMode`: `applyThrow(draft, record)` and
   `isMatchComplete(state)`.
2. Mutate **only** through the mutable draft handed to `applyThrow`. No side
   effects, no I/O, no randomness — the mode must be replayable.
3. Register the mode in `src/game-engine/modes/registry.ts` so the rule sheet
   and the mode registry test know about it.
4. Export it from the barrel `src/game-engine/index.ts` without breaking the
   existing exports.
5. Document it in `src/game-engine/README.md`.

## Changing a rule

1. Write the failing test first. Watch it fail for the right reason.
2. Change the rule.
3. Run the engine suite — the existing tests are the proof that you did not
   break the old behaviour.
4. If the behaviour is user-visible, update `src/game-engine/README.md` and
   tell the frontend agent which view is affected.

## Edge cases that must always be covered

- Zero, 60 (triple 20), 50 (bull), 25 (outer bull).
- A bust in every mode; a bust as the last dart of a visit.
- Out rules `straight` / `master` / `double`; a finish that is invalid for the
  rule; the "stuck on 1" case; the inner bull (50) as a finish.
- Leg and set boundaries: the score reset, "best of N" (more than half of N),
  the `modeData.legSet` progress.
- Multi-player interaction: in Cricket the score of one player depends on
  another player's marks.
- Undo on a **completed** match is allowed; `correctThrow` on a completed
  match is refused.
- A refused correction changes **nothing**: not the state, not the ledger, not
  the corrections trail.
- A corrected dart keeps its player — the player is read from the ledger.
- A correction that would make a later dart bust is refused.
- One player, zero throws, a match that never starts.

## Verification

```bash
npx vitest run tests/unit/game-engine tests/unit/board tests/unit/ai
npx vitest run tests/unit/game-center tests/unit/game   # consumers of the engine
npm run typecheck
npm run lint
```

Quote the actual output. If a test fails, fix it or document why — never
report a green run you did not see.

## Do not

- Do not add a framework import to the domain core.
- Do not introduce a second record of the darts.
- Do not change a public export's shape without a compatibility path.
- Do not add `Date.now()` or `Math.random()` to a scoring path.
