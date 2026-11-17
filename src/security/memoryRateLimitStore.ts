/**
 * The in-process counter store.
 *
 * It is used when no Redis is configured — in development, in the tests, and
 * on a single-node deployment that does not run Redis. It is **not** a
 * silent fallback for a broken Redis: when Redis is configured and does not
 * answer, the request is refused (see `CountingRateLimiter`), which is a
 * different path entirely.
 *
 * Two properties matter:
 *
 * - **Atomicity.** `hit` contains no `await`, so the whole method runs in
 *   one turn of the event loop. Two concurrent requests cannot both read a
 *   count and both write it back; the second one sees the first one's
 *   result.
 * - **Boundedness.** The store keeps at most `maxEntries` keys. Without
 *   that, an attacker who varies the address could grow the map until the
 *   process runs out of memory. When the cap is reached, expired keys are
 *   dropped first and the oldest keys after that.
 */

import type { RateLimitRule, RateLimitStore, RateLimitStoreResult } from "./rateLimiter";

/** One counter and the moment it stops counting. */
interface Counter {
  count: number;
  expiresAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  /** The counters, keyed by the derived key. The map preserves the
   * insertion order, which is what the eviction below relies on. */
  private readonly counters = new Map<string, Counter>();

  constructor(private readonly maxEntries: number = 10_000) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitStoreResult> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (existing === undefined || existing.expiresAt <= now) {
      // A missing or expired counter starts a new window.
      this.counters.set(key, { count: 1, expiresAt: now + rule.windowSeconds * 1000 });
      this.enforceCapacity(now);
      return { count: 1, ttlSeconds: rule.windowSeconds };
    }

    existing.count += 1;
    return {
      count: existing.count,
      ttlSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  /** The number of counters the store currently holds. Exposed for the
   * tests that prove the store stays bounded. */
  get size(): number {
    return this.counters.size;
  }

  /** Drops the counters that are no longer counting, and — if the store is
   * still over its cap — the oldest ones. */
  private enforceCapacity(now: number): void {
    if (this.counters.size <= this.maxEntries) {
      return;
    }

    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) {
        this.counters.delete(key);
      }
    }

    // Still over the cap: drop the oldest entries. The map iterates in
    // insertion order, so the first key is the oldest one.
    while (this.counters.size > this.maxEntries) {
      const oldest = this.counters.keys().next();
      if (oldest.done === true) {
        break;
      }
      this.counters.delete(oldest.value);
    }
  }
}
