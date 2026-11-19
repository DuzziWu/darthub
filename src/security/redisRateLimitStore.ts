/**
 * The Redis counter store — the production store.
 *
 * The count and the expiry are set in **one** Lua script, which Redis runs
 * atomically. Doing it in two round trips (`INCR` then `EXPIRE`) would leave
 * a window in which a counter exists without an expiry — a key that never
 * goes away and a client that is locked out forever.
 *
 * The store fails **closed**. A Redis that is down, unreachable or not yet
 * connected makes `hit` throw, and the limiter turns that into a refusal
 * (see `CountingRateLimiter`). It never turns into "allowed": a limiter
 * that stops counting because its counter broke is no limiter at all, and
 * nothing would show that it had stopped.
 */

import type { RateLimitRule, RateLimitStore, RateLimitStoreResult } from "./rateLimiter";
import { RateLimitBackendError } from "./rateLimiter";

/**
 * The slice of the Redis client this store uses.
 *
 * Declared here so the store can be tested against a fake client, and so
 * the store does not depend on the whole `ioredis` surface.
 */
export interface RateLimitRedisClient {
  /** The connection state: `wait`, `connecting`, `connect`, `ready`, … */
  readonly status: string;
  /** Opens the connection. Rejects when the server cannot be reached. */
  connect(): Promise<void>;
  /** Runs a script on the server. */
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

/**
 * Counts one hit and sets the expiry, atomically.
 *
 * `INCR` returns the new value. On the first hit the counter did not exist,
 * so the window is opened with `EXPIRE`. `TTL` reports how long the current
 * window still has.
 */
const INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RateLimitRedisClient) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitStoreResult> {
    await this.ensureConnected();

    let raw: unknown;
    try {
      raw = await this.client.eval(INCREMENT_SCRIPT, 1, key, rule.windowSeconds);
    } catch {
      // The script failed — the connection dropped, the server refused the
      // command, or the script was rejected. Either way the counter is
      // unknown, so the caller must refuse the request.
      throw new RateLimitBackendError("the counter could not be incremented");
    }

    if (!Array.isArray(raw)) {
      throw new RateLimitBackendError("the counter answered in an unexpected shape");
    }

    const count = Number(raw[0]);
    const ttl = Number(raw[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      throw new RateLimitBackendError("the counter answered with a value that is not a number");
    }

    return { count, ttlSeconds: Math.max(1, ttl) };
  }

  /**
   * Makes sure the client can carry a command.
   *
   * The client is created with `lazyConnect`, so it has not opened the
   * connection yet on the first call — that call opens it. A client that is
   * already connecting or reconnecting is refused instead of waiting: the
   * request must not hang, and it must not be counted against a counter
   * nobody can read.
   */
  private async ensureConnected(): Promise<void> {
    const status = this.client.status;
    if (status === "ready") {
      return;
    }
    if (status === "wait") {
      try {
        await this.client.connect();
        return;
      } catch {
        throw new RateLimitBackendError("the server could not be reached");
      }
    }
    throw new RateLimitBackendError(`the connection is in the state "${status}"`);
  }
}
