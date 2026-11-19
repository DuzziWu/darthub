import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { createLoginRouteHandlers } from "@/auth/loginRoutes";
import { AUTH_LOGIN_POLICY } from "@/security/rateLimitPolicies";
import { TOO_MANY_REQUESTS_MESSAGE } from "@/security/rateLimiter";
import { createInMemoryAuthRepository } from "../../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const ATTACKED_EMAIL = "guessed@darthub.dev";

function loginRequest(): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ATTACKED_EMAIL, password: "guessing-away" }),
  });
}

/**
 * The limits of the product, exercised end to end.
 *
 * The other tests inject a limiter, so that the production limits do not
 * decide whether they pass. This file does not: it uses the limiter of the
 * running process, so that the numbers in
 * `src/security/rateLimitPolicies.ts` are shown to be the numbers that
 * actually apply.
 */
describe("the real limits of the product", () => {
  it("stops a password-guessing run at the account limit", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
      issueUserSession: async () => "stub-session-token",
    });
    // No limiter is injected: this is the limiter of the running process.
    const handlers = createLoginRouteHandlers({ authService });

    const accountLimit = AUTH_LOGIN_POLICY.perAccount?.limit ?? 0;
    expect(accountLimit).toBeGreaterThan(0);

    const statuses: number[] = [];
    for (let attempt = 0; attempt <= accountLimit; attempt += 1) {
      const resp = await handlers.POST(loginRequest());
      statuses.push(resp.status);
    }

    // Every attempt before the limit is answered as a wrong credential —
    // the guess is refused, but the refusal does not tell the attacker
    // anything about the account.
    expect(statuses.slice(0, accountLimit).every((status) => status === 401)).toBe(true);
    // The attempt after the limit is answered as too many requests.
    expect(statuses[accountLimit]).toBe(429);

    const refused = await handlers.POST(loginRequest());
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });
});
