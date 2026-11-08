/**
 * Repository contract for the hybrid rating services.
 *
 * Everything the rating services need is expressed over batched results:
 * per-mode rating rows are read with one select per user (never a per-row
 * loop) and recent game stats arrive pre-aggregated (a single grouped /
 * aggregate SQL query in the Prisma implementation), so aggregating a
 * performance rating costs O(1) queries, not O(games).
 */

/** Default rating mode, matching the X01 game mode. */
export const DEFAULT_RATING_MODE = "X01";

export interface EloRatingRecord {
  userId: string;
  mode: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface PerformanceRatingRecord {
  userId: string;
  mode: string;
  /** Mean points per turn, rounded to 2 decimals (Decimal(6,2) storage). */
  averageTurnScore: number;
  /** Successful checkout ratio in [0, 1], 4 decimals (Decimal(5,4) storage). */
  checkoutPct: number;
  gamesPlayed: number;
}

/**
 * Pre-aggregated stats over the recent window of one player's games in one
 * mode. The repository folds the underlying game/score rows into this single
 * summary with grouped queries, so the service never iterates game rows.
 */
export interface GameStatsSummary {
  /** Number of finished games folded into this summary. */
  gamesPlayed: number;
  /** Total turns (three-dart rounds) taken across those games. */
  turns: number;
  /** Total points scored across those turns. */
  points: number;
  /** Checkouts successfully landed. */
  checkouts: number;
  /** Turns in which a checkout was the goal (i.e. leg-ending chances). */
  checkoutAttempts: number;
}

export interface RatingRepository {
  /** Single-mode Elo row, or null when the user has not played this mode. */
  getEloRating(userId: string, mode: string): Promise<EloRatingRecord | null>;
  /** All of one user's Elo rows (every mode) in a single query. */
  getEloRatingsForUser(userId: string): Promise<readonly EloRatingRecord[]>;
  /** Upsert of one (userId, mode) Elo row. */
  saveEloRating(record: EloRatingRecord): Promise<EloRatingRecord>;
  /** Single-mode performance row, or null for a new (user, mode) pair. */
  getPerformanceRating(userId: string, mode: string): Promise<PerformanceRatingRecord | null>;
  /** All of one user's performance rows (every mode) in a single query. */
  getPerformanceRatingsForUser(userId: string): Promise<readonly PerformanceRatingRecord[]>;
  /** Upsert of one (userId, mode) performance row. */
  savePerformanceRating(record: PerformanceRatingRecord): Promise<PerformanceRatingRecord>;
  /**
   * Aggregated stats for the last `limit` games of (userId, mode).
   * Implementations MUST batch this into a single grouped/aggregate query.
   */
  getRecentGameStats(userId: string, mode: string, limit: number): Promise<GameStatsSummary>;
}
