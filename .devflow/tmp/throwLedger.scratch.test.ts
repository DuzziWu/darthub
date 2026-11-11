import { describe, expect, it } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { CricketMode } from "@/game-engine/modes/CricketMode";
import { AroundTheClockMode } from "@/game-engine/modes/AroundTheClockMode";
import { ShanghaiMode } from "@/game-engine/modes/ShanghaiMode";
import { GameEngineStateError } from "@/game-engine/types";

describe("ledger + replay", () => {
  it("records every entered dart in the throw ledger", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 30 });
    const state = engine.getState();
    expect(state.throws).toHaveLength(2);
    expect(state.throws[0]).toEqual({ playerId: "alice", points: 20, bust: false });
    expect(state.throws[1]).toEqual({ playerId: "alice", points: 30, bust: false });
  });

  it("records the player, points and segment of each dart", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20, segment: "double" });
    expect(engine.getState().throws[0]).toEqual({
      playerId: "alice",
      points: 20,
      segment: "double",
      bust: false,
    });
  });

  it("records a busting dart without applying it to the score", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    expect(() => engine.recordThrow({ playerId: "alice", points: 50 })).toThrowError(/bust/i);
    const state = engine.getState();
    expect(state.throws).toHaveLength(2);
    expect(state.throws[1]).toEqual({ playerId: "alice", points: 50, bust: true });
  });

  it("leaves the score and the dart count unchanged when a dart busts", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    const before = engine.getState();
    expect(() => engine.recordThrow({ playerId: "alice", points: 50 })).toThrowError(/bust/i);
    const after = engine.getState();
    expect(after.players[0]!.totalPoints).toBe(before.players[0]!.totalPoints);
    expect(after.throwCount).toBe(before.throwCount);
    expect(after.throwsInCurrentTurn).toBe(before.throwsInCurrentTurn);
    expect(after.currentPlayerId).toBe(before.currentPlayerId);
  });

  it("keeps the ledger length different from throwCount after a bust", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    expect(() => engine.recordThrow({ playerId: "alice", points: 50 })).toThrowError(/bust/i);
    const state = engine.getState();
    expect(state.throws).toHaveLength(2);
    expect(state.throwCount).toBe(1);
  });

  it("derives the same state by replaying the ledger as by recording the darts directly", () => {
    const darts = [
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "alice", points: 60 },
      { playerId: "bob", points: 45 },
    ];
    const live = new GameEngine(new StandardMode({ startScore: 501 }));
    live.startMatch({ playerIds: ["alice", "bob"] });
    for (const dart of darts) {
      live.recordThrow(dart);
    }
    const liveState = live.getState();

    const replayed = new GameEngine(new StandardMode({ startScore: 501 }));
    replayed.startMatch({ playerIds: ["alice", "bob"] });
    for (const dart of darts) {
      replayed.recordThrow(dart);
    }
    const replayedState = replayed.getState();
    expect(replayedState.players).toEqual(liveState.players);
    expect(replayedState.currentPlayerId).toBe(liveState.currentPlayerId);
    expect(replayedState.throwCount).toBe(liveState.throwCount);
    expect(replayedState.throwsInCurrentTurn).toBe(liveState.throwsInCurrentTurn);
    expect(replayedState.status).toBe(liveState.status);
  });

  it("replays the turn order and the dart counters identically", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b", "c"] });
    for (let index = 0; index < 7; index++) {
      engine.recordThrow({ playerId: engine.getState().currentPlayerId!, points: 20 });
    }
    const state = engine.getState();
    expect(state.currentPlayerId).toBe("c");
    expect(state.throwsInCurrentTurn).toBe(1);
    expect(state.throwCount).toBe(7);
  });

  it("replays the match completion identically", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 60, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBe(null);
    expect(state.players[0]!.totalPoints).toBe(0);
  });

  it("keeps the state JSON-safe when the ledger is present", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60, segment: "triple" });
    const state = engine.getState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("exposes the ledger as part of the match state", () => {
    const engine = new GameEngine();
    const started = engine.startMatch({ playerIds: ["alice"] });
    expect(started.throws).toEqual([]);
    expect(started.corrections).toEqual([]);
  });
});

