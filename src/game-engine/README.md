# Game Engine (`@/game-engine`)

The DartHub core dart match engine. Pure TypeScript with zero runtime
dependencies — no React, Next.js, Socket.IO or other framework imports — so the
exact same code runs on the multiplayer Node server and inside any browser
client. The engine is **UI-agnostic** and can be used **in isolation**: it owns
match lifecycle, turn order and throw recording, and delegates all scoring and
completion rules to a pluggable `DartGameMode`.

## Quick start

```ts
import { GameEngine } from "@/game-engine";

const engine = new GameEngine(); // uses the shipped NeutralScoreMode

const state = engine.startMatch({ playerIds: ["alice", "bob"] });
// → initial snapshot: alice throws first, 3 darts per turn

const afterThrow = engine.recordThrow({ playerId: "alice", points: 20 });
// → same turn (throwsInCurrentTurn: 1). A turn advances only after the
//   3rd dart of that turn.

console.log(JSON.stringify(engine.getState())); // JSON-safe snapshot
```

## Configuration

A match is configured through the object passed to `startMatch`:

```ts
import type { MatchConfig } from "@/game-engine";

const config: MatchConfig = {
  // Player IDs in seating/turn order. Unique, non-empty strings (trimmed).
  playerIds: ["alice", "bob", "carol"],
};
```

Validation performed by the core on `startMatch`:

- At least one player is required.
- IDs are trimmed and must remain non-empty.
- IDs must be unique.

