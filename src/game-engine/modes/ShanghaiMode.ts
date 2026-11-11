import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/** Number of rounds in a standard Shanghai match. */
export const SHANGHAI_ROUNDS = 7;

/** Round N targets number N (1-indexed). */
export function roundTarget(round: number): number {
  return round;
}

/** Mode-owned state for Shanghai. */
export type ShanghaiModeData = {
  /** Index of the current round (0-based, so round 1 = index 0). */
  currentRound: number;
  /** Total darts thrown in the current round across all players. */
  totalDartsThisRound: number;
  /** Per-player round records for the current round. */
  roundRecords: Record<
    string,
    {
      marks: number;
      hitSingle: boolean;
      hitDouble: boolean;
      hitTriple: boolean;
    }
  >;
};

/**
 * "Shanghai" dart game.
 *
 * 7 rounds: round N targets number N. Each dart in the round must hit
 * the target to score marks (single=1, double=2, triple=3). If a player
 * hits all three segments (single, double AND triple) of the target in
 * a single round they win immediately ("Shanghai!"). After 7 rounds the
 * player with the most marks wins (draws possible).
 */
export class ShanghaiMode implements DartGameMode {
  readonly id = "shanghai";

  initializeMatch(draft: MutableMatchState): void {
    for (const player of draft.players) {
      player.totalPoints = 0;
    }
    draft.modeData = {
      currentRound: 0,
      totalDartsThisRound: 0,
      roundRecords: {},
    } satisfies ShanghaiModeData;
  }

  applyThrow(draft: MutableMatchState, throwRecord: ThrowRecord): void {
    const data = requireModeData(draft);

    if (data.currentRound >= SHANGHAI_ROUNDS) {
      return;
    }

    const target = roundTarget(data.currentRound + 1);
    const marks = segmentMarks(throwRecord.points, target);

    const player = draft.players.find((p) => p.id === throwRecord.playerId);
    if (!player) {
      return;
    }

    // Count every dart toward the round.
    data.totalDartsThisRound += 1;

    if (marks > 0) {
      // Ensure a record exists for this player in the current round.
      if (!data.roundRecords[throwRecord.playerId]) {
        data.roundRecords[throwRecord.playerId] = {
          marks: 0,
          hitSingle: false,
          hitDouble: false,
          hitTriple: false,
        };
      }
      const record = data.roundRecords[throwRecord.playerId]!;

      recordSegmentHit(record, throwRecord.points, target);
      player.totalPoints += marks;

      // Check for Shanghai (all three segments hit in one round).
      if (record.hitSingle && record.hitDouble && record.hitTriple) {
        draft.modeData = structuredClone(data);
        return;
      }
    }

    // Advance round when all players have completed their 3-dart turns.
    if (data.totalDartsThisRound >= draft.players.length * 3) {
      data.currentRound += 1;
      data.totalDartsThisRound = 0;
      data.roundRecords = {};
    }

    draft.modeData = structuredClone(data);
  }

  isMatchComplete(state: MatchState): boolean {
    const data = state.modeData as ShanghaiModeData | undefined;
    if (!data) {
      return false;
    }
    const hasShanghai = Object.values(data.roundRecords).some(
      (r) => r.hitSingle && r.hitDouble && r.hitTriple,
    );
    if (hasShanghai) {
      return true;
    }
    return data.currentRound >= SHANGHAI_ROUNDS;
  }
}

/** Updates record segment flags based on the thrown points value. */
function recordSegmentHit(
  record: { hitSingle: boolean; hitDouble: boolean; hitTriple: boolean },
  points: number,
  target: number,
): void {
  if (points === target) {
    record.hitSingle = true;
  }
  if (points === 2 * target) {
    record.hitDouble = true;
  }
  if (points === 3 * target) {
    record.hitTriple = true;
  }
}

/** Returns the marks scored by a throw of `points` on target `target`, or 0 if it misses. */
function segmentMarks(points: number, target: number): number {
  if (points === target) {
    return 1;
  }
  if (points === 2 * target) {
    return 2;
  }
  if (points === 3 * target) {
    return 3;
  }
  return 0;
}

function requireModeData(draft: MutableMatchState): ShanghaiModeData {
  const existing = draft.modeData as ShanghaiModeData | undefined;
  if (existing && existing.roundRecords !== undefined) {
    return existing;
  }
  const created: ShanghaiModeData = { currentRound: 0, totalDartsThisRound: 0, roundRecords: {} };
  draft.modeData = created;
  return created;
}
