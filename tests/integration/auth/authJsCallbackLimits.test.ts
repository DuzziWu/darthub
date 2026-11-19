import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAuthJsRouteHandlers } from "@/auth/authjsRoute";
import { createGuestService } from "@/auth/guest";
import { callbackPolicy } from "@/auth/authjsRouteGuard";
import { AUTH_GUEST_POLICY, AUTH_LOGIN_POLICY } from "@/security/rateLimitPolicies";
import {
  allowAllRateLimiter,
  createCountingRateLimiter,
  refuseAllRateLimiter,
} from "../../support/allowAllRateLimiter";
import { createInMemoryAuthRepository } from "../../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

// Auth.js needs a secret to handle the session. The database is
// deliberately unreachable: the credential comparison then fails fast, and
// the test stays about the limit rather than about the database.
process.env.AUTH_SECRET = STRONG_SECRET;
process.env.DATABASE_URL = "postgresql://darthub:darthub@127.0.0.1:5999/darthub";

const CREDENTIALS_PATH = "/api/auth/callback/credentials";
const GUEST_PATH = "/api/auth/callback/guest";

/** A request to an Auth.js callback, as the browser would send it. */
function callbackRequest(
  path: string,
  body: Record<string, string>,
  address: string,
  cookie = "authjs.csrf-token=token%7Chash",
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": address,
      cookie,
    },
    body: new URLSearchParams(body),
  });
}

/** A stand-in for the Auth.js handlers that records every call. */
function recordingHandlers(): {
  handlers: Record<"GET" | "POST", (req: NextRequest) => Promise<Response>>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    handlers: {
      GET: async () => new Response("session", { status: 200 }),
      POST: async (req: NextRequest) => {
        calls.push(req.nextUrl.pathname);
        return new Response(null, { status: 302, headers: { location: "/dashboard" } });
      },
    },
  };
}

describe("the Auth.js callback guard", () => {
  it("knows the policy of every callback path", () => {
    expect(callbackPolicy(CREDENTIALS_PATH)).toBe(AUTH_LOGIN_POLICY);
    expect(callbackPolicy(GUEST_PATH)).toBe(AUTH_GUEST_POLICY);
    // A path that is not a provider callback is not guarded.
    expect(callbackPolicy("/api/auth/session")).toBeNull();
    expect(callbackPolicy("/api/auth/csrf")).toBeNull();
    expect(callbackPolicy("/api/auth/signout")).toBeNull();
    expect(callbackPolicy("/api/auth")).toBeNull();
  });

  it("guards the callback under a path prefix as well", () => {
    expect(callbackPolicy(`/darthub${CREDENTIALS_PATH}`)).toBe(AUTH_LOGIN_POLICY);
    expect(callbackPolicy(`/darthub${GUEST_PATH}`)).toBe(AUTH_GUEST_POLICY);
  });

  it("counts the credential callback against the sign-in bucket", () => {
    // The same bucket as the own sign-in route: the two paths must not be
    // able to spend each other's budget.
    expect(AUTH_LOGIN_POLICY.name).toBe("auth.login");
    expect(AUTH_GUEST_POLICY.name).toBe("auth.guest");
    expect(AUTH_LOGIN_POLICY.perAccount).toBeDefined();
    expect(AUTH_GUEST_POLICY.perAccount).toBeUndefined();
  });
});

