import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import {
  ShanghaiMode,
  SHANGHAI_ROUNDS,
  roundTarget,
  type ShanghaiModeData,
  type ShanghaiRoundRecord,
} from "@/game-engine/modes/ShanghaiMode";
import type { MatchState } from "@/game-engine/types";

/** Starts a fresh two-player match. */
function startMatch(): GameEngine {
  const engine = new GameEngine(new ShanghaiMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  return engine;
}

/** Reads the current round index from state. */
function currentRound(state: MatchState): number {
  return (state.modeData as ShanghaiModeData | undefined)?.currentRound ?? 0;
}

/** Reads a player's total marks. */
function playerMarks(state: MatchState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)?.totalPoints ?? -1;
}

describe("ShanghaiMode", () => {
  it("initializes with round 0 and zero marks for all players", () => {
    const engine = startMatch();
    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(currentRound(state)).toBe(0);
    expect(playerMarks(state, "alice")).toBe(0);
    expect(playerMarks(state, "bob")).toBe(0);
    expect(SHANGHAI_ROUNDS).toBe(7);
    expect(roundTarget(1)).toBe(1);
    expect(roundTarget(7)).toBe(7);
  });

  it("awards 1 mark for a single of the current target", () => {
    const engine = startMatch();

    // Round 1 targets number 1: alice's 3 darts, all single 1.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    let state = engine.recordThrow({ playerId: "alice", points: 1 });
    expect(playerMarks(state, "alice")).toBe(3);
    // Still round 0 while bob throws.
    expect(currentRound(state)).toBe(0);

    // Bob throws, round advances after his 3 darts.
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    state = engine.recordThrow({ playerId: "bob", points: 1 });
    expect(currentRound(state)).toBe(1); // now round 2
  });

  it("awards 2 marks for a double and 3 for a triple of the current target", () => {
    const engine = startMatch();

    // Round 1: double 1 = 2 points scores 2 marks.
    engine.recordThrow({ playerId: "alice", points: 2 });
    expect(playerMarks(engine.getState(), "alice")).toBe(2);

    // Triple 1 = 3 points scores 3 marks.
    engine.recordThrow({ playerId: "alice", points: 3 });
    expect(playerMarks(engine.getState(), "alice")).toBe(5);
  });

  it("awards 0 marks for a miss (wrong number)", () => {
    const engine = startMatch();

    // Round 1 targets 1: alice's first dart throws 4 (miss: 4≠1, 2, 3).
    engine.recordThrow({ playerId: "alice", points: 4 });
    let state = engine.getState();
    expect(playerMarks(state, "alice")).toBe(0);
    expect(currentRound(state)).toBe(0); // still round 1

    // Correct throw on next dart still scores.
    engine.recordThrow({ playerId: "alice", points: 1 });
    state = engine.getState();
    expect(playerMarks(state, "alice")).toBe(1);
  });

  it("detects Shanghai and completes the match immediately", () => {
    const engine = startMatch();

    // Round 1 targets number 1: hit single 1, double 1, triple 1 = Shanghai!
    engine.recordThrow({ playerId: "alice", points: 1 }); // single
    engine.recordThrow({ playerId: "alice", points: 2 }); // double
    const state = engine.recordThrow({ playerId: "alice", points: 3 }); // triple

    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(playerMarks(state, "alice")).toBe(6); // 1+2+3 marks
  });

  it("advances round after both players complete their turns", () => {
    const engine = startMatch();

    // Complete round 1: alice 3×1, bob 3×1.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    const state = engine.recordThrow({ playerId: "bob", points: 1 });

    expect(currentRound(state)).toBe(1); // round 2

    // Now round 2 targets number 2: hitting 2 scores, hitting 1 does not.
    engine.recordThrow({ playerId: "alice", points: 2 }); // hits
    expect(playerMarks(engine.getState(), "alice")).toBe(4);

    engine.recordThrow({ playerId: "alice", points: 1 }); // misses (target is now 2)
    expect(playerMarks(engine.getState(), "alice")).toBe(4); // unchanged
  });

  it("completes the match after 7 rounds with no Shanghai", () => {
    const engine = startMatch();

    // Play 7 full rounds without a Shanghai.
    for (let round = 0; round < 7; round++) {
      const target = round + 1;
      // Alice's turn (3 darts).
      engine.recordThrow({ playerId: "alice", points: target });
      engine.recordThrow({ playerId: "alice", points: target });
      engine.recordThrow({ playerId: "alice", points: target });
      // Bob's turn (3 darts).
      engine.recordThrow({ playerId: "bob", points: target });
      engine.recordThrow({ playerId: "bob", points: target });
      engine.recordThrow({ playerId: "bob", points: target });
    }

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(currentRound(state)).toBe(7);
    // 7 rounds × 3 marks each = 21 marks per player.
    expect(playerMarks(state, "alice")).toBe(21);
    expect(playerMarks(state, "bob")).toBe(21);
  });

  it("state snapshot is JSON-safe", () => {
    const engine = startMatch();
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 2 });
    const state = engine.getState();
    const revived = JSON.parse(JSON.stringify(state)) as MatchState;
    expect((revived.modeData as ShanghaiModeData).currentRound).toBe(0);
    expect(playerMarks(revived, "alice")).toBe(3);
  });

  it("seeds the whole round state of a new match", () => {
    const engine = startMatch();
    const data = engine.getState().modeData as ShanghaiModeData;
    expect(data.currentRound).toBe(0);
    expect(data.dartsThisRound).toEqual({});
    expect(data.roundRecords).toEqual({});
    expect(data.finishedRounds).toEqual({});
  });

  it("keeps no total dart counter any more", () => {
    const engine = startMatch();
    engine.recordThrow({ playerId: "alice", points: 1 });
    const data = engine.getState().modeData as ShanghaiModeData;
    expect("totalDartsThisRound" in data).toBe(false);
  });

  it("counts the darts of the round per player, misses included", () => {
    const engine = startMatch();

    // Alice throws a scoring dart and two misses: every dart counts.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    let data = (engine.getState().modeData as ShanghaiModeData).dartsThisRound;
    expect(data.alice).toBe(3);
    expect(data.bob).toBeUndefined();

    // Bob has thrown nothing yet, so the round is not over.
    expect(currentRound(engine.getState())).toBe(0);

    engine.recordThrow({ playerId: "bob", points: 0 });
    data = (engine.getState().modeData as ShanghaiModeData).dartsThisRound;
    expect(data.alice).toBe(3);
    expect(data.bob).toBe(1);
  });

  it("advances the round only after every player has thrown three darts", () => {
    const engine = startMatch();

    // Alice alone throws three darts: the round is not over yet.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    let state = engine.recordThrow({ playerId: "alice", points: 1 });
    expect(currentRound(state)).toBe(0);
    expect((state.modeData as ShanghaiModeData).dartsThisRound.alice).toBe(3);

    // Bob throws two of his three darts: still not over.
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    state = engine.getState();
    expect(currentRound(state)).toBe(0);
    expect((state.modeData as ShanghaiModeData).dartsThisRound.bob).toBe(2);

    // Bob's third dart ends the round for everybody.
    state = engine.recordThrow({ playerId: "bob", points: 1 });
    expect(currentRound(state)).toBe(1);
    const data = state.modeData as ShanghaiModeData;
    expect(data.dartsThisRound).toEqual({});
    expect(data.roundRecords).toEqual({});
  });

  it("records the marks each player scored in the round in play", () => {
    const engine = startMatch();

    // Round 1 targets number 1: a triple of 1 scores 3 marks.
    engine.recordThrow({ playerId: "alice", points: 3 });
    const data = engine.getState().modeData as ShanghaiModeData;
    const record: ShanghaiRoundRecord | undefined = data.roundRecords.alice;
    expect(record?.marks).toBe(3);
    expect(record?.hitTriple).toBe(true);
    expect(playerMarks(engine.getState(), "alice")).toBe(3);
  });

  it("keeps the marks of every finished round for every player, in order", () => {
    const engine = startMatch();

    // Round 1 (target 1): alice scores 3, bob scores 1 + 2 + 0 = 3.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 2 });
    engine.recordThrow({ playerId: "bob", points: 0 });

    // Round 2 (target 2): alice scores three doubles = 6, bob misses everything.
    engine.recordThrow({ playerId: "alice", points: 4 });
    engine.recordThrow({ playerId: "alice", points: 4 });
    engine.recordThrow({ playerId: "alice", points: 4 });
    engine.recordThrow({ playerId: "bob", points: 0 });
    engine.recordThrow({ playerId: "bob", points: 0 });
    const state = engine.recordThrow({ playerId: "bob", points: 0 });

    const data = state.modeData as ShanghaiModeData;
    expect(currentRound(state)).toBe(2);
    expect(data.finishedRounds.alice).toEqual([3, 6]);
    expect(data.finishedRounds.bob).toEqual([3, 0]);
    expect(playerMarks(state, "alice")).toBe(9);
    expect(playerMarks(state, "bob")).toBe(3);
  });

  it("appends a zero for a player who scored nothing in a finished round", () => {
    const engine = startMatch();

    // Round 1 (target 1): alice misses everything, bob scores three singles.
    engine.recordThrow({ playerId: "alice", points: 0 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    const state = engine.recordThrow({ playerId: "bob", points: 1 });

    const data = state.modeData as ShanghaiModeData;
    expect(currentRound(state)).toBe(1);
    expect(data.finishedRounds.alice).toEqual([0]);
    expect(data.finishedRounds.bob).toEqual([3]);
    expect(playerMarks(state, "alice")).toBe(0);
    expect(playerMarks(state, "bob")).toBe(3);
  });

  it("ends the match on a Shanghai without advancing the round", () => {
    const engine = startMatch();

    // Round 1 targets number 1: single, double and triple = Shanghai!
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 2 });
    const state = engine.recordThrow({ playerId: "alice", points: 3 });

    const data = state.modeData as ShanghaiModeData;
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    // The match ended, the round did not: nothing is in the round history.
    expect(currentRound(state)).toBe(0);
    expect(data.finishedRounds).toEqual({});
    expect(data.dartsThisRound.alice).toBe(3);
  });

  it("re-derives the round and its history when the last dart is undone", () => {
    const engine = startMatch();

    // Round 1: alice scores 3, bob scores 2 so far.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    engine.recordThrow({ playerId: "bob", points: 1 });
    const state = engine.recordThrow({ playerId: "bob", points: 1 });
    expect(currentRound(state)).toBe(1);
    expect((state.modeData as ShanghaiModeData).finishedRounds.alice).toEqual([3]);

    // Undoing bob's last dart replays the ledger: the round is in play
    // again and the finished round is gone.
    const restored = engine.undoLastThrow();
    const data = restored.modeData as ShanghaiModeData;
    expect(data.currentRound).toBe(0);
    expect(data.dartsThisRound).toEqual({ alice: 3, bob: 2 });
    expect(data.finishedRounds).toEqual({});
    expect(data.roundRecords.bob?.marks).toBe(2);
    expect(playerMarks(restored, "alice")).toBe(3);
  });

  it("ends the round on the turn boundary and never busts a dart", () => {
    const engine = startMatch();

    // Alice's turn: one single 1 and two misses.
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    engine.recordThrow({ playerId: "alice", points: 0 });
    let state = engine.getState();
    // Her turn is over, the round is not: bob has not thrown yet.
    expect(currentRound(state)).toBe(0);
    expect(state.currentPlayerId).toBe("bob");
    // A shanghai match has no checkout, so no dart of it ever busts.
    expect(state.throws.every((dart) => !dart.bust)).toBe(true);

    // Bob's turn: a double 1 and two misses.
    engine.recordThrow({ playerId: "bob", points: 2 });
    engine.recordThrow({ playerId: "bob", points: 0 });
    state = engine.recordThrow({ playerId: "bob", points: 0 });

    // His third dart ends his turn AND the round.
    expect(currentRound(state)).toBe(1);
    expect(state.throws.every((dart) => !dart.bust)).toBe(true);
    expect(state.throws.map((dart) => dart.playerId)).toEqual([
      "alice",
      "alice",
      "alice",
      "bob",
      "bob",
      "bob",
    ]);
  });
});
