/**
 * Elo rating math for competitive (X01) play.
 *
 * Standard Elo: expected score on the logistic curve
 * `E = 1 / (1 + 10^((ratingOpponent - rating) / 400))`, rating change
 * `delta = K * (actual - expected)`, rounded to whole points.
 *
 * Edge cases:
 * - Ratings are clamped to [MIN_RATING, MAX_RATING] so no input (legacy
 *   import data, runaway K factors) can push a rating out of sane bounds.
 * - A win and the mirrored loss always produce exact negative deltas
 *   (rounded symmetrically), so paired games conserve rating points.
 */

export const DEFAULT_K_FACTOR = 32;
export const DEFAULT_RATING = 1000;
export const MIN_RATING = 100;
/** Comfortably above any reachable rating; guards against runaway deltas. */
export const MAX_RATING = 4000;

export type GameResult = "win" | "loss";

export interface EloChangeInput {
  /** The acting player's current rating. */
  rating: number;
  /** The opponent's current rating. */
  opponentRating: number;
  /** Whether the acting player won or lost. */
  result: GameResult;
  /** Elo K-factor; standard default of 32. */
  kFactor?: number;
  /** Optional custom clamp bounds; defaults to the module constants. */
  minRating?: number;
  maxRating?: number;
}

export interface EloChangeResult {
  /** New integer rating after the update (clamped to bounds). */
  newRating: number;
  /** Signed integer delta actually applied (`newRating - rating`, clamped). */
  change: number;
  /** Expected score of this player before the game, in [0, 1]. */
  expectedScore: number;
}

/** Expected score of `ratingA` against `ratingB`, in [0, 1]. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** Clamp `rating` into [minRating, maxRating]. */
export function clampRating(rating: number, minRating: number, maxRating: number): number {
  return Math.min(maxRating, Math.max(minRating, rating));
}

/** Compute a single player's Elo change for one game result. */
export function computeEloChange(input: EloChangeInput): EloChangeResult {
  const {
    rating,
    opponentRating,
    result,
    kFactor = DEFAULT_K_FACTOR,
    minRating = MIN_RATING,
    maxRating = MAX_RATING,
  } = input;

  const expected = expectedScore(rating, opponentRating);
  const actual = result === "win" ? 1 : 0;
  const rawNewRating = rating + kFactor * (actual - expected);
  const newRating = Math.round(clampRating(rawNewRating, minRating, maxRating));
  return { newRating, change: newRating - rating, expectedScore: expected };
}
