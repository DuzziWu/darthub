---
name: darthub-game-engine
description: This skill should be used when the user asks to "change the scoring", "add a game mode", "fix a bust", "implement checkout rules", "add an out rule", "change the turn order", or otherwise touches the DartHub game engine. Encodes the ledger-and-replay model, the pure-TypeScript boundary of src/game-engine, the shared board-segment vocabulary and the rule-derivation discipline that keeps the rule sheet honest.
paths:
  - "src/game-engine/**"
  - "src/board/**"
---

# DartHub Game Engine

Guide for evolving the DartHub game engine without breaking the invariants
that make undo, correction and replay correct.

## The three rules that matter

### 1. The engine is pure TypeScript

`src/game-engine/types.ts` states the rule directly: the engine must never
import UI frameworks (React, Next.js), networking layers (Socket.IO) or
Node/browser-only built-ins, so it can run unchanged on the multiplayer server
and in the single-player client.

When adding an import to `src/game-engine/`, check that the imported module is
itself free of framework dependencies. `src/board/boardGeometry.ts` is a valid
dependency — it is pure geometry.

### 2. State is derived from a ledger, never mutated

`GameEngine` keeps a ledger of every dart the players entered. The match state
is _derived_ from that ledger by replaying it through the engine. Undoing or
correcting a dart therefore re-derives everything — score, turn order, leg
progress — from one single source of truth.

Consequences for a change:

- To change scoring, change how state is **derived**, never how it is stored.
- A new mode must re-derive identically whether the match is built forward or
  replayed from a ledger. If forward and replayed states diverge, the mode is
  wrong.
- A busting dart is _entered_ into the ledger but counts for nothing; it is
  still rejected with a `GameEngineStateError`.

Visit boundaries are deliberately **not** stored — a correction changes them,
so a stored boundary goes stale. They are derived from the replay
(`deriveVisitIndexes`, `groupVisits` in `src/game-engine/throwLedger.ts`).

### 3. Mode rules are delegated, and the UI never invents them

The core `GameEngine` owns match lifecycle, players, turn order and throw
recording. Everything mode-specific — 501 countdown, busts, checkout — lives
in a `DartGameMode` implementation in `src/game-engine/modes/`:

| Mode                                  | File                    | Exports                             |
| ------------------------------------- | ----------------------- | ----------------------------------- |
| `Standard501Mode` / `Standard301Mode` | `StandardMode.ts`       | id encodes start score and out rule |
| `CricketMode`                         | `CricketMode.ts`        | `CRICKET_TARGETS`, `MARKS_TO_CLOSE` |
| `ShanghaiMode`                        | `ShanghaiMode.ts`       | `SHANGHAI_ROUNDS`, `roundTarget`    |
| `AroundTheClockMode`                  | `AroundTheClockMode.ts` | `AROUND_THE_CLOCK_TARGETS`          |
| `NeutralScoreMode`                    | `NeutralScoreMode.ts`   | default; no scoring rules           |

`src/game-engine/modes/registry.ts` derives every rule-sheet string from the
mode's own exported constants, so the rule sheet can never describe a rule the
engine does not implement. When adding a mode, export its constants and let
the registry read them — do not write the rule text in the registry or in a
React component.

## Shared segment vocabulary

`BoardSegment` is defined once in `src/board/boardGeometry.ts` and re-exported
by the engine as `ThrowSegment`. Board geometry and engine must never disagree
about segment names.

Never define a local segment type. Import from `@/board/boardGeometry`.

## Checklist: adding a new game mode

1. Implement the mode in `src/game-engine/modes/`, extending the
   `DartGameMode` contract (`references/engine-rules.md`).
2. Export the mode's rule constants (targets, marks to close, rounds).
3. Register the mode in `src/game-engine/modes/registry.ts` — derive its rule
   sheet entry from those constants.
4. Add a route/page under `app/game/<mode>/`.
5. Add a mode view under `src/components/game/` using the shared components.
6. Add unit tests under `tests/unit/game-engine/modes/`.
7. Add a correction-replay test: the mode must produce the same state when
   built forward and when replayed from a ledger.

## Checklist: changing an existing rule

1. Locate the rule's constant in the mode file — not in the registry, not in a
   component.
2. Change the derivation in the mode.
3. Update the mode's unit tests.
4. Check `tests/unit/game-engine/modes/CorrectionReplay.test.ts` still passes.
5. Check the rule sheet text still matches — it is derived, so it should update
   itself; if it does not, the derivation was bypassed.

## Verification

Run the engine tests, which need neither a database nor a dev server:

```bash
npx vitest run tests/unit/game-engine/
```

For the broader suite, read the known baseline first:
`references/test-matrix.md` records the pre-existing failures so they are not
mistaken for regressions.

## Additional Resources

### Reference Files

- **`references/engine-rules.md`** — the `DartGameMode` contract, the
  replay/undo semantics, and each mode's rule constants.
- **`references/test-matrix.md`** — test categories, required environment and
  the known-failure list.
