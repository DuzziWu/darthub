import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import type { MatchState } from "@/game-engine/types";
import { CricketMode, type CricketModeData } from "@/game-engine/modes/CricketMode";

/** Reads the mark count of one target on one player's cricket board. */
function marksFor(state: MatchState, playerId: string, target: number): number {
  const data = state.modeData as CricketModeData | undefined;
  return data?.marks[playerId]?.[String(target)] ?? 0;
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

/**
 * Pin tests for the per-player cricket behaviour of a multiplayer match.
 *
 * They pin the two properties a later UI refactor must not break: every
 * player owns their own marks, and a dart scores for the thrower who has
 * already closed the number while an opponent still has it open (standard
 * cricket, not cut-throat).
 */
describe("cricket with two players", () => {
  it("gives each player their own marks", () => {
    const engine = startCricketMatch();

    // Alice's opening visit: three darts on the 20 give her three marks.
    const state = throwDarts(engine, "alice", [20, 20, 20]);

    // The marks belong to the player who threw them, not to the match.
    expect(marksFor(state, "alice", 20)).toBe(3);
    expect(marksFor(state, "bob", 20)).toBe(0);
  });

  it("scores a dart on a number the thrower closed and an opponent has open", () => {
    const engine = startCricketMatch();

    // Alice closes the 20 with her three darts. The dart that closes a
    // number never scores, so she is still on zero afterwards.
    throwDarts(engine, "alice", [20, 20, 20]);

    // Bob throws his visit elsewhere: the 20 stays open for him.
    throwDarts(engine, "bob", [19, 19, 19]);

    // Alice's next dart on the 20 she closed scores, because Bob still
    // has the 20 open.
    const state = throwDarts(engine, "alice", [20]);

    expect(playerPoints(state, "alice")).toBe(20);
    expect(playerPoints(state, "bob")).toBe(0);
  });
});
