import { describe, it, expect } from "vitest";
import { GameEngine, DARTS_PER_TURN } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { GameEngineStateError } from "@/game-engine/types";
import type { MatchState } from "@/game-engine/types";

/**
 * Strips the match id so states from two independently started engines can
 * be compared — everything else must match bit for bit.
 */
function strip(state: MatchState): Omit<MatchState, "matchId"> {
  const { matchId: _matchId, ...rest } = state;
  return rest;
}

/** Starts a fresh neutral engine and replays the given darts in order. */
function neutralReplay(playerIds: string[], darts: Array<[string, number]>): MatchState {
  const engine = new GameEngine(new NeutralScoreMode());
  let state = engine.startMatch({ playerIds });
  for (const [playerId, points] of darts) {
    state = engine.recordThrow({ playerId, points });
  }
  return state;
}

describe("GameEngine undo & correct", () => {
  it("undo of the last dart restores exactly the state before that dart", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 5 });
    engine.recordThrow({ playerId: "alice", points: 1 }); // alice's turn done → bob
    const beforeBob = engine.getState();
    engine.recordThrow({ playerId: "bob", points: 40 });
    const afterBob = engine.getState();
    expect(afterBob.throws).toHaveLength(4);

    const undone = engine.undoLastThrow();
    expect(strip(undone)).toEqual(strip(beforeBob));
    expect(undone.currentPlayerId).toBe("bob"); // bob's turn, before his dart
    expect(undone.throwsInCurrentTurn).toBe(0);
    expect(undone.throws).toHaveLength(3);
  });

  it("undo on an empty ledger is refused", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice"] });
    expect(() => engine.undoLastThrow()).toThrow(GameEngineStateError);
  });

  it("correct replaces the dart, never adds a second one", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 40 });

    const corrected = engine.correctThrow(1, { points: 18 });

    expect(corrected.throws).toHaveLength(2);
    expect(corrected.players.find((p) => p.id === "alice")?.totalPoints).toBe(38);
    // The result equals the state that would exist had 18 been entered first.
    expect(strip(corrected)).toEqual(
      strip(
        neutralReplay(
          ["alice", "bob"],
          [
            ["alice", 20],
            ["alice", 18],
          ],
        ),
      ),
    );
  });

  it("several consecutive corrections replay to the final value", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["alice", "bob"] });
    engine.recordThrow({ playerId: "alice", points: 20 });
    engine.recordThrow({ playerId: "alice", points: 40 });

    engine.correctThrow(1, { points: 18 });
    const corrected = engine.correctThrow(1, { points: 30 });

    expect(strip(corrected)).toEqual(
      strip(
        neutralReplay(
          ["alice", "bob"],
          [
            ["alice", 20],
            ["alice", 30],
          ],
        ),
      ),
    );
    // Both darts sit in the turn in progress and the result did not change,
    // so no audit entries are written — corrections is not spammed.
    expect(corrected.corrections).toHaveLength(0);
  });

  it("a busting dart is recorded, then correcting it makes it count", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double" });
    engine.recordThrow({ playerId: "a", points: 40, segment: "double" }); // 10 left
    expect(
      () => engine.recordThrow({ playerId: "a", points: 20 }), // overshoot: bust
    ).toThrow(GameEngineStateError);

    const afterBust = engine.getState();
    expect(afterBust.throws).toHaveLength(2);
    expect(afterBust.throws[1]?.bust).toBe(true);
    expect(afterBust.players[0]?.totalPoints).toBe(10);

    const corrected = engine.correctThrow(1, { points: 10, segment: "double" });
    expect(corrected.status).toBe("completed");
    expect(corrected.players[0]?.totalPoints).toBe(0);
    expect(corrected.throws[1]?.bust).toBe(false);
    expect(corrected.throws[1]?.points).toBe(10);
  });

  it("undo of the match-winning dart returns the match to inProgress", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double" });
    engine.recordThrow({ playerId: "a", points: 40, segment: "double" });
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" }); // wins
    const completed = engine.getState();
    expect(completed.status).toBe("completed");

    const undone = engine.undoLastThrow();
    expect(undone.status).toBe("inProgress");
    expect(undone.currentPlayerId).toBe("a");
    expect(undone.players[0]?.totalPoints).toBe(10);
    expect(undone.throws).toHaveLength(1);
  });

  it("correctThrow on a completed match is refused without touching the state", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "double" });
    engine.recordThrow({ playerId: "a", points: 40, segment: "double" });
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" });
    const before = engine.getState();

    expect(() => engine.correctThrow(0, { points: 20 })).toThrow(GameEngineStateError);
    expect(engine.getState()).toEqual(before);
  });

  it("refused corrections change neither state nor ledger", () => {
    // (a) index out of range
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    const baseline = engine.getState();
    expect(() => engine.correctThrow(5, { points: 10 })).toThrow(GameEngineStateError);
    expect(engine.getState()).toEqual(baseline);

    // (b) the corrected dart itself would bust
    const busting = new GameEngine(new StandardMode({ startScore: 50 }));
    busting.startMatch({ playerIds: ["a"], outRule: "straight" });
    busting.recordThrow({ playerId: "a", points: 40 }); // 10 left
    const bustBaseline = busting.getState();
    expect(() => busting.correctThrow(0, { points: 60 })).toThrow(GameEngineStateError);
    expect(busting.getState()).toEqual(bustBaseline);

    // (c) the correction would make a later dart bust that did not before
    const later = new GameEngine(new StandardMode({ startScore: 100 }));
    later.startMatch({ playerIds: ["a"], outRule: "straight" });
    later.recordThrow({ playerId: "a", points: 20 }); // 80 left
    later.recordThrow({ playerId: "a", points: 60 }); // 20 left
    const laterBaseline = later.getState();
    expect(laterBaseline.throws.every((dart) => !dart.bust)).toBe(true);
    expect(
      () => later.correctThrow(0, { points: 60 }), // a would stand on 40 → dart 2 busts
    ).toThrow(GameEngineStateError);
    expect(later.getState()).toEqual(laterBaseline);
    expect(later.getState().corrections).toHaveLength(0);
  });

  it("a correction never moves a dart between players", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 40 });
    engine.recordThrow({ playerId: "a", points: 30 }); // a's turn done
    engine.recordThrow({ playerId: "b", points: 20 });
    engine.recordThrow({ playerId: "b", points: 40 });
    engine.recordThrow({ playerId: "b", points: 30 }); // b's turn done → a

    const corrected = engine.correctThrow(3, { points: 50 }); // b's first dart

    expect(corrected.throws.map((dart) => dart.playerId)).toEqual(["a", "a", "a", "b", "b", "b"]);
    expect(corrected.throws[4]?.points).toBe(40); // b's other darts untouched
    expect(corrected.throws[5]?.points).toBe(30);
    expect(corrected.currentPlayerId).toBe("a"); // turn order re-derived, not broken
  });

  it("undoing a bust does not corrupt the turn counters", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });
    engine.recordThrow({ playerId: "a", points: 40 });
    const afterCounted = engine.getState();
    expect(afterCounted.throwsInCurrentTurn).toBe(1);
    expect(
      () => engine.recordThrow({ playerId: "a", points: 20 }), // bust: 10 - 20
    ).toThrow(GameEngineStateError);

    // The bust is in the ledger but consumed no dart slot.
    const withBust = engine.getState();
    expect(withBust.throwsInCurrentTurn).toBe(1);
    expect(withBust.throws).toHaveLength(2);

    const undone = engine.undoLastThrow();
    expect(strip(undone)).toEqual(strip(afterCounted));
    const undoneTwice = engine.undoLastThrow();
    expect(undoneTwice.throws).toHaveLength(0);
    expect(undoneTwice.throwsInCurrentTurn).toBe(0);
    expect(undoneTwice.players[0]?.totalPoints).toBe(50);
  });

  it("getVisits groups the ledger and keeps a bust with its visit", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });
    engine.recordThrow({ playerId: "a", points: 40 });
    expect(
      () => engine.recordThrow({ playerId: "a", points: 20 }), // bust
    ).toThrow(GameEngineStateError);
    engine.recordThrow({ playerId: "a", points: 10 }); // opens the next visit

    const visits = engine.getVisits();
    expect(visits).toHaveLength(2);
    expect(visits[0]?.throws).toHaveLength(2); // counted dart + the bust
    expect(visits[0]?.throws[1]?.bust).toBe(true);
    expect(visits[1]?.throws).toHaveLength(1);
    expect(visits.flatMap((visit) => visit.throws)).toHaveLength(engine.getState().throws.length);
  });

  it("corrections are never double-booked: totals replay from the ledger alone", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 40 });
    engine.recordThrow({ playerId: "a", points: 30 }); // a's turn done
    engine.recordThrow({ playerId: "b", points: 20 });
    engine.recordThrow({ playerId: "b", points: 40 });
    engine.recordThrow({ playerId: "b", points: 30 });
    engine.correctThrow(4, { points: 50 });

    const state = engine.getState();
    expect(state.throws).toHaveLength(6);
    // Independent check: re-sum the ledger, do not trust engine internals.
    const sum: Record<string, number> = {};
    for (const dart of state.throws) {
      if (!dart.bust) sum[dart.playerId] = (sum[dart.playerId] ?? 0) + dart.points;
    }
    expect(sum.a).toBe(90);
    expect(sum.b).toBe(100);
    for (const player of state.players) {
      expect(player.totalPoints).toBe(sum[player.id] ?? 0);
    }
  });

  it("a correction of a dart in a finished visit is audited", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 20 }); // a's turn done
    engine.recordThrow({ playerId: "b", points: 40 });
    engine.recordThrow({ playerId: "b", points: 40 }); // b's turn in progress

    const corrected = engine.correctThrow(0, { points: 10 });
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0]).toEqual({
      dartIndex: 0,
      playerId: "a",
      previousPoints: 20,
      newPoints: 10,
    });
  });

  it("multiplayer: undo and correction keep attribution and event order", () => {
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b", "c"] });
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 40 });
    engine.recordThrow({ playerId: "a", points: 30 }); // a's turn done
    engine.recordThrow({ playerId: "b", points: 50 });

    const undone = engine.undoLastThrow();
    expect(undone.currentPlayerId).toBe("b"); // back to b's first dart of the turn
    expect(undone.throws).toHaveLength(3);

    // Re-enter b's dart, then correct one of a's from the previous turn.
    engine.recordThrow({ playerId: "b", points: 50 });
    const corrected = engine.correctThrow(1, { points: 20 }); // a's second dart
    expect(corrected.throws.map((dart) => dart.playerId)).toEqual(["a", "a", "a", "b"]);
    expect(corrected.throws.map((dart) => dart.points)).toEqual([20, 20, 30, 50]);
    expect(corrected.throwsInCurrentTurn).toBe(1);
    expect(corrected.currentPlayerId).toBe("b");
  });
});

describe("throwLedger visit derivation", () => {
  it("a bust ends its visit even though the turn goes on", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 50 }));
    engine.startMatch({ playerIds: ["a"], outRule: "straight" });
    engine.recordThrow({ playerId: "a", points: 30 }); // 20 left
    expect(
      () => engine.recordThrow({ playerId: "a", points: 30 }), // overshoot: bust
    ).toThrow(GameEngineStateError);
    engine.recordThrow({ playerId: "a", points: 10 }); // 10 left
    engine.recordThrow({ playerId: "a", points: 10 }); // wins on the last dart

    // Visit 0: [30, bust]. Visit 1: [10, 10]. Turn order ran through both.
    const visits = engine.getVisits();
    expect(visits.map((visit) => visit.throws.length)).toEqual([2, 2]);
    expect(visits.every((visit) => visit.playerId === "a")).toBe(true);
    expect(DARTS_PER_TURN).toBe(3);
  });
});