describe("the Auth.js route with a counting limiter", () => {
  it("refuses a credential callback that reached the account limit", async () => {
    const limiter = createCountingRateLimiter(2);
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({ authHandlers: handlers, rateLimiter: limiter });

    const body = { email: "player@darthub.dev", password: "beliebig", csrfToken: "token" };
    const first = await route.POST(callbackRequest(CREDENTIALS_PATH, body, "203.0.113.1"));
    const second = await route.POST(callbackRequest(CREDENTIALS_PATH, body, "203.0.113.1"));
    const third = await route.POST(callbackRequest(CREDENTIALS_PATH, body, "203.0.113.1"));

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBe("60");
    // The refused request never reached Auth.js — the credential
    // comparison behind it did not happen either.
    expect(calls).toHaveLength(2);
  });

  it("refuses a guest callback that reached the address limit", async () => {
    const limiter = createCountingRateLimiter(2);
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({ authHandlers: handlers, rateLimiter: limiter });

    const first = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.2"),
    );
    const second = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.2"),
    );
    const third = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.2"),
    );

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(third.status).toBe(429);
    // The guest session was not created for the refused request — no
    // mirror account, no guest row, no bcrypt hash.
    expect(calls).toHaveLength(2);
  });

  it("creates no further guest session after the limit", async () => {
    // The guest session is what the Auth.js handler creates. The handler is
    // the only thing that writes, so the fact that it is not called again
    // is the proof that no further account and no further guest row is
    // written.
    const repository = createInMemoryAuthRepository();
    const guestService = createGuestService({ repository, sessionSecret: STRONG_SECRET });
    const limiter = createCountingRateLimiter(2);
    const handlers: Record<"GET" | "POST", (req: NextRequest) => Promise<Response>> = {
      GET: async () => new Response("", { status: 200 }),
      POST: async () => {
        await guestService.createGuestSession({});
        return new Response(null, { status: 302, headers: { location: "/dashboard" } });
      },
    };
    const route = createAuthJsRouteHandlers({ authHandlers: handlers, rateLimiter: limiter });

    await route.POST(callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.30"));
    await route.POST(callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.30"));

    const usersAtTheLimit = repository.backingStore.users.size;
    const guestsAtTheLimit = repository.backingStore.guests.size;
    expect(usersAtTheLimit).toBe(2);
    expect(guestsAtTheLimit).toBe(2);

    // The requests beyond the limit are refused before Auth.js runs.
    const refused = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.30"),
    );
    expect(refused.status).toBe(429);

    expect(repository.backingStore.users.size).toBe(usersAtTheLimit);
    expect(repository.backingStore.guests.size).toBe(guestsAtTheLimit);
  });

  it("counts the guest callback per address, not per body", async () => {
    const limiter = createCountingRateLimiter(2);
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({ authHandlers: handlers, rateLimiter: limiter });

    // Two different addresses, two different budgets.
    const first = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.3"),
    );
    const second = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: "token" }, "203.0.113.4"),
    );

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(calls).toHaveLength(2);
  });

  it("does not count the read-only endpoints", async () => {
    const limiter = createCountingRateLimiter(1);
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({ authHandlers: handlers, rateLimiter: limiter });

    // The sign-in page needs the session and the CSRF token. Neither
    // creates anything, so neither is counted.
    await route.GET(new NextRequest("http://localhost/api/auth/session"));
    await route.GET(new NextRequest("http://localhost/api/auth/csrf"));
    await route.POST(
      callbackRequest(
        CREDENTIALS_PATH,
        { email: "a@b.dev", password: "x", csrfToken: "t" },
        "203.0.113.5",
      ),
    );

    expect(calls).toHaveLength(1);
    // The one POST was counted twice — once for the address, once for the
    // account. The two GET requests were not counted at all.
    expect(limiter.calls).toBe(2);
    expect(limiter.counts.size).toBe(2);
    expect([...limiter.counts.keys()].every((key) => key.startsWith("auth.login:"))).toBe(true);
  });

  it("answers 503 when the counter store does not answer", async () => {
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({
      authHandlers: handlers,
      rateLimiter: refuseAllRateLimiter,
    });

    const response = await route.POST(
      callbackRequest(
        CREDENTIALS_PATH,
        { email: "a@b.dev", password: "x", csrfToken: "t" },
        "203.0.113.6",
      ),
    );

    // A limiter that cannot count must not let the request through.
    expect(response.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it("leaves the Auth.js flow alone when nothing was reached", async () => {
    const { handlers, calls } = recordingHandlers();
    const route = createAuthJsRouteHandlers({
      authHandlers: handlers,
      rateLimiter: allowAllRateLimiter,
    });

    const response = await route.POST(
      callbackRequest(
        CREDENTIALS_PATH,
        { email: "a@b.dev", password: "x", csrfToken: "t" },
        "203.0.113.7",
      ),
    );

    // The Auth.js answer is handed on unchanged: status, headers and body.
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/dashboard");
    expect(calls).toHaveLength(1);
  });
});

describe("the Auth.js route module of the application", () => {
  let route: {
    GET: (req: NextRequest) => Promise<Response>;
    POST: (req: NextRequest) => Promise<Response>;
  };

  /** The CSRF token and the cookie that goes with it. */
  let csrf: { token: string; cookie: string };

  beforeAll(async () => {
    // The database is deliberately unreachable, so Auth.js logs the error of
    // the credential check it could not finish. The error is the point of
    // the setup, not something to read.
    vi.spyOn(console, "error").mockImplementation(() => {});

    // The module is imported here, after the environment is set, because
    // Auth.js reads the secret when the handlers are built.
    const module = await import("../../../app/api/auth/[...nextauth]/route");
    route = module;

    // The real CSRF handshake of the browser: the token comes from the
    // CSRF endpoint and travels back in the cookie and in the body.
    const response = await route.GET(new NextRequest("http://localhost/api/auth/csrf"));
    const body = (await response.json()) as { csrfToken: string };
    const cookie =
      (response.headers.getSetCookie() ?? [])
        .map((entry) => entry.split(";")[0] ?? "")
        .find((entry) => entry.startsWith("authjs.csrf-token=")) ?? "";
    csrf = { token: body.csrfToken, cookie };
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("refuses a repeated credential sign-in at the account limit", async () => {
    const body = {
      email: "konto@darthub.dev",
      password: "beliebig",
      csrfToken: csrf.token,
    };
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= (AUTH_LOGIN_POLICY.perAccount?.limit ?? 0); attempt += 1) {
      const response = await route.POST(
        callbackRequest(CREDENTIALS_PATH, body, "203.0.113.20", csrf.cookie),
      );
      statuses.push(response.status);
    }

    // Every attempt before the limit was handed to Auth.js, the one after
    // the limit was refused with 429.
    const limit = AUTH_LOGIN_POLICY.perAccount?.limit ?? 0;
    expect(statuses.slice(0, limit).every((status) => status !== 429)).toBe(true);
    expect(statuses[limit]).toBe(429);
  });

  it("refuses repeated guest sessions at the address limit", async () => {
    const limit = AUTH_GUEST_POLICY.perAddress.limit;
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      const response = await route.POST(
        callbackRequest(GUEST_PATH, { csrfToken: csrf.token }, "203.0.113.21", csrf.cookie),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, limit).every((status) => status !== 429)).toBe(true);
    expect(statuses[limit]).toBe(429);
  });

  it("answers 429 with a retry-after", async () => {
    const limit = AUTH_GUEST_POLICY.perAddress.limit;
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      await route.POST(
        callbackRequest(GUEST_PATH, { csrfToken: csrf.token }, "203.0.113.22", csrf.cookie),
      );
    }

    const refused = await route.POST(
      callbackRequest(GUEST_PATH, { csrfToken: csrf.token }, "203.0.113.22", csrf.cookie),
    );

    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).not.toBeNull();
    const body = (await refused.json()) as { error: string };
    expect(body.error).toMatch(/too many requests/i);
  });

  it("serves the CSRF token, so the sign-in flow still works", async () => {
    const response = await route.GET(new NextRequest("http://localhost/api/auth/csrf"));

    // The read-only endpoints are not counted and keep working.
    expect(response.status).toBe(200);
  });
});
