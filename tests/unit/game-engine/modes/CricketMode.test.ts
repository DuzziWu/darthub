import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import type { MatchState } from "@/game-engine/types";
import {
  CricketMode,
  CRICKET_TARGETS,
  getCricketWinnerId,
  MARKS_TO_CLOSE,
  type CricketModeData,
} from "@/game-engine/modes/CricketMode";

/** Reads the mark count of one target on one player's board. */
function marksFor(state: MatchState, playerId: string, target: number): number {
  const data = state.modeData as CricketModeData | undefined;
  return data?.marks[playerId]?.[String(target)] ?? 0;
}

/** True when the player has reached MARKS_TO_CLOSE marks on a target. */
function isClosed(state: MatchState, playerId: string, target: number): boolean {
  return marksFor(state, playerId, target) >= MARKS_TO_CLOSE;
}

/** Reads a player's cricket point score from the state snapshot. */
function playerPoints(state: MatchState, playerId: string): number {
  return state.players.find((player) => player.id === playerId)?.totalPoints ?? -1;
}

/** Starts a fresh two-player cricket match inside a new engine. */
function startCricketMatch(): GameEngine {
  const engine = new GameEngine(new CricketMode());
  engine.startMatch({ playerIds: ["alice", "bob"] });
  return engine;
}

/** Throws the given dart values for one player (each engine call = 1 dart). */
function throwDarts(engine: GameEngine, playerId: string, darts: readonly number[]): MatchState {
  let state = engine.getState();
  for (const points of darts) {
    state = engine.recordThrow({ playerId, points });
  }
  return state;
}

/** Burns a full turn of the given player with three misses. */
function passTurn(engine: GameEngine, playerId: string): void {
  throwDarts(engine, playerId, [0, 0, 0]);
}

/**
 * Cricket scoring convention implemented here (standard, not cut-throat):
 * a player scores points when hitting a number they themselves have
 * closed (3 marks) while at least one opponent still has it open.
 */
