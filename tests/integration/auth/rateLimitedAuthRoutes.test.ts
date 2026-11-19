import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { createGuestService } from "@/auth/guest";
import { createInvitationRouteHandlers } from "@/auth/invitationRoutes";
import { createLinkGuestRouteHandlers } from "@/auth/linkGuestRoutes";
import { createLoginRouteHandlers } from "@/auth/loginRoutes";
import { createRegisterRouteHandlers } from "@/auth/registerRoutes";
import { generateInvitationCode } from "@/auth/invitationStore";
import { LIMITER_UNAVAILABLE_MESSAGE, TOO_MANY_REQUESTS_MESSAGE } from "@/security/rateLimiter";
import {
  allowAllRateLimiter,
  refuseAllRateLimiter,
  refusingRateLimiter,
} from "../../support/allowAllRateLimiter";
import { createInMemoryAuthRepository } from "../../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const PASSWORD = "correct horse battery staple";

function buildAuthService(): ReturnType<typeof createAuthService> {
  return createAuthService({
    repository: createInMemoryAuthRepository(),
    sessionSecret: STRONG_SECRET,
    issueUserSession: async () => "stub-session-token",
  });
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("the auth routes answer a reached limit with 429", () => {
  it("refuses a sign-in", async () => {
    const handlers = createLoginRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });

    const resp = await handlers.POST(
      jsonRequest("/api/auth/login", { email: "player@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(429);
    expect(resp.headers.get("retry-after")).toBe("30");
    expect(await resp.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });

  it("refuses a registration", async () => {
    const handlers = createRegisterRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });

    const resp = await handlers.POST(
      jsonRequest("/api/auth/register", { email: "player@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(429);
    expect(await resp.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });

  it("refuses the guest conversion", async () => {
    const repository = createInMemoryAuthRepository();
    const handlers = createLinkGuestRouteHandlers({
      authService: createAuthService({
        repository,
        sessionSecret: STRONG_SECRET,
        issueUserSession: async () => "stub-session-token",
      }),
      guestService: createGuestService({ repository, sessionSecret: STRONG_SECRET }),
      rateLimiter: refusingRateLimiter,
    });

    const resp = await handlers.POST(
      jsonRequest("/api/auth/link-guest", {
        guestId: "some-guest",
        migrationToken: "some-token",
        email: "player@darthub.dev",
        password: PASSWORD,
        displayName: "Robin",
      }),
    );

    expect(resp.status).toBe(429);
    expect(await resp.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });

  it("refuses the invitation flow", async () => {
    const handlers = createInvitationRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });

    const resp = await handlers.POST(jsonRequest("/api/auth/invitation", { action: "generate" }));

    expect(resp.status).toBe(429);
    expect(await resp.json()).toEqual({ error: TOO_MANY_REQUESTS_MESSAGE });
  });

  it("counts a request whose body is broken — it is a request too", async () => {
    // The address limit is counted before the body is read, so a request
    // that carries no usable body cannot be used to skip the limit.
    const handlers = createLoginRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });

    const resp = await handlers.POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json at all",
      }),
    );

    expect(resp.status).toBe(429);
  });

  it("answers with the same message for every limit", async () => {
    const login = createLoginRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });
    const register = createRegisterRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refusingRateLimiter,
    });

    const loginBody = await (
      await login.POST(
        jsonRequest("/api/auth/login", { email: "player@darthub.dev", password: PASSWORD }),
      )
    ).text();
    const registerBody = await (
      await register.POST(
        jsonRequest("/api/auth/register", { email: "player@darthub.dev", password: PASSWORD }),
      )
    ).text();

    // One message for every endpoint: a client that is told which limit it
    // hit learns something about the server.
    expect(loginBody).toBe(registerBody);
  });
});

describe("the auth routes answer a broken limiter with 503", () => {
  it("refuses a sign-in instead of letting it through", async () => {
    const handlers = createLoginRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refuseAllRateLimiter,
    });

    const resp = await handlers.POST(
      jsonRequest("/api/auth/login", { email: "player@darthub.dev", password: PASSWORD }),
    );

    // The counter store could not answer. The request must not go through
    // unchecked, and it must not be answered as if the client had sent too
    // many requests either.
    expect(resp.status).toBe(503);
    expect(await resp.json()).toEqual({ error: LIMITER_UNAVAILABLE_MESSAGE });
  });

  it("refuses a registration instead of letting it through", async () => {
    const handlers = createRegisterRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: refuseAllRateLimiter,
    });

    const resp = await handlers.POST(
      jsonRequest("/api/auth/register", { email: "player@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(503);
  });
});

describe("no auth route answers with a raw user row", () => {
  it("builds every answer that carries a user from the public field list", () => {
    // A source-level guard: the routes that answer with a user must build
    // that answer from the list of public fields, so a row that carries a
    // password hash cannot slip into a response.
    const routes = ["loginRoutes", "registerRoutes", "invitationRoutes"];

    for (const route of routes) {
      const source = readFileSync(resolve(process.cwd(), "src/auth", `${route}.ts`), "utf-8");

      expect(source, `${route} must build the user from the public field list`).toContain(
        "toPublicUser",
      );
      expect(source, `${route} must not answer with a raw user row`).not.toMatch(
        /user:\s*user\b|user:\s*result\.user\b/,
      );
    }
  });
});

describe("the invitation route never answers with the password hash", () => {
  it("registers a player and answers with the public fields only", async () => {
    const handlers = createInvitationRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: allowAllRateLimiter,
    });
    const code = generateInvitationCode();

    const resp = await handlers.POST(
      jsonRequest("/api/auth/invitation", {
        action: "register",
        code,
        email: "player@darthub.dev",
        password: PASSWORD,
        displayName: "Robin",
      }),
    );

    expect(resp.status).toBe(201);
    const raw = await resp.text();

    // The route used to answer with the whole user row, and that row
    // carries the bcrypt hash of the password.
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toMatch(/\$2[aby]\$/);
    expect(raw).not.toContain(PASSWORD);

    const body = JSON.parse(raw) as { user: Record<string, unknown> };
    expect(Object.keys(body.user)).not.toContain("passwordHash");
    expect(body.user.email).toBe("player@darthub.dev");
  });

  it("refuses a password that breaks the rules", async () => {
    const handlers = createInvitationRouteHandlers({
      authService: buildAuthService(),
      rateLimiter: allowAllRateLimiter,
    });
    const code = generateInvitationCode();

    const resp = await handlers.POST(
      jsonRequest("/api/auth/invitation", {
        action: "register",
        code,
        email: "player@darthub.dev",
        password: "short",
        displayName: "Robin",
      }),
    );

    expect(resp.status).toBe(400);
  });
});
