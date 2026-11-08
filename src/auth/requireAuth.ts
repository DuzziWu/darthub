/** Route authentication middleware: the narrow seam tasks 016, 021 and 023
 * consume. Reads a `Bearer <JWT> Authorization` header, verifies the session
 * token and hands back either the caller's identity or a ready-to-return 401
 * response. Never throws: handlers pattern-match on the `ok` discriminant.
 *
 * Compatible with the existing `AuthGateway` seam in `src/career/auth`.
 */

import { readSessionSecret, verifySessionToken, type SessionClaims } from "./session";

export type AuthIdentityKind = SessionClaims["kind"];

export interface AuthIdentity {
  kind: AuthIdentityKind;
  /** Present on user sessions: the registered account's id. */
  userId?: string;
  /** Present on guest sessions: the guest row's id. */
  guestId?: string;
  /** Present on guest sessions: id of the (mirror) user row currently
   * owning the guest's progress. */
  progressUserId?: string;
  nickname?: string;
}

export type AuthResult = { ok: true; identity: AuthIdentity } | { ok: false; response: Response };

export interface RequireAuthDeps {
  /** Signing secret; falls back to `process.env.AUTH_SECRET` in production. */
  sessionSecret?: string;
}

const BEARER_PREFIX = "Bearer ";

function unauthorized(): AuthResult {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  };
}

export function identityFromClaims(claims: SessionClaims): AuthIdentity {
  if (claims.kind === "guest") {
    return {
      kind: "guest",
      guestId: claims.sub,
      progressUserId: claims.progressUserId ?? "",
      nickname: claims.nickname,
    };
  }
  return { kind: "user", userId: claims.sub, nickname: claims.nickname };
}

export async function requireAuth(
  request: Request,
  deps: RequireAuthDeps = {},
): Promise<AuthResult> {
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith(BEARER_PREFIX)) {
    return unauthorized();
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) {
    return unauthorized();
  }

  try {
    const claims = await verifySessionToken(token, deps.sessionSecret ?? readSessionSecret());
    return { ok: true, identity: identityFromClaims(claims) };
  } catch {
    // Invalid signatures, expired tokens and malformed JWTs are all just
    // "not authenticated" from the route's point of view.
    return unauthorized();
  }
}
