import { describe, expect, it } from "vitest";
import { RedisRateLimitStore } from "@/security/redisRateLimitStore";
import type { RateLimitRedisClient } from "@/security/redisRateLimitStore";
import { RateLimitBackendError } from "@/security/rateLimiter";

const RULE = { limit: 3, windowSeconds: 60 };

/** A stand-in for the Redis client. It records what the store asked for and
 * answers what the test wants it to answer. */
class FakeRedisClient implements RateLimitRedisClient {
  readonly calls: { script: string; numKeys: number; args: (string | number)[] }[] = [];
  connectCalls = 0;

  readonly status: string;

  constructor(
    status: string,
    private readonly answer: unknown = [1, 60],
    private readonly failWith: Error | null = null,
  ) {
    this.status = status;
  }

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.failWith !== null) {
      throw this.failWith;
    }
  }

  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    this.calls.push({ script, numKeys, args });
    if (this.failWith !== null) {
      throw this.failWith;
    }
    return this.answer;
  }
}

describe("RedisRateLimitStore", () => {
  it("counts and sets the expiry in one script", async () => {
    const client = new FakeRedisClient("ready");
    const store = new RedisRateLimitStore(client);

    const result = await store.hit("the-key", RULE);

    expect(result.count).toBe(1);
    expect(result.ttlSeconds).toBe(60);
    // One round trip, one key, the window as the argument.
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.numKeys).toBe(1);
    expect(client.calls[0]?.args).toEqual(["the-key", 60]);
    // The script increments the counter and opens the window in the same
    // atomic step — two round trips would leave a counter without a
    // expiry, and a client that is locked out forever.
    expect(client.calls[0]?.script).toContain("INCR");
    expect(client.calls[0]?.script).toContain("EXPIRE");
  });

  it("reads the count and the remaining time out of the answer", async () => {
    const store = new RedisRateLimitStore(new FakeRedisClient("ready", [7, 42]));

    const result = await store.hit("the-key", RULE);

    expect(result.count).toBe(7);
    expect(result.ttlSeconds).toBe(42);
  });

  it("never reports a remaining time of zero", async () => {
    const store = new RedisRateLimitStore(new FakeRedisClient("ready", [1, 0]));

    const result = await store.hit("the-key", RULE);

    expect(result.ttlSeconds).toBeGreaterThanOrEqual(1);
  });

  it("refuses when the script fails, instead of counting nothing", async () => {
    const store = new RedisRateLimitStore(
      new FakeRedisClient("ready", undefined, new Error("READONLY")),
    );

    await expect(store.hit("the-key", RULE)).rejects.toBeInstanceOf(RateLimitBackendError);
  });

  it("refuses when the answer has a shape it does not understand", async () => {
    const store = new RedisRateLimitStore(new FakeRedisClient("ready", "not-an-array"));

    await expect(store.hit("the-key", RULE)).rejects.toBeInstanceOf(RateLimitBackendError);
  });

  it("refuses when the answer is not a number", async () => {
    const store = new RedisRateLimitStore(new FakeRedisClient("ready", ["x", "y"]));

    await expect(store.hit("the-key", RULE)).rejects.toBeInstanceOf(RateLimitBackendError);
  });

  it("opens the connection on the first call and refuses when that fails", async () => {
    const reachable = new FakeRedisClient("wait");
    const store = new RedisRateLimitStore(reachable);

    await store.hit("the-key", RULE);

    expect(reachable.connectCalls).toBe(1);
    expect(reachable.calls).toHaveLength(1);

    const unreachable = new FakeRedisClient("wait", undefined, new Error("ECONNREFUSED"));
    const failingStore = new RedisRateLimitStore(unreachable);

    await expect(failingStore.hit("the-key", RULE)).rejects.toBeInstanceOf(RateLimitBackendError);
  });

  it("refuses while the connection is not usable", async () => {
    const store = new RedisRateLimitStore(new FakeRedisClient("reconnecting"));

    await expect(store.hit("the-key", RULE)).rejects.toBeInstanceOf(RateLimitBackendError);
  });
});
