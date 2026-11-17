/**
 * App Router route handler for `/api/auth/register`.
 *
 * The handler stays thin: it validates the input, delegates to the auth
 * service and maps domain errors to HTTP statuses. The handler instance is
 * created with `createRegisterRouteHandlers` so tests can wire an in-memory
 * repository instead of a live database — the same pattern the guest link
 * route uses in `src/auth/linkGuestRoutes.ts`.
 *
 * The route creates the account through the existing
 * `authService.registerUser` (`src/auth/authService.ts`) — it never hashes a
 * password itself and never writes to the database. The answer carries the
 * created user **without** the password hash; the fields the client may see
 * are listed in one place, `src/auth/publicUser.ts`.
 *
 * The password rules live in the service (`src/auth/passwordPolicy.ts`), so
 * that no caller can bypass them. The route checks them as well, because
 * the route can answer with a message that says what is wrong; it reads the
 * same constants, so the two cannot disagree.
 *
 * The route does **not** establish a session: it sets no cookie. The browser
 * signs in afterwards through the Auth.js `email` provider
 * (`src/auth/nextauth.ts`), which owns the session cookie.
 *
 * **The route is rate limited.** Creating an account is how an attacker
 * fills a database — see `src/security/rateLimitPolicies.ts`.
 */

import { NextResponse } from "next/server";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import { AUTH_REGISTER_POLICY } from "@/security/rateLimitPolicies";
import { RateLimitGuard, type RateLimiter } from "@/security/rateLimiter";
import type { AuthService } from "./authService";
import { isValidEmail, normalizeEmail } from "./email";
import { EmailAlreadyRegisteredError, InvalidEmailError, InvalidPasswordError } from "./errors";
import { MIN_PASSWORD_LENGTH, passwordPolicyViolation } from "./passwordPolicy";
import { toPublicUser } from "./publicUser";

export interface RegisterRouteHandlerDependencies {
  authService: AuthService;
  /**
   * The limiter that guards this route. It defaults to the limiter of the
   * running process; a test injects its own so that it counts only the
   * requests it makes.
   */
  rateLimiter?: RateLimiter;
}

export interface RegisterRouteHandlers {
  POST(request: Request): Promise<Response>;
}

interface RegisterRequestBody {
  email: string;
  password: string;
  displayName?: string;
}

interface ValidatedRegistration {
  email: string;
  password: string;
  displayName: string;
}

/** Display names are trimmed to this length, like the guest nickname. */
const MAX_DISPLAY_NAME_LENGTH = 64;

function readBody(value: unknown): RegisterRequestBody | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const { email, password, displayName } = source;
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }
  return {
    email,
    password,
    displayName: typeof displayName === "string" ? displayName : undefined,
  };
}

/** Fallback name for a registration that carries none: the local part of
 * the email address. The sign-up form has an email and a password field —
 * no third field — so the account still gets a readable name. */
function deriveDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

/** Hand-written validation — no new dependency for four rules. Returns
 * `null` when the input must be rejected.
 *
 * The password rules come from `src/auth/passwordPolicy.ts` — the same
 * module the service uses — so the route and the service always agree on
 * what a usable password is. */
function validate(body: RegisterRequestBody): ValidatedRegistration | null {
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return null;
  }

  if (passwordPolicyViolation(body.password) !== null) {
    return null;
  }

  const requestedName = body.displayName?.trim() ?? "";
  const displayName =
    requestedName.length > 0
      ? requestedName.slice(0, MAX_DISPLAY_NAME_LENGTH)
      : deriveDisplayName(email);

  return { email, password: body.password, displayName };
}

export function createRegisterRouteHandlers(
  deps: RegisterRouteHandlerDependencies,
): RegisterRouteHandlers {
  const { authService } = deps;
  const guard = new RateLimitGuard(
    deps.rateLimiter ?? getDefaultRateLimiter(),
    AUTH_REGISTER_POLICY,
  );

  const POST = async (request: Request): Promise<Response> => {
    // The address limit is counted before the body is read, so that a
    // request with a broken body is not free.
    const addressRefusal = await guard.checkAddress(request);
    if (addressRefusal !== null) {
      return addressRefusal;
    }

    let body: RegisterRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }
    const registration = body === null ? null : validate(body);

    const accountRefusal = await guard.checkAccount(
      registration === null ? null : registration.email,
    );
    if (accountRefusal !== null) {
      return accountRefusal;
    }

    if (registration === null) {
      return NextResponse.json(
        {
          error: `A valid email address and a password of at least ${MIN_PASSWORD_LENGTH} characters are required.`,
        },
        { status: 400 },
      );
    }

    try {
      const { user, sessionToken } = await authService.registerUser(registration);
      return NextResponse.json({ user: toPublicUser(user), sessionToken }, { status: 201 });
    } catch (err) {
      // Map known domain errors to user-friendly HTTP responses.
      if (err instanceof InvalidEmailError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof InvalidPasswordError) {
        // The route checked the rules itself, so the service only refuses
        // here when a caller bypassed the route. It stays a 400: a
        // malformed password is a bad request.
        return NextResponse.json(
          {
            error: `A valid email address and a password of at least ${MIN_PASSWORD_LENGTH} characters are required.`,
          },
          { status: 400 },
        );
      }
      if (err instanceof EmailAlreadyRegisteredError) {
        // The status code already tells the client that the address is taken;
        // the message adds no information beyond it.
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      // Unexpected errors – propagate as 500. The request body is never
      // logged, so the password cannot leak into a log file.
      console.error(err);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };

  return { POST };
}
