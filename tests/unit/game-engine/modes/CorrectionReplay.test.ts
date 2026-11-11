import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { StandardMode } from "@/game-engine/modes/StandardMode";
import { CricketMode, type CricketModeData } from "@/game-engine/modes/CricketMode";
import {
  AroundTheClockMode,
  type AroundTheClockModeData,
} from "@/game-engine/modes/AroundTheClockMode";
import { ShanghaiMode, type ShanghaiModeData } from "@/game-engine/modes/ShanghaiMode";
import { LEG_SET_MODE_DATA_KEY, type LegSetProgress } from "@/game-engine/rules/LegSetManager";
import { GameEngineBustError } from "@/game-engine/types";

/** Reads the leg/set progress out of a state's mode data. */
function legSet(state: { modeData?: Record<string, unknown> }): LegSetProgress | undefined {
  return state.modeData?.[LEG_SET_MODE_DATA_KEY] as LegSetProgress | undefined;
}

describe("correction replay across modes", () => {
  it("keeps the double-out rule and leg progress alive across a correction", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 30 }));
    engine.startMatch({ playerIds: ["a", "b"], outRule: "double", legs: 5 });
    engine.recordThrow({ playerId: "a", points: 20 }); // a: 10
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" }); // a wins leg 1
    engine.recordThrow({ playerId: "a", points: 20 }); // leg 2: a: 10
    engine.recordThrow({ playerId: "b", points: 20 }); // b: 10

    const before = engine.getState();
    expect(before.status).toBe("inProgress");
    expect(legSet(before)?.legsWon).toEqual({ a: 1 });

    // Correct a dart of leg 2.
    engine.correctThrow(2, { points: 5 });

    const after = engine.getState();
    // Leg progress survived the replay, untouched by the correction.
    expect(legSet(after)?.legsWon).toEqual({ a: 1 });
    expect(after.players.find((p) => p.id === "a")?.totalPoints).toBe(25);
    expect(after.currentPlayerId).toBe("b");

    // The double-out rule survived the replay: b on 10 cannot finish on a single.
    expect(() => engine.recordThrow({ playerId: "b", points: 10 })).toThrow(GameEngineBustError);
  });

  it("audits a correction of a leg-winning dart", () => {
    const engine = new GameEngine(new StandardMode({ startScore: 30 }));
    engine.startMatch({ playerIds: ["a", "b"], outRule: "double", legs: 5 });
    // a: 20, D5 wins leg 1, D5 → a: 20.  b: 20, D5 wins leg 2, 20 → b: 10.
    engine.recordThrow({ playerId: "a", points: 20 });
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" });
    engine.recordThrow({ playerId: "a", points: 10, segment: "double" });
    engine.recordThrow({ playerId: "b", points: 20 });
    engine.recordThrow({ playerId: "b", points: 10, segment: "double" });
    engine.recordThrow({ playerId: "b", points: 20 });
    // a's current turn: 5 → 15, 5 → 10.
    engine.recordThrow({ playerId: "a", points: 5 });
    engine.recordThrow({ playerId: "a", points: 5 });
    expect(engine.getState().status).toBe("inProgress");

    // Move a's leg-1 win from the second dart to the third (still won by a):
    // the winning D5 becomes a miss, so the third dart (D5) finishes the leg.
    const corrected = engine.correctThrow(1, { points: 0 });

    expect(corrected.status).toBe("inProgress");
    expect(legSet(corrected)?.legsWon).toEqual({ a: 1, b: 1 });
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0]).toMatchObject({
      dartIndex: 1,
      playerId: "a",
      previousPoints: 10,
      newPoints: 0,
    });
  });

  it("replays cricket marks for both players after a correction", () => {
    const engine = new GameEngine(new CricketMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    // a's first turn: T20 closes 20; two bulls put marks on 25. No scores.
    engine.recordThrow({ playerId: "a", points: 60 });
    engine.recordThrow({ playerId: "a", points: 25 });
    engine.recordThrow({ playerId: "a", points: 25 });
    // b's turn: two marks on 20, one miss — 20 stays open.
    engine.recordThrow({ playerId: "b", points: 20 });
    engine.recordThrow({ playerId: "b", points: 20 });
    engine.recordThrow({ playerId: "b", points: 0 });
    // a's second turn: D20 scores 40 (a closed 20, b still open).
    engine.recordThrow({ playerId: "a", points: 40 });
    engine.recordThrow({ playerId: "a", points: 0 });
    engine.recordThrow({ playerId: "a", points: 0 });
    const before = engine.getState();
    expect(before.players.find((p) => p.id === "a")?.totalPoints).toBe(40);

    // Re-enter a's D20 as a double bull (50): two more marks on 25, no score.
    const corrected = engine.correctThrow(6, { points: 50 });
    const marks = corrected.modeData as CricketModeData;

    expect(marks.marks.a?.["20"]).toBe(3); // closing marks kept
    expect(marks.marks.a?.["25"]).toBe(4); // 2 from before + the corrected dart
    expect(marks.marks.b?.["20"]).toBe(2); // b's darts untouched
    // The 40 points a scored go away — the whole match re-derived.
    expect(corrected.players.find((p) => p.id === "a")?.totalPoints).toBe(0);
    expect(corrected.players.find((p) => p.id === "b")?.totalPoints).toBe(0);
    expect(corrected.throws).toHaveLength(9);
  });

  it("replays the around-the-clock target index after a correction", () => {
    const engine = new GameEngine(new AroundTheClockMode());
    engine.startMatch({ playerIds: ["a"] });
    // a hits 1 and 2; 5 is a miss on target 3 (no single/double/triple match).
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });
    engine.recordThrow({ playerId: "a", points: 5 });
    const before = engine.getState().modeData as AroundTheClockModeData;
    expect(before.currentTargetIndex).toBe(2);
    expect(before.playerProgress).toEqual({ a: 2 });

    // A's first dart was actually a miss: the shared index walks back.
    const corrected = engine.correctThrow(0, { points: 0 });
    const data = corrected.modeData as AroundTheClockModeData;
    expect(data.currentTargetIndex).toBe(1);
    expect(data.playerProgress).toEqual({ a: 1 });

    // And correcting it back restores the index.
    const restored = engine.correctThrow(0, { points: 1 });
    expect((restored.modeData as AroundTheClockModeData).currentTargetIndex).toBe(2);
  });

  it("replays shanghai rounds and audits a correction of a finished round", () => {
    const engine = new GameEngine(new ShanghaiMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    // Round 1 targets 1: a hits single + double, misses the third.
    engine.recordThrow({ playerId: "a", points: 1 });
    engine.recordThrow({ playerId: "a", points: 2 });
    engine.recordThrow({ playerId: "a", points: 0 });
    // b hits the single only; the round completes and advances.
    engine.recordThrow({ playerId: "b", points: 1 });
    engine.recordThrow({ playerId: "b", points: 0 });
    engine.recordThrow({ playerId: "b", points: 0 });
    const before = engine.getState();
    expect((before.modeData as ShanghaiModeData).currentRound).toBe(1);
    expect(before.players.find((p) => p.id === "a")?.totalPoints).toBe(3);

    // A's single was a miss: round 1 re-derives, the round counter stands.
    const corrected = engine.correctThrow(0, { points: 0 });
    const data = corrected.modeData as ShanghaiModeData;
    expect(data.currentRound).toBe(1); // still on round 2
    expect(data.roundRecords).toEqual({}); // cleared by the round advance
    expect(corrected.players.find((p) => p.id === "a")?.totalPoints).toBe(2);
    expect(corrected.players.find((p) => p.id === "b")?.totalPoints).toBe(1);

    // The dart sat in a finished visit, so the correction is audited.
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0]).toMatchObject({
      dartIndex: 0,
      playerId: "a",
      previousPoints: 1,
      newPoints: 0,
    });
  });
});
