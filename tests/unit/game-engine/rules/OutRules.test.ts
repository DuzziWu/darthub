import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine";
import { StandardMode } from "@/game-engine/modes";
import {
  GameEngineStateError,
  GameEngineValidationError,
  type MatchState,
  type ThrowInput,
  type ThrowSegment,
} from "@/game-engine/types";

/** Records the given throws in order and returns the last snapshot. */
function playThrows(engine: GameEngine, throws: readonly ThrowInput[]): MatchState {
  let state: MatchState | null = null;
  for (const throwInput of throws) {
    state = engine.recordThrow(throwInput);
  }
  return state ?? engine.getState();
}

describe("OutRules (checkout rules)", () => {
  describe("Double Out", () => {
    it("it enforces Double Out: a player can only finish on a double", () => {
      const engine = new GameEngine(new StandardMode({ startScore: 50, outRule: "double" }));
      engine.startMatch({ playerIds: ["alice", "bob"] });

      // The inner bull (50) counts as a double in other rule sets, but
      // this rule demands a board double, so a 50 checkout is a bust.
      expect(() =>
        engine.recordThrow({ playerId: "alice", points: 50, segment: "bull" }),
      ).toThrowError(GameEngineStateError);
      expect(engine.getState().players[0]!.totalPoints).toBe(50);

      // Drive the score down to 10: 50 - 20 = 30, 30 - 20 = 10.
      playThrows(engine, [
        { playerId: "alice", points: 20, segment: "single" },
        { playerId: "alice", points: 20, segment: "single" },
      ]);
      expect(engine.getState().players[0]!.totalPoints).toBe(10);

      // Finishing on a single is not a legal checkout under Double Out.
      expect(() =>
        engine.recordThrow({ playerId: "alice", points: 10, segment: "single" }),
      ).toThrowError(/bust/i);
      expect(engine.getState().players[0]!.totalPoints).toBe(10);

      // Finishing on double 5 is a legal checkout and wins the match.
      const finished = engine.recordThrow({
        playerId: "alice",
        points: 10,
        segment: "double",
      });
      expect(finished.status).toBe("completed");
      expect(finished.currentPlayerId).toBe(null);
      expect(finished.players[0]!.totalPoints).toBe(0);
      expect(finished.players[1]!.totalPoints).toBe(50);
      // State must stay JSON-safe so it can be serialized over the wire.
      expect(JSON.parse(JSON.stringify(finished))).toEqual(finished);
    });
  });

  describe("Master Out", () => {
    it("it enforces Master Out: a player can finish on any double or bull", () => {
      // Case 1: a triple that reaches zero is NOT a legal master checkout.
      const tripleEngine = new GameEngine(new StandardMode({ startScore: 60, outRule: "master" }));
      tripleEngine.startMatch({ playerIds: ["alice", "bob"] });
      expect(() =>
        tripleEngine.recordThrow({ playerId: "alice", points: 60, segment: "triple" }),
      ).toThrowError(/bust/i);
      expect(tripleEngine.getState().players[0]!.totalPoints).toBe(60);

      // A double finishes: 60 - 20 (single) = 40, double 20 = 0.
      playThrows(tripleEngine, [{ playerId: "alice", points: 20, segment: "single" }]);
      expect(tripleEngine.getState().players[0]!.totalPoints).toBe(40);
      const doubleFinish = tripleEngine.recordThrow({
        playerId: "alice",
        points: 40,
        segment: "double",
      });
      expect(doubleFinish.status).toBe("completed");
      expect(doubleFinish.players[0]!.totalPoints).toBe(0);

      // Case 2: the bull (50) also finishes under Master Out.
      const bullEngine = new GameEngine(new StandardMode({ startScore: 50, outRule: "master" }));
      bullEngine.startMatch({ playerIds: ["alice", "bob"] });
      const bullFinish = bullEngine.recordThrow({
        playerId: "alice",
        points: 50,
        segment: "bull",
      });
      expect(bullFinish.status).toBe("completed");
      expect(bullFinish.players[0]!.totalPoints).toBe(0);
    });
  });

  describe("Straight Out", () => {
    it("it enforces Straight Out: any score can finish the leg", () => {
      // An explicit "straight" configuration behaves like the default:
      // non-double segments may check out, no segment info is required.
      const engine = new GameEngine(new StandardMode({ startScore: 60, outRule: "straight" }));
      engine.startMatch({ playerIds: ["alice", "bob"] });

      // A triple reaching zero finishes without any bust.
      const tripleFinish = engine.recordThrow({
        playerId: "alice",
        points: 60,
        segment: "triple",
      });
      expect(tripleFinish.status).toBe("completed");
      expect(tripleFinish.players[0]!.totalPoints).toBe(0);

      // Throws without segment info stay fully backwards compatible.
      const plainEngine = new GameEngine(new StandardMode({ startScore: 31 }));
      plainEngine.startMatch({ playerIds: ["alice"] });
      const plainFinish = playThrows(plainEngine, [
        { playerId: "alice", points: 30 },
        { playerId: "alice", points: 1 },
      ]);
      expect(plainFinish.status).toBe("completed");
      expect(plainFinish.players[0]!.totalPoints).toBe(0);
    });
  });

  describe("Bust scenarios", () => {
    it("it correctly handles bust scenarios according to the selected out rule", () => {
      // Double Out: throwing 40 down from 41 would strand the player on
      // 1, from which no double checkout exists — that is a bust.
      const doubleEngine = new GameEngine(new StandardMode({ startScore: 41, outRule: "double" }));
      doubleEngine.startMatch({ playerIds: ["alice", "bob"] });
      expect(() =>
        doubleEngine.recordThrow({ playerId: "alice", points: 40, segment: "double" }),
      ).toThrowError(/bust/i);

      // Rejected throws leave the match state completely untouched.
      const afterBust = doubleEngine.getState();
      expect(afterBust.status).toBe("inProgress");
      expect(afterBust.currentPlayerId).toBe("alice");
      expect(afterBust.players[0]!.totalPoints).toBe(41);
      expect(afterBust.throwCount).toBe(0);

      // From 41 a safe route exists: single 1 lands on 40, double 20 wins.
      const recovered = playThrows(doubleEngine, [
        { playerId: "alice", points: 1, segment: "single" },
      ]);
      expect(recovered.players[0]!.totalPoints).toBe(40);
      const comebackWin = doubleEngine.recordThrow({
        playerId: "alice",
        points: 40,
        segment: "double",
      });
      expect(comebackWin.status).toBe("completed");
      expect(comebackWin.players[0]!.totalPoints).toBe(0);

      // Straight Out: landing on 1 is NOT a bust; a single 1 finishes.
      const straightEngine = new GameEngine(new StandardMode({ startScore: 41 }));
      straightEngine.startMatch({ playerIds: ["alice", "bob"] });
      const onOne = straightEngine.recordThrow({
        playerId: "alice",
        points: 40,
        segment: "double",
      });
      expect(onOne.status).toBe("inProgress");
      expect(onOne.players[0]!.totalPoints).toBe(1);
      const straightWin = straightEngine.recordThrow({
        playerId: "alice",
        points: 1,
        segment: "single",
      });
      expect(straightWin.status).toBe("completed");

      // Overshoots below zero are busts under every out rule.
      for (const outRule of ["double", "master", "straight"] as const) {
        const engine = new GameEngine(new StandardMode({ startScore: 20, outRule }));
        engine.startMatch({ playerIds: ["alice"] });
        expect(() =>
          engine.recordThrow({ playerId: "alice", points: 40, segment: "double" }),
        ).toThrowError(/bust/i);
        expect(engine.getState().players[0]!.totalPoints).toBe(20);
      }
    });
  });

  describe("Engine configuration", () => {
    it("it exposes out-rule and leg/set configuration through MatchConfig", () => {
      // Options not set on the mode are filled in from startMatch config.
      const engine = new GameEngine(new StandardMode({ startScore: 50 }));
      engine.startMatch({ playerIds: ["alice"], outRule: "double", legs: 5 });

      // Double Out applies via MatchConfig: the bull (50) cannot finish.
      expect(() =>
        engine.recordThrow({ playerId: "alice", points: 50, segment: "bull" }),
      ).toThrowError(/bust/i);

      // triple 10 -> 20, then double 10 checks out leg 1 of the best of 5.
      playThrows(engine, [{ playerId: "alice", points: 30, segment: "triple" }]);
      const afterLeg1 = engine.recordThrow({ playerId: "alice", points: 20, segment: "double" });
      expect(afterLeg1.status).toBe("inProgress");
      expect(afterLeg1.players[0]!.totalPoints).toBe(50);
      const progress = afterLeg1.modeData?.["legSet"] as { legsWon: Record<string, number> };
      expect(progress.legsWon).toEqual({ alice: 1 });
    });

    it("it validates throw segments against the scored points", () => {
      const engine = new GameEngine(new StandardMode({ startScore: 50, outRule: "double" }));
      engine.startMatch({ playerIds: ["alice"] });

      // Unknown segment names and segment/points mismatches are invalid.
      // The cast simulates a client sending an unknown segment name.
      const unknownSegment = "quadruple" as ThrowSegment;
      const badThrows: readonly ThrowInput[] = [
        { playerId: "alice", points: 20, segment: unknownSegment },
        { playerId: "alice", points: 21, segment: "double" },
        { playerId: "alice", points: 50, segment: "triple" },
        { playerId: "alice", points: 30, segment: "bull" },
        { playerId: "alice", points: 0, segment: "single" },
      ];
      for (const badThrow of badThrows) {
        expect(() => engine.recordThrow(badThrow)).toThrowError(GameEngineValidationError);
      }

      // Consistent segment/point pairs are accepted (and the turn is
      // untouched by the rejections above).
      const state = playThrows(engine, [
        { playerId: "alice", points: 20, segment: "single" },
        { playerId: "alice", points: 25, segment: "bull" },
        { playerId: "alice", points: 0 },
      ]);
      // 50 - 20 (single) - 25 (single bull) - 0 = 5.
      expect(state.players[0]!.totalPoints).toBe(5);
    });
  });
});
