/**
 * Adaptive difficulty engine (task 022).
 *
 * Adjusts quest difficulty from a player's performance feed (quest
 * completions / win outcomes) and the player's current Elo.
 *
 * Elo access goes through the narrow `RatingProvider` seam because the
 * rating service (task 006) is not built yet: the default provider
 * returns `null`, and Elo-based tier selection falls back to the
 * `"unranked"` tier until the seam is wired to the real service.
 */

import type { Quest } from "./questSchema";
import { createEmptyProgress, type CareerProgressRepository } from "./careerProgressRepository";

export type DifficultyTierName = "novice" | "club" | "competitive" | "professional" | "unranked";

export interface DifficultyTierDefinition {
  name: Exclude<DifficultyTierName, "unranked">;
  /** Lowest Elo (inclusive) that belongs to this tier. */
  minElo: number;
}

/** Elo brackets, ascending. The highest bracket whose `minElo` is reached wins. */
export const DIFFICULTY_TIERS: readonly DifficultyTierDefinition[] = [
  { name: "novice", minElo: 0 },
  { name: "club", minElo: 1200 },
  { name: "competitive", minElo: 1500 },
  { name: "professional", minElo: 1800 },
];

/**
 * Narrow seam over the rating service (task 006). Returns the player's
 * current Elo, or `null` when no rating is available.
 */
export interface RatingProvider {
  getElo(userId: string): number | null;
}

/**
 * Default seam implementation used until task 006 lands: always reports
 * "no rating", which degrades tier selection to the `"unranked"` tier.
 */
export function createNullRatingProvider(): RatingProvider {
  return { getElo: () => null };
}

export function selectTierFromElo(elo: number | null): DifficultyTierName {
  if (elo === null) {
    return "unranked";
  }
  let tier = DIFFICULTY_TIERS[0] as DifficultyTierDefinition;
  for (const candidate of DIFFICULTY_TIERS) {
    if (elo >= candidate.minElo) {
      tier = candidate;
    }
  }
  return tier.name;
}

export interface AdaptiveDifficultyEngineDependencies {
  progressRepository: CareerProgressRepository;
  /** Defaults to `createNullRatingProvider()` (see seam note above). */
  ratingProvider?: RatingProvider;
}

export interface AdaptiveDifficultyEngine {
  /**
   * Tier for the player, from their Elo via the rating seam; `"unranked"`
   * when no rating is available.
   */
  resolveDifficultyTier(userId: string): DifficultyTierName;
  /**
   * Feed one quest result: updates the player's win/loss streaks, applies
   * any escalation/de-escalation, and persists the adjustment through the
   * career progress repository. When `event.quest` carries an enabled
   * `adaptiveDifficulty` configuration, its parameters and flags govern
   * the adjustment; otherwise the engine defaults apply.
   */
  recordResult(event: QuestResultEvent): Promise<AdaptiveDifficultyResult>;
}

/** Default escalation/de-escalation thresholds when a quest sets none. */
export const DEFAULT_ADAPTIVE_PARAMETERS = {
  winStreakThreshold: 2,
  lossStreakThreshold: 2,
  targetAdjustmentStep: 0.1,
} as const;

/**
 * Cumulative adjustment clamp magnitude (five steps of 0.1 in each
 * direction) so streaks cannot push targets unboundedly.
 */
export const MAX_ADJUSTMENT = 0.5;

export const DEFAULT_ADAPTIVE_FLAGS = {
  tightenTargetsOnWin: true,
  relaxTargetsOnLoss: true,
} as const;

export type DifficultyAction = "escalated" | "de-escalated" | "unchanged";

export interface QuestResultEvent {
  userId: string;
  won: boolean;
  /** ID of the completed quest, for traceability in logs/callers. */
  questId?: string;
  /**
   * The upcoming quest whose `adaptiveDifficulty` configuration governs
   * the adjustment. Optional: engine defaults apply when absent.
   */
  quest?: Quest;
}

export interface AdaptiveDifficultyResult {
  winStreak: number;
  lossStreak: number;
  /** Cumulative fractional target adjustment after this result. */
  adjustment: number;
  action: DifficultyAction;
  tier: DifficultyTierName;
  /** The Elo retrieved via the rating seam, or null when unavailable. */
  elo: number | null;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function clampAdjustment(value: number): number {
  return Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, value));
}

interface ResolvedAdaptiveConfiguration {
  winStreakThreshold: number;
  lossStreakThreshold: number;
  targetAdjustmentStep: number;
  tightenTargetsOnWin: boolean;
  relaxTargetsOnLoss: boolean;
}

/**
 * A quest with an enabled `adaptiveDifficulty` configuration governs its
 * own parameters and flags; quests without one use the engine defaults.
 */
function resolveAdaptiveConfiguration(quest?: Quest): ResolvedAdaptiveConfiguration {
  const adaptive = quest?.adaptiveDifficulty;
  if (adaptive === undefined || !adaptive.enabled) {
    return {
      ...DEFAULT_ADAPTIVE_PARAMETERS,
      tightenTargetsOnWin: DEFAULT_ADAPTIVE_FLAGS.tightenTargetsOnWin,
      relaxTargetsOnLoss: DEFAULT_ADAPTIVE_FLAGS.relaxTargetsOnLoss,
    };
  }
  return {
    winStreakThreshold: adaptive.parameters.winStreakThreshold,
    lossStreakThreshold: adaptive.parameters.lossStreakThreshold,
    targetAdjustmentStep: adaptive.parameters.targetAdjustmentStep,
    tightenTargetsOnWin: adaptive.flags.tightenTargetsOnWin,
    relaxTargetsOnLoss: adaptive.flags.relaxTargetsOnLoss,
  };
}

export function createAdaptiveDifficultyEngine(
  deps: AdaptiveDifficultyEngineDependencies,
): AdaptiveDifficultyEngine {
  const ratingProvider = deps.ratingProvider ?? createNullRatingProvider();

  return {
    resolveDifficultyTier(userId: string): DifficultyTierName {
      return selectTierFromElo(ratingProvider.getElo(userId));
    },

    async recordResult(event: QuestResultEvent): Promise<AdaptiveDifficultyResult> {
      const progress =
        (await deps.progressRepository.findByUserId(event.userId)) ??
        createEmptyProgress(event.userId);

      const winStreak = event.won ? progress.winStreak + 1 : 0;
      const lossStreak = event.won ? 0 : progress.lossStreak + 1;

      const configuration = resolveAdaptiveConfiguration(event.quest);
      const currentAdjustment = progress.difficultyAdjustment ?? 0;
      let action: DifficultyAction = "unchanged";
      let adjustment = currentAdjustment;
      if (
        event.won &&
        configuration.tightenTargetsOnWin &&
        winStreak >= configuration.winStreakThreshold
      ) {
        action = "escalated";
        adjustment = clampAdjustment(
          round6(currentAdjustment + configuration.targetAdjustmentStep),
        );
      } else if (
        !event.won &&
        configuration.relaxTargetsOnLoss &&
        lossStreak >= configuration.lossStreakThreshold
      ) {
        action = "de-escalated";
        adjustment = clampAdjustment(
          round6(currentAdjustment - configuration.targetAdjustmentStep),
        );
      }

      const elo = ratingProvider.getElo(event.userId);
      const tier = selectTierFromElo(elo);

      progress.winStreak = winStreak;
      progress.lossStreak = lossStreak;
      progress.difficultyAdjustment = adjustment;
      progress.difficultyTier = tier;
      progress.updatedAt = new Date();
      await deps.progressRepository.save(progress);

      return { winStreak, lossStreak, adjustment, action, tier, elo };
    },
  };
}
