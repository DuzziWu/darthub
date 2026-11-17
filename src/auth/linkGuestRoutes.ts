/**
 * App Router route handler for `/api/auth/link-guest`.
 *
 * The handler stays thin: it parses the request, delegates to the auth and
 * guest services, and maps domain errors to HTTP statuses. The handler
 * instance is created with `createLinkGuestRouteHandlers` so tests can wire
 * in-memory repositories instead of a live database — the same pattern the
 * rating API uses in `src/rating/ratingRoutes.ts`.
 *
 * The route creates a real account and then moves the guest's progress onto
 * it. The account is created through `authService.registerUser`, so the
 * password rules of `src/auth/passwordPolicy.ts` apply here as well — the
 * route never writes a user row itself.
 *
 * **The route is rate limited.** It creates an account, so it carries the
 * same limits as the registration — see `src/security/rateLimitPolicies.ts`.
 */

import { NextResponse } from "next/server";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { AUTH_LINK_GUEST_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard, type RateLimiter } from "@/security/rateLimiter";
import type { AuthService } from "./authService";
import {
  EmailAlreadyRegisteredError,
  GuestMigrationError,
  InvalidEmailError,
  InvalidPasswordError,
} from "./errors";
import { isValidEmail, normalizeEmail } from "./email";
import type { GuestService } from "./guest";

export interface LinkGuestRouteHandlerDependencies {
  authService: AuthService;
  guestService: GuestService;
  /**
   * The limiter that guards this route. It defaults to the limiter of the
   * running process; a test injects its own so that it counts only the
   * requests it makes.
   */
  rateLimiter?: RateLimiter;
}

export interface LinkGuestRouteHandlers {
  POST(request: Request): Promise<Response>;
}

interface LinkGuestRequestBody {
  guestId: string;
  migrationToken: string;
  email: string;
  password: string;
  displayName: string;
}

function readBody(value: unknown): LinkGuestRequestBody | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const result = {} as LinkGuestRequestBody;
  for (const key of ["guestId", "migrationToken", "email", "password", "displayName"] as const) {
    const field = source[key];
    if (typeof field !== "string" || field.length === 0) {
      return null;
    }
    result[key] = field;
  }
  return result;
}

export function createLinkGuestRouteHandlers(
  deps: LinkGuestRouteHandlerDependencies,
): LinkGuestRouteHandlers {
  const { authService, guestService } = deps;
  const guard = new RateLimitGuard(
    deps.rateLimiter ?? getDefaultRateLimiter(),
    AUTH_LINK_GUEST_POLICY,
  );

  const POST = async (request: Request): Promise<Response> => {
    // The address limit is counted before the body is read.
    const addressRefusal = await guard.checkAddress(request);
    if (addressRefusal !== null) {
      return addressRefusal;
    }

    let body: LinkGuestRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }

    // The account limit is counted once the body was read. It is counted
    // only for an address that has the accepted shape.
    const accountRefusal = await guard.checkAccount(
      body === null || !isValidEmail(body.email) ? null : normalizeEmail(body.email),
    );
    if (accountRefusal !== null) {
      return accountRefusal;
    }

    if (body === null) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    try {
      // 1. Create the real user account. The service applies the password
      //    rules, so an account is never created with a password the
      //    product would refuse.
      const { user, sessionToken } = await authService.registerUser({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });

      // 2. Migrate the guest data atomically.
      await guestService.migrateGuestToUser({
        guestId: body.guestId,
        migrationToken: body.migrationToken,
        targetUserId: user.id,
      });

      // 3. Return a fresh JWT for the linked account.
      return NextResponse.json({ sessionToken });
    } catch (err) {
      // Map known domain errors to user-friendly HTTP responses. The answer
      // is the same for every one of them, so it cannot be used to find out
      // whether a guest exists.
      if (
        err instanceof GuestMigrationError ||
        err instanceof InvalidEmailError ||
        err instanceof EmailAlreadyRegisteredError ||
        err instanceof InvalidPasswordError
      ) {
        return new NextResponse("Bad Request", { status: 400 });
      }
      // Unexpected errors – propagate as 500.
      console.error(err);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  };

  return { POST };
}
