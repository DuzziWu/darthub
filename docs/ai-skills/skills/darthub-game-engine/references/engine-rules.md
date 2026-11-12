# DartHub Game Engine Rules

The `DartGameMode` contract, the replay/undo semantics, and the rule
constants of every existing mode.

## The `DartGameMode` contract

`src/game-engine/types.ts`:

```ts
export interface DartGameMode {
  /** Unique mode identifier, e.g. "neutral". */
  readonly id: string;

  /** Optional: called once when a match starts, before the first snapshot.
   *  Modes seed initial scores here (e.g. start every player at 501). */
  initializeMatch?(draft: MutableMatchState): void;

  /** Optional: called with the raw MatchConfig once per startMatch,
   *  before initializeMatch. Modes pick up mode-agnostic options here
   *  (outRule, legs, sets). */
  configure?(config: MatchConfig): void;

  /** Applies a recorded throw to the mutable state draft. */
  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void;

  /** Returns true when the mode considers the match finished. */
  isMatchComplete(state: MatchState): boolean;

  /** Optional: a stable description of the match result — who won what.
   *  The engine compares the signature before and after a correction to
   *  tell whether a correction changed the *result*, not merely a score.
   *  Modes without a result structure omit it. */
  resultSignature?(state: MatchState): string;
}
```

Two helpers the modes work with:

| Type                 | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `MutableMatchState`  | the mutable counterpart of `MatchState` handed to `applyThrow` |
| `MutablePlayerState` | the mutable counterpart of `PlayerState`                       |

`MutableMatchState` is `MatchState` with the `readonly` modifiers removed and
`players` widened to `MutablePlayerState[]`.

### Ordering inside `startMatch`

```text
validatePlayerIds(config.playerIds)
  -> mode.configure?.(config)
  -> build the players array
  -> mode.initializeMatch?.(draft)
  -> freeze into a MatchState
```

`configure` runs before `initializeMatch`, so a mode can read `outRule`,
`legs` and `sets` from the config and seed its initial state accordingly.

## Replay and undo semantics

The engine keeps the ledger of every dart the players entered. The match
state is **derived** by replaying that ledger through the engine.

```text
recordThrow(input)
  -> validate the input
  -> mode.applyThrow(draft, throwRecord)
  -> push onto the ledger
  -> return the new state snapshot
```

Undo and correction do not mutate anything backwards. They re-derive the
state by replaying the ledger minus (or with) the affected dart. That is why
the rules below hold:

- **A busting dart is entered but counts for nothing.** It lands in the
  ledger, and it is still rejected with a `GameEngineStateError` (subclass
  `GameEngineBustError`) so existing callers and the realtime error mapping
  keep working.
- **Visit boundaries are not stored.** A correction changes them, so a stored
  boundary goes stale. They are derived from the replay by
  `deriveVisitIndexes` and `groupVisits` in `src/game-engine/throwLedger.ts`.
- **A correction never moves a dart between players.** The replacement value
  (`CorrectionValue`) carries only `points` and `segment`; the player comes
  from the recorded dart.
- **`resultSignature` distinguishes "the score changed" from "the result
  changed".** The engine compares the signature before and after a
  correction.

### The consequence for a new mode

A new mode must produce **identical** state whether the match is built
forward through `recordThrow` or derived by replaying a ledger. If the two
diverge, the mode is wrong — and undo/correct will produce wrong results
that only show up in the correction tests.

Test this explicitly:

```ts
// build forward
const forward = engine.startMatch({ playerIds });
engine.recordThrow({ playerId: "p1", points: 20 });

// replay the same ledger
const replayed = new GameEngine(mode).startMatch({ playerIds });
replayed.recordThrow({ playerId: "p1", points: 20 });

expect(replayed.getState()).toEqual(forward);
```

## Rule constants per mode

