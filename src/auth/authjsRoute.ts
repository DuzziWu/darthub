/**
 * The App Router route handler for `/api/auth/[...nextauth]`.
 *
 * The handler is a thin wrapper around the Auth.js handlers: it counts the
 * provider callbacks and refuses the ones that reached a limit, and it
 * hands everything else to Auth.js unchanged.
 *
 * **Why the wrapper and not the provider.** A provider can only answer
 * with a user or with nothing, so a provider that finds the limit reached
 * cannot answer with `429` — Auth.js turns the refusal into a redirect to
 * its error page. In front of Auth.js the answer is an ordinary HTTP
 * response: `429` with a `Retry-After` header for a reached limit, `503`
 * for a counter store that does not answer. See
 * `src/auth/authjsRouteGuard.ts` for the details.
 *
 * The Auth.js flow itself is untouched: the same handlers serve the
 * session, the CSRF token, the sign-out and the provider callbacks, and
 * the CSRF check still runs inside Auth.js, after the guard.
 */

import type { NextRequest } from "next/server";
import { getDefaultRateLimiter } from "@/security/defaultRateLimiter";
import type { RateLimiter } from "@/security/rateLimiter";
import { guardAuthJsCallback } from "./authjsRouteGuard";

/** The Auth.js handlers, as `NextAuth({...}).handlers` returns them. */
export type AuthJsHandlers = Record<"GET" | "POST", (req: NextRequest) => Promise<Response>>;

export interface AuthJsRouteDependencies {
  /** The Auth.js handlers the route delegates to. */
  authHandlers: AuthJsHandlers;
  /**
   * The limiter that guards the provider callbacks. It defaults to the
   * limiter of the running process; a test injects its own so that it
   * counts only the requests it makes.
   */
  rateLimiter?: RateLimiter;
}

export interface AuthJsRouteHandlers {
  GET(request: NextRequest): Promise<Response>;
  POST(request: NextRequest): Promise<Response>;
}

export function createAuthJsRouteHandlers(deps: AuthJsRouteDependencies): AuthJsRouteHandlers {
  const limiter = deps.rateLimiter ?? getDefaultRateLimiter();

  return {
    // The read-only endpoints — the session, the CSRF token, the list of
    // providers — are not counted. The sign-in page needs them, and none
    // of them creates anything.
    GET: (request: NextRequest) => deps.authHandlers.GET(request),

    POST: async (request: NextRequest): Promise<Response> => {
      const refusal = await guardAuthJsCallback(request, limiter);
      if (refusal !== null) {
        return refusal;
      }
      return deps.authHandlers.POST(request);
    },
  };
}
