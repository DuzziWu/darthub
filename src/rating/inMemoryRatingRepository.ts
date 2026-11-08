/**
 * In-memory `RatingRepository`.
 *
 * Stand-in for the Prisma-backed repository: same contract, dictionary
 * storage. Used by tests (and usable in local tooling); keyed on
 * `${userId}:${mode}` so the (userId, mode) semantics of the schema are
 * honoured.
 */

import type {
  EloRatingRecord,
  GameStatsSummary,
  PerformanceRatingRecord,
  RatingRepository,
} from "@/rating/ratingRepository";
import { DEFAULT_RATING_MODE } from "@/rating/ratingRepository";

const recordKey = (userId: string, mode: string): string => `${userId}:${mode}`;

export interface InMemoryRatingRepositoryOptions {
  /** Pre-seeded aggregated game stats, keyed `${userId}:${mode}`. */
  recentGameStats?: Record<string, GameStatsSummary>;
  /** Test hook observing the `limit` requested for recent-game stats. */
  onGetRecentGameStats?: (limit: number) => void;
}

export interface InMemoryRatingRepository extends RatingRepository {
  /** Direct read for test assertions. */
  readonly seedElo: Map<string, EloRatingRecord>;
  readonly seedPerformance: Map<string, PerformanceRatingRecord>;
}

export function createInMemoryRatingRepository(
  options: InMemoryRatingRepositoryOptions = {},
): InMemoryRatingRepository {
  const { recentGameStats = {}, onGetRecentGameStats } = options;
  const elo = new Map<string, EloRatingRecord>();
  const performance = new Map<string, PerformanceRatingRecord>();

  return {
    seedElo: elo,
    seedPerformance: performance,

    async getEloRating(userId, mode = DEFAULT_RATING_MODE): Promise<EloRatingRecord | null> {
      return elo.get(recordKey(userId, mode)) ?? null;
    },

    async getEloRatingsForUser(userId): Promise<readonly EloRatingRecord[]> {
      return [...elo.values()].filter((record) => record.userId === userId);
    },

    async saveEloRating(record): Promise<EloRatingRecord> {
      elo.set(recordKey(record.userId, record.mode), { ...record });
      return { ...record };
    },

    async getPerformanceRating(
      userId,
      mode = DEFAULT_RATING_MODE,
    ): Promise<PerformanceRatingRecord | null> {
      return performance.get(recordKey(userId, mode)) ?? null;
    },

    async getPerformanceRatingsForUser(userId): Promise<readonly PerformanceRatingRecord[]> {
      return [...performance.values()].filter((record) => record.userId === userId);
    },

    async savePerformanceRating(record): Promise<PerformanceRatingRecord> {
      performance.set(recordKey(record.userId, record.mode), { ...record });
      return { ...record };
    },

    async getRecentGameStats(userId, mode, limit): Promise<GameStatsSummary> {
      onGetRecentGameStats?.(limit);
      return (
        recentGameStats[recordKey(userId, mode)] ?? {
          gamesPlayed: 0,
          turns: 0,
          points: 0,
          checkouts: 0,
          checkoutAttempts: 0,
        }
      );
    },
  };
}
