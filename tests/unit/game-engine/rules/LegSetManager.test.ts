import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine";
import { StandardMode } from "@/game-engine/modes";
import { LegSetManager } from "@/game-engine/rules/LegSetManager";
import type { LegSetProgress } from "@/game-engine/rules/LegSetManager";
import type { MatchModeData } from "@/game-engine/types";

/** Reads the leg/set progress slice from a modeData snapshot. */
function legSetProgress(modeData: MatchModeData | undefined): LegSetProgress | undefined {
  return modeData?.["legSet"] as LegSetProgress | undefined;
}

describe("LegSetManager", () => {
  it("it tracks leg wins and set progression", () => {
    // Best of 3 legs per set, best of 2 sets: 2 leg wins take a set and
    // 2 set wins take the match, i.e. 4 checkouts in total.
    const engine = new GameEngine(
      new StandardMode({ startScore: 32, outRule: "double", legs: 3, sets: 2 }),
    );
    engine.startMatch({ playerIds: ["alice"] });

    // Leg 1: double 16 checks out; the match must CONTINUE with a fresh
    // leg (all scores reset) and record the leg win.
    const afterLeg1 = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
    expect(afterLeg1.status).toBe("inProgress");
    expect(afterLeg1.players[0]!.totalPoints).toBe(32);
    expect(legSetProgress(afterLeg1.modeData)?.legsWon).toEqual({ alice: 1 });
    expect(legSetProgress(afterLeg1.modeData)?.setsWon).toEqual({});
    expect(legSetProgress(afterLeg1.modeData)?.matchWinnerId).toBe(null);

    // Leg 2: second leg win completes set 1; legs reset, sets persist.
    const afterLeg2 = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
    expect(afterLeg2.status).toBe("inProgress");
    expect(afterLeg2.players[0]!.totalPoints).toBe(32);
    expect(legSetProgress(afterLeg2.modeData)?.legsWon).toEqual({});
    expect(legSetProgress(afterLeg2.modeData)?.setsWon).toEqual({ alice: 1 });

    // Leg 3: first leg win of set 2.
    const afterLeg3 = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
    expect(afterLeg3.status).toBe("inProgress");
    expect(legSetProgress(afterLeg3.modeData)?.legsWon).toEqual({ alice: 1 });
    expect(legSetProgress(afterLeg3.modeData)?.setsWon).toEqual({ alice: 1 });

    // Leg 4: set 2 goes to alice, who also takes the match.
    const finished = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
    expect(finished.status).toBe("completed");
    expect(finished.currentPlayerId).toBe(null);
    expect(finished.players[0]!.totalPoints).toBe(0);
    expect(legSetProgress(finished.modeData)?.setsWon).toEqual({ alice: 2 });
    expect(legSetProgress(finished.modeData)?.matchWinnerId).toBe("alice");
    // State must stay JSON-safe so it can be serialized over the wire.
    expect(JSON.parse(JSON.stringify(finished))).toEqual(finished);
  });

  it("it requires more than half of a best-of-N round to win it", () => {
    // 5 legs -> 3 leg wins take a set; 3 sets -> 2 set wins take the match.
    const manager = new LegSetManager({ legs: 5, sets: 3 });
    const progress = manager.initialProgress();

    // Set 1 to "ally": two leg wins are not enough, the third completes it.
    const leg1 = manager.recordLegWinner(progress, "ally");
    expect(leg1.setCompleted).toBe(false);
    const leg2 = manager.recordLegWinner(leg1.progress, "ally");
    expect(leg2.setCompleted).toBe(false);
    const leg3 = manager.recordLegWinner(leg2.progress, "ally");
    expect(leg3.setCompleted).toBe(true);
    expect(leg3.setWinnerId).toBe("ally");
    expect(leg3.progress.legsWon).toEqual({});
    expect(leg3.progress.setsWon).toEqual({ ally: 1 });
    expect(leg3.matchCompleted).toBe(false);

    // Set 2 to "nix": legs reset per set, sets accumulate for both players.
    let setProgress = leg3.progress;
    for (let leg = 0; leg < 2; leg += 1) {
      const outcome = manager.recordLegWinner(setProgress, "nix");
      expect(outcome.setCompleted).toBe(false);
      setProgress = outcome.progress;
    }
    const nixSet = manager.recordLegWinner(setProgress, "nix");
    expect(nixSet.setCompleted).toBe(true);
    expect(nixSet.progress.legsWon).toEqual({});
    expect(nixSet.progress.setsWon).toEqual({ ally: 1, nix: 1 });
    expect(nixSet.matchCompleted).toBe(false);

    // Set 3 to "ally": wins the set AND, with 2 of 3 sets, the match.
    let thirdSet = nixSet.progress;
    for (let leg = 0; leg < 2; leg += 1) {
      thirdSet = manager.recordLegWinner(thirdSet, "ally").progress;
    }
    const matchPoint = manager.recordLegWinner(thirdSet, "ally");
    expect(matchPoint.setCompleted).toBe(true);
    expect(matchPoint.progress.setsWon).toEqual({ ally: 2, nix: 1 });
    expect(matchPoint.matchCompleted).toBe(true);
    expect(matchPoint.progress.matchWinnerId).toBe("ally");
  });

  it("it counts the legs of the longer formats the 501 offers", () => {
    // Best of 7 legs is first to 4; best of 9 legs is first to 5.
    const seven = new LegSetManager({ legs: 7 });
    expect(seven.initialProgress().legsWon).toEqual({});

    let progress = seven.initialProgress();
    for (let leg = 0; leg < 3; leg += 1) {
      const outcome = seven.recordLegWinner(progress, "alice");
      expect(outcome.progress.legsWon).toEqual({ alice: leg + 1 });
      // The set is not taken before the fourth leg.
      expect(outcome.setCompleted).toBe(false);
      progress = outcome.progress;
    }

    const fourth = seven.recordLegWinner(progress, "alice");
    expect(fourth.setCompleted).toBe(true);
    expect(fourth.progress.legsWon).toEqual({});

    const nine = new LegSetManager({ legs: 9 });
    let nineProgress = nine.initialProgress();
    for (let leg = 0; leg < 4; leg += 1) {
      const outcome = nine.recordLegWinner(nineProgress, "alice");
      expect(outcome.setCompleted).toBe(false);
      nineProgress = outcome.progress;
    }
    const fifth = nine.recordLegWinner(nineProgress, "alice");
    expect(fifth.setCompleted).toBe(true);
  });

  it("it ends a match of the longer formats at the right leg", () => {
    // Best of 7 legs: the match ends when a player has won 4 legs.
    const engine = new GameEngine(new StandardMode({ startScore: 32, outRule: "double", legs: 7 }));
    engine.startMatch({ playerIds: ["alice"] });

    for (let leg = 0; leg < 3; leg += 1) {
      const state = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
      expect(state.status).toBe("inProgress");
    }
    const fourth = engine.recordThrow({ playerId: "alice", points: 32, segment: "double" });
    expect(fourth.status).toBe("completed");
    expect(legSetProgress(fourth.modeData)?.matchWinnerId).toBe("alice");
  });
});
