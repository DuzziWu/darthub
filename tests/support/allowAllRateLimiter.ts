import type { RateLimitDecision, RateLimiter } from "@/security/rateLimiter";

/**
 * A limiter that never refuses.
 *
 * The tests that are about authentication — the sign-in, the registration,
 * the guest conversion — are not about the limits, and they must not fail
 * because a file happens to make the tenth request. They inject this
 * limiter, so the production limits never decide whether a test passes.
 *
 * The limits themselves are tested in `tests/unit/security/` and in
 * `tests/integration/auth/rateLimitedAuthRoutes.test.ts`.
 */
export const allowAllRateLimiter: RateLimiter = {
  async consume(): Promise<RateLimitDecision> {
    return { allowed: true, unavailable: false, retryAfterSeconds: 0 };
  },
};

/**
 * A limiter that refuses every request.
 *
 * It stands in for a limiter whose counter store cannot answer, so that
 * the routes can be tested against the case where the protection itself
 * is broken.
 */
export const refuseAllRateLimiter: RateLimiter = {
  async consume(): Promise<RateLimitDecision> {
    return { allowed: false, unavailable: true, retryAfterSeconds: 1 };
  },
};

/**
 * A limiter that counts and refuses beyond a given number.
 *
 * It counts per bucket and subject, the way the real limiter does, so a
 * test can prove that a request is refused *and* that the work behind the
 * refusal — the credential comparison, the guest session — did not happen.
 */
export function createCountingRateLimiter(limit: number): RateLimiter & {
  readonly counts: Map<string, number>;
  readonly calls: number;
} {
  const counts = new Map<string, number>();
  const state = { calls: 0 };
  return {
    counts,
    get calls(): number {
      return state.calls;
    },
    async consume(bucket: string, subject: string): Promise<RateLimitDecision> {
      state.calls += 1;
      const key = `${bucket}:${subject}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      const allowed = count <= limit;
      return {
        allowed,
        unavailable: false,
        retryAfterSeconds: allowed ? 0 : 60,
      };
    },
  };
}

/**
 * A limiter that refuses every request because a limit was reached.
 *
 * It stands in for a limiter whose counter says "too many", so that the
 * routes can be tested against the case where a client sends more than it
 * may.
 */
export const refusingRateLimiter: RateLimiter = {
  async consume(): Promise<RateLimitDecision> {
    return { allowed: false, unavailable: false, retryAfterSeconds: 30 };
  },
};
