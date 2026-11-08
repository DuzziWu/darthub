/**
 * Default runtime for the rating API.
 *
 * Wires the Prisma-backed repository into the rating service. The
 * `PrismaClient` is created lazily (first request), so importing the
 * route modules never needs a database connection, and no connection is
 * made without traffic.
 *
 * The auth gateway defaults to denying everything until task 003
 * (Auth.js under `src/auth`) lands and its middleware replaces the seam —
 * route signatures do not change.
 */

import { PrismaClient } from "@prisma/client";
import { createBearerTokenAuthGateway, type AuthGateway } from "@/rating/authGateway";
import { createPrismaRatingRepository } from "@/rating/prismaRatingRepository";
import { createRatingService, type RatingService } from "@/rating/ratingService";

export interface RatingRuntime {
  ratingService: RatingService;
  authGateway: AuthGateway;
  /** Exposed for health checks / graceful shutdown in later tasks. */
  prisma: PrismaClient;
}

export function createDefaultRatingRuntime(): RatingRuntime {
  const prisma = new PrismaClient();
  const repository = createPrismaRatingRepository(prisma);
  return {
    prisma,
    ratingService: createRatingService({ repository }),
    authGateway: createBearerTokenAuthGateway(),
  };
}

type RatingRuntimeAccessor = {
  get ratingService(): RatingService;
  get authGateway(): AuthGateway;
};

let runtime: RatingRuntime | null = null;

/** Lazily built default runtime; `PrismaClient` construction is deferred. */
export const defaultRatingRuntime: RatingRuntimeAccessor = {
  get ratingService() {
    return (runtime ??= createDefaultRatingRuntime()).ratingService;
  },
  get authGateway() {
    return (runtime ??= createDefaultRatingRuntime()).authGateway;
  },
};
