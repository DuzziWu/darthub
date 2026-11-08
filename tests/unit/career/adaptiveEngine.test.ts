import { describe, expect, it, vi } from "vitest";
import {
  createAdaptiveDifficultyEngine,
  createNullRatingProvider,
  type RatingProvider,
} from "@/career/adaptiveEngine";
import { createInMemoryCareerProgressRepository } from "@/career/careerProgressRepository";
import { validQuestFixture } from "./helpers/validQuestFixture";

describe("adaptiveEngine", () => {
  it("retrieves player Elo and selects appropriate difficulty tier", async () => {
    const ratingProvider: RatingProvider = {
      getElo: vi.fn(() => 1650),
    };
    const engine = createAdaptiveDifficultyEngine({
      progressRepository: createInMemoryCareerProgressRepository(),
      ratingProvider,
    });

    const tier = engine.resolveDifficultyTier("user-1");

    expect(tier).toBe("competitive");
    expect(ratingProvider.getElo).toHaveBeenCalledWith("user-1");

    // No rating available: the engine falls back to the "unranked" tier.
    const unrankedEngine = createAdaptiveDifficultyEngine({
      progressRepository: createInMemoryCareerProgressRepository(),
      ratingProvider: createNullRatingProvider(),
    });
    expect(unrankedEngine.resolveDifficultyTier("user-1")).toBe("unranked");
  });

  it("escalates difficulty after consecutive successes", async () => {
    const engine = createAdaptiveDifficultyEngine({
      progressRepository: createInMemoryCareerProgressRepository(),
      ratingProvider: createNullRatingProvider(),
    });

    // First win: below the default escalation threshold (2).
    const first = await engine.recordResult({ userId: "user-1", won: true });
    expect(first.action).toBe("unchanged");
    expect(first.adjustment).toBe(0);

    // Second consecutive win: escalates by one step.
    const second = await engine.recordResult({ userId: "user-1", won: true });
    expect(second.action).toBe("escalated");
    expect(second.adjustment).toBe(0.1);
    expect(second.winStreak).toBe(2);

    // Third consecutive win: escalates again, cumulatively.
    const third = await engine.recordResult({ userId: "user-1", won: true });
    expect(third.action).toBe("escalated");
    expect(third.adjustment).toBe(0.2);
  });

  it("de-escalates after failures", async () => {
    const engine = createAdaptiveDifficultyEngine({
      progressRepository: createInMemoryCareerProgressRepository(),
      ratingProvider: createNullRatingProvider(),
    });

    // First loss: below the default relaxation threshold (2).
    const first = await engine.recordResult({ userId: "user-1", won: false });
    expect(first.action).toBe("unchanged");
    expect(first.adjustment).toBe(0);

    // Second consecutive loss: de-escalates by one step.
    const second = await engine.recordResult({ userId: "user-1", won: false });
    expect(second.action).toBe("de-escalated");
    expect(second.adjustment).toBe(-0.1);
    expect(second.lossStreak).toBe(2);

    // Escalation counters earlier de-escalation (symmetric loop).
    await engine.recordResult({ userId: "user-1", won: true });
    const recovery = await engine.recordResult({ userId: "user-1", won: true });
    expect(recovery.action).toBe("escalated");
    expect(recovery.adjustment).toBe(0);
  });

  describe("scenario matrix", () => {
    function buildEngine(ratingProvider?: RatingProvider) {
      const progressRepository = createInMemoryCareerProgressRepository();
      const engine = createAdaptiveDifficultyEngine({
        progressRepository,
        ratingProvider: ratingProvider ?? createNullRatingProvider(),
      });
      return { progressRepository, engine };
    }

    function questWithFlags(
      flags: Partial<{
        tightenTargetsOnWin: boolean;
        relaxTargetsOnLoss: boolean;
        winStreakThreshold: number;
        lossStreakThreshold: number;
        targetAdjustmentStep: number;
      }>,
    ): typeof validQuestFixture {
      return {
        ...validQuestFixture,
        id: "quest-adaptive-matrix",
        adaptiveDifficulty: {
          enabled: true,
          parameters: {
            winRateTarget: 0.5,
            winStreakThreshold: flags.winStreakThreshold ?? 2,
            lossStreakThreshold: flags.lossStreakThreshold ?? 2,
            targetAdjustmentStep: flags.targetAdjustmentStep ?? 0.1,
          },
          flags: {
            relaxTargetsOnLoss: flags.relaxTargetsOnLoss ?? true,
            tightenTargetsOnWin: flags.tightenTargetsOnWin ?? true,
            assistOnStreak: false,
          },
        },
      };
    }

    it("respects a quest's tightenTargetsOnWin flag", async () => {
      const { engine } = buildEngine();
      const quest = questWithFlags({ tightenTargetsOnWin: false, winStreakThreshold: 1 });

      await engine.recordResult({ userId: "user-1", won: true, quest });
      const secondWin = await engine.recordResult({ userId: "user-1", won: true, quest });

      expect(secondWin.action).toBe("unchanged");
      expect(secondWin.adjustment).toBe(0);
    });

    it("respects a quest's relaxTargetsOnLoss flag", async () => {
      const { engine } = buildEngine();
      const quest = questWithFlags({ relaxTargetsOnLoss: false, lossStreakThreshold: 1 });

      await engine.recordResult({ userId: "user-1", won: false, quest });
      const secondLoss = await engine.recordResult({ userId: "user-1", won: false, quest });

      expect(secondLoss.action).toBe("unchanged");
      expect(secondLoss.adjustment).toBe(0);
    });

    it("uses a quest's own thresholds and step", async () => {
      const { engine } = buildEngine();
      const quest = questWithFlags({
        winStreakThreshold: 1,
        targetAdjustmentStep: 0.25,
      });

      const firstWin = await engine.recordResult({ userId: "user-1", won: true, quest });
      expect(firstWin.action).toBe("escalated");
      expect(firstWin.adjustment).toBe(0.25);
    });

    it("clamps the cumulative adjustment at the loop boundaries", async () => {
      const { engine } = buildEngine();
      const quest = questWithFlags({ lossStreakThreshold: 1, targetAdjustmentStep: 0.3 });

      for (let i = 0; i < 5; i += 1) {
        await engine.recordResult({ userId: "user-1", won: false, quest });
      }
      const deepest = await engine.recordResult({ userId: "user-1", won: false, quest });
      expect(deepest.adjustment).toBe(-0.5);
    });

    it("persists difficulty adjustments per user", async () => {
      const { progressRepository, engine } = buildEngine();

      // user-1 hits the de-escalation threshold; user-2 stays at zero.
      await engine.recordResult({ userId: "user-1", won: false });
      const deEscalated = await engine.recordResult({ userId: "user-1", won: false });
      const other = await engine.recordResult({ userId: "user-2", won: true });

      const storedUser1 = await progressRepository.findByUserId("user-1");
      const storedUser2 = await progressRepository.findByUserId("user-2");
      expect(storedUser1?.difficultyAdjustment).toBe(deEscalated.adjustment);
      expect(storedUser1?.difficultyAdjustment).toBe(-0.1);
      expect(storedUser1?.lossStreak).toBe(2);
      expect(storedUser1?.difficultyTier).toBe("unranked");
      expect(storedUser2?.difficultyAdjustment).toBe(other.adjustment);
      expect(storedUser2?.difficultyAdjustment).toBe(0);
      expect(storedUser2?.difficultyTier).toBe("unranked");
    });
  });
});
