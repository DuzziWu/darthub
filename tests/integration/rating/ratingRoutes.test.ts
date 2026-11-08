import { describe, expect, it } from "vitest";
import { createBearerTokenAuthGateway } from "@/rating/authGateway";
import { createInMemoryRatingRepository } from "@/rating/inMemoryRatingRepository";
import { createRatingRouteHandlers } from "@/rating/ratingRoutes";
import { createRatingService } from "@/rating/ratingService";

function buildHandlers() {
  const repository = createInMemoryRatingRepository({
    recentGameStats: {
      "user-1:X01": { gamesPlayed: 1, turns: 21, points: 501, checkouts: 1, checkoutAttempts: 2 },
      "user-2:X01": { gamesPlayed: 1, turns: 25, points: 438, checkouts: 0, checkoutAttempts: 2 },
    },
  });
  const ratingService = createRatingService({ repository });
  const handlers = createRatingRouteHandlers({
    ratingService,
    authGateway: createBearerTokenAuthGateway(async (token) =>
      token === "known-token" ? "user-1" : null,
    ),
  });
  return { repository, ratingService, handlers };
}

function getRequest(userId: string, token?: string, query = ""): Request {
  const url = `http://localhost/api/rating/${userId}${query}`;
  return new Request(url, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

function params(userId: string): { params: Promise<{ userId: string }> } {
  // Next.js App Router 16 hands route params over as a promise.
  return { params: Promise.resolve({ userId }) };
}

describe("GET /api/rating/:userId", () => {
  it("returns both ratings in the GET /api/rating/:userId endpoint", async () => {
    const { ratingService, handlers } = buildHandlers();
    await ratingService.recordGameResult({
      winner: { kind: "user", userId: "user-1" },
      loser: { kind: "user", userId: "user-2" },
      mode: "X01",
    });

    const unauthenticated = await handlers.GET(getRequest("user-1"), params("user-1"));
    expect(unauthenticated.status).toBe(401);

    const response = await handlers.GET(getRequest("user-1", "known-token"), params("user-1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const payload = (await response.json()) as {
      userId: string;
      mode: string;
      elo: { rating: number; gamesPlayed: number; wins: number; losses: number };
      performance: { averageTurnScore: number; checkoutPct: number; gamesPlayed: number };
    };
    expect(payload.userId).toBe("user-1");
    expect(payload.mode).toBe("X01");
    expect(payload.elo).toMatchObject({ rating: 1016, gamesPlayed: 1, wins: 1, losses: 0 });
    expect(payload.performance).toMatchObject({
      averageTurnScore: 23.86,
      checkoutPct: 0.5,
      gamesPlayed: 1,
    });
  });

  it("serves the baseline defaults for a user without any recorded games", async () => {
    const { handlers } = buildHandlers();

    const response = await handlers.GET(getRequest("user-9", "known-token"), params("user-9"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      elo: { rating: number };
      performance: { averageTurnScore: number };
    };
    expect(payload.elo.rating).toBe(1000);
    expect(payload.performance.averageTurnScore).toBe(0);
  });

  it("respects the requested game mode from the query string", async () => {
    const { ratingService, handlers } = buildHandlers();
    await ratingService.recordGameResult({
      winner: { kind: "user", userId: "user-1" },
      loser: { kind: "user", userId: "user-2" },
      mode: "CRICKET",
    });

    const response = await handlers.GET(
      getRequest("user-1", "known-token", "?mode=CRICKET"),
      params("user-1"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { mode: string; elo: { wins: number } };
    expect(payload.mode).toBe("CRICKET");
    expect(payload.elo.wins).toBe(1);
  });

  it("returns 400 when the user id parameter is missing", async () => {
    const { handlers } = buildHandlers();

    const response = await handlers.GET(getRequest("*", "known-token"), {
      params: Promise.resolve({ userId: " " }),
    });
    expect(response.status).toBe(400);
  });
});

function postRequest(body: unknown, token?: string, mode?: string): Request {
  const url = `http://localhost/api/rating/game${mode === undefined ? "" : `?mode=${mode}`}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rating/game", () => {
  it("applies the Elo and performance updates for both participants", async () => {
    const { ratingService, handlers } = buildHandlers();

    const unauthenticated = await handlers.POST(postRequest({}));
    expect(unauthenticated.status).toBe(401);

    const response = await handlers.POST(
      postRequest({ winnerId: "user-1", loserId: "user-2" }, "known-token"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      winner: { elo: { rating: number; wins: number }; performance: { gamesPlayed: number } };
      loser: { elo: { rating: number; losses: number } };
    };
    expect(payload.winner.elo).toMatchObject({ rating: 1016, wins: 1 });
    expect(payload.winner.performance.gamesPlayed).toBe(1);
    expect(payload.loser.elo).toMatchObject({ rating: 984, losses: 1 });

    // The updates are persisted in the underlying repository.
    const winner = await ratingService.getRatingProfile({
      actor: { kind: "user", userId: "user-1" },
    });
    expect(winner.elo.rating).toBe(1016);
  });

  it("rejects a malformed POST body and honours the mode query", async () => {
    const { handlers } = buildHandlers();

    const malformed = await handlers.POST(postRequest({ wrong: "shape" }, "known-token"));
    expect(malformed.status).toBe(400);

    const withMode = await handlers.POST(
      postRequest({ winnerId: "user-1", loserId: "user-2" }, "known-token", "CRICKET"),
    );
    expect(withMode.status).toBe(200);
    const payload = (await withMode.json()) as { winner: { elo: { mode: string } } };
    expect(payload.winner.elo.mode).toBe("CRICKET");
  });
});