| Mode                 | File                    | Exports                                     |
| -------------------- | ----------------------- | ------------------------------------------- |
| `NeutralScoreMode`   | `NeutralScoreMode.ts`   | the default mode; no scoring rules          |
| `Standard501Mode`    | `StandardMode.ts`       | id encodes the start score and the out rule |
| `Standard301Mode`    | `StandardMode.ts`       | id encodes the start score and the out rule |
| `CricketMode`        | `CricketMode.ts`        | `CRICKET_TARGETS`, `MARKS_TO_CLOSE`         |
| `ShanghaiMode`       | `ShanghaiMode.ts`       | `SHANGHAI_ROUNDS`, `roundTarget`            |
| `AroundTheClockMode` | `AroundTheClockMode.ts` | `AROUND_THE_CLOCK_TARGETS`                  |

### x01 modes

The x01 mode id encodes the rules it was built with:
`/^x01-(\d+)(?:-(double|master)-out)?/`. The registry reads the start score
and the default out rule straight out of that id — it does not keep a second
copy of the facts.

| `OutRuleId` | Meaning      |
| ----------- | ------------ |
| `double`    | double out   |
| `master`    | master out   |
| `straight`  | straight out |

### Checkout rules

`src/game-engine/rules/OutRules.ts` exports the `OUT_RULES` record and
`isValidSegmentScore`. The registry derives the human-readable checkout
descriptions from what each rule actually accepts, so the rule sheet cannot
describe a finish the rule does not allow.

### Legs and sets

`src/game-engine/rules/LegSetManager.ts` manages leg and set progression.
It is a rule of the game, so it lives under `rules/` rather than inside a
mode.

## The rule sheet

`src/game-engine/modes/registry.ts` is the single place the Game Center
reads its rules from. It exports:

| Export             | Purpose                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| `MODE_RULES`       | one `ModeRuleEntry` per mode — id, name, href, start, win condition, checkout, targets |
| `OUT_RULE_CHOICES` | the checkout rules the match setup offers                                              |
| `sheetFootnote()`  | the one generated line: darts per turn and the checkout rules                          |

Every value in `MODE_RULES` is derived from a mode's own exported constants
or from the mode instance itself. When adding a mode, export the constants
and let the registry read them.

## Rules for changing the engine

1. Never import React, Next.js, Socket.IO or Node built-ins into
   `src/game-engine/`.
2. Change the _derivation_, never the stored representation.
3. Keep the segment vocabulary shared with `src/board/boardGeometry.ts`.
4. Export new rule constants; let the registry derive the copy.
5. Keep `applyThrow` a pure function of `(draft, throwRecord)` — it must not
   reach outside the draft for the previous state.
6. Update `tests/unit/game-engine/` and
   `tests/unit/game-engine/modes/CorrectionReplay.test.ts`.

## Existing engine tests

| File                                                      | Covers                                          |
| --------------------------------------------------------- | ----------------------------------------------- |
| `tests/unit/game-engine/GameEngine.test.ts`               | the core engine                                 |
| `tests/unit/game-engine/GameEngineValidation.test.ts`     | input validation and the error types            |
| `tests/unit/game-engine/UndoCorrect.test.ts`              | undo and correction                             |
| `tests/unit/game-engine/frameworkAgnostic.test.ts`        | that the engine stays free of framework imports |
| `tests/unit/game-engine/docs/publicApi.test.ts`           | the public API surface                          |
| `tests/unit/game-engine/modes/StandardMode.test.ts`       | 501 / 301                                       |
| `tests/unit/game-engine/modes/CricketMode.test.ts`        | cricket                                         |
| `tests/unit/game-engine/modes/ShanghaiMode.test.ts`       | shanghai                                        |
| `tests/unit/game-engine/modes/AroundTheClockMode.test.ts` | around the clock                                |
| `tests/unit/game-engine/modes/CorrectionReplay.test.ts`   | replay after a correction, per mode             |
| `tests/unit/game-engine/rules/LegSetManager.test.ts`      | legs and sets                                   |
| `tests/unit/game-engine/rules/OutRules.test.ts`           | the checkout rules                              |

`frameworkAgnostic.test.ts` enforces the purity rule mechanically — check it
before assuming a new import is safe.
