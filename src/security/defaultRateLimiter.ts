/**
 * The rate limiter the product runs with.
 *
 * The backend is chosen once, from the environment:
 *
 * - **`REDIS_URL` is set** → the Redis store. The counters are shared by
 *   every process, they survive a restart, and they are incremented
 *   atomically. This is the production configuration; `docker-compose.yml`
 *   sets the variable and runs a Redis beside the application.
 * - **`REDIS_URL` is not set, and this is not production** → the
 *   in-process store. The counters are bounded and enforced, but they belong
 *   to one process. The choice is announced in the log, so nobody believes
 *   they have a distributed limit when they do not.
 * - **`REDIS_URL` is not set, and this is production** → **the limiter
 *   refuses every request.** There is no third case, and in particular no
 *   switch that turns the limiter off.
 *
 * ## Why production fails and development does not
 *
 * The in-process store is not unlimited: it counts, it enforces, and it is
 * bounded. It is nevertheless the wrong store for a production
 * installation, for two reasons that only matter when more than one process
 * is involved:
 *
 * - **The counters are per process.** With two instances, the effective
 *   limit is twice the configured one; with an instance per request, it is
 *   unbounded.
 * - **The counters do not survive a restart.** A deployment that restarts
 *   regularly — a rollout, a crash, an autoscaler — starts every window
 *   from zero.
 *
 * A production installation that would silently get a weaker limit than it
 * asked for is a misconfiguration, not a decision. It therefore fails
 * **closed**: the request is refused with a `503`, exactly as it is when a
 * configured Redis does not answer. The operator sees the outage on the
 * first request instead of discovering months later that the limit was
 * never what the configuration said.
 *
 * Docker Compose runs a Redis beside the application and makes it a hard
 * dependency, so the production path costs nothing there.
 */

import Redis from "ioredis";
import { MemoryRateLimitStore } from "./memoryRateLimitStore";
import { RedisRateLimitStore } from "./redisRateLimitStore";
import {
  CountingRateLimiter,
  RateLimitBackendError,
  type RateLimiter,
  type RateLimitRule,
  type RateLimitStore,
  type RateLimitStoreResult,
} from "./rateLimiter";

/**
 * The Redis client the rate limiter uses.
 *
 * `enableOfflineQueue: false` keeps a command from waiting in a queue while
 * the connection is down: the command fails at once, the limiter refuses
 * the request, and the client is told the service is unavailable. `lazyConnect`
 * keeps the module import free of a connection, so importing a route
 * handler never opens a socket.
 */
function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    // Bounded backoff: the client keeps trying, so the limiter recovers on
    // its own once Redis is back, without hammering it while it is down.
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });

  // Without a listener of its own, ioredis prints the stack of every
  // connection error — and the stack of a connection error can carry the
  // connection string, and the connection string can carry a password. The
  // failure is reported by the limiter, which refuses the request.
  client.on("error", () => {
    console.error("[rate-limit] the redis connection failed");
  });

  return client;
}

/**
 * A store that cannot answer.
 *
 * It is the production answer to a missing `REDIS_URL`: every request is
 * refused, because a limiter that cannot count cannot protect anything.
 */
class UnavailableRateLimitStore implements RateLimitStore {
  async hit(): Promise<RateLimitStoreResult> {
    throw new RateLimitBackendError("no counter store is configured for production");
  }
}

/**
 * The in-process store, announced once — when it is first used.
 *
 * The announcement is not made when the limiter is built, because the
 * limiter is built when the route module is imported, and that happens
 * during the production build as well. A build that says "REDIS_URL is not
 * set" describes the build, not the running application; the application
 * is the one that has to know that its counters belong to one process.
 */
class AnnouncedMemoryRateLimitStore implements RateLimitStore {
  private readonly store = new MemoryRateLimitStore();
  private announced = false;

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitStoreResult> {
    if (!this.announced) {
      this.announced = true;
      console.warn(
        "[rate-limit] REDIS_URL is not set: the in-process limiter is used. " +
          "The limits are enforced, but the counters belong to this process only. " +
          "Set REDIS_URL to share them across instances.",
      );
    }
    return this.store.hit(key, rule);
  }
}

/** True when the application runs as a production installation. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Builds a limiter from the current environment. */
export function createDefaultRateLimiter(): RateLimiter {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl !== undefined && redisUrl.length > 0) {
    return new CountingRateLimiter(new RedisRateLimitStore(createRedisClient(redisUrl)));
  }

  if (isProduction()) {
    // Production without a counter store does not get a weaker limiter — it
    // gets no limiter at all, and the refusal is loud.
    console.error(
      "[rate-limit] REDIS_URL is not set and NODE_ENV is production: " +
        "the request rate limiter refuses every request. " +
        "Set REDIS_URL to a reachable Redis.",
    );
    return new CountingRateLimiter(new UnavailableRateLimitStore());
  }

  return new CountingRateLimiter(new AnnouncedMemoryRateLimitStore());
}

let instance: RateLimiter | null = null;

/** The limiter of the running process. One instance, so that all routes
 * count into the same buckets. */
export function getDefaultRateLimiter(): RateLimiter {
  instance ??= createDefaultRateLimiter();
  return instance;
}
