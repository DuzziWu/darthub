import { describe, expect, it, vi } from "vitest";
import {
  clientAddress,
  isValidAddress,
  normalizeAddress,
  UNKNOWN_ADDRESS,
} from "@/security/clientAddress";
import {
  CountingRateLimiter,
  decisionToResponse,
  deriveRateLimitKey,
  LIMITER_UNAVAILABLE_MESSAGE,
  RateLimitGuard,
  TOO_MANY_REQUESTS_MESSAGE,
  type RateLimitRule,
  type RateLimitStore,
  type RateLimitStoreResult,
} from "@/security/rateLimiter";

/** A store that counts in memory and remembers what it was asked. */
class RecordingStore implements RateLimitStore {
  readonly keys: string[] = [];
  private readonly counts = new Map<string, number>();

  constructor(private readonly failWith: Error | null = null) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitStoreResult> {
    if (this.failWith !== null) {
      throw this.failWith;
    }
    this.keys.push(key);
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count, ttlSeconds: rule.windowSeconds };
  }
}

const RULE: RateLimitRule = { limit: 3, windowSeconds: 60 };

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/login", { headers });
}

describe("deriveRateLimitKey", () => {
  it("never contains the raw subject", () => {
    const key = deriveRateLimitKey("auth.login", "acct:player@darthub.dev");

    expect(key).not.toContain("player@darthub.dev");
    expect(key).not.toContain("auth.login");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("separates the buckets and the subjects from one another", () => {
    const login = deriveRateLimitKey("auth.login", "acct:player@darthub.dev");
    const register = deriveRateLimitKey("auth.register", "acct:player@darthub.dev");
    const other = deriveRateLimitKey("auth.login", "acct:other@darthub.dev");

    expect(login).not.toBe(register);
    expect(login).not.toBe(other);
  });
});

describe("CountingRateLimiter", () => {
  it("allows a request up to the limit and refuses the one after it", async () => {
    const limiter = new CountingRateLimiter(new RecordingStore());

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const decision = await limiter.consume("auth.login", "acct:a@b.dev", RULE);
      expect(decision.allowed, `attempt ${attempt}`).toBe(true);
      expect(decision.unavailable).toBe(false);
      expect(decision.retryAfterSeconds).toBe(0);
    }

    const refused = await limiter.consume("auth.login", "acct:a@b.dev", RULE);
    expect(refused.allowed).toBe(false);
    expect(refused.unavailable).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts the subjects apart from one another", async () => {
    const limiter = new CountingRateLimiter(new RecordingStore());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await limiter.consume("auth.login", "acct:a@b.dev", RULE);
    }

    const first = await limiter.consume("auth.login", "acct:a@b.dev", RULE);
    const second = await limiter.consume("auth.login", "acct:b@b.dev", RULE);

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(true);
  });

  it("refuses the request when the store cannot answer — it never allows it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const limiter = new CountingRateLimiter(new RecordingStore(new Error("redis is down")));

      const decision = await limiter.consume("auth.login", "acct:a@b.dev", RULE);

      // A limiter that fails open is no limiter — and nothing would show
      // that it had stopped counting.
      expect(decision.allowed).toBe(false);
      expect(decision.unavailable).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not write the failure of the store into the log", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const limiter = new CountingRateLimiter(
        new RecordingStore(new Error("connect ECONNREFUSED redis://user:hunter2@redis:6379")),
      );

      await limiter.consume("auth.login", "acct:player@darthub.dev", RULE);

      const logged = consoleError.mock.calls.flat().join(" ");
      expect(logged).not.toContain("hunter2");
      expect(logged).not.toContain("player@darthub.dev");
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("decisionToResponse", () => {
  it("answers 429 with a retry-after and one message for every limit", async () => {
    const response = decisionToResponse({
      allowed: false,
      unavailable: false,
      retryAfterSeconds: 42,
    });

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("42");
    expect(await response?.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });

  it("answers 503 when the limiter itself is broken", async () => {
    const response = decisionToResponse({
      allowed: false,
      unavailable: true,
      retryAfterSeconds: 1,
    });

    expect(response?.status).toBe(503);
    expect(response?.headers.get("retry-after")).toBeNull();
    expect(await response?.json()).toEqual({ error: LIMITER_UNAVAILABLE_MESSAGE });
  });

  it("answers nothing when the request may proceed", () => {
    expect(
      decisionToResponse({ allowed: true, unavailable: false, retryAfterSeconds: 0 }),
    ).toBeNull();
  });
});

describe("RateLimitGuard", () => {
  it("counts the address of the request and refuses it past the limit", async () => {
    const store = new RecordingStore();
    const guard = new RateLimitGuard(new CountingRateLimiter(store), {
      name: "auth.login",
      perAddress: { limit: 2, windowSeconds: 60 },
    });

    const first = await guard.checkAddress(requestWith({ "x-forwarded-for": "203.0.113.7" }));
    const second = await guard.checkAddress(requestWith({ "x-forwarded-for": "203.0.113.7" }));
    const third = await guard.checkAddress(requestWith({ "x-forwarded-for": "203.0.113.7" }));

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(third?.status).toBe(429);
  });

  it("counts the addresses apart from one another", async () => {
    const guard = new RateLimitGuard(new CountingRateLimiter(new RecordingStore()), {
      name: "auth.login",
      perAddress: { limit: 1, windowSeconds: 60 },
    });

    expect(await guard.checkAddress(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
    expect(await guard.checkAddress(requestWith({ "x-forwarded-for": "203.0.113.8" }))).toBeNull();
  });

  it("counts the account on its own key", async () => {
    const store = new RecordingStore();
    const guard = new RateLimitGuard(new CountingRateLimiter(store), {
      name: "auth.login",
      perAddress: { limit: 100, windowSeconds: 60 },
      perAccount: { limit: 1, windowSeconds: 60 },
    });

    expect(await guard.checkAccount("player@darthub.dev")).toBeNull();
    expect((await guard.checkAccount("player@darthub.dev"))?.status).toBe(429);
    // A different account has its own budget.
    expect(await guard.checkAccount("other@darthub.dev")).toBeNull();
  });

  it("does not count an account when the endpoint has no account limit", async () => {
    const store = new RecordingStore();
    const guard = new RateLimitGuard(new CountingRateLimiter(store), {
      name: "invite.create",
      perAddress: { limit: 100, windowSeconds: 60 },
    });

    expect(await guard.checkAccount("player@darthub.dev")).toBeNull();
    expect(await guard.checkAccount(null)).toBeNull();
    // Only the address was counted.
    expect(store.keys).toHaveLength(0);
  });
});

describe("clientAddress", () => {
  it("takes the single entry of x-forwarded-for", () => {
    expect(clientAddress(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("takes the LAST entry of x-forwarded-for", () => {
    // A proxy that appends its own observation leaves the entries a client
    // supplied at the front. The last entry is the one the proxy added and
    // the only one a client cannot forge — the first entry is forgeable.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "203.0.113.7, 198.51.100.1, 192.0.2.1" }),
    );

    expect(address).toBe("192.0.2.1");
  });

  it("ignores a forged entry in front of the real one", () => {
    const forged = clientAddress(requestWith({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }));

    expect(forged).toBe("203.0.113.7");
  });

  it("ignores the whitespace around the entries", () => {
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "  10.0.0.1 ,  203.0.113.7  " }),
    );

    expect(address).toBe("203.0.113.7");
  });

  it("does not fall back to an earlier entry when the last one is empty", () => {
    // Falling back to an earlier entry would put the client back in charge
    // of the address — the earlier entries are the ones a client supplies.
    // A list that does not end in an address is not trusted at all.
    expect(clientAddress(requestWith({ "x-forwarded-for": "203.0.113.7, " }))).toBe(
      UNKNOWN_ADDRESS,
    );
    expect(clientAddress(requestWith({ "x-forwarded-for": "203.0.113.7, , " }))).toBe(
      UNKNOWN_ADDRESS,
    );
  });

  it("shares one bucket when the last entry is not an address", () => {
    // A value that is not an address must not become a bucket of its own:
    // that would let a caller create a new bucket per request.
    expect(clientAddress(requestWith({ "x-forwarded-for": "not-an-address" }))).toBe(
      UNKNOWN_ADDRESS,
    );
    expect(clientAddress(requestWith({ "x-forwarded-for": "10.0.0.1, garbage" }))).toBe(
      UNKNOWN_ADDRESS,
    );
    expect(clientAddress(requestWith({ "x-forwarded-for": "999.999.999.999" }))).toBe(
      UNKNOWN_ADDRESS,
    );
  });

  it("shares one bucket when the list ends empty", () => {
    expect(clientAddress(requestWith({ "x-forwarded-for": "203.0.113.7," }))).toBe(UNKNOWN_ADDRESS);
    expect(clientAddress(requestWith({ "x-forwarded-for": "," }))).toBe(UNKNOWN_ADDRESS);
    expect(clientAddress(requestWith({ "x-forwarded-for": "   " }))).toBe(UNKNOWN_ADDRESS);
  });

  it("does not fall back to another client-controlled header when the list is unusable", () => {
    // The list is present but does not hold an address. The secondary
    // header is client-controlled as well, so it must not be used to open
    // a bucket of its own.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "garbage", "x-real-ip": "203.0.113.9" }),
    );

    expect(address).toBe(UNKNOWN_ADDRESS);
  });

  it("falls back to x-real-ip when the standard header is absent entirely", () => {
    expect(clientAddress(requestWith({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("shares one bucket when the secondary header is not an address", () => {
    expect(clientAddress(requestWith({ "x-real-ip": "not-an-address" }))).toBe(UNKNOWN_ADDRESS);
  });

  it("falls back to the shared bucket when the request carries no address", () => {
    expect(clientAddress(requestWith({}))).toBe(UNKNOWN_ADDRESS);
  });

  it("uses the standard header when it is present and valid", () => {
    // The header the proxy writes decides. The secondary header is not
    // consulted, so the address cannot be chosen by the client.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.9" }),
    );

    expect(address).toBe("203.0.113.7");
  });

  it("shares the bucket when the standard header is present but empty", () => {
    // The header is there, so it decides — and it does not name an address.
    // The secondary header is client-controlled as well, so it must not be
    // used to open a bucket of its own.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "", "x-real-ip": "198.51.100.9" }),
    );

    expect(address).toBe(UNKNOWN_ADDRESS);
  });

  it("shares the bucket when the standard header is present but ends empty", () => {
    // The list does not end in an entry. Falling back to the secondary
    // header would hand the choice of the bucket back to the client.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "203.0.113.7, ", "x-real-ip": "198.51.100.9" }),
    );

    expect(address).toBe(UNKNOWN_ADDRESS);
  });

  it("shares the bucket when the standard header is present but invalid", () => {
    // The header is there and does not hold an address: the secondary
    // header must not step in for it.
    const address = clientAddress(
      requestWith({ "x-forwarded-for": "not-an-address", "x-real-ip": "198.51.100.9" }),
    );

    expect(address).toBe(UNKNOWN_ADDRESS);
  });

  it("uses the secondary header only when the standard one is absent", () => {
    // No standard header at all: the secondary one is the only source
    // there is, and it is used when it holds an address.
    const address = clientAddress(requestWith({ "x-real-ip": "198.51.100.9" }));

    expect(address).toBe("198.51.100.9");
  });

  it("reads the same client as the same address however it was written", () => {
    const written = ["203.0.113.7", "203.0.113.7:51000", "[::1]", "::1", "::ffff:203.0.113.7"];

    const addresses = written.map((value) => normalizeAddress(value));

    expect(addresses[0]).toBe("203.0.113.7");
    expect(addresses[1]).toBe("203.0.113.7");
    expect(addresses[2]).toBe("::1");
    expect(addresses[3]).toBe("::1");
    expect(addresses[4]).toBe("203.0.113.7");
  });

  it("does not confuse an IPv6 address with an address and a port", () => {
    expect(normalizeAddress("2001:db8::1")).toBe("2001:db8::1");
  });

  it("knows what is an address and what is not", () => {
    expect(isValidAddress("203.0.113.7")).toBe(true);
    expect(isValidAddress("2001:db8::1")).toBe(true);
    expect(isValidAddress("::1")).toBe(true);
    expect(isValidAddress("not-an-address")).toBe(false);
    expect(isValidAddress("999.999.999.999")).toBe(false);
    expect(isValidAddress("")).toBe(false);
  });
});
