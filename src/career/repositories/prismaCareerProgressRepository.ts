/**
 * Prisma-backed `CareerProgressRepository` for the `CareerQuestProgress`
 * model landed by task 002.
 *
 * It depends only on a structural delegate type so the module compiles
 * (and is unit-testable with a fake delegate) before Prisma Client
 * generation includes the career-progress model. The later wiring task
 * constructs it with `prisma.careerQuestProgress`.
 *
 * NOTE (task 021): task 002 is still in flight, so the default career
 * runtime uses the in-memory repository; this module is the slot-in
 * replacement. If the landed `CareerQuestProgress` columns differ from
 * `CareerQuestProgressRow`, adapt the row mapping here.
 */

import type {
  CareerProgressRepository,
  CareerQuestProgressRecord,
} from "../careerProgressRepository";

/** Row shape the repository expects from the Prisma model. */
export interface CareerQuestProgressRow {
  userId: string;
  currentQuestId: string | null;
  completedQuestIds: string[];
  playerLevel: number;
  effectiveTargetAdjustment: number;
  winStreak: number;
  lossStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

/** The subset of the generated Prisma client this repository needs. */
export interface PrismaCareerProgressDelegate {
  findUnique(args: { where: { userId: string } }): Promise<CareerQuestProgressRow | null>;
  upsert(args: {
    where: { userId: string };
    create: CareerQuestProgressRow;
    update: CareerQuestProgressRow;
  }): Promise<CareerQuestProgressRow>;
}

function toRecord(row: CareerQuestProgressRow): CareerQuestProgressRecord {
  return {
    userId: row.userId,
    currentQuestId: row.currentQuestId,
    completedQuestIds: [...row.completedQuestIds],
    playerLevel: row.playerLevel,
    effectiveTargetAdjustment: row.effectiveTargetAdjustment,
    winStreak: row.winStreak,
    lossStreak: row.lossStreak,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(record: CareerQuestProgressRecord): CareerQuestProgressRow {
  return {
    userId: record.userId,
    currentQuestId: record.currentQuestId,
    completedQuestIds: [...record.completedQuestIds],
    playerLevel: record.playerLevel,
    effectiveTargetAdjustment: record.effectiveTargetAdjustment,
    winStreak: record.winStreak,
    lossStreak: record.lossStreak,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function createPrismaCareerProgressRepository(
  delegate: PrismaCareerProgressDelegate,
): CareerProgressRepository {
  return {
    async findByUserId(userId: string): Promise<CareerQuestProgressRecord | null> {
      const row = await delegate.findUnique({
        where: { userId },
      });
      return row === null ? null : toRecord(row);
    },

    async save(record: CareerQuestProgressRecord): Promise<CareerQuestProgressRecord> {
      const row = await delegate.upsert({
        where: { userId: record.userId },
        create: toRow(record),
        update: toRow(record),
      });
      return toRecord(row);
    },
  };
}
