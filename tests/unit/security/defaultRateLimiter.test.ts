import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultRateLimiter, isProduction } from "@/security/defaultRateLimiter";
import { RateLimitGuard } from "@/security/rateLimiter";

const RULE = { limit: 2, windowSeconds: 60 };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // The environment is restored to what it was before the test.
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the default rate limiter", () => {
  it("refuses every request in production when no counter store is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", undefined);

    const limiter = createDefaultRateLimiter();
    const decision = await limiter.consume("auth.login", "acct:a@b.dev", RULE);

    // Production without Redis must not silently get a weaker limiter. The
    // request is refused, exactly as it is when a configured Redis does not
    // answer.
    expect(decision.allowed).toBe(false);
    expect(decision.unavailable).toBe(true);
  });

  it("answers with 503 in production when no counter store is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", undefined);

    const guard = new RateLimitGuard(createDefaultRateLimiter(), {
      name: "auth.login",
      perAddress: RULE,
    });

    const response = await guard.checkAddress(new Request("http://localhost/api/auth/login"));

    expect(response?.status).toBe(503);
  });

  it("says so in the log", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", undefined);

    const limiter = createDefaultRateLimiter();
    await limiter.consume("auth.login", "acct:a@b.dev", RULE);

    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("REDIS_URL");
    expect(logged).toContain("production");
  });

  it("counts in the process outside production when no counter store is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REDIS_URL", undefined);

    const limiter = createDefaultRateLimiter();
    const first = await limiter.consume("auth.login", "acct:a@b.dev", RULE);
    const second = await limiter.consume("auth.login", "acct:a@b.dev", RULE);
    const third = await limiter.consume("auth.login", "acct:a@b.dev", RULE);

    // Development and the tests keep the in-process store: the limit works
    // there, it simply belongs to one process.
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.unavailable).toBe(false);
  });

  it("counts in the process when the environment does not name a stage at all", async () => {
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("REDIS_URL", undefined);

    const limiter = createDefaultRateLimiter();
    const decision = await limiter.consume("auth.login", "acct:a@b.dev", RULE);

    expect(decision.allowed).toBe(true);
    expect(decision.unavailable).toBe(false);
  });

  it("refuses every request in production when the configured Redis does not answer", async () => {
    // A port nothing listens on: the connection is refused at once.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6399");

    const limiter = createDefaultRateLimiter();
    const decision = await limiter.consume("auth.login", "acct:a@b.dev", RULE);

    // A configured counter store that is down must fail closed, in
    // production as everywhere else.
    expect(decision.allowed).toBe(false);
    expect(decision.unavailable).toBe(true);
  });

  it("knows whether it runs as production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProduction()).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(isProduction()).toBe(false);

    vi.stubEnv("NODE_ENV", undefined);
    expect(isProduction()).toBe(false);
  });
});
