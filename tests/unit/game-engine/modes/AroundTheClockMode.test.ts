import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import {
  AroundTheClockMode,
  AROUND_THE_CLOCK_TARGETS,
  getAroundTheClockWinnerId,
  type AroundTheClockModeData,
} from "@/game-engine/modes/AroundTheClockMode";
import type { MatchModeData, MatchState, MutableMatchState } from "@/game-engine/types";

/** Starts a fresh single-player match. */
function startMatch(): GameEngine {
  const engine = new GameEngine(new AroundTheClockMode());
  engine.startMatch({ playerIds: ["alice"] });
  return engine;
}

/** Starts a fresh two-player match. */
function startTwoPlayerMatch(): GameEngine {
  const engine = new GameEngine(new AroundTheClockMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  return engine;
}

/** Reads the target index of one player from the state snapshot. */
function currentTargetIndex(state: MatchState, playerId = "alice"): number {
  const data = state.modeData as AroundTheClockModeData | undefined;
  return data?.currentTargetIndex?.[playerId] ?? 0;
}

/** Reads alice's totalPoints (targets hit so far). */
function alicePoints(state: MatchState): number {
  return state.players[0]?.totalPoints ?? -1;
}

/** A mutable draft with a hand-picked mode data slice, for the mode's own seam. */
function draftWithModeData(modeData: unknown): MutableMatchState {
  return {
    matchId: "match-test",
    status: "inProgress",
    players: [
      { id: "alice", totalPoints: 0 },
      { id: "bob", totalPoints: 0 },
    ],
    currentPlayerId: "alice",
    throwsInCurrentTurn: 0,
    throwCount: 0,
    throws: [],
    corrections: [],
    modeData: modeData as MatchModeData,
  };
}

/**
 * The mode data and the players' scores must tell the same story: in this
 * mode a player's totalPoints IS the number of targets they have hit.
 */
function expectModeDataAgreesWithScores(state: {
  readonly players: readonly { readonly id: string; readonly totalPoints: number }[];
  readonly modeData?: unknown;
}): void {
  const data = state.modeData as AroundTheClockModeData;
  for (const player of state.players) {
    expect(data.currentTargetIndex[player.id]).toBe(player.totalPoints);
    expect(data.playerProgress[player.id]).toBe(player.totalPoints);
  }
}

/** The mode's own completion rule. */
function modeIsComplete(state: MatchState): boolean {
  return new AroundTheClockMode().isMatchComplete(state);
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

  it("seeds a target index of 0 for every player", () => {
    const engine = startTwoPlayerMatch();
    const data = engine.getState().modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex).toEqual({ alice: 0, bob: 0 });
    expect(data.playerProgress).toEqual({});
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

  it("gives each player their own target to hit", () => {
    const engine = startTwoPlayerMatch();
    // Alice's visit: 1 hits her target 1, 5 and 9 are misses (her target
    // is 2 by then).
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 5 });
    engine.recordThrow({ playerId: "alice", points: 9 });

    const state = engine.getState();
    const data = state.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex["alice"]).toBe(1);
    expect(data.currentTargetIndex["bob"]).toBe(0);
    expect(data.playerProgress["alice"]).toBe(1);
    expect(data.playerProgress["bob"]).toBeUndefined();
    expect(state.players.find((p) => p.id === "alice")?.totalPoints).toBe(1);
    expect(state.players.find((p) => p.id === "bob")?.totalPoints).toBe(0);
  });

  it("does not advance a player whose dart missed the current target", () => {
    const engine = startTwoPlayerMatch();
    engine.recordThrow({ playerId: "alice", points: 1 });
    engine.recordThrow({ playerId: "alice", points: 5 });
    engine.recordThrow({ playerId: "alice", points: 9 });
    // Bob's target is 1: a dart on 20 is a miss.
    engine.recordThrow({ playerId: "bob", points: 20 });

    const state = engine.getState();
    const data = state.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex["bob"]).toBe(0);
    expect(data.playerProgress["bob"]).toBeUndefined();
    // The miss consumes the dart: it is in the ledger and it was counted.
    expect(state.throws).toHaveLength(4);
    expect(state.throwCount).toBe(4);
    // And it moves nobody's target — not bob's, not alice's.
    expect(data.currentTargetIndex["alice"]).toBe(1);
    expect(state.players.find((p) => p.id === "bob")?.totalPoints).toBe(0);
  });

  it("completes the match when one player has cleared every target", () => {
    const engine = startTwoPlayerMatch();

    // Alice clears all 21 targets; bob misses every dart of his visits.
    let aliceHits = 0;
    for (let visit = 0; visit < 7; visit++) {
      for (let dart = 0; dart < 3; dart++) {
        const target = AROUND_THE_CLOCK_TARGETS[aliceHits]!;
        aliceHits += 1;
        engine.recordThrow({ playerId: "alice", points: target });
      }
      if (aliceHits >= AROUND_THE_CLOCK_TARGETS.length) {
        break; // alice cleared every target: the match is over
      }
      // Bob's visit: three misses, so the turn goes back to alice.
      for (let dart = 0; dart < 3; dart++) {
        engine.recordThrow({ playerId: "bob", points: 0 });
      }
    }

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(currentTargetIndex(state, "alice")).toBe(21);
    expect(state.players.find((p) => p.id === "alice")?.totalPoints).toBe(21);
    // Bob hit nothing at all — the match ended without him finishing.
    expect(currentTargetIndex(state, "bob")).toBe(0);
    expect(state.players.find((p) => p.id === "bob")?.totalPoints).toBe(0);
  });

  it("re-seeds a snapshot that carries the old shared index", () => {
    const mode = new AroundTheClockMode();
    // A snapshot persisted by the old code: one shared index for everybody.
    const draft = draftWithModeData({ currentTargetIndex: 3, playerProgress: { alice: 3 } });

    // The number is not a per-player map: it must be re-seeded, not read.
    expect(() => mode.applyThrow(draft, { playerId: "alice", points: 1 })).not.toThrow();

    const data = draft.modeData as AroundTheClockModeData;
    // The re-seed covers every player, and the two maps agree with the
    // scores the players hold: alice hit her target 1, bob hit nothing.
    expect(data.currentTargetIndex).toEqual({ alice: 1, bob: 0 });
    expect(data.playerProgress).toEqual({ alice: 1, bob: 0 });
    expect(draft.players.find((p) => p.id === "alice")?.totalPoints).toBe(1);
    expect(draft.players.find((p) => p.id === "bob")?.totalPoints).toBe(0);
    expectModeDataAgreesWithScores(draft);
  });

  it("re-seeds a snapshot whose target index is null", () => {
    const mode = new AroundTheClockMode();
    // `typeof null === "object"`: the truthiness check has to come first.
    const draft = draftWithModeData({ currentTargetIndex: null, playerProgress: null });

    expect(() => mode.applyThrow(draft, { playerId: "alice", points: 1 })).not.toThrow();

    const data = draft.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex).toEqual({ alice: 1, bob: 0 });
    expect(data.playerProgress).toEqual({ alice: 1, bob: 0 });
    expectModeDataAgreesWithScores(draft);
  });

  it("re-seeds a snapshot without a player progress map", () => {
    const mode = new AroundTheClockMode();
    // A valid map but no progress map: the slice is half-formed, so it is
    // re-seeded instead of being dereferenced.
    const draft = draftWithModeData({ currentTargetIndex: { alice: 5 } });

    expect(() => mode.applyThrow(draft, { playerId: "alice", points: 1 })).not.toThrow();

    const data = draft.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex).toEqual({ alice: 1, bob: 0 });
    expect(data.playerProgress).toEqual({ alice: 1, bob: 0 });
    expectModeDataAgreesWithScores(draft);
  });

  it("does not read an old shared index as a map when it checks for completion", () => {
    const mode = new AroundTheClockMode();
    const engine = startTwoPlayerMatch();
    // Both legacy shapes: a number, and null (`typeof null === "object"`).
    for (const legacyIndex of [3, null]) {
      const legacyState: MatchState = {
        ...engine.getState(),
        modeData: { currentTargetIndex: legacyIndex, playerProgress: {} },
      };
      expect(() => mode.isMatchComplete(legacyState)).not.toThrow();
      expect(mode.isMatchComplete(legacyState)).toBe(false);
      expect(() => getAroundTheClockWinnerId(legacyState)).not.toThrow();
      expect(getAroundTheClockWinnerId(legacyState)).toBeNull();
    }
  });

  it("names the winner through the mode's own accessor", () => {
    const engine = startTwoPlayerMatch();
    // Nobody has cleared the targets yet.
    expect(getAroundTheClockWinnerId(engine.getState())).toBeNull();

    // Alice clears all 21 targets; bob hits nothing.
    let aliceHits = 0;
    for (let visit = 0; visit < 7; visit++) {
      for (let dart = 0; dart < 3; dart++) {
        const target = AROUND_THE_CLOCK_TARGETS[aliceHits]!;
        aliceHits += 1;
        engine.recordThrow({ playerId: "alice", points: target });
      }
      if (aliceHits >= AROUND_THE_CLOCK_TARGETS.length) {
        break;
      }
      for (let dart = 0; dart < 3; dart++) {
        engine.recordThrow({ playerId: "bob", points: 0 });
      }
    }

    const state = engine.getState();
    // The accessor and the completion rule are the same rule.
    expect(getAroundTheClockWinnerId(state)).toBe("alice");
    expect(modeIsComplete(state)).toBe(true);
    expect(state.status).toBe("completed");
  });

  it("state snapshot is JSON-safe", () => {
    const engine = startMatch();
    engine.recordThrow({ playerId: "alice", points: 1 });
    const state = engine.getState();
    const revived = JSON.parse(JSON.stringify(state)) as MatchState;
    expect((revived.modeData as AroundTheClockModeData).currentTargetIndex["alice"]).toBe(1);
  });
});