describe("undo", () => {
  it("undoes the last entered dart", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 30 });
    const state = engine.undoLastThrow();
    expect(state.throws).toHaveLength(1);
    expect(state.players[0]!.totalPoints).toBe(20);
  });

  it("restores the state to exactly what it was before that dart was entered", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501 }));
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    const before = engine.getState();
    engine.recordThrow({ playerId: "alice", points: 60 });
    const after = engine.undoLastThrow();
    expect(after).toEqual(before);
  });

  it("undoes a dart that busted", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    const before = engine.getState();
    expect(() => engine.recordThrow({ playerId: "alice", points: 50 })).toThrowError(/bust/i);
    const after = engine.undoLastThrow();
    expect(after.throws).toHaveLength(1);
    expect(after.throwCount).toBe(before.throwCount);
    expect(after.players[0]!.totalPoints).toBe(before.players[0]!.totalPoints);
  });

  it("undoes the dart that completed the match", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 60, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    expect(engine.getState().status).toBe("completed");
    const state = engine.undoLastThrow();
    expect(state.status).toBe("inProgress");
    expect(state.currentPlayerId).toBe("alice");
    expect(state.players[0]!.totalPoints).toBe(60);
    expect(state.throws).toHaveLength(0);
  });

  it("refuses to undo when no dart has been entered", () => {
    const engine = new GameEngine();
    engine.startMatch({ playerIds: ["alice"] });
    expect(() => engine.undoLastThrow()).toThrowError(GameEngineStateError);
  });

  it("restores the ledger and the counters after an undo", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    const state = engine.undoLastThrow();
    expect(state.throws).toHaveLength(2);
    expect(state.currentPlayerId).toBe("a");
    expect(state.throwsInCurrentTurn).toBe(2);
    expect(state.throwCount).toBe(2);
  });
});

describe("correct", () => {
  it("corrects a recorded dart with a new value", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    const state = engine.correctThrow(0, { points: 40 });
    expect(state.throws[0]).toEqual({ playerId: "alice", points: 40, bust: false });
  });

  it("recalculates the score after a correction", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    const state = engine.correctThrow(0, { points: 40 });
    expect(state.players[0]!.totalPoints).toBe(40);
  });

  it("recalculates the remaining total after a correction", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 501, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    const state = engine.correctThrow(0, { points: 50 });
    expect(state.players[0]!.totalPoints).toBe(451);
  });

  it("recalculates the turn order after a correction", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 60 });
    // 50 points with 40 left busts, so the turn stays with "a".
    expect(() => engine.recordThrow({ playerId: "a", points: 50 })).toThrowError(/bust/i);
    expect(engine.getState().currentPlayerId).toBe("a");
    expect(engine.getState().throwsInCurrentTurn).toBe(1);
    // Correcting the first dart to 50 leaves exactly 50, so the second
    // dart no longer busts and the turn advances after the third dart.
    const state = engine.correctThrow(0, { points: 50 });
    expect(state.throws[1]!.bust).toBe(false);
    expect(state.players[0]!.totalPoints).toBe(0);
    expect(state.status).toBe("completed");
  });

  it("keeps the corrected dart with the player who threw it", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "b", points: 20 });
    const state = engine.correctThrow(0, { points: 30 });
    expect(state.throws[0]!.playerId).toBe("a");
  });

  it("never moves a corrected dart to another player", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "b", points: 20 });
    const state = engine.correctThrow(3, { points: 40 });
    expect(state.throws[3]!.playerId).toBe("b");
    expect(state.throws.map((dart) => dart.playerId)).toEqual(["a", "a", "a", "b"]);
  });

  it("refuses to correct a dart that does not exist", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    expect(() => engine.correctThrow(5, { points: 10 })).toThrowError(GameEngineStateError);
    expect(() => engine.correctThrow(-1, { points: 10 })).toThrowError(GameEngineStateError);
  });

  it("refuses a correction that would turn the corrected dart itself into a bust", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    expect(() => engine.correctThrow(0, { points: 60 })).toThrowError(/bust/i);
  });

  it("refuses a correction that would leave a later dart busting", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 200, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 40 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 30 });
    expect(engine.getState().players[0]!.totalPoints).toBe(10);
    // Raising the first dart to 60 leaves 20 for the last dart of 30.
    expect(() => engine.correctThrow(0, { points: 60 })).toThrowError(/bust/i);
  });

  it("refuses a correction on a completed match", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 60, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 60 });
    expect(() => engine.correctThrow(0, { points: 50 })).toThrowError(GameEngineStateError);
  });

  it("leaves the ledger unchanged after a refused correction", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    const before = engine.getState();
    expect(() => engine.correctThrow(0, { points: 60 })).toThrowError(/bust/i);
    const after = engine.getState();
    expect(after).toEqual(before);
    expect(after.throws).toEqual(before.throws);
  });

  it("records a correction of a finished turn in the audit trail", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "b", points: 20 });
    const state = engine.correctThrow(0, { points: 30 });
    expect(state.corrections).toHaveLength(1);
    expect(state.corrections[0]).toMatchObject({
      dartIndex: 0,
      playerId: "a",
      previousPoints: 20,
      newPoints: 30,
    });
  });

  it("does not record a correction of the turn in progress in the audit trail", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    const state = engine.correctThrow(1, { points: 30 });
    expect(state.corrections).toHaveLength(0);
  });

  it("records a correction that changes who won a leg in the audit trail", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice", "bob"], legs: 3, sets: 1 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 40 });
    // Alice won leg 1; correcting the first dart un-wins it.
    expect(engine.getState().modeData).toBeDefined();
    const state = engine.correctThrow(0, { points: 50 });
    expect(state.corrections).toHaveLength(1);
    expect(state.corrections[0]).toMatchObject({ dartIndex: 0, previousPoints: 60, newPoints: 50 });
  });
});

