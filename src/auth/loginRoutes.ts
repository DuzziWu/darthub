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
 * no token of its own.
 *
 * The route does **not** establish a session: it sets no cookie. The cookie
 * session belongs to Auth.js (`src/auth/nextauth.ts`); the bearer token in
 * the body is the path the API routes accept (`Authorization: Bearer …`,
 * see `src/auth/requireAuth.ts`).
 *
 * Refused sign-ins always answer 401 with the same message, so a response
 * never enumerates accounts.
 */

import { NextResponse } from "next/server";
import type { AuthService } from "./authService";
import { InvalidCredentialsError, InvalidEmailError } from "./errors";
import type { UserRow } from "./repository";

export interface LoginRouteHandlerDependencies {
  authService: AuthService;
}

export interface LoginRouteHandlers {
  POST(request: Request): Promise<Response>;
}

/** The user as the client may see it — without the password hash. Mirrors
 * `PublicUser` in `src/auth/registerRoutes.ts`; the shape is copied rather
 * than imported so the login route stays independent of the registration
 * route, and both interfaces stay structurally identical. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

/** Same shape the auth service accepts. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * must not be filtered out here. */
function validate(body: LoginRequestBody): { email: string; password: string } | null {
  const email = body.email.trim();
  if (!EMAIL_PATTERN.test(email)) {
    return null;
  }
  return { email, password: body.password };
}

/** The user without the password hash — the hash never leaves the server. */
function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createLoginRouteHandlers(deps: LoginRouteHandlerDependencies): LoginRouteHandlers {
  const { authService } = deps;

  const POST = async (request: Request): Promise<Response> => {
    let body: LoginRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }
    const credentials = body === null ? null : validate(body);
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
