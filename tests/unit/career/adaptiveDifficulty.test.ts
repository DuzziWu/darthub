import { describe, expect, it } from "vitest";
import {
  adaptiveDifficultyStep,
  createDefaultAdaptiveDifficultyPolicy,
} from "@/career/adaptiveDifficulty";
import type { QuestAdaptiveDifficulty } from "@/career/questSchema";
import { validQuestFixture } from "./helpers/validQuestFixture";

const policy = createDefaultAdaptiveDifficultyPolicy();

function questWithAdaptiveDifficulty(overrides: Partial<QuestAdaptiveDifficulty> = {}) {
  return {
    ...validQuestFixture,
    adaptiveDifficulty: {
      enabled: true,
      parameters: {
        winRateTarget: 0.5,
        lossStreakThreshold: 2,
        winStreakThreshold: 2,
        targetAdjustmentStep: 0.1,
      },
      flags: {
        relaxTargetsOnLoss: true,
        tightenTargetsOnWin: true,
        assistOnStreak: false,
      },
      ...overrides,
    },
  };
}

describe("defaultAdaptiveDifficultyPolicy", () => {
  it("applies no adjustment when the quest has no adaptive difficulty block", () => {
    expect(
      policy.effectiveAdjustment({
        quest: validQuestFixture,
        winStreak: 5,
        lossStreak: 5,
      }),
    ).toBe(0);
  });

  it("applies no adjustment when adaptive difficulty is disabled", () => {
    expect(
      policy.effectiveAdjustment({
        quest: questWithAdaptiveDifficulty({ enabled: false }),
        winStreak: 5,
        lossStreak: 5,
      }),
    ).toBe(0);
  });

  it("tightens targets after reaching the win streak threshold", () => {
    expect(
      policy.effectiveAdjustment({
        quest: questWithAdaptiveDifficulty(),
        winStreak: 2,
        lossStreak: 0,
      }),
    ).toBe(adaptiveDifficultyStep.tighten(0.1));
  });

  it("relaxes targets after reaching the loss streak threshold", () => {
    expect(
      policy.effectiveAdjustment({
        quest: questWithAdaptiveDifficulty(),
        winStreak: 0,
        lossStreak: 2,
      }),
    ).toBe(adaptiveDifficultyStep.relax(0.1));
  });

  it("relaxes before tightening when both streak thresholds are met", () => {
    expect(
      policy.effectiveAdjustment({
        quest: questWithAdaptiveDifficulty(),
        winStreak: 3,
        lossStreak: 3,
      }),
    ).toBe(adaptiveDifficultyStep.relax(0.1));
  });

  it("ignores tighten/relax when the corresponding flag is off", () => {
    expect(
      policy.effectiveAdjustment({
        quest: questWithAdaptiveDifficulty({
          flags: {
            relaxTargetsOnLoss: false,
            tightenTargetsOnWin: false,
            assistOnStreak: false,
          },
        }),
        winStreak: 5,
        lossStreak: 5,
      }),
    ).toBe(0);
  });
});