describe("CricketMode", () => {
  it("tracks hits on each target number and the bullseye", () => {
    const engine = startCricketMatch();

    // Turn 1: single 20, single 19, single outer bull.
    throwDarts(engine, "alice", [20, 19, 25]);
    let state = engine.getState();
    expect(marksFor(state, "alice", 20)).toBe(1);
    expect(marksFor(state, "alice", 19)).toBe(1);
    expect(marksFor(state, "alice", 25)).toBe(1);
    expect(marksFor(state, "alice", 18)).toBe(0);
    expect(marksFor(state, "alice", 17)).toBe(0);
    expect(marksFor(state, "alice", 16)).toBe(0);
    expect(marksFor(state, "alice", 15)).toBe(0);
    expect(marksFor(state, "bob", 20)).toBe(0);

    passTurn(engine, "bob");

    // Turn 2: double 20, double 17, single 18.
    throwDarts(engine, "alice", [40, 34, 18]);
    state = engine.getState();
    expect(marksFor(state, "alice", 20)).toBe(3);
    expect(marksFor(state, "alice", 17)).toBe(2);
    expect(marksFor(state, "alice", 18)).toBe(1);

    passTurn(engine, "bob");

    // Turn 3: triple 20, triple 19, triple 15.
    throwDarts(engine, "alice", [60, 57, 45]);
    state = engine.getState();
    expect(marksFor(state, "alice", 20)).toBe(6);
    expect(marksFor(state, "alice", 19)).toBe(4);
    expect(marksFor(state, "alice", 15)).toBe(3);

    passTurn(engine, "bob");

    // Turn 4: inner bull doubles the bull marks (25 -> 3), then misses.
    throwDarts(engine, "alice", [50, 0, 21]);
    state = engine.getState();
    expect(marksFor(state, "alice", 25)).toBe(3);
    // 21 is no cricket segment (no single/double/triple of 15-20 or bull):
    // no marks are recorded for it.
    expect(marksFor(state, "alice", 16)).toBe(0);
    expect(marksFor(state, "alice", 18)).toBe(1);

    // The bullseye is tracked like every other number in the target set.
    expect(CRICKET_TARGETS).toEqual([20, 19, 18, 17, 16, 15, 25]);

    // Tracked marks survive the JSON round trip of the state snapshot.
    const revived = JSON.parse(JSON.stringify(state)) as MatchState;
    expect(marksFor(revived, "alice", 20)).toBe(6);
  });

  it("correctly closes a number after three hits", () => {
    const engine = startCricketMatch();

    // Two singles on 20: not yet closed.
    throwDarts(engine, "alice", [20, 20, 0]);
    expect(marksFor(engine.getState(), "alice", 20)).toBe(2);

    passTurn(engine, "bob");

    // The third single hits 20: exactly three marks -> the number closes.
    const state = throwDarts(engine, "alice", [20, 0, 0]);
    expect(marksFor(state, "alice", 20)).toBe(3);
    expect(isClosed(state, "alice", 20)).toBe(true);

    // A number below MARKS_TO_CLOSE marks is still open (19 has one).
    expect(isClosed(state, "alice", 19)).toBe(false);
    expect(isClosed(state, "alice", 18)).toBe(false);

    passTurn(engine, "bob");

    // A single triple in one dart closes a number at once (triple 18).
    const tripleState = throwDarts(engine, "alice", [54, 0, 0]);
    expect(marksFor(tripleState, "alice", 18)).toBe(3);
    expect(isClosed(tripleState, "alice", 18)).toBe(true);
  });

  it("awards points for hits on already-closed numbers of the opponent", () => {
    const engine = startCricketMatch();

    // Alice closes 20 with a triple and two singles. The closing dart
    // itself scores nothing, but within the same turn the number is
    // already closed, so the two follow-up singles each score 20.
    throwDarts(engine, "alice", [60, 20, 20]);
    let state = engine.getState();
    expect(playerPoints(state, "alice")).toBe(40);
    expect(playerPoints(state, "bob")).toBe(0);

    passTurn(engine, "bob");

    // Bob still has 20 open, and Alice has it closed: each further hit
    // scores its number value on Alice's own score.
    state = throwDarts(engine, "alice", [20, 0, 0]);
    expect(playerPoints(state, "alice")).toBe(60);
    expect(playerPoints(state, "bob")).toBe(0);

    passTurn(engine, "bob");

    // Dart 1: single bull (not closed yet, no points). Dart 2: inner
    // bull raises the bull to 3 marks and closes it; the closing dart
    // scores for the hits after it, not for itself.
    state = throwDarts(engine, "alice", [25, 50, 0]);
    expect(playerPoints(state, "alice")).toBe(60);

    passTurn(engine, "bob");

    // Bull is closed for Alice while Bob still has it open: inner bull
    // (50) scores 2 marks x 25 value.
    state = throwDarts(engine, "alice", [50, 0, 0]);
    expect(playerPoints(state, "alice")).toBe(110);
    expect(playerPoints(state, "bob")).toBe(0);

    passTurn(engine, "bob");

    passTurn(engine, "alice");

    // Bob closes 20 as well: with no opponent having 20 open, Alice's
    // further hits on 20 stop scoring.
    throwDarts(engine, "bob", [40, 20, 20]);
    expect(playerPoints(engine.getState(), "bob")).toBe(0);

    state = throwDarts(engine, "alice", [20, 0, 0]);
    expect(marksFor(state, "alice", 20)).toBe(7);
    expect(playerPoints(state, "alice")).toBe(110);
  });

  it("determines the winner when all numbers are closed and the higher score wins", () => {
    const engine = startCricketMatch();

    // Alice closes 20 immediately (triple, then scores 60 on her own
    // closed 20), Bob closes the bull. Bob then farms points on the
    // bull because Alice still has it open.
    throwDarts(engine, "alice", [60, 0, 0]);
    throwDarts(engine, "bob", [50, 25, 0]);
    throwDarts(engine, "alice", [60, 0, 0]);
    throwDarts(engine, "bob", [50, 50, 50]);
    expect(playerPoints(engine.getState(), "alice")).toBe(60);
    expect(playerPoints(engine.getState(), "bob")).toBe(150);

    // Alice closes her remaining numbers (19, 18, 17, 16, 15). Closing
    // darts score for themselves, so no extra points for Alice here,
    // and the bull climbs to 2 marks with the last dart.
    throwDarts(engine, "alice", [57, 54, 51]);
    passTurn(engine, "bob");
    throwDarts(engine, "alice", [48, 45, 50]);
    passTurn(engine, "bob");

    // Alice now closes the bull: every number is closed for her, but
    // her 60 points trail Bob's 150, so the match must CONTINUE.
    const trailingState = throwDarts(engine, "alice", [25, 0, 0]);
    expect(isAllClosed(trailingState, "alice")).toBe(true);
    expect(trailingState.status).toBe("inProgress");
    expect(getCricketWinnerId(trailingState)).toBeNull();
    expect(playerPoints(trailingState, "alice")).toBe(60);
    expect(playerPoints(trailingState, "bob")).toBe(150);

    // Bob closes his remaining numbers: with 150 >= 60 he wins and the
    // match completes as soon as his last number is closed.
    throwDarts(engine, "bob", [60, 57, 54]);
    throwDarts(engine, "alice", [0, 0, 0]);
    throwDarts(engine, "bob", [51, 48, 45]);

    const state = engine.getState();
    expect(state.status).toBe("completed");
    expect(state.currentPlayerId).toBeNull();
    expect(getCricketWinnerId(state)).toBe("bob");
    expect(isAllClosed(state, "bob")).toBe(true);
    expect(playerPoints(state, "bob")).toBe(150);
    expect(playerPoints(state, "alice")).toBe(60);
  });
});

/** True when every cricket target has at least MARKS_TO_CLOSE marks. */
function isAllClosed(state: MatchState, playerId: string): boolean {
  return CRICKET_TARGETS.every((target) => isClosed(state, playerId, target));
}
