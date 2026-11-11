import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import {
  AroundTheClockMode,
  AROUND_THE_CLOCK_TARGETS,
  type AroundTheClockModeData,
} from "@/game-engine/modes/AroundTheClockMode";
import type { MatchState } from "@/game-engine/types";

/** Starts a fresh single-player match. */
function startMatch(): GameEngine {
  const engine = new GameEngine(new AroundTheClockMode());
  engine.startMatch({ playerIds: ["alice"] });
  return engine;
}

/** Reads currentTargetIndex from the state snapshot. */
function currentTargetIndex(state: MatchState): number {
  return (state.modeData as AroundTheClockModeData | undefined)?.currentTargetIndex ?? 0;
}

/** Reads alice's totalPoints (targets hit so far). */
function alicePoints(state: MatchState): number {
  return state.players[0]?.totalPoints ?? -1;
}

describe("AroundTheClockMode", () => {
  it("initializes match with currentTargetIndex 0 and totalPoints 0", () => {
    const engine = startMatch();
    const state = engine.getState();
    expect(state.status).toBe("inProgress");
    expect(currentTargetIndex(state)).toBe(0);
    expect(alicePoints(state)).toBe(0);
    expect(AROUND_THE_CLOCK_TARGETS).toHaveLength(21);
    expect(AROUND_THE_CLOCK_TARGETS[0]).toBe(1);
    expect(AROUND_THE_CLOCK_TARGETS[20]).toBe(25);
  });

  it("advances progress when the current target is hit with a single", () => {
    const engine = startMatch();

    // Target 1: single 1 advances.
    engine.recordThrow({ playerId: "alice", points: 1 });
    let state = engine.getState();
    expect(currentTargetIndex(state)).toBe(1);
    expect(alicePoints(state)).toBe(1);

    // Now targeting 2: single 2 advances.
    engine.recordThrow({ playerId: "alice", points: 2 });
    state = engine.getState();
    expect(currentTargetIndex(state)).toBe(2);
    expect(alicePoints(state)).toBe(2);
  });

  it("does not advance when the current target is missed", () => {
    const engine = startMatch();

    // Target 1: throwing 4 misses (4 is not 1, 2*1=2, or 3*1=3).
    engine.recordThrow({ playerId: "alice", points: 4 });
    let state = engine.getState();
    expect(currentTargetIndex(state)).toBe(0);
    expect(alicePoints(state)).toBe(0);

    // Throwing 5 also misses.
    engine.recordThrow({ playerId: "alice", points: 5 });
    state = engine.getState();
    expect(currentTargetIndex(state)).toBe(0);
    expect(alicePoints(state)).toBe(0);

    // Correct target still advances.
    engine.recordThrow({ playerId: "alice", points: 1 });
    state = engine.getState();
    expect(currentTargetIndex(state)).toBe(1);
    expect(alicePoints(state)).toBe(1);
  });

  it("counts a double of the current target as a hit", () => {
    const engine = startMatch();

    // Target 1: double 1 = 2 points = 2*1 → hits target 1.
    engine.recordThrow({ playerId: "alice", points: 2 });
    const state = engine.getState();
    expect(currentTargetIndex(state)).toBe(1);
    expect(alicePoints(state)).toBe(1);

    // Now targeting 2: double 2 = 4 points = 2*2 → hits target 2.
    engine.recordThrow({ playerId: "alice", points: 4 });
    expect(currentTargetIndex(engine.getState())).toBe(2);
  });

  it("counts a triple of the current target as a hit", () => {
    const engine = startMatch();

    // Target 1: triple 1 = 3 points = 3*1 → hits target 1.
    engine.recordThrow({ playerId: "alice", points: 3 });
    let state = engine.getState();
    expect(currentTargetIndex(state)).toBe(1);
    expect(alicePoints(state)).toBe(1);

    // Target 2: triple 2 = 6 points = 3*2 → hits target 2.
    engine.recordThrow({ playerId: "alice", points: 6 });
    state = engine.getState();
    expect(currentTargetIndex(state)).toBe(2);
    expect(alicePoints(state)).toBe(2);
  });

  it("advances through all targets and completes the match on the last hit", () => {
    const engine = startMatch();

    // Hit targets 1 through 20 one at a time.
    for (let i = 0; i < 20; i++) {
      const target = AROUND_THE_CLOCK_TARGETS[i]!;
      engine.recordThrow({ playerId: "alice", points: target });
    }
    let state = engine.getState();
    expect(currentTargetIndex(state)).toBe(20);
    expect(state.status).toBe("inProgress");

    // Hit bullseye (25) to complete.
    engine.recordThrow({ playerId: "alice", points: 25 });
    state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(currentTargetIndex(state)).toBe(21);
    expect(alicePoints(state)).toBe(21);
  });

  it("double bull (50) counts as hitting the bullseye target", () => {
    const engine = startMatch();

    // Hit targets 1-20.
    for (let i = 0; i < 20; i++) {
      engine.recordThrow({ playerId: "alice", points: AROUND_THE_CLOCK_TARGETS[i]! });
    }
    // Double bull (50 = 2*25) should complete.
    engine.recordThrow({ playerId: "alice", points: 50 });
    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(alicePoints(state)).toBe(21);
  });

  it("state snapshot is JSON-safe", () => {
    const engine = startMatch();
    engine.recordThrow({ playerId: "alice", points: 1 });
    const state = engine.getState();
    const revived = JSON.parse(JSON.stringify(state)) as MatchState;
    expect((revived.modeData as AroundTheClockModeData).currentTargetIndex).toBe(1);
  });
});
