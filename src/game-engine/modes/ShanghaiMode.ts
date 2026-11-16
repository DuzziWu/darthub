import type { DartGameMode, MatchState, MutableMatchState, ThrowRecord } from "@/game-engine/types";

/** Number of rounds in a standard Shanghai match. */
export const SHANGHAI_ROUNDS = 7;

/** Darts each player throws per round. */
const DARTS_PER_ROUND = 3;

/** Round N targets number N (1-indexed). */
export function roundTarget(round: number): number {
  return round;
}

/** What one player scored in the round in play. */
export type ShanghaiRoundRecord = {
  /** The marks the player scored in this round so far. */
  marks: number;
  /** Whether the player hit the single of the target. */
  hitSingle: boolean;
  /** Whether the player hit the double of the target. */
  hitDouble: boolean;
  /** Whether the player hit the triple of the target. */
  hitTriple: boolean;
};

/** Mode-owned state for Shanghai. */
export type ShanghaiModeData = {
  /** Index of the current round (0-based, so round 1 = index 0). */
  currentRound: number;
  /** How many darts every player has thrown in the current round. */
  dartsThisRound: Record<string, number>;
  /** Per-player round records for the current round. */
  roundRecords: Record<string, ShanghaiRoundRecord>;
  /** The marks every player scored in every finished round, the first round first. */
  finishedRounds: Record<string, number[]>;
};

/**
 * "Shanghai" dart game.
 *
 * 7 rounds: round N targets number N. Each dart in the round must hit
 * the target to score marks (single=1, double=2, triple=3). If a player
 * hits all three segments (single, double AND triple) of the target in
 * a single round they win immediately ("Shanghai!"). After 7 rounds the
 * player with the most marks wins (draws possible).
 *
 * Every player throws three darts per round, and the round is over when
 * the last player has thrown their third dart. The mode therefore counts
 * the darts of the round per player and keeps what every player scored in
 * every finished round, so a score sheet can show a round table.
 */
export class ShanghaiMode implements DartGameMode {
  readonly id = "shanghai";

  initializeMatch(draft: MutableMatchState): void {
    for (const player of draft.players) {
      player.totalPoints = 0;
    }
    draft.modeData = {
      currentRound: 0,
      dartsThisRound: {},
      roundRecords: {},
      finishedRounds: {},
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

    // Count every dart of this player toward the round.
    data.dartsThisRound[throwRecord.playerId] =
      (data.dartsThisRound[throwRecord.playerId] ?? 0) + 1;

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

      record.marks += marks;
      recordSegmentHit(record, throwRecord.points, target);
      player.totalPoints += marks;

      // Check for Shanghai (all three segments hit in one round).
      if (record.hitSingle && record.hitDouble && record.hitTriple) {
        draft.modeData = structuredClone(data);
        return;
      }
    }

    // The round is over when every player has thrown their three darts.
    const roundComplete = draft.players.every(
      (p) => (data.dartsThisRound[p.id] ?? 0) >= DARTS_PER_ROUND,
    );
    if (roundComplete) {
      // Every player keeps what they scored in the round that just ended —
      // a player who scored nothing keeps a zero.
      for (const p of draft.players) {
        const roundMarks = data.roundRecords[p.id]?.marks ?? 0;
        data.finishedRounds[p.id] = [...(data.finishedRounds[p.id] ?? []), roundMarks];
      }
      data.currentRound += 1;
      data.dartsThisRound = {};
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
  const existing = draft.modeData as Partial<ShanghaiModeData> | undefined;
  if (existing && existing.roundRecords !== undefined) {
    // A state written before the per-player round history existed still
    // replays: the fields it lacks are seeded empty.
    const normalized: ShanghaiModeData = {
      currentRound: existing.currentRound ?? 0,
      dartsThisRound: existing.dartsThisRound ?? {},
      roundRecords: existing.roundRecords,
      finishedRounds: existing.finishedRounds ?? {},
    };
    draft.modeData = normalized;
    return normalized;
  }
  const created: ShanghaiModeData = {
    currentRound: 0,
    dartsThisRound: {},
    roundRecords: {},
    finishedRounds: {},
  };
  draft.modeData = created;
  return created;
}
