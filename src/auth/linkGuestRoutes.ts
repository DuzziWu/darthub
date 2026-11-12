/**
 * App Router route handler for `/api/auth/link-guest`.
 *
 * The handler stays thin: it parses the request, delegates to the auth and
 * guest services, and maps domain errors to HTTP statuses. The handler
 * instance is created with `createLinkGuestRouteHandlers` so tests can wire
 * in-memory repositories instead of a live database — the same pattern the
 * rating API uses in `src/rating/ratingRoutes.ts`.
 */

import { NextResponse } from "next/server";
import type { AuthService } from "./authService";
import { EmailAlreadyRegisteredError, GuestMigrationError, InvalidEmailError } from "./errors";
import type { GuestService } from "./guest";

export interface LinkGuestRouteHandlerDependencies {
  authService: AuthService;
  guestService: GuestService;
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

  const POST = async (request: Request): Promise<Response> => {
    let body: LinkGuestRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }
    if (body === null) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    try {
      // 1. Create the real user account.
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
      // Map known domain errors to user-friendly HTTP responses.
      if (
        err instanceof GuestMigrationError ||
        err instanceof InvalidEmailError ||
        err instanceof EmailAlreadyRegisteredError
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
