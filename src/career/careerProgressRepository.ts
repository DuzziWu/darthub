/**
 * Persisted career quest progress for a single user.
 *
 * This record shape is the contract the Prisma `CareerQuestProgress`
 * model (task 002) must satisfy; the in-memory and Prisma repositories
 * both speak in terms of this record.
 */

export interface CareerQuestProgressRecord {
  userId: string;
  /** Quest the player is currently on, or null when all are done. */
  currentQuestId: string | null;
  /** IDs of all quests the player has completed. */
  completedQuestIds: string[];
  /** Player's career level, used for quest unlocking. */
  playerLevel: number;
  /**
   * Fractional adjustment applied to objective targets by the adaptive
   * difficulty policy (negative = easier, positive = harder).
   */
  effectiveTargetAdjustment: number;
  /** Current consecutive-win count (drives adaptive difficulty). */
  winStreak: number;
  /** Current consecutive-loss count (drives adaptive difficulty). */
  lossStreak: number;
  /**
   * Cumulative fractional difficulty adjustment produced by the adaptive
   * difficulty engine (task 022; negative = easier, positive = harder).
   * Additive and optional until the Prisma `CareerQuestProgress` model
   * revision (task 002/005 is in flight) can carry the columns.
   */
  difficultyAdjustment?: number;
  /**
   * Difficulty tier selected by the adaptive difficulty engine for this
   * player (task 022, additive for the same reason as above).
   */
  difficultyTier?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerProgressRepository {
  findByUserId(userId: string): Promise<CareerQuestProgressRecord | null>;
  save(record: CareerQuestProgressRecord): Promise<CareerQuestProgressRecord>;
}

export function createEmptyProgress(userId: string): CareerQuestProgressRecord {
  const now = new Date();
  return {
    userId,
    currentQuestId: null,
    completedQuestIds: [],
    playerLevel: 1,
    effectiveTargetAdjustment: 0,
    winStreak: 0,
    lossStreak: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * In-memory persistence used for tests and as a stand-in until the
 * Prisma `CareerQuestProgress` model lands (task 002).
 */
export function createInMemoryCareerProgressRepository(): CareerProgressRepository & {
  getAll(): CareerQuestProgressRecord[];
} {
  const records = new Map<string, CareerQuestProgressRecord>();

  return {
    async findByUserId(userId) {
      const existing = records.get(userId);
      return existing === undefined ? null : { ...existing };
    },
    async save(record) {
      const stored = {
        ...record,
        completedQuestIds: [...record.completedQuestIds],
      };
      records.set(record.userId, stored);
      return { ...stored, completedQuestIds: [...stored.completedQuestIds] };
    },
    getAll() {
      return [...records.values()];
    },
  };
}
