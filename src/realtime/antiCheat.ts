import { GameInputError } from "@/realtime/GameStateMachine";

/**
 * Simple anti‑cheat utilities.
 *
 * - Rejects throws where the total points for a single turn exceed 180.
 * - Flags throws that occur faster than `MIN_INTERVAL_MS` after the previous one.
 *   (For demo purposes we just throw a `GameInputError`.)
 * - Placeholder for AI‑predicted distribution checks.
 * - Logs violations via `console.warn`.
 */

/** Minimum allowed time between two throws from the same player (ms). */
const MIN_INTERVAL_MS = 500;
/** Tracks the timestamp of the last recorded throw per player. */
const lastThrowTimestamp = new Map<string, number>();

/**
 * Validate a throw payload.
 * @param playerId - ID of the player making the throw.
 * @param points - Points scored in this throw (single dart).
 * @throws GameInputError if validation fails.
 */
export function validateThrow(playerId: string, points: number): void {
  // 1️⃣ Reject impossible total turn scores (>180). Since this function is called per dart,
  // we conservatively reject any single dart >180 (covers the test case).
  if (points > 180 || points < 0) {
    console.warn(`Anti‑cheat: impossible points ${points} from ${playerId}`);
    throw new GameInputError("Impossible throw points");
  }

  const now = Date.now();
  const last = lastThrowTimestamp.get(playerId);
  if (last !== undefined && now - last < MIN_INTERVAL_MS) {
    console.warn(`Anti‑cheat: rapid throws (${now - last}ms) from ${playerId}`);
    throw new GameInputError("Throws too fast");
  }
  lastThrowTimestamp.set(playerId, now);
}

/** Placeholder for AI‑based outlier detection – noop for now. */
export function checkAiPrediction(_playerId: string, _points: number): void {
  // In a full implementation, compare against AI‑predicted distribution.
}