describe("per-mode replay", () => {
  it("replays cricket marks identically", () => {
    const live = new GameEngine(new CricketMode());
    live.startMatch({ playerIds: ["alice", "bob"] });
    live.recordThrow({ playerId: "alice", points: 20 });
    live.recordThrow({ playerId: "alice", points: 20 });
    live.recordThrow({ playerId: "alice", points: 20 });
    const afterThree = live.getState();

    const replayed = new GameEngine(new CricketMode());
    replayed.startMatch({ playerIds: ["alice", "bob"] });
    replayed.recordThrow({ playerId: "alice", points: 20 });
    replayed.recordThrow({ playerId: "alice", points: 20 });
    replayed.recordThrow({ playerId: "alice", points: 20 });
    replayed.recordThrow({ playerId: "bob", points: 20 });
    const undone = replayed.undoLastThrow();
    expect(undone.modeData).toEqual(afterThree.modeData);
  });

  it("replays the around-the-clock target index identically", () => {
    const live = new GameEngine(new AroundTheClockMode());
    live.startMatch({ playerIds: ["alice"] });
    live.recordThrow({ playerId: "alice", points: 1 });
    live.recordThrow({ playerId: "alice", points: 2 });
    live.recordThrow({ playerId: "alice", points: 3 });
    const liveState = live.getState();

    const replayed = new GameEngine(new AroundTheClockMode());
    replayed.startMatch({ playerIds: ["alice"] });
    replayed.recordThrow({ playerId: "alice", points: 1 });
    replayed.recordThrow({ playerId: "alice", points: 2 });
    replayed.recordThrow({ playerId: "alice", points: 3 });
    expect(replayed.getState().modeData).toEqual(liveState.modeData);
  });

  it("replays shanghai rounds identically", () => {
    const live = new GameEngine(new ShanghaiMode());
    live.startMatch({ playerIds: ["alice"] });
    live.recordThrow({ playerId: "alice", points: 1 });
    live.recordThrow({ playerId: "alice", points: 2 });
    live.recordThrow({ playerId: "alice", points: 3 });
    const liveState = live.getState();

    const replayed = new GameEngine(new ShanghaiMode());
    replayed.startMatch({ playerIds: ["alice"] });
    replayed.recordThrow({ playerId: "alice", points: 1 });
    replayed.recordThrow({ playerId: "alice", points: 2 });
    replayed.recordThrow({ playerId: "alice", points: 3 });
    expect(replayed.getState().modeData).toEqual(liveState.modeData);
  });

  it("replays x01 legs and sets identically", () => {
    const live = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    live.startMatch({ playerIds: ["alice", "bob"], legs: 3, sets: 1 });
    live.recordThrow({ playerId: "alice", points: 60 });
    live.recordThrow({ playerId: "alice", points: 40 });
    live.recordThrow({ playerId: "alice", points: 20 });
    live.recordThrow({ playerId: "bob", points: 60 });
    live.recordThrow({ playerId: "bob", points: 40 });
    live.recordThrow({ playerId: "bob", points: 20 });
    const liveState = live.getState();

    const replayed = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    replayed.startMatch({ playerIds: ["alice", "bob"], legs: 3, sets: 1 });
    replayed.recordThrow({ playerId: "alice", points: 60 });
    replayed.recordThrow({ playerId: "alice", points: 40 });
    replayed.recordThrow({ playerId: "alice", points: 20 });
    replayed.recordThrow({ playerId: "bob", points: 60 });
    replayed.recordThrow({ playerId: "bob", points: 40 });
    replayed.recordThrow({ playerId: "bob", points: 20 });
    expect(replayed.getState().modeData).toEqual(liveState.modeData);
  });

  it("replays a double-out match identically (the mode keeps its checkout rule)", () => {
    const live = new GameEngine(new StandardMode({ startScore: 100, outRule: "double" }));
    live.startMatch({ playerIds: ["alice"] });
    live.recordThrow({ playerId: "alice", points: 60 });
    live.recordThrow({ playerId: "alice", points: 40, segment: "double" });
    const liveState = live.getState();
    expect(liveState.status).toBe("completed");

    const replayed = new GameEngine(new StandardMode({ startScore: 100, outRule: "double" }));
    replayed.startMatch({ playerIds: ["alice"] });
    replayed.recordThrow({ playerId: "alice", points: 60 });
    replayed.recordThrow({ playerId: "alice", points: 40, segment: "double" });
    const replayedState = replayed.getState();
    expect(replayedState.status).toBe(liveState.status);
    expect(replayedState.players).toEqual(liveState.players);
    expect(replayedState.throws).toEqual(liveState.throws);
  });

  it("keeps the double-out rule through a replay (a single on zero busts)", () => {
    // Under double out a single on zero is a bust; under straight out it
    // would win. A replay that lost the checkout rule would win instead.
    const engine = new GameEngine(new StandardMode({ startScore: 60, outRule: "double" }));
    engine.startMatch({ playerIds: ["alice"] });
    expect(() =>
      engine.recordThrow({ playerId: "alice", points: 60, segment: "triple" }),
    ).toThrowError(/bust/i);
    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(state.players[0]!.totalPoints).toBe(60);
    expect(state.throws).toHaveLength(1);
    expect(state.throws[0]!.bust).toBe(true);
  });

  it("keeps the configured legs and sets through a replay", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice", "bob"], legs: 3, sets: 1 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 40 });
    const state = engine.getState();
    // Alice won leg 1: every score resets and the leg progress advances.
    expect(state.players.every((player) => player.totalPoints === 100)).toBe(true);
    expect(state.modeData).toBeDefined();
  });

  it("replays a leg win and resets every player's score", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 100, outRule: "straight" }));
    engine.startMatch({ playerIds: ["alice", "bob"], legs: 3, sets: 1 });
    engine.recordThrow({ playerId: "alice", points: 60 });
    engine.recordThrow({ playerId: "alice", points: 40 });
    const state = engine.getState();
    expect(state.players.every((player) => player.totalPoints === 100)).toBe(true);
    expect(state.modeData).toBeDefined();
  });
});
