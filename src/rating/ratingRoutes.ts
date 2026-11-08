/**
 * App Router route handlers for the rating API (`/api/rating/*`).
 *
 * Handlers stay thin: they authenticate via the `AuthGateway` seam, then
 * delegate to the rating service. Handler instances are created with
 * `createRatingRouteHandlers` so tests can wire a fake gateway and an
 * in-memory repository.
 *
 * Endpoints:
 * - `GET /api/rating/:userId`            -> both ratings for one user (and
 *   their per-mode rows when no explicit `mode` query is given).
 * - `POST /api/rating/game`              -> applies an Elo + performance
 *   update after a recorded game.
 */

import type { AuthGateway } from "@/rating/authGateway";
import { DEFAULT_RATING_MODE } from "@/rating/ratingRepository";
import type { RatingService } from "@/rating/ratingService";

export interface RatingRouteHandlerDependencies {
  ratingService: RatingService;
  authGateway: AuthGateway;
}

export interface RatingRouteHandlers {
  GET(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

const noStore = { headers: { "cache-control": "no-store" } } as const;
const unauthorized = (): Response => Response.json({ error: "Unauthorized" }, { status: 401 });

function readBody<T extends object>(body: unknown, keys: readonly (keyof T & string)[]) {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const source = body as Record<string, unknown>;
  const result = {} as T;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string" || value.length === 0) {
      return null;
    }
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

export function createRatingRouteHandlers(
  deps: RatingRouteHandlerDependencies,
): RatingRouteHandlers {
  const { ratingService, authGateway } = deps;

  const GET = async (
    request: Request,
    context: { params: Promise<{ userId: string }> },
  ): Promise<Response> => {
    const user = await authGateway.getCurrentUser(request);
    if (user === null) {
      return unauthorized();
    }

    const { userId } = await context.params;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      return Response.json({ error: '"userId" path parameter is required' }, { status: 400 });
    }

    const requestedMode = new URL(request.url).searchParams.get("mode");
    const mode = requestedMode === null ? null : requestedMode.trim();

    if (mode === null) {
      // No explicit mode: answer with the default-mode profile plus the
      // user's per-mode rows (two batched reads, no per-mode queries).
      const [profile, perMode] = await Promise.all([
        ratingService.getRatingProfile({ actor: { kind: "user", userId } }),
        ratingService.listRatingProfiles(userId),
      ]);
      return Response.json({ userId, mode: DEFAULT_RATING_MODE, ...profile, perMode }, noStore);
    }

    const profile = await ratingService.getRatingProfile({
      actor: { kind: "user", userId },
      mode,
    });
    return Response.json({ userId, mode, ...profile }, noStore);
  };

  const POST = async (request: Request): Promise<Response> => {
    const user = await authGateway.getCurrentUser(request);
    if (user === null) {
      return unauthorized();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = readBody<{ winnerId: string; loserId: string; mode?: string }>(body, [
      "winnerId",
      "loserId",
    ]);
    if (parsed === null) {
      return Response.json(
        { error: '"winnerId" and "loserId" (strings) are required' },
        { status: 400 },
      );
    }

    const mode = new URL(request.url).searchParams.get("mode") ?? parsed.mode;
    const result = await ratingService.recordGameResult({
      winner: { kind: "user", userId: parsed.winnerId },
      loser: { kind: "user", userId: parsed.loserId },
      mode: mode === null ? undefined : mode,
    });
    return Response.json({ recordedBy: user, winner: result.winner, loser: result.loser }, noStore);
  };

  return { GET, POST };
}
