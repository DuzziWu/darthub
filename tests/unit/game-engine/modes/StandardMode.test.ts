import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine";
import { Standard301Mode, Standard501Mode, StandardMode } from "@/game-engine/modes";
import {
  GameEngineStateError,
  GameEngineValidationError,
  type MatchState,
  type ThrowInput,
} from "@/game-engine/types";

/** Records the given throws in order and returns the last snapshot. */
function playThrows(engine: GameEngine, throws: readonly ThrowInput[]): MatchState {
  let state: MatchState | null = null;
  for (const throwInput of throws) {
    state = engine.recordThrow(throwInput);
  }
  return state ?? engine.getState();
}

describe("StandardMode (x01)", () => {
  it("it starts a match at 501 and allows scoring down to zero", () => {
    const engine = new GameEngine(new Standard501Mode());

    const started = engine.startMatch({ playerIds: ["alice", "bob"] });
    expect(started.status).toBe("inProgress");
    expect(started.currentPlayerId).toBe("alice");
    expect(started.players[0]!.totalPoints).toBe(501);
    expect(started.players[1]!.totalPoints).toBe(501);

    const state = playThrows(engine, [
      // Alice's first turn: 501 - 180 = 321.
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      // Bob's first turn: 501 - 180 = 321.
      { playerId: "bob", points: 60 },
      { playerId: "bob", points: 60 },
      { playerId: "bob", points: 60 },
    ]);
    expect(state.status).toBe("inProgress");
    expect(state.players[0]!.totalPoints).toBe(321);
    expect(state.players[1]!.totalPoints).toBe(321);

    const beforeWin = playThrows(engine, [
      // Alice: 321 - 180 = 141. Bob: 321 - 60 = 261.
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "bob", points: 20 },
      { playerId: "bob", points: 20 },
      { playerId: "bob", points: 20 },
      // Alice: 141 - 140 = 1. Bob: 261 - 180 = 81.
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 20 },
      { playerId: "bob", points: 60 },
      { playerId: "bob", points: 60 },
      { playerId: "bob", points: 60 },
    ]);
    expect(beforeWin.status).toBe("inProgress");
    expect(beforeWin.currentPlayerId).toBe("alice");
    expect(beforeWin.players[0]!.totalPoints).toBe(1);
    expect(beforeWin.players[1]!.totalPoints).toBe(81);

    // First player to reach exactly zero wins the match.
    const finished = engine.recordThrow({ playerId: "alice", points: 1 });
    expect(finished.status).toBe("completed");
    expect(finished.currentPlayerId).toBe(null);
    expect(finished.players[0]!.totalPoints).toBe(0);
    // The other player keeps their remaining score untouched.
    expect(finished.players[1]!.totalPoints).toBe(81);

    // State must stay JSON-safe so it can be serialized over the wire.
    expect(JSON.parse(JSON.stringify(finished))).toEqual(finished);
  });

  it("it starts a match at 301 and behaves identically with a lower start score", () => {
    const engine = new GameEngine(new Standard301Mode());

    const started = engine.startMatch({ playerIds: ["alice"] });
    expect(started.status).toBe("inProgress");
    expect(started.players[0]!.totalPoints).toBe(301);

    const afterFirstTurn = playThrows(engine, [
      // 301 - 180 = 121.
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
    ]);
    expect(afterFirstTurn.players[0]!.totalPoints).toBe(121);

    const nearWin = playThrows(engine, [
      // 121 - 120 = 1.
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 40 },
      { playerId: "alice", points: 20 },
    ]);
    expect(nearWin.status).toBe("inProgress");
    expect(nearWin.players[0]!.totalPoints).toBe(1);

    // Same bust rule as 501: a throw below zero is rejected...
    expect(() => engine.recordThrow({ playerId: "alice", points: 60 })).toThrowError(/bust/i);
    const afterBust = engine.getState();
    expect(afterBust.players[0]!.totalPoints).toBe(1);
    expect(afterBust.throwCount).toBe(6);
    expect(afterBust.throwsInCurrentTurn).toBe(0);

    // ...and plain subtraction still wins from exactly 1 (no double-out yet).
    const finished = engine.recordThrow({ playerId: "alice", points: 1 });
    expect(finished.status).toBe("completed");
    expect(finished.currentPlayerId).toBe(null);
    expect(finished.players[0]!.totalPoints).toBe(0);
  });

  it("it rejects throws that would reduce the score below zero (bust)", () => {
    const engine = new GameEngine(new Standard501Mode());
    engine.startMatch({ playerIds: ["alice"] });

    // Drive alice down: 501 - 180 = 321, 321 - 180 = 141, 141 - 140 = 1.
    const nearWin = playThrows(engine, [
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 20 },
    ]);
    expect(nearWin.players[0]!.totalPoints).toBe(1);

    // A throw overshooting zero is a bust and must be rejected outright.
    expect(() => engine.recordThrow({ playerId: "alice", points: 20 })).toThrowError(
      GameEngineStateError,
    );

    // Rejected throws leave the match state completely untouched.
    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(state.currentPlayerId).toBe("alice");
    expect(state.players[0]!.totalPoints).toBe(1);
    expect(state.throwCount).toBe(9);
    expect(state.throwsInCurrentTurn).toBe(0);
  });

  it("it can be selected via a configuration object when creating a GameEngine instance", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));
    const started = engine.startMatch({ playerIds: ["alice"] });
    expect(started.players[0]!.totalPoints).toBe(501);

    const won = playThrows(engine, [
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 20 },
      { playerId: "alice", points: 1 },
    ]);
    expect(won.status).toBe("completed");
    expect(won.players[0]!.totalPoints).toBe(0);

    // Arbitrary (still valid) start scores are configurable too.
    const custom = new GameEngine(new StandardMode({ startScore: 250 }));
    const customMatch = custom.startMatch({ playerIds: ["alice", "bob"] });
    expect(customMatch.players.every((player) => player.totalPoints === 250)).toBe(true);

    // Invalid configurations are rejected.
    expect(() => new StandardMode({ startScore: 0 })).toThrow(GameEngineValidationError);
    expect(() => new StandardMode({ startScore: -1 })).toThrow(GameEngineValidationError);
    expect(() => new StandardMode({ startScore: 50.5 })).toThrow(GameEngineValidationError);
  });
});
