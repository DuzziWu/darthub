/**
 * The rate limiter: one place that decides how many requests a client may
 * make, and one place that says so.
 *
 * The product had no request limiting at all. `docs/SECURITY.md` described
 * per-session limits on the write endpoints as if they existed; they did
 * not. Nothing stopped an attacker from trying a million passwords against
 * one account, from minting a million invitation codes, or from filling the
 * database with accounts.
 *
 * The limiter counts requests in named **buckets**. A bucket has a name, a
 * per-address limit and — where the endpoint knows who the caller claims to
 * be — a per-account limit. Both must hold. The per-account limit is the
 * one that cannot be dodged: the address of a request is a header the
 * client controls, the account is not.
 *
 * The counters live in a {@link RateLimitStore}. The production store is
 * Redis, whose `INCR`/`EXPIRE` pair runs inside one Lua script and is
 * therefore atomic across every process that shares it. The fallback store
 * is in-process; it is bounded and it is used only when no Redis is
 * configured, and its use is announced in the log.
 *
 * **A store that cannot answer must never answer "allowed".** A limiter
 * that fails open is no limiter at all, and the failure would be invisible:
 * the requests would simply keep coming. So a broken store produces a
 * refusal, and the caller turns that into a 503.
 */

import { createHash } from "node:crypto";
import { clientAddress } from "./clientAddress";

/** One limit: how many requests, over which window. */
export interface RateLimitRule {
  /** Requests allowed inside the window. */
  readonly limit: number;
  /** The length of the window in seconds. */
  readonly windowSeconds: number;
}

/** What the store reports after counting one request. */
export interface RateLimitStoreResult {
  /** The hits counted in the current window, including this one. */
  readonly count: number;
  /** Seconds until the window frees a slot. At least 1. */
  readonly ttlSeconds: number;
}

/**
 * The counter store behind the limiter.
 *
 * `hit` must count atomically: two concurrent requests must not both read
 * the same count and both write it back.
 */
export interface RateLimitStore {
  hit(key: string, rule: RateLimitRule): Promise<RateLimitStoreResult>;
}

/** Thrown when the store cannot answer. The limiter turns it into a
 * refusal — never into an allowed request. */
export class RateLimitBackendError extends Error {
  constructor(reason: string) {
    super(`The rate limit store is unavailable: ${reason}`);
    this.name = "RateLimitBackendError";
  }
}

/** The decision about one counted request. */
export interface RateLimitDecision {
  /** True when the request may proceed. */
  readonly allowed: boolean;
  /**
   * True when the request was refused because the store could not answer,
   * not because a limit was reached. The caller answers 503 for this and
   * 429 for a reached limit — the two mean different things to the client
   * and to the operator.
   */
  readonly unavailable: boolean;
  /** Seconds until the client may try again. 0 when the request is allowed. */
  readonly retryAfterSeconds: number;
}

/** Counts requests against a bucket. */
export interface RateLimiter {
  consume(bucket: string, subject: string, rule: RateLimitRule): Promise<RateLimitDecision>;
}

/**
 * The key a counter is stored under.
 *
 * The bucket name and the subject are hashed together, so the store never
 * sees a raw address or a raw email address — a Redis dump does not become
 * a list of the players who signed in. The separator is a NUL byte, which
 * cannot occur in an address, so two different pairs can never hash to the
 * same key.
 */
export function deriveRateLimitKey(bucket: string, subject: string): string {
  return createHash("sha256").update(`${bucket}\u0000${subject}`, "utf8").digest("hex");
}

/** The limiter over a counter store. */
export class CountingRateLimiter implements RateLimiter {
  /** The first failure is logged; the following ones are not. A store that
   * is down fails on every request, and one line per request would bury
   * everything else in the log. */
  private failureLogged = false;

  constructor(private readonly store: RateLimitStore) {}

  async consume(bucket: string, subject: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    try {
      const result = await this.store.hit(deriveRateLimitKey(bucket, subject), rule);
      const allowed = result.count <= rule.limit;
      return {
        allowed,
        unavailable: false,
        retryAfterSeconds: allowed ? 0 : Math.max(1, result.ttlSeconds),
      };
    } catch {
      // The store could not answer. The request is refused — a limiter that
      // fails open is not a limiter. Only the name of the failure is
      // logged: an error message from a database client can carry the
      // connection string, and that string can carry a password.
      if (!this.failureLogged) {
        this.failureLogged = true;
        console.error("[rate-limit] the store did not answer; the request is refused");
      }
      return { allowed: false, unavailable: true, retryAfterSeconds: 1 };
    }
  }
}

/** The limits that apply to one endpoint. */
export interface RateLimitPolicy {
  /** The bucket name. It is the key prefix in the store and the name in the
   * log, so it says which endpoint was limited. */
  readonly name: string;
  /** The limit for the caller's address. */
  readonly perAddress: RateLimitRule;
  /**
   * The limit for the caller's account. Endpoints that have no account
   * leave this out.
   *
   * The subject must already be normalised by the caller — with
   * `normalizeEmail` for an address — so that two spellings of one account
   * share one counter.
   */
  readonly perAccount?: RateLimitRule;
}

/** The message every refused request carries. One message for every limit
 * and every endpoint: a client that is told *which* limit it hit learns
 * something about the server. */
export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please try again later.";

/** The message a request carries when the limiter itself is broken. */
export const LIMITER_UNAVAILABLE_MESSAGE =
  "Service temporarily unavailable. Please try again later.";

/** Turns a decision into the response the route returns, or `null` when the
 * request may proceed. */
export function decisionToResponse(decision: RateLimitDecision): Response | null {
  if (decision.unavailable) {
    return new Response(JSON.stringify({ error: LIMITER_UNAVAILABLE_MESSAGE }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  if (decision.allowed) {
    return null;
  }
  return new Response(JSON.stringify({ error: TOO_MANY_REQUESTS_MESSAGE }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "retry-after": String(decision.retryAfterSeconds),
    },
  });
}

/**
 * Applies a {@link RateLimitPolicy} to a request.
 *
 * The two checks are separate on purpose:
 *
 * - {@link checkAddress} runs **before** the request body is read, so a
 *   request with a broken body is limited too. A limiter that only counted
 *   well-formed requests would not limit an attacker at all.
 * - {@link checkAccount} runs after the body was read, because the account
 *   is in the body.
 */
export class RateLimitGuard {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly policy: RateLimitPolicy,
  ) {}

  /** Counts the request against the address quota. */
  async checkAddress(request: Request): Promise<Response | null> {
    const decision = await this.limiter.consume(
      this.policy.name,
      `addr:${clientAddress(request)}`,
      this.policy.perAddress,
    );
    return decisionToResponse(decision);
  }

  /** Counts the request against the account quota. `null` means the
   * endpoint has no account limit, or the caller named no account. */
  async checkAccount(account: string | null): Promise<Response | null> {
    const rule = this.policy.perAccount;
    if (rule === undefined || account === null || account.length === 0) {
      return null;
    }
    const decision = await this.limiter.consume(this.policy.name, `acct:${account}`, rule);
    return decisionToResponse(decision);
  }
}
