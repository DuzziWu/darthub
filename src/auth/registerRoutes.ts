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
 * created user **without** the password hash; the hash never leaves the
 * server.
 *
 * The route does **not** establish a session: it sets no cookie. The browser
 * signs in afterwards through the Auth.js `email` provider
 * (`src/auth/nextauth.ts`), which owns the session cookie.
 */

import { NextResponse } from "next/server";
import type { AuthService } from "./authService";
import { EmailAlreadyRegisteredError, InvalidEmailError } from "./errors";
import type { UserRow } from "./repository";

export interface RegisterRouteHandlerDependencies {
  authService: AuthService;
}

export interface RegisterRouteHandlers {
  POST(request: Request): Promise<Response>;
}

/** The user as the client may see it — without the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
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

/** Same shape the auth service accepts. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** bcrypt hashes at most 72 bytes and silently drops the rest, so a longer
 * password would accept a truncated secret. It is rejected instead. */
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;
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
 * `null` when the input must be rejected. */
function validate(body: RegisterRequestBody): ValidatedRegistration | null {
  const email = body.email.trim();
  if (!EMAIL_PATTERN.test(email)) {
    return null;
  }

  const password = body.password;
  if (password.length < MIN_PASSWORD_LENGTH) {
    return null;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return null;
  }

  const requestedName = body.displayName?.trim() ?? "";
  const displayName =
    requestedName.length > 0
      ? requestedName.slice(0, MAX_DISPLAY_NAME_LENGTH)
      : deriveDisplayName(email);

  return { email, password, displayName };
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

export function createRegisterRouteHandlers(
  deps: RegisterRouteHandlerDependencies,
): RegisterRouteHandlers {
  const { authService } = deps;

  const POST = async (request: Request): Promise<Response> => {
    let body: RegisterRequestBody | null;
    try {
      body = readBody(await request.json());
    } catch {
      body = null;
    }
    const registration = body === null ? null : validate(body);
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
