import { describe, expect, it } from "vitest";
import { DEFAULT_RATING } from "@/rating/eloService";
import { createRatingService } from "@/rating/ratingService";
import { createInMemoryRatingRepository } from "@/rating/inMemoryRatingRepository";
import type { RatingRepository } from "@/rating/ratingRepository";

function buildRepository() {
  return createInMemoryRatingRepository({
    recentGameStats: {
      "winner:X01": {
        gamesPlayed: 1,
        turns: 21,
        points: 501,
        checkouts: 1,
        checkoutAttempts: 2,
      },
      "loser:X01": {
        gamesPlayed: 1,
        turns: 25,
        points: 438,
        checkouts: 0,
        checkoutAttempts: 2,
      },
    },
  });
}

/** Repository wrapped with save spies so persistence can be observed. */
function buildSpyRepository() {
  const original = buildRepository();
  const savedEloUserIds: string[] = [];
  const savedPerformanceUserIds: string[] = [];
  const saveElo = original.saveEloRating.bind(original);
  const savePerformance = original.savePerformanceRating.bind(original);
  const repository: RatingRepository = {
    ...original,
    async saveEloRating(record) {
      savedEloUserIds.push(`${record.userId}:${record.mode}`);
      return saveElo(record);
    },
    async savePerformanceRating(record) {
      savedPerformanceUserIds.push(`${record.userId}:${record.mode}`);
      return savePerformance(record);
    },
  };
  return { repository, savedEloUserIds, savedPerformanceUserIds };
}

describe("ratingService", () => {
  it("stores both ratings separately for a user", async () => {
    const repository = buildRepository();
    const service = createRatingService({ repository });

    await service.recordGameResult({
      winner: { kind: "user", userId: "winner" },
      loser: { kind: "user", userId: "loser" },
      mode: "X01",
    });

    // Elo rating: its own collection, its own semantics.
    const elo = await repository.getEloRatingsForUser("winner");
    expect(elo).toHaveLength(1);
    expect(elo[0]).toMatchObject({
      userId: "winner",
      mode: "X01",
      rating: 1016,
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
    });

    // Performance rating: a separate row from the Elo row, holding game
    // statistics rather than a rating number.
    const performance = await repository.getPerformanceRatingsForUser("winner");
    expect(performance).toHaveLength(1);
    expect(performance[0]).toMatchObject({
      userId: "winner",
      mode: "X01",
      // 501 points over 21 turns -> 23.86, stored at Decimal(6,2) precision.
      averageTurnScore: 23.86,
      checkoutPct: 0.5,
    });
    expect((performance[0] as { rating?: number }).rating).toBeUndefined();
  });

  it("keeps ratings for different game modes in separate rows", async () => {
    const repository = buildRepository();
    const service = createRatingService({ repository });

    await service.recordGameResult({
      winner: { kind: "user", userId: "winner" },
      loser: { kind: "user", userId: "loser" },
      mode: "X01",
    });
    await service.recordGameResult({
      winner: { kind: "user", userId: "winner" },
      loser: { kind: "user", userId: "loser" },
      mode: "CRICKET",
    });

    const elo = await repository.getEloRatingsForUser("winner");
    expect(elo.map((row) => row.mode).sort()).toEqual(["CRICKET", "X01"]);
    // The X01 row also keeps its own progression: only one game there.
    expect(elo.find((row) => row.mode === "X01")?.wins).toBe(1);
  });

  it("starts a new user at the baseline default values", async () => {
    const repository = buildRepository();
    const service = createRatingService({ repository });

    const profile = await service.getRatingProfile({
      actor: { kind: "user", userId: "brand-new" },
      mode: "X01",
    });

    expect(profile.elo).toMatchObject({
      userId: "brand-new",
      mode: "X01",
      rating: DEFAULT_RATING,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    });
    expect(profile.performance).toMatchObject({
      userId: "brand-new",
      mode: "X01",
      averageTurnScore: 0,
      checkoutPct: 0,
      gamesPlayed: 0,
    });
  });

  it("does not affect guest ratings until migration", async () => {
    const { repository, savedEloUserIds, savedPerformanceUserIds } = buildSpyRepository();
    const service = createRatingService({ repository });

    // A guest-vs-guest game: computed, but never persisted.
    await service.recordGameResult({
      winner: { kind: "guest", guestId: "guest-1" },
      loser: { kind: "guest", guestId: "guest-2" },
      mode: "X01",
    });

    expect(await repository.getEloRatingsForUser("guest-1")).toEqual([]);
    expect(await repository.getPerformanceRatingsForUser("guest-1")).toEqual([]);
    expect(await repository.getEloRatingsForUser("guest-2")).toEqual([]);
    expect(savedEloUserIds).toEqual([]);
    expect(savedPerformanceUserIds).toEqual([]);

    // The guests' provisional ratings live in memory on the service
    // instance only: they update per game but vanish with it.
    const winningGuest = await service.getRatingProfile({
      actor: { kind: "guest", guestId: "guest-1" },
      mode: "X01",
    });
    expect(winningGuest.elo).toMatchObject({ rating: 1016, wins: 1, gamesPlayed: 1 });

    // A mixed game: the registered side is persisted, the guest side is not.
    await service.recordGameResult({
      winner: { kind: "user", userId: "member" },
      loser: { kind: "guest", guestId: "guest-2" },
      mode: "X01",
    });
    expect(savedEloUserIds).toEqual(["member:X01"]);
    expect(savedPerformanceUserIds).toEqual(["member:X01"]);
    // The member is rated against the guest's provisional pre-game rating.
    const member = await service.getRatingProfile({ actor: { kind: "user", userId: "member" } });
    expect(member.elo.rating).toBe(1015);
    expect(await repository.getEloRatingsForUser("guest-2")).toEqual([]);
  });
});
