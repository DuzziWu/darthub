import { describe, it, expect } from "vitest";
import { GameEngine, type LegSetProgress } from "@/game-engine";
import { Standard301Mode, Standard501Mode, StandardMode } from "@/game-engine/modes";
import { LEG_SET_MODE_DATA_KEY } from "@/game-engine/rules";
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

/** Plays plain darts until the player has `target` points left. */
function driveTo(engine: GameEngine, target: number): MatchState {
  let state = engine.getState();
  while (state.players[0]!.totalPoints > target) {
    const remaining = state.players[0]!.totalPoints;
    state = engine.recordThrow({ playerId: "alice", points: Math.min(60, remaining - target) });
  }
  return state;
}

describe("StandardMode (x01)", () => {
  it("it starts a match at 501 and allows scoring down to zero", () => {
    // The plain mode keeps its own "straight" default: this case is about
    // plain-mode behaviour, so it says so explicitly.
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));

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
    // The plain mode again: this case is about plain-mode behaviour.
    const engine = new GameEngine(new StandardMode({ startScore: 301 }));

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
    // The plain mode again: sitting on one point and overshooting is plain
    // mode behaviour, and the x01 wrappers no longer allow it.
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));
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

  it("it lets a double finish the leg under the double out rule", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501, outRule: "double" }));
    engine.startMatch({ playerIds: ["alice"] });

    // Alice is on 2.
    expect(driveTo(engine, 2).players[0]!.totalPoints).toBe(2);

    // A double 1 is two points, and it finishes the leg.
    const finished = engine.recordThrow({ playerId: "alice", points: 2, segment: "double" });
    expect(finished.status).toBe("completed");
    expect(finished.players[0]!.totalPoints).toBe(0);
  });

  it("it rejects a non-double finish under the double out rule", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501, outRule: "double" }));
    engine.startMatch({ playerIds: ["alice"] });
    expect(driveTo(engine, 2).players[0]!.totalPoints).toBe(2);

    // The same two points as a single do not finish the leg.
    expect(() =>
      engine.recordThrow({ playerId: "alice", points: 2, segment: "single" }),
    ).toThrowError(GameEngineStateError);

    // The rejected throw leaves the match state untouched.
    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(state.players[0]!.totalPoints).toBe(2);
  });

  it("it defaults 501 and 301 to double out", () => {
    for (const mode of [new Standard501Mode(), new Standard301Mode()]) {
      const engine = new GameEngine(mode);
      engine.startMatch({ playerIds: ["alice"] });
      expect(driveTo(engine, 2).players[0]!.totalPoints).toBe(2);

      // A double finishes the leg under the wrappers' default rule.
      const finished = engine.recordThrow({ playerId: "alice", points: 2, segment: "double" });
      expect(finished.status).toBe("completed");
    }
  });

  it("it seeds the leg structure when the match is configured with legs", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));
    const started = engine.startMatch({ playerIds: ["alice"], legs: 3 });

    // The slice is in the state from the first moment: it is what tells the
    // view that the match has legs at all. The won-counts alone would only
    // appear once the first leg is over.
    const progress = started.modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress | undefined;
    expect(progress).toEqual({ legsWon: {}, setsWon: {}, matchWinnerId: null });
  });

  it("it leaves the mode data alone when the match has no leg structure", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));
    const started = engine.startMatch({ playerIds: ["alice"] });

    // A single leg is no leg structure at all: nothing is seeded.
    expect(started.modeData?.[LEG_SET_MODE_DATA_KEY]).toBeUndefined();
  });

  it("keeps the leg structure alive across an undo", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 101 }));
    engine.startMatch({ playerIds: ["alice"], outRule: "double", legs: 3 });

    // Alice scores 22 in one visit: 101 - 1 - 20 - 1 = 79.
    for (const points of [1, 20, 1]) engine.recordThrow({ playerId: "alice", points });
    const after = engine.getState();
    expect(after.players[0]!.totalPoints).toBe(79);

    engine.undoLastThrow();
    const undone = engine.getState();
    expect(undone.players[0]!.totalPoints).toBe(80);

    // The replay re-seeds the structure, so the leg is still there to show.
    expect(undone.modeData?.[LEG_SET_MODE_DATA_KEY]).toBeDefined();
  });

  it("records a leg win in the mode's own state", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 20 }));
    engine.startMatch({ playerIds: ["alice", "bob"], outRule: "double", legs: 3 });
    engine.recordThrow({ playerId: "alice", points: 20, segment: "double" });

    const state = engine.getState();
    const progress = state.modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress;
    expect(progress.legsWon).toEqual({ alice: 1 });
    expect(progress.matchWinnerId).toBeNull();

    // A best of 3 is first to 2 legs, so one leg does not end the match —
    // and everybody is back at the start score for the next leg.
    expect(state.status).toBe("inProgress");
    expect(state.players.every((player) => player.totalPoints === 20)).toBe(true);

    // The mode data stays JSON-safe, so it can travel over the wire.
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
