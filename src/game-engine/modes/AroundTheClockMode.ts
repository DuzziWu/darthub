import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/** Targets in order: 1-20 then bullseye (25). */
export const AROUND_THE_CLOCK_TARGETS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

/** Mode-owned state: the shared target index and per-player progress. */
export type AroundTheClockModeData = {
  currentTargetIndex: number;
  /** Per-player: how many targets this player has personally hit. */
  playerProgress: Record<string, number>;
};

/**
 * "Around the Clock" dart game.
 *
 * Players must hit every target in order from 1 to 20 and then the
 * bullseye (25). A dart scores only when it lands on the current target
 * (single, double or triple all count as one hit). Missing the current
 * target does not advance progress. The player who hits all 21 targets
 * first wins the match.
 */
export class AroundTheClockMode implements DartGameMode {
  readonly id = "around-the-clock";

  initializeMatch(draft: MutableMatchState): void {
    for (const player of draft.players) {
      player.totalPoints = 0;
    }
    draft.modeData = {
      currentTargetIndex: 0,
      playerProgress: {},
    } satisfies AroundTheClockModeData;
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const data = requireModeData(draft);
    if (data.currentTargetIndex >= AROUND_THE_CLOCK_TARGETS.length) {
      return;
    }

    const target = AROUND_THE_CLOCK_TARGETS[data.currentTargetIndex]!;

    if (!hitsTarget(throwRecord.points, target)) {
      return;
    }

    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (!player) {
      return;
    }

    // Record this player's personal progress.
    data.playerProgress[throwRecord.playerId] = data.currentTargetIndex + 1;
    player.totalPoints = data.currentTargetIndex + 1;

    data.currentTargetIndex += 1;
    draft.modeData = structuredClone(data);
  }

  isMatchComplete(state: MatchState): boolean {
    const data = state.modeData as AroundTheClockModeData | undefined;
    return (data?.currentTargetIndex ?? 0) >= AROUND_THE_CLOCK_TARGETS.length;
  }
}

/**
 * Returns true when the thrown points count as hitting the given target
 * number for Around the Clock purposes. Doubles and triples of the target
 * also count. For the bullseye (25), both 25 and 50 (double bull) count.
 */
function hitsTarget(points: number, target: number): boolean {
  if (points === target) {
    return true;
  }
  if (points === 2 * target) {
    return true;
  }
  if (points === 3 * target) {
    return true;
  }
  return false;
}

function requireModeData(draft: MutableMatchState): AroundTheClockModeData {
  const existing = draft.modeData as AroundTheClockModeData | undefined;
  if (existing && typeof existing.currentTargetIndex === "number" && existing.playerProgress) {
    return existing;
  }
  const created: AroundTheClockModeData = { currentTargetIndex: 0, playerProgress: {} };
  draft.modeData = created;
  return created;
}
