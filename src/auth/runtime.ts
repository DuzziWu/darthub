/** Default runtime for the auth API. Mirrors `src/rating/ratingRuntime.ts`:
 * the `PrismaClient` is created lazily (first request), so importing route
 * modules never needs a database connection. Tests inject an in-memory
 * repository into `createAuthService` / `createGuestService` directly. */

import { PrismaClient } from "@prisma/client";
import { createAuthService, type AuthService } from "./authService";
import { createGuestService, type GuestService } from "./guest";
import { createPrismaAuthRepository } from "./prismaAuthRepository";
import { requireAuth } from "./requireAuth";

export interface AuthRuntime {
  authService: AuthService;
  guestService: GuestService;
  /** The middleware seam consumed by API route handlers (016/021/023). */
  requireAuth: typeof requireAuth;
}

let runtime: AuthRuntime | null = null;

function createDefaultAuthRuntime(): AuthRuntime {
  const prisma = new PrismaClient();
  const repository = createPrismaAuthRepository(prisma);
  return {
    authService: createAuthService({ repository }),
    guestService: createGuestService({ repository }),
    requireAuth,
  };
}

type AuthRuntimeAccessor = {
  get authService(): AuthService;
  get guestService(): GuestService;
  get requireAuth(): typeof requireAuth;
};

/** Lazily built default runtime; resolves services on first access. */
export const defaultAuthRuntime: AuthRuntimeAccessor = {
  get authService() {
    return (runtime ??= createDefaultAuthRuntime()).authService;
  },
  get guestService() {
    return (runtime ??= createDefaultAuthRuntime()).guestService;
  },
  get requireAuth() {
    return (runtime ??= createDefaultAuthRuntime()).requireAuth;
  },
};
