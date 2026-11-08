/**
 * Performance rating service (casual side of the hybrid rating model).
 *
 * A performance rating is NOT a zero-sum rating: it is the plain rolling
 * stats over the player's recent games in a mode — average points per turn
 * and checkout percentage. Aggregation is delegated to the repository's
 * batched summary (one grouped SQL query per update), so the service never
 * loops over game rows and no N+1 pattern can occur.
 */

import type {
  GameStatsSummary,
  PerformanceRatingRecord,
  RatingRepository,
} from "@/rating/ratingRepository";
import { DEFAULT_RATING_MODE } from "@/rating/ratingRepository";

/** How many recent games feed the rolling performance window. */
export const DEFAULT_PERFORMANCE_WINDOW = 10;

export interface PerformanceStats {
  averageTurnScore: number;
  checkoutPct: number;
  gamesPlayed: number;
}

const roundTo = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Fold a pre-aggregated game summary into performance stats. */
export function computePerformanceStats(summary: GameStatsSummary): PerformanceStats {
  return {
    // Decimal(6,2) storage.
    averageTurnScore: summary.turns === 0 ? 0 : roundTo(summary.points / summary.turns, 2),
    // Decimal(5,4) storage; ratio in [0, 1].
    checkoutPct:
      summary.checkoutAttempts === 0 ? 0 : roundTo(summary.checkouts / summary.checkoutAttempts, 4),
    gamesPlayed: summary.gamesPlayed,
  };
}

export interface PerformanceRatingServiceDependencies {
  repository: RatingRepository;
  windowSize?: number;
}

export interface PerformanceRatingService {
  /**
   * Recompute the (userId, mode) performance rating from the last
   * `windowSize` games and persist it.
   */
  updateFromRecentGames(input: { userId: string; mode?: string }): Promise<PerformanceRatingRecord>;
  /** Read the stored rating, or the new-user default when none exists. */
  getPerformanceRating(input: { userId: string; mode?: string }): Promise<PerformanceRatingRecord>;
}

export function createPerformanceRatingService(
  dependencies: PerformanceRatingServiceDependencies,
): PerformanceRatingService {
  const { repository, windowSize = DEFAULT_PERFORMANCE_WINDOW } = dependencies;

  return {
    async updateFromRecentGames({ userId, mode = DEFAULT_RATING_MODE }) {
      // Single batched aggregate for the whole window (repository contract).
      const summary = await repository.getRecentGameStats(userId, mode, windowSize);
      const record: PerformanceRatingRecord = {
        userId,
        mode,
        ...computePerformanceStats(summary),
      };
      return repository.savePerformanceRating(record);
    },

    async getPerformanceRating({ userId, mode = DEFAULT_RATING_MODE }) {
      const stored = await repository.getPerformanceRating(userId, mode);
      if (stored === null) {
        return { userId, mode, averageTurnScore: 0, checkoutPct: 0, gamesPlayed: 0 };
      }
      return stored;
    },
  };
}
