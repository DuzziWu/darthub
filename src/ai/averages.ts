/**
 * The 3-dart averages an AI opponent can be set to.
 *
 * The average is the *long-term* strength of a player, not a fixed score
 * per visit: the AI must reach its average over many visits, never hit it
 * exactly once. The levels below are the settings the player chooses
 * between; the profile behind each level — the spread and the target
 * weights — is calibrated separately.
 *
 * The values are the ones the 501 specification names. They live here, in
 * the AI module, because they describe the AI and not the form that offers
 * them.
 */

/** The averages an AI opponent can be set to. */
export const AI_AVERAGE_LEVELS = [25, 40, 55, 70, 85] as const;

/** One of the settable averages. */
export type AiAverageLevel = (typeof AI_AVERAGE_LEVELS)[number];

/**
 * The average an AI seat starts with.
 *
 * A middle level: an opponent nobody configured should neither be a
 * pushover nor a wall.
 */
export const DEFAULT_AI_AVERAGE: AiAverageLevel = 40;

/** True when `value` is one of the settable averages. */
export function isAiAverageLevel(value: number): value is AiAverageLevel {
  return (AI_AVERAGE_LEVELS as readonly number[]).includes(value);
}
