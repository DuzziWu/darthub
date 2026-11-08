/**
 * Prisma-backed `RatingRepository`.
 *
 * N+1 discipline (structurally enforced):
 * - Per user and mode, single-key lookups (`userId_mode` compound unique).
 * - `getEloRatingsForUser` / `getPerformanceRatingsForUser` read ALL of a
 *   user's rows for every mode in ONE query each.
 * - `getRecentGameStats` folds the whole recent window into exactly two
 *   queries: one indexed session lookup, then ONE `score.aggregate` over
 *   all of that user's rows across the window — never a per-session or
 *   per-row query loop.
 *
 * NOTE (approximation on the settled schema): the settled `Score` table
 * stores one points row per recorded turn. Turns/points come from a single
 * aggregate; checkouts are derived from leg wins (finishing an X01 leg IS
 * the checkout) because per-dart outcome telemetry is out of scope here.
 */

import { GameMode, GameStatus, Prisma, PrismaClient } from "@prisma/client";
import type {
  EloRatingRecord,
  GameStatsSummary,
  PerformanceRatingRecord,
  RatingRepository,
} from "@/rating/ratingRepository";

/** Zero summary for a (userId, mode) pair with no recorded games. */
const zeroSummary = (): GameStatsSummary => ({
  gamesPlayed: 0,
  turns: 0,
  points: 0,
  checkouts: 0,
  checkoutAttempts: 0,
});

const toEloRecord = (row: {
  userId: string;
  mode: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}): EloRatingRecord => ({ ...row });

const toPerformanceRecord = (row: {
  userId: string;
  mode: string;
  averageTurnScore: Prisma.Decimal;
  checkoutPct: Prisma.Decimal;
  gamesPlayed: number;
}): PerformanceRatingRecord => ({
  userId: row.userId,
  mode: row.mode,
  averageTurnScore: Number(row.averageTurnScore),
  checkoutPct: Number(row.checkoutPct),
  gamesPlayed: row.gamesPlayed,
});

export function createPrismaRatingRepository(prisma: PrismaClient): RatingRepository {
  return {
    async getEloRating(userId, mode) {
      const row = await prisma.eloRating.findUnique({
        where: { userId_mode: { userId, mode } },
      });
      return row === null ? null : toEloRecord(row);
    },

    async getEloRatingsForUser(userId) {
      // One query for every mode of this user (batched, index-backed).
      const rows = await prisma.eloRating.findMany({ where: { userId } });
      return rows.map(toEloRecord);
    },

    async saveEloRating(record) {
      const { userId, mode, rating, gamesPlayed, wins, losses } = record;
      const row = await prisma.eloRating.upsert({
        where: { userId_mode: { userId, mode } },
        update: { rating, gamesPlayed, wins, losses },
        create: { userId, mode, rating, gamesPlayed, wins, losses },
      });
      return toEloRecord(row);
    },

    async getPerformanceRating(userId, mode) {
      const row = await prisma.performanceRating.findUnique({
        where: { userId_mode: { userId, mode } },
      });
      return row === null ? null : toPerformanceRecord(row);
    },

    async getPerformanceRatingsForUser(userId) {
      // One query for every mode of this user (batched, index-backed).
      const rows = await prisma.performanceRating.findMany({ where: { userId } });
      return rows.map(toPerformanceRecord);
    },

    async savePerformanceRating(record) {
      const { userId, mode, averageTurnScore, checkoutPct, gamesPlayed } = record;
      const row = await prisma.performanceRating.upsert({
        where: { userId_mode: { userId, mode } },
        update: { averageTurnScore, checkoutPct, gamesPlayed },
        create: { userId, mode, averageTurnScore, checkoutPct, gamesPlayed },
      });
      return toPerformanceRecord(row);
    },

    async getRecentGameStats(userId, mode, limit): Promise<GameStatsSummary> {
      // Rating modes are free strings; only known ones map onto the
      // GameSession GameMode enum. Unknown (test/admin) modes have no
      // session rows by construction.
      const gameMode = mode as GameMode;
      if (!Object.values(GameMode).includes(gameMode)) {
        return zeroSummary();
      }

      // Query 1: the last `limit` finished sessions this user took part in.
      const sessions = await prisma.gameSession.findMany({
        where: {
          mode: gameMode,
          status: GameStatus.FINISHED,
          OR: [{ playerOneId: userId }, { playerTwoId: userId }],
        },
        orderBy: { finishedAt: "desc" },
        take: limit,
        select: { id: true, winnerId: true },
      });
      if (sessions.length === 0) {
        return zeroSummary();
      }

      // Query 2 (and no more): ONE aggregate over every score row of the
      // window's sessions — batched instead of one query per session/row.
      const scores = await prisma.score.aggregate({
        where: { userId, sessionId: { in: sessions.map((session) => session.id) } },
        _sum: { points: true },
        _count: { points: true },
      });

      const wins = sessions.filter((session) => session.winnerId === userId).length;
      return {
        gamesPlayed: sessions.length,
        turns: scores._count.points,
        points: scores._sum.points ?? 0,
        checkouts: wins,
        checkoutAttempts: sessions.length,
      };
    },
  };
}
