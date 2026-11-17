/**
 * App Router route handler for `/api/auth/login`.
 *
 * The handler stays thin: it validates the input, delegates to the auth
 * service and maps domain errors to HTTP statuses. The handler instance is
 * created with `createLoginRouteHandlers` so tests can wire an in-memory
 * repository instead of a live database — the same pattern the registration
 * route uses in `src/auth/registerRoutes.ts`.
 *
 * The route signs in through the existing `authService.loginUser`
 * (`src/auth/authService.ts`): it never verifies a password itself and never
 * hashes anything. The answer carries the signed-in user **without** the
 * password hash and the bearer token the service issued — the route invents
 * no token of its own. The fields the client may see are listed in one
 * place, `src/auth/publicUser.ts`.
 *
 * The route does **not** establish a session: it sets no cookie. The cookie
 * session belongs to Auth.js (`src/auth/nextauth.ts`); the bearer token in
 * the body is the path the API routes accept (`Authorization: Bearer …`,
 * see `src/auth/requireAuth.ts`).
 *
 * Refused sign-ins always answer 401 with the same message, so a response
 * never enumerates accounts.
 *
 * **The route is rate limited.** A sign-in is the one place where an
 * attacker gets to try passwords for free, so it carries both an address
 * limit and an account limit — see `src/security/rateLimitPolicies.ts`.
 */

import { NextResponse } from "next/server";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { AUTH_LOGIN_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard, type RateLimiter } from "@/security/rateLimiter";
import type { AuthService } from "./authService";
import { isValidEmail, normalizeEmail } from "./email";
import { InvalidCredentialsError, InvalidEmailError } from "./errors";
import { toPublicUser } from "./publicUser";

export interface LoginRouteHandlerDependencies {
  authService: AuthService;
  /**
   * The limiter that guards this route. It defaults to the limiter of the
   * running process; a test injects its own so that it counts only the
   * requests it makes.
   */
  rateLimiter?: RateLimiter;
}

export interface LoginRouteHandlers {
  POST(request: Request): Promise<Response>;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

function readBody(value: unknown): LoginRequestBody | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const { email, password } = source;
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }
  return { email, password };
}

/** Hand-written validation — no new dependency for two rules. The email has
 * to look like one; the password is only checked for presence. A wrong
 * password is a credential problem (401), not a malformed request, so it
 * must not be filtered out here.
 *
 * The address is returned in its canonical form, so that the account the
 * service looks up and the account the rate limiter counts are the same
 * account however it was spelled. */
function validate(body: LoginRequestBody): { email: string; password: string } | null {
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return null;
  }
  return { email, password: body.password };
}

export function createLoginRouteHandlers(deps: LoginRouteHandlerDependencies): LoginRouteHandlers {
  const { authService } = deps;
  const guard = new RateLimitGuard(deps.rateLimiter ?? getDefaultRateLimiter(), AUTH_LOGIN_POLICY);

  const POST = async (request: Request): Promise<Response> => {
    // The address limit is counted before the body is read: a request with
    // a broken body is a request too, and it must not be free.
    const addressRefusal = await guard.checkAddress(request);
    if (addressRefusal !== null) {
      return addressRefusal;
    }

    let body: LoginRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }
    const credentials = body === null ? null : validate(body);

    // The account limit is counted once the body was read, because the
    // account is in the body. It is counted only for an address that has
    // the accepted shape — a counter for a nonsense address would protect
    // nothing.
    const accountRefusal = await guard.checkAccount(
      credentials === null ? null : credentials.email,
    );
    if (accountRefusal !== null) {
      return accountRefusal;
    }

    if (credentials === null) {
      return NextResponse.json(
        { error: "A valid email address and a password are required." },
        { status: 400 },
      );
    }

    try {
      const { user, sessionToken } = await authService.loginUser(credentials);
      return NextResponse.json({ user: toPublicUser(user), sessionToken }, { status: 200 });
    } catch (err) {
      // Map known domain errors to user-friendly HTTP responses.
      if (err instanceof InvalidCredentialsError) {
        // Unknown address and wrong password share this error and therefore
        // this message: the answer must not enumerate accounts.
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      // The route validates the address itself, so the service cannot reach
      // this branch today. It stays a 400 all the same: a malformed address
      // is a bad request, never a server error.
      if (err instanceof InvalidEmailError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      // Unexpected errors – propagate as 500. The request body is never
      // logged, so the password cannot leak into a log file.
      console.error(err);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };

  return { POST };
}
