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
  getState(): MatchState;
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
- **`getState(): MatchState`** — returns a fresh `structuredClone` of the
  current snapshot. Mutating the returned object never affects engine
  internals. Throws `GameEngineStateError` if called before `startMatch`.

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

Exported types: `DartGameMode`, `MatchConfig`, `MatchState`, `MatchStatus`,
`MutableMatchState`, `MutablePlayerState`, `PlayerState`, `ThrowInput`,
`ThrowRecord`.

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
}
```

Turn-order subtlety: the turn advances **after the 3rd dart of a turn**
(standard darts). A single `recordThrow` therefore passes play to the same
player unless it is their third dart of the turn — check
`throwsInCurrentTurn` and `currentPlayerId` on the returned snapshot.

## Error classes

```ts
import { GameEngineValidationError, GameEngineStateError } from "@/game-engine";
```

- **`GameEngineValidationError`** — bad inputs: empty/duplicate/blank player
  IDs; `points` that is non-integer, negative, or above 60.
- **`GameEngineStateError`** — bad lifecycle usage: `recordThrow`/`getState`
  before `startMatch`, throwing out of turn, or throwing after the match
  completed.

Both extend `Error`, set their own `name`, and carry a descriptive `message`.

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
