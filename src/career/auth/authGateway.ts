/**
 * Authentication seam for the career API.
 *
 * Task 003 (Auth.js) is a later dependency; until it lands, routes
 * authenticate through this narrow gateway. The production gateway
 * resolves `Authorization: Bearer <token>` headers via an injected
 * token resolver (defaulting to denying everything, since no real
 * provider exists yet); tests inject a fake resolver.
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
