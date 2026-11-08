import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createQuestLoaderService } from "@/career/questLoader";
import { createInMemoryCareerProgressRepository } from "@/career/careerProgressRepository";
import { createQuestService, QuestNotFoundError } from "@/career/questService";
import { createDefaultAdaptiveDifficultyPolicy } from "@/career/adaptiveDifficulty";
import { validQuestFixture } from "./helpers/validQuestFixture";

const tempDirs: string[] = [];

function writeTempQuestDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "darthub-career-quests-"));
  tempDirs.push(dir);
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(dir, fileName), JSON.stringify(content));
  }
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("questService", () => {
  it("validates quest JSON files against the TypeScript schema before loading", async () => {
    const questsDir = writeTempQuestDir({ "bad.json": { id: "nope" } });
    const questService = createQuestService({
      questLoader: createQuestLoaderService(questsDir),
      progressRepository: createInMemoryCareerProgressRepository(),
    });

    await expect(questService.getCurrentQuest("user-1")).rejects.toThrow(/Invalid quest JSON/);
  });

  it("records quest completion and updates progress", async () => {
    const questsDir = writeTempQuestDir({
      "a.json": validQuestFixture,
      "b.json": {
        ...validQuestFixture,
        id: "quest-double-in",
        minLevel: 1,
        order: 2,
      },
    });
    const progressRepository = createInMemoryCareerProgressRepository();
    const questService = createQuestService({
      questLoader: createQuestLoaderService(questsDir),
      progressRepository,
    });

    const result = await questService.completeQuest("user-1", "quest-first-checkout", {
      won: true,
    });

    expect(result.progress.completedQuestIds).toContain("quest-first-checkout");
    expect(result.progress.currentQuestId).toBe("quest-double-in");
    expect(result.progress.updatedAt.getTime()).toBeGreaterThanOrEqual(
      result.progress.createdAt.getTime(),
    );
    expect(result.nextQuest?.id).toBe("quest-double-in");

    // The completion was persisted through the repository.
    const stored = await progressRepository.findByUserId("user-1");
    expect(stored?.completedQuestIds).toContain("quest-first-checkout");
    expect(stored?.currentQuestId).toBe("quest-double-in");
  });

  it("unlocks the next quest based on adaptive difficulty", async () => {
    const hardNextQuest = {
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
    const questService = createQuestService({
      questLoader: createQuestLoaderService(
        writeTempQuestDir({
          "a.json": validQuestFixture,
          "b.json": hardNextQuest,
        }),
      ),
      progressRepository: createInMemoryCareerProgressRepository(),
      adaptiveDifficultyPolicy: createDefaultAdaptiveDifficultyPolicy(),
    });

    // A win unlocks the next quest; its adaptive flags tighten it.
    const winResult = await questService.completeQuest("user-1", "quest-first-checkout", {
      won: true,
    });
    expect(winResult.nextQuest?.id).toBe("quest-double-in");
    expect(winResult.progress.effectiveTargetAdjustment).toBe(0.1);

    // A relaxed-flag quest eases the following quest after a loss streak.
    const easyThirdQuest = {
      ...validQuestFixture,
      id: "quest-treble-top",
      minLevel: 1,
      order: 3,
      adaptiveDifficulty: {
        enabled: true,
        parameters: {
          winRateTarget: 0.5,
          lossStreakThreshold: 1,
          winStreakThreshold: 3,
          targetAdjustmentStep: 0.2,
        },
        flags: {
          relaxTargetsOnLoss: true,
          tightenTargetsOnWin: false,
          assistOnStreak: false,
        },
      },
    };
    const relaxingService = createQuestService({
      questLoader: createQuestLoaderService(
        writeTempQuestDir({
          "a.json": validQuestFixture,
          "b.json": hardNextQuest,
          "c.json": easyThirdQuest,
        }),
      ),
      progressRepository: createInMemoryCareerProgressRepository(),
      adaptiveDifficultyPolicy: createDefaultAdaptiveDifficultyPolicy(),
    });

    await relaxingService.completeQuest("user-2", "quest-first-checkout", {
      won: false,
    });
    const lossResult = await relaxingService.completeQuest("user-2", "quest-double-in", {
      won: false,
    });
    expect(lossResult.nextQuest?.id).toBe("quest-treble-top");
    expect(lossResult.progress.effectiveTargetAdjustment).toBe(-0.2);
  });

  it("returns error if quest ID is invalid", async () => {
    const questService = createQuestService({
      questLoader: createQuestLoaderService(writeTempQuestDir({ "a.json": validQuestFixture })),
      progressRepository: createInMemoryCareerProgressRepository(),
    });

    await expect(
      questService.completeQuest("user-1", "does-not-exist", { won: true }),
    ).rejects.toThrow(QuestNotFoundError);
    await expect(
      questService.completeQuest("user-1", "does-not-exist", { won: true }),
    ).rejects.toThrow(/does-not-exist/);
  });
});
