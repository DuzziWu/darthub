/**
 * Authentication seam for the rating API.
 *
 * Task 003 (Auth.js under `src/auth`) has not landed yet; until it does,
 * routes authenticate through this narrow gateway (same shape as the
 * career API's gateway). The default production gateway resolves
 * `Authorization: Bearer <token>` headers via an injected token resolver
 * that denies everything, since no real identity provider exists yet.
 * The 003 middleware replaces this seam wholesale — route signatures do
 * not change.
 */

export interface AuthGateway {
  /** The authenticated user's ID, or null when the request is anonymous. */
  getCurrentUser(request: Request): Promise<string | null>;
}

const BEARER_PREFIX = "Bearer ";

export function createBearerTokenAuthGateway(
  resolveToken: (token: string) => Promise<string | null> = async () => null,
): AuthGateway {
  return {
    async getCurrentUser(request: Request): Promise<string | null> {
      const header = request.headers.get("authorization");
      if (header === null || !header.startsWith(BEARER_PREFIX)) {
        return null;
      }
      const token = header.slice(BEARER_PREFIX.length).trim();
      if (token.length === 0) {
        return null;
      }
      return resolveToken(token);
    },
  };
}
