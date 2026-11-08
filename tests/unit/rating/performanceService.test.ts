import { describe, expect, it } from "vitest";
import {
  computePerformanceStats,
  createPerformanceRatingService,
} from "@/rating/performanceService";
import { createInMemoryRatingRepository } from "@/rating/inMemoryRatingRepository";
import type { GameStatsSummary } from "@/rating/ratingRepository";

const summary: GameStatsSummary = {
  gamesPlayed: 10,
  turns: 120,
  points: 1440,
  checkouts: 9,
  checkoutAttempts: 10,
};

describe("PerformanceRating", () => {
  it("updates PerformanceRating based on recent game stats", async () => {
    const repository = createInMemoryRatingRepository({
      recentGameStats: { "player-1:X01": summary },
    });
    const service = createPerformanceRatingService({ repository });

    const record = await service.updateFromRecentGames({ userId: "player-1", mode: "X01" });

    // 1440 points over 120 turns -> 12.00 average per turn.
    expect(record.averageTurnScore).toBe(12);
    // 9 of 10 checkout attempts landed -> 0.9.
    expect(record.checkoutPct).toBe(0.9);
    expect(record.gamesPlayed).toBe(10);
    expect(record.userId).toBe("player-1");
    expect(record.mode).toBe("X01");

    // The value is persisted in the repository, so reading it back shows
    // the updated stats instead of a new-user default.
    const stored = await service.getPerformanceRating({ userId: "player-1", mode: "X01" });
    expect(stored.averageTurnScore).toBe(12);
    expect(stored.checkoutPct).toBe(0.9);
  });

  it("aggregates the last N games in a single batched summary (no per-game queries)", async () => {
    const requestedLimits: number[] = [];
    const repository = createInMemoryRatingRepository({
      recentGameStats: { "player-1:X01": summary },
      onGetRecentGameStats: (limit) => requestedLimits.push(limit),
    });
    const service = createPerformanceRatingService({ repository, windowSize: 10 });

    await service.updateFromRecentGames({ userId: "player-1", mode: "X01" });

    expect(requestedLimits).toEqual([10]);
  });

  it("returns default zeroes for a new user without any game stats", async () => {
    const repository = createInMemoryRatingRepository();
    const service = createPerformanceRatingService({ repository });

    const record = await service.getPerformanceRating({ userId: "new-player", mode: "X01" });

    expect(record).toEqual({
      userId: "new-player",
      mode: "X01",
      averageTurnScore: 0,
      checkoutPct: 0,
      gamesPlayed: 0,
    });
  });

  it("avoids division by zero when no turns or checkout attempts were recorded", () => {
    expect(
      computePerformanceStats({
        gamesPlayed: 1,
        turns: 0,
        points: 0,
        checkouts: 0,
        checkoutAttempts: 0,
      }),
    ).toEqual({
      averageTurnScore: 0,
      checkoutPct: 0,
      gamesPlayed: 1,
    });
  });

  it("rounds stored values to the database decimal precision", () => {
    // 1003 points over 7 turns = 143.2857... -> 143.29 (Decimal(6,2) storage).
    const stats = computePerformanceStats({
      gamesPlayed: 1,
      turns: 7,
      points: 1003,
      checkouts: 2,
      checkoutAttempts: 3,
    });
    expect(stats.averageTurnScore).toBe(143.29);
    // 2 / 3 = 0.66666... -> 0.6667 (Decimal(5,4) storage).
    expect(stats.checkoutPct).toBe(0.6667);
  });
});