The chosen game mode itself is injected via the constructor — see
[Extension: implementing a DartGameMode](#extension-implementing-a-dartgamemode).

### Checkout rules and legs/sets (x01)

`StandardMode` accepts additional configuration when it is constructed, and
the same options can be filled in per match through `startMatch` (constructor
options take precedence):

```ts
import { GameEngine } from "@/game-engine";
import { StandardMode } from "@/game-engine/modes";

// Double Out, best of 5 legs per set, best of 3 sets per match.
const mode = new StandardMode({ startScore: 501, outRule: "double" });
const engine = new GameEngine(mode);
engine.startMatch({ playerIds: ["alice", "bob"], outRule: "double", legs: 5, sets: 3 });
```

- **`outRule: "double" | "master" | "straight"`** — which darts may finish a
  leg on exactly zero. `"straight"` (default) accepts any finish, `"master"`
  any double or the inner bull (50), `"double"` only a board double.
  `StandardMode`'s own default is `"straight"`; the `Standard501Mode` and
  `Standard301Mode` wrappers default to `"double"`, so a standard x01 match is
  played under double out unless the match configuration says otherwise.
- **`legs` / `sets`** — "best of N" sizes: winning a round takes more than
  half of N (best of 5 legs = first to 3). On every non-final leg all scores
  reset to the start score; per-leg/set progress is tracked JSON-safely in
  `MatchState.modeData` under the `"legSet"` key.
- Busts are rejected outright (`GameEngineStateError`) and leave the match
  state untouched: a score below zero, a finish whose segment is invalid for
  the out rule, and (double/master out) stranding a player on 1.
- `ThrowInput`/`ThrowRecord` carry an optional `segment`
  (`"single" | "double" | "triple" | "bull"`) so checkout rules know which
  board area the last dart hit. Segment-less throws stay fully backwards
  compatible but cannot finish a leg under `"double"`/`"master"`.

## Public API

### `class GameEngine`

```ts
import { GameEngine, NeutralScoreMode, DARTS_PER_TURN } from "@/game-engine";
import type { DartGameMode } from "@/game-engine";

class GameEngine {
  constructor(mode?: DartGameMode); // defaults to NeutralScoreMode

  startMatch(config: MatchConfig): MatchState;
  recordThrow(input: ThrowInput): MatchState;
  undoLastThrow(): MatchState;
  correctThrow(dartIndex: number, value: CorrectionValue): MatchState;
  getState(): MatchState;
  getVisits(): readonly MatchVisit[];
  getCurrentTurn(): readonly RecordedThrow[];
}

/** Darts available to each player per turn (always 3). */
export const DARTS_PER_TURN = 3;
```

- **`constructor(mode?: DartGameMode)`** — injects the scoring/completion
  rules. Omitting it uses the shipped `NeutralScoreMode` (`id: "neutral"`).
- **`startMatch(config: MatchConfig): MatchState`** — validates the config,
  creates a match (`matchId` is generated as `match-<timestamp>-<random>`) and
  returns the initial snapshot. Throws `GameEngineValidationError` on invalid
  player IDs.
- **`recordThrow(input: ThrowInput): MatchState`** — records one dart for the
  current player, applies the mode's scoring via `applyThrow`, then advances
  the turn **after the 3rd dart** (`DARTS_PER_TURN`). When the mode reports
  the match complete, the resulting snapshot has `status: "completed"`,
  `currentPlayerId: null` and `throwsInCurrentTurn: 0`; it still contains the
  final throw's points. Throws:
  - `GameEngineValidationError` — blank `playerId`, or `points` not an
    integer in `0..60` (single dart max is triple 20).
  - `GameEngineStateError` — no match started yet, match already completed,
    or `playerId` is not the current player.
  - Every failed call leaves the internal state untouched.
- **`undoLastThrow(): MatchState`** — removes the last dart of the ledger and
  re-derives the state. A bust is a dart of the ledger, so it is removed
  too. Allowed on a completed match: undoing the match-winning dart returns
  the match to `inProgress`. See [Correction and undo](#correction-and-undo).
- **`correctThrow(dartIndex: number, value: CorrectionValue): MatchState`** —
  replaces the value of one recorded dart — the index is the position of the
  dart in the ledger — and re-derives the state. The player of the dart comes
  from the ledger, never from the caller. See
  [Correction and undo](#correction-and-undo).
- **`getState(): MatchState`** — returns a fresh `structuredClone` of the
  current snapshot. Mutating the returned object never affects engine
  internals. Throws `GameEngineStateError` if called before `startMatch`.
- **`getVisits(): readonly MatchVisit[]`** — groups the ledger into visits:
  the dart groups the match views show as one chip row. A visit ends when
  the turn advances and when a dart busts.
- **`getCurrentTurn(): readonly RecordedThrow[]`** — returns the darts of the
  turn in progress: the darts the player whose turn it is has thrown since
  that turn started. A bust belongs to the turn — the player threw it — but
  it consumes no dart slot, so the turn goes on and the bust fills none of
  the three places. The boundary is derived from the ledger, never stored,
  so a correction cannot leave it stale.

### Ledger helpers

```ts
import {
  deriveTurnIndexes,
  deriveTurnThrows,
  deriveVisitIndexes,
  groupVisits,
} from "@/game-engine";
import type { RecordedThrow } from "@/game-engine";

function deriveTurnIndexes(throws: readonly RecordedThrow[], dartsPerTurn: number): number[];

function deriveTurnThrows(
  throws: readonly RecordedThrow[],
  currentPlayerId: string | null,
  dartsPerTurn: number,
): RecordedThrow[];

function deriveVisitIndexes(throws: readonly RecordedThrow[], dartsPerTurn: number): number[];

function groupVisits(throws: readonly RecordedThrow[], dartsPerTurn: number): MatchVisit[];
```

- **`deriveTurnIndexes(throws: readonly RecordedThrow[], dartsPerTurn: number): number[]`**
  — returns the turn index of every dart of the ledger, oldest first. A turn
  holds `dartsPerTurn` counted darts and a bust consumes no slot, so the turn
  of a dart is the number of counted darts before it, rounded down to the turn
  it fills.
- **`deriveTurnThrows(throws: readonly RecordedThrow[], currentPlayerId: string | null, dartsPerTurn: number): RecordedThrow[]`**
  — derives the darts of the turn in progress from the ledger. The walk runs
  backwards from the end of the ledger and collects the darts of
  `currentPlayerId`; a dart of another player ends the turn. A bust is a dart
  of the turn but spends no dart slot, so the walk continues past it and the
  result holds at most `dartsPerTurn` counted darts. `currentPlayerId: null`
  — the match is over — yields an empty array.
- **`deriveVisitIndexes(throws: readonly RecordedThrow[], dartsPerTurn: number): number[]`**
  — returns the visit index of every dart of the ledger, oldest first.
- **`groupVisits(throws: readonly RecordedThrow[], dartsPerTurn: number): MatchVisit[]`**
  — groups the ledger into visits, oldest first.

Neither the visit boundaries nor the turn boundary are stored on a dart: a
correction changes them, so a stored boundary would go stale. They are
re-derived from the ledger whenever they are asked for.

### Correction and undo

Both operations change the ledger and re-derive the whole match state from
it: the engine replays the entire ledger through the mode's `applyThrow`
(`replay` → `applyToDraft`). There is no score arithmetic on the correction
path — the score, the counters, the turn order and the mode-owned state are
consequences of the replayed darts, not of the correction itself.

```ts
import { GameEngine } from "@/game-engine";
import type { CorrectionValue } from "@/game-engine";

const engine = new GameEngine();
engine.startMatch({ playerIds: ["alice", "bob"] });

// Replace the value of the dart at ledger index 0.
const value: CorrectionValue = { points: 60, segment: "triple" };
engine.correctThrow(0, value);

// Remove the last dart of the ledger.
engine.undoLastThrow();
```

`correctThrow(dartIndex, value)` takes the **index of the dart in the
ledger** and a `CorrectionValue` (`{ points, segment? }`). The replacement
carries **no player id**: the player always comes from the recorded dart, so
a correction can never move a dart between players.

A correction may change:

- the score — `players[].totalPoints`,
- the counters — `throwsInCurrentTurn`,
- the mode-owned state — `modeData` (e.g. the leg progress of an x01 match),
- the audit trail — `state.corrections`, one `CorrectionRecord` per audited
  correction.

A correction may **not** change the **turn membership** of the darts. A bust
consumes no dart slot and a turn holds three counted darts, so correcting a
bust into a counting dart would hand that turn a **fourth** dart — a ledger
shape `recordThrow` could never produce, because it would have advanced the
turn after the third counted dart. The engine therefore refuses such a
correction with `GameEngineStateError`.

The check compares the turn index of **every** dart before and after the
correction (`deriveTurnIndexes`). The player order of the ledger never
changes — the player of a dart is preserved — what is pinned is the turn
membership.

A refused correction changes **nothing**: neither the match state nor the
ledger, and it writes **no audit entry**.

A correction may still change `throwsInCurrentTurn`: a bust of the **turn in
progress** that becomes a counting dart adds a dart slot to that turn. That is
allowed, because it does not move a dart into another turn. A bust of an
earlier turn cannot be counted the same way — that would push the darts after
it into another turn, so it is refused.

An audit entry is written only when the engine's own `shouldAudit` decides
so:

- a correction of a dart from a **finished visit** is always audited,
- a correction of a dart in the **turn in progress** is audited only when it
  changed the result of the match — the match ended, or the mode's result
  signature moved, e.g. a different player won the leg.

Two consecutive corrections of the same dart inside the turn in progress
therefore leave no audit trail at all — unless one of them changed the
result of the match.

`undoLastThrow` and `correctThrow` differ in what they do to the ledger:
`undoLastThrow` **removes** the last dart — a bust too, because the bust is
in the ledger — and re-derives the state, while `correctThrow` **replaces
the value** of one dart and keeps it in the ledger.

- `undoLastThrow` is allowed on a **completed** match: undoing the
  match-winning dart returns the match to `inProgress`.
- `correctThrow` on a completed match is refused.
- `undoLastThrow` on an empty ledger throws `GameEngineStateError`.
- `undoLastThrow` also drops the audit entries that pointed at the removed
  dart.

`correctThrow` refuses a correction that would

- run on a completed match — the match is already completed,
- address a dart that does not exist — the index is not in the ledger,
- make the corrected dart itself bust,
- make a later recorded dart bust that did not bust before,
- change the turn rotation of the ledger.

Every one of these refusals carries a stable `code` — the names are listed in
[Error codes](#error-codes).

An invalid replacement value — `points` outside `0..60`, or a `segment` that
is impossible for those points — throws `GameEngineValidationError`.

### Mode and shared types

```ts
class NeutralScoreMode implements DartGameMode {
  readonly id: "neutral";

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void;
  isMatchComplete(state: MatchState): boolean; // always false
}
```

`NeutralScoreMode` simply adds each throw's `points` to the throwing player's
`totalPoints` and never ends the match. It exists so the core has a working
rule set out of the box; all real modes plug in via the `DartGameMode` seam.

Additional exported value: `DARTS_PER_TURN = 3`.

Exported types: `CorrectionRecord`, `CorrectionValue`, `DartGameMode`,
`GameEngineErrorCode`, `MatchConfig`, `MatchModeData`, `MatchState`,
`MatchStatus`, `MatchVisit`, `MutableMatchState`, `MutablePlayerState`,
`PlayerState`, `RecordedThrow`, `ThrowInput`, `ThrowRecord`.

## State snapshot shape

`MatchState` is a **JSON-safe** snapshot — only plain objects, arrays,
strings, numbers, booleans and `null` — so it can be serialized over the wire
or stored as-is:

```ts
interface MatchState {
  readonly matchId: string; // generated by startMatch
  readonly status: "inProgress" | "completed";
  readonly players: readonly {
    readonly id: string;
    readonly totalPoints: number; // meaning defined by the mode
  }[];
  readonly currentPlayerId: string | null; // null once the match is over
  readonly throwsInCurrentTurn: number; // 0..2 for a live turn
  readonly throwCount: number; // total darts recorded in the match
  readonly modeData?: MatchModeData; // mode-owned slice, e.g. the leg progress
  readonly throws: readonly RecordedThrow[]; // the ledger, oldest first
  readonly corrections: readonly CorrectionRecord[]; // the audit trail
}
```

Turn-order subtlety: the turn advances **after the 3rd dart of a turn**
(standard darts). A single `recordThrow` therefore passes play to the same
player unless it is their third dart of the turn — check
`throwsInCurrentTurn` and `currentPlayerId` on the returned snapshot.

## Error classes

```ts
import {
  GameEngineBustError,
  GameEngineStateError,
  GameEngineValidationError,
} from "@/game-engine";
```

- **`GameEngineValidationError`** — bad inputs: empty/duplicate/blank player
  IDs; `points` that is non-integer, negative, or above 60.
- **`GameEngineStateError`** — bad lifecycle usage: `recordThrow`/`getState`
  before `startMatch`, throwing out of turn, or throwing after the match
  completed.
- **`GameEngineBustError`** — the dart busted: it was entered, but it counts
  for nothing. It is a subclass of `GameEngineStateError`, so every caller
  that only knows the state error keeps working.

All three extend `Error`, set their own `name`, and carry a descriptive
`message`.

### Error codes

Every `GameEngineStateError` carries a stable `code` next to its message.
The **message is English developer text and may change**; the **code is the
contract** — a UI branches on the code and never on the message text.

The codes of the correction and undo path are part of this contract. The
rules behind them — what a correction may change and what it may not — are
described in [Correction and undo](#correction-and-undo).

```ts
import type { GameEngineErrorCode } from "@/game-engine";

type GameEngineErrorCode =
  | "INVALID_STATE"
  | "MATCH_COMPLETED"
  | "NOT_YOUR_TURN"
  | "NO_MATCH"
  | "NOTHING_TO_UNDO"
  | "NO_DART_AT_INDEX"
  | "BUST"
  | "CORRECTION_WOULD_BUST"
  | "LATER_DART_WOULD_BUST"
  | "TURN_ROTATION_CHANGED";
```

- `GameEngineStateError` carries the code of the refusal; the default is
  `"INVALID_STATE"`.
- `GameEngineBustError` always carries `"BUST"`.
- `GameEngineValidationError` carries no code: it is an input error, not a
  refusal of the engine's own state.

| Code                      | Raised when                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `"INVALID_STATE"`         | the generic fallback — a state refusal without a more specific code         |
| `"MATCH_COMPLETED"`       | a dart is recorded on a finished match, or a correction is attempted on one |
| `"NOT_YOUR_TURN"`         | `recordThrow` is called for a player whose turn it is not                   |
| `"NO_MATCH"`              | a method is called before `startMatch`                                      |
| `"NOTHING_TO_UNDO"`       | `undoLastThrow` is called on an empty ledger                                |
| `"NO_DART_AT_INDEX"`      | `correctThrow` is called with an index that holds no dart                   |
| `"BUST"`                  | the dart busted                                                             |
| `"CORRECTION_WOULD_BUST"` | the corrected dart itself would bust                                        |
| `"LATER_DART_WOULD_BUST"` | the correction would make a later recorded dart bust                        |
| `"TURN_ROTATION_CHANGED"` | the correction would change the turn rotation of the ledger                 |

The mode's own refusal — a throw by a player who is not in the match — uses
the `"INVALID_STATE"` fallback on purpose. It is unreachable through the
public API: `recordThrow` refuses an unknown player earlier with
`"NOT_YOUR_TURN"`, and a replay only ever replays the players of the ledger.
A dedicated code for it would document a path no caller can reach.

The code adds no new behaviour: the refusal conditions, the thrown class
hierarchy and the audit trail are exactly the same as without it.

## Extension: implementing a DartGameMode

`DartGameMode` is the extension seam for concrete modes. The core keeps **no**
mode rules (no 501 countdown, cricket, bust or checkout logic) — a mode
supplies only scoring and completion:

```ts
import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine";

export class MyMode implements DartGameMode {
  readonly id = "my-mode";

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    // Mutate only through the provided mutable draft; no side effects.
    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (player) player.totalPoints -= throwRecord.points;
  }

  isMatchComplete(state: MatchState): boolean {
    return state.players.some((p) => p.totalPoints === 0);
  }
}

const engine = new GameEngine(new MyMode());
```

Rules for a well-behaved mode:

- Mutate **only** through the `MutableMatchState` draft handed to
  `applyThrow`; keep it free of side effects so the engine stays
  serializable and testable.
- `isMatchComplete` receives the immutable post-throw snapshot.

> Mode roadmap: `NeutralScoreMode` is the shipped default. Standard 501/301
> and Cricket modes follow the same `DartGameMode` seam and are in
> development by parallel tasks — implement (or consume) them through the
> seam rather than the core. Out-rule variants (double-out, bust) are planned
> but **not implemented yet**.

## Client-side usage (UI integration)

React-agnostic — the engine only hands you plain data, so you render it with
whatever your UI stack uses:

```ts
import {
  DARTS_PER_TURN,
  GameEngine,
  GameEngineStateError,
  GameEngineValidationError,
} from "@/game-engine";
import type { MatchState } from "@/game-engine";

const engine = new GameEngine();
let view = engine.startMatch({ playerIds: ["alice", "bob"] });

function onDart(playerId: string, points: number): void {
  try {
    view = engine.recordThrow({ playerId, points });
  } catch (error) {
    if (error instanceof GameEngineValidationError) {
      // Points outside 0..60 or a bogus player ID — show a validation hint.
    } else if (error instanceof GameEngineStateError) {
      // Out of turn or match finished — show a state hint.
    }
    return;
  }
  renderMatchHUD(getHudModel(view));
}

function getHudModel(state: MatchState) {
  return {
    activePlayerId: state.currentPlayerId,
    dartsLeft: DARTS_PER_TURN - state.throwsInCurrentTurn,
    scores: state.players.map((p) => ({ id: p.id, score: p.totalPoints })),
    finished: state.status === "completed",
  };
}

function renderMatchHUD(_model: ReturnType<typeof getHudModel>) {
  // Draw with your framework of choice — the engine is UI-agnostic.
}
```

## Server-side usage (real-time server)

Server-authoritative pattern: **each match room owns one `GameEngine`
instance, and only the server calls `recordThrow`.** Clients send throw
intents; the server validates and applies them, then broadcasts the serialized
snapshot:

```ts
import { GameEngine, GameEngineStateError, GameEngineValidationError } from "@/game-engine";
import type { MatchState } from "@/game-engine";

// One engine per live match, held in your room/session store.
const matches = new Map<string, { engine: GameEngine; players: readonly string[] }>();

export function createMatch(playerIds: readonly string[]): MatchState {
  const engine = new GameEngine(); // or a concrete mode via the DartGameMode seam
  const state = engine.startMatch({ playerIds });
  matches.set(state.matchId, { engine, players: playerIds });
  return state;
}

export function onThrowIntent(
  matchId: string,
  input: { playerId: string; points: number },
): MatchState {
  const match = matches.get(matchId);
  try {
    const state = match.engine.recordThrow(input); // server-side only
    broadcast(matchId, JSON.stringify(state)); // MatchState is JSON-safe
    return state;
  } catch (error) {
    if (error instanceof GameEngineValidationError) throw new Error("Invalid throw");
    if (error instanceof GameEngineStateError) throw new Error("Invalid turn/match");
    throw error;
  }
}

export function snapshotForClient(matchId: string): string {
  const match = matches.get(matchId);
  return JSON.stringify(match.engine.getState());
}

declare function broadcast(matchId: string, payload: string): void;
```

Key points:

- Never trust a serialized match state back into the engine — reconstruct
  state by replaying `recordThrow` calls server-side, or keep the live engine
  instance (recommended).
- `getState()` / every `recordThrow` return value can be sent directly with
  `JSON.stringify` because `MatchState` is JSON-safe and cloned on each call.

## Notes

- **UI-agnostic**: no imports from React, Next.js, or Socket.IO anywhere in
  `src/game-engine`; it only uses `Date.now`, `Math.random`,
  `structuredClone` — available in Node 20+ and all modern browsers.
- **Usable in isolation**: instantiate it in a plain Node script, a unit
  test, or a browser bundle with no other DartHub infrastructure present.
- Framework guard tests enforce this
  (`tests/unit/game-engine/frameworkAgnostic.test.ts` greps the sources for
  forbidden framework/node/browser imports and globals), so the engine cannot
  silently drift toward a specific framework.
- The engine's public entry point is the barrel `src/game-engine/index.ts`,
  importable as `@/game-engine`.
