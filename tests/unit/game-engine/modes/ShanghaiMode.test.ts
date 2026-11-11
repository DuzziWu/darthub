import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import {
  ShanghaiMode,
  SHANGHAI_ROUNDS,
  roundTarget,
  type ShanghaiModeData,
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
});
