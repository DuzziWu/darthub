import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createAdaptiveDifficultyEngine, createNullRatingProvider } from "@/career/adaptiveEngine";
import { createQuestLoaderService } from "@/career/questLoader";
import { createQuestService } from "@/career/questService";
import { createInMemoryCareerProgressRepository } from "@/career/careerProgressRepository";
import { validQuestFixture } from "../../unit/career/helpers/validQuestFixture";

const tempDirs: string[] = [];

function writeTempQuestDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tempRoot(), "darthub-career-adaptive-flow-"));
  tempDirs.push(dir);
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(dir, fileName), JSON.stringify(content));
  }
  return dir;
}

function tempRoot(): string {
  return tmpdir();
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const tighteningNextQuest = {
  ...validQuestFixture,
  id: "quest-double-in",
  minLevel: 1,
  order: 2,
  adaptiveDifficulty: {
    enabled: true,
    parameters: {
      winRateTarget: 0.5,
      lossStreakThreshold: 2,
      winStreakThreshold: 1,
      targetAdjustmentStep: 0.1,
    },
    flags: {
      relaxTargetsOnLoss: true,
      tightenTargetsOnWin: true,
      assistOnStreak: false,
    },
  },
};

describe("adaptive engine integration with the quest completion flow", () => {
  it("escalates difficulty through completeQuest and persists it per user", async () => {
    const progressRepository = createInMemoryCareerProgressRepository();
    const engine = createAdaptiveDifficultyEngine({
      progressRepository,
      ratingProvider: createNullRatingProvider(),
    });
    const questService = createQuestService({
      questLoader: createQuestLoaderService(
        writeTempQuestDir({
          "a.json": validQuestFixture,
          "b.json": tighteningNextQuest,
        }),
      ),
      progressRepository,
      adaptiveEngine: engine,
    });

    const result = await questService.completeQuest("user-1", "quest-first-checkout", {
      won: true,
    });

    expect(result.nextQuest?.id).toBe("quest-double-in");
    expect(result.progress.winStreak).toBe(1);
    expect(result.progress.effectiveTargetAdjustment).toBe(0.1);
    expect(result.progress.difficultyAdjustment).toBe(0.1);
    expect(result.progress.difficultyTier).toBe("unranked");

    // The engine's adjustment is persisted for the user.
    const stored = await progressRepository.findByUserId("user-1");
    expect(stored?.difficultyAdjustment).toBe(0.1);
    expect(stored?.currentQuestId).toBe("quest-double-in");
  });

  it("de-escalates through completeQuest after consecutive losses", async () => {
    const progressRepository = createInMemoryCareerProgressRepository();
    const engine = createAdaptiveDifficultyEngine({
      progressRepository,
      ratingProvider: createNullRatingProvider(),
    });
    const questService = createQuestService({
      questLoader: createQuestLoaderService(
        writeTempQuestDir({
          "a.json": validQuestFixture,
          "b.json": tighteningNextQuest,
        }),
      ),
      progressRepository,
      adaptiveEngine: engine,
    });

    const first = await questService.completeQuest("user-2", "quest-first-checkout", {
      won: false,
    });
    const second = await questService.completeQuest("user-2", "quest-double-in", {
      won: false,
    });

    expect(first.progress.effectiveTargetAdjustment).toBe(0);
    expect(second.progress.effectiveTargetAdjustment).toBe(-0.1);
    expect(second.progress.lossStreak).toBe(2);

    const stored = await progressRepository.findByUserId("user-2");
    expect(stored?.difficultyAdjustment).toBe(-0.1);
  });
});
