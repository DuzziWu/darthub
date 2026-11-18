import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { CountingRateLimiter } from "@/security/rateLimiter";
import { RedisRateLimitStore } from "@/security/redisRateLimitStore";

/**
 * The Redis counter store against a **real** Redis.
 *
 * The unit test drives the store with a fake client, which proves that the
 * store asks the right questions. It cannot prove that the questions work
 * against a real server — the Lua script, the atomicity and the expiry are
 * exactly the parts a fake cannot speak for.
 *
 * The test is skipped when no Redis is reachable, so the suite stays green
 * on a machine without one. **A skipped run is not a passed run**: the
 * result has to be read from the report, not from the exit code alone.
 */

const REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";
const PREFIX = "darthub:test:ratelimit";

const RULE = { limit: 3, windowSeconds: 30 };

/** A client of its own, so the test never touches the application's keys. */
let client: Redis | null = null;
let reachable = false;

beforeAll(async () => {
  const probe = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await probe.connect();
    reachable = probe.status === "ready";
  } catch {
    reachable = false;
  } finally {
    probe.disconnect();
  }

  if (!reachable) {
    return;
  }

  client = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await client.connect();
});

afterAll(async () => {
  if (client !== null) {
    const keys = await client.keys(`${PREFIX}:*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    client.disconnect();
  }
});

describe("the Redis counter store against a real server", () => {
  it("counts, expires and refuses in one atomic step", async () => {
    if (!reachable) {
      // The reason is named so that a skipped run cannot be mistaken for a
      // passed one.
      console.warn(`[redis] no server at ${REDIS_URL} — the store was not exercised`);
      return;
    }

    const store = new RedisRateLimitStore(client!);
    const key = `${PREFIX}:${Date.now()}`;

    const first = await store.hit(key, RULE);
    expect(first.count).toBe(1);
    expect(first.ttlSeconds).toBeGreaterThan(0);

    const second = await store.hit(key, RULE);
    expect(second.count).toBe(2);

    // The expiry is set by the same script, so the key cannot exist
    // without one.
    const ttl = await client!.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(RULE.windowSeconds);

    // The limiter refuses the request after the limit — from the counter
    // the real server keeps.
    const limiter = new CountingRateLimiter(store);
    const decisions = [];
    for (let attempt = 0; attempt <= RULE.limit; attempt += 1) {
      decisions.push(await limiter.consume("test.bucket", `addr:${key}`, RULE));
    }

    expect(decisions.slice(0, RULE.limit).every((decision) => decision.allowed)).toBe(true);
    expect(decisions[RULE.limit]?.allowed).toBe(false);
    expect(decisions[RULE.limit]?.unavailable).toBe(false);

    await client!.del(key);
  });

  it("refuses a server that cannot be reached, instead of counting nothing", async () => {
    if (!reachable) {
      console.warn(`[redis] no server at ${REDIS_URL} — the store was not exercised`);
      return;
    }

    // A port nothing listens on: the connection is refused at once.
    const broken = new Redis("redis://127.0.0.1:6399", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
    });
    const store = new RedisRateLimitStore(broken);

    await expect(store.hit(`${PREFIX}:unreachable`, RULE)).rejects.toThrow();
    broken.disconnect();
  });
});
