/**
 * Adaptive difficulty seam for quest unlocking.
 *
 * The default policy maps a player's current win/loss streaks onto the
 * just-unlocked quest's `adaptiveDifficulty` flags: a long-enough losing
 * streak relaxes (eases) objective targets, a long-enough winning streak
 * tightens (hardens) them. Task 022 refines this hook; anything
 * depending on it should go through the `AdaptiveDifficultyPolicy`
 * interface.
 */

import type { Quest } from "./questSchema";

export interface AdaptiveDifficultyContext {
  /** The quest that was just unlocked. */
  quest: Quest;
  /** Player's current consecutive-win count. */
  winStreak: number;
  /** Player's current consecutive-loss count. */
  lossStreak: number;
}

export interface AdaptiveDifficultyPolicy {
  /**
   * The fractional target adjustment to persist for the unlocked quest
   * (negative = easier, positive = harder, 0 = no adjustment).
   */
  effectiveAdjustment(context: AdaptiveDifficultyContext): number;
}

export const adaptiveDifficultyStep = {
  tighten: (targetAdjustmentStep: number): number => targetAdjustmentStep,
  relax: (targetAdjustmentStep: number): number => -targetAdjustmentStep,
};

export function createDefaultAdaptiveDifficultyPolicy(): AdaptiveDifficultyPolicy {
  return {
    effectiveAdjustment({ quest, winStreak, lossStreak }) {
      const adaptive = quest.adaptiveDifficulty;
      if (adaptive === undefined || !adaptive.enabled) {
        return 0;
      }
      const { flags, parameters } = adaptive;
      // Relaxing first: a struggling player is eased before wins tighten.
      if (flags.relaxTargetsOnLoss && lossStreak >= parameters.lossStreakThreshold) {
        return adaptiveDifficultyStep.relax(parameters.targetAdjustmentStep);
      }
      if (flags.tightenTargetsOnWin && winStreak >= parameters.winStreakThreshold) {
        return adaptiveDifficultyStep.tighten(parameters.targetAdjustmentStep);
      }
      return 0;
    },
  };
}
