import { describe, expect, it } from "vitest";
import { validateQuest } from "@/career/questSchema";
import { validQuestFixture } from "./helpers/validQuestFixture";

describe("questSchema", () => {
  it("validates a quest JSON against the schema", () => {
    const result = validateQuest(validQuestFixture);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.quest.id).toBe("quest-first-checkout");
      expect(result.quest.stages).toHaveLength(1);
    }
  });

  it("rejects a quest missing required fields", () => {
    const result = validateQuest({});

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("validates the sample quest file", async () => {
    const sample = (await import("@/career/quests/sample.json")).default;
    const result = validateQuest(sample);

    expect(result.valid).toBe(true);
  });

  it("supports adaptive difficulty flags", () => {
    const result = validateQuest({
      ...validQuestFixture,
      id: "quest-adaptive",
      adaptiveDifficulty: {
        enabled: true,
        parameters: {
          winRateTarget: 0.5,
          lossStreakThreshold: 3,
          winStreakThreshold: 3,
          targetAdjustmentStep: 0.1,
        },
        flags: {
          relaxTargetsOnLoss: true,
          tightenTargetsOnWin: true,
          assistOnStreak: false,
        },
      },
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.quest.adaptiveDifficulty).toEqual({
        enabled: true,
        parameters: {
          winRateTarget: 0.5,
          lossStreakThreshold: 3,
          winStreakThreshold: 3,
          targetAdjustmentStep: 0.1,
        },
        flags: {
          relaxTargetsOnLoss: true,
          tightenTargetsOnWin: true,
          assistOnStreak: false,
        },
      });
    }
  });

  it("rejects invalid adaptive difficulty values", () => {
    const result = validateQuest({
      ...validQuestFixture,
      id: "quest-adaptive-bad",
      adaptiveDifficulty: {
        enabled: "yes",
        parameters: {
          winRateTarget: 2,
          lossStreakThreshold: -1,
          winStreakThreshold: 3,
          targetAdjustmentStep: 0,
        },
        flags: {
          relaxTargetsOnLoss: true,
          tightenTargetsOnWin: "sometimes",
          assistOnStreak: false,
        },
      },
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.join(" ")).toMatch(/adaptiveDifficulty/);
    }
  });
});
