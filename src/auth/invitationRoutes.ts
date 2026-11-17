/**
 * App Router route handler for `/api/auth/invitation`.
 *
 * The handler stays thin, like every other auth route: it parses the
 * request, delegates to the auth service and maps domain errors to HTTP
 * statuses. The handler instance is created with
 * `createInvitationRouteHandlers` so tests can wire an in-memory repository
 * instead of a live database — the same pattern the registration route uses
 * in `src/auth/registerRoutes.ts`.
 *
 * **The answer never carries the password hash.** The route used to answer
 * with the whole user row the service returned, and that row has a
 * `passwordHash` field — the bcrypt hash of the password went out over the
 * wire. The fields the client may see are listed in one place,
 * `src/auth/publicUser.ts`, and the answer is built from that list alone.
 *
 * **The route is rate limited.** Minting a code and spending it are both
 * counted, so the invitation flow cannot be used to create accounts in bulk
 * — see `src/security/rateLimitPolicies.ts`.
 */

import { NextResponse } from "next/server";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { AUTH_INVITATION_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard, type RateLimiter } from "@/security/rateLimiter";
import type { AuthService } from "./authService";
import { isValidEmail, normalizeEmail } from "./email";
import { consumeInvitationCode, generateInvitationCode } from "./invitationStore";
import { toPublicUser } from "./publicUser";

export interface InvitationRouteHandlerDependencies {
  authService: AuthService;
  /**
   * The limiter that guards this route. It defaults to the limiter of the
   * running process; a test injects its own so that it counts only the
   * requests it makes.
   */
  rateLimiter?: RateLimiter;
}

export interface InvitationRouteHandlers {
  POST(request: Request): Promise<Response>;
}

/** The body the route accepts. */
interface InvitationRequestBody {
  action?: string;
  code?: string;
  email?: string;
  password?: string;
  displayName?: string;
}

export function createInvitationRouteHandlers(
  deps: InvitationRouteHandlerDependencies,
): InvitationRouteHandlers {
  const { authService } = deps;
  const guard = new RateLimitGuard(
    deps.rateLimiter ?? getDefaultRateLimiter(),
    AUTH_INVITATION_POLICY,
  );

  const POST = async (request: Request): Promise<Response> => {
    // The address limit is counted before the body is read: a request with
    // a broken body is a request too.
    const addressRefusal = await guard.checkAddress(request);
    if (addressRefusal !== null) {
      return addressRefusal;
    }

    let body: InvitationRequestBody;
    try {
      body = (await request.json()) as InvitationRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { action } = body;

    if (action === "generate") {
      const code = generateInvitationCode();
      return NextResponse.json({ code });
    }

    if (action === "register") {
      // The account limit is counted once the body was read, because the
      // account is in the body.
      const accountRefusal = await guard.checkAccount(
        typeof body.email === "string" && isValidEmail(body.email)
          ? normalizeEmail(body.email)
          : null,
      );
      if (accountRefusal !== null) {
        return accountRefusal;
      }

      const { code, email, password, displayName } = body;
      if (!code || !email || !password || !displayName) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      if (!consumeInvitationCode(code)) {
        return NextResponse.json({ error: "Invalid or used invitation code" }, { status: 400 });
      }
      try {
        // The service applies the password rules and normalises the
        // address, so this route does not have to know either.
        const result = await authService.registerUser({ email, password, displayName });
        // Only the public fields leave the server — never the password hash.
        return NextResponse.json(
          { user: toPublicUser(result.user), token: result.sessionToken },
          { status: 201 },
        );
      } catch (e) {
        // Forward auth errors (e.g. InvalidEmailError) as 400.
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  };

  return { POST };
}
