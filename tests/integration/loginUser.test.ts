import { beforeAll, describe, expect, it, vi } from "vitest";
import { createAuthService, type AuthService, type LoginInput } from "@/auth/authService";
import { createLoginRouteHandlers } from "@/auth/loginRoutes";
import { hashPassword } from "@/auth/password";
import type { UserRow } from "@/auth/repository";
import { allowAllRateLimiter } from "../support/allowAllRateLimiter";
import { createInMemoryAuthRepository } from "../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const ACCOUNT_EMAIL = "player@darthub.dev";
const PASSWORD = "correct horse battery staple";
/** The service issues the token; the route only hands it on. */
const SESSION_TOKEN = "stub-session-token";

/** The store and the service the route talks to. The account is seeded
 * once: a sign-in never changes the store, so one instance serves every
 * test in this file. */
const repository = createInMemoryAuthRepository();
const authService = createAuthService({
  repository,
  sessionSecret: STRONG_SECRET,
  issueUserSession: async () => SESSION_TOKEN,
});
const handlers = createLoginRouteHandlers({ authService, rateLimiter: allowAllRateLimiter });

/** A service double: the route must reach `loginUser` and nothing else. */
function stubAuthService(loginUser: AuthService["loginUser"]): AuthService {
  return {
    registerUser: async () => {
      throw new Error("registerUser must not be called by the login route");
    },
    loginUser,
  };
}

function loginRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await repository.users.create({
    email: ACCOUNT_EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    displayName: "Robin",
  });
});

describe("POST /api/auth/login", () => {
  it("signs a known account in and answers with the user and the token", async () => {
    const resp = await handlers.POST(loginRequest({ email: ACCOUNT_EMAIL, password: PASSWORD }));

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      user: {
        id: string;
        email: string;
        displayName: string;
        role: string;
        createdAt: string;
      };
      sessionToken: string;
    };
    expect(body.user.email).toBe(ACCOUNT_EMAIL);
    expect(body.user.displayName).toBe("Robin");
    expect(body.user.role).toBe("USER");
    expect(typeof body.user.id).toBe("string");
    expect(typeof body.user.createdAt).toBe("string");
    // The token is the service's, unchanged.
    expect(body.sessionToken).toBe(SESSION_TOKEN);

    // The answer describes the account that is really stored.
    const stored = await repository.users.findByEmail(ACCOUNT_EMAIL);
    expect(body.user.id).toBe(stored?.id);
  });

  it("never answers with the password hash", async () => {
    const resp = await handlers.POST(loginRequest({ email: ACCOUNT_EMAIL, password: PASSWORD }));
    const raw = await resp.text();

    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain("passwordHash");
    // A bcrypt hash would be recognisable by its prefix.
    expect(raw).not.toMatch(/\$2[aby]\$/);
  });

  it("sets no cookie — the bearer token is the API path", async () => {
    const resp = await handlers.POST(loginRequest({ email: ACCOUNT_EMAIL, password: PASSWORD }));

    expect(resp.headers.get("set-cookie")).toBeNull();
  });

  it("finds the account regardless of the case of the address", async () => {
    const resp = await handlers.POST(
      loginRequest({ email: "PLAYER@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(200);
  });

  it("rejects a wrong password with 401", async () => {
    const resp = await handlers.POST(
      loginRequest({ email: ACCOUNT_EMAIL, password: "totally-wrong-pass" }),
    );

    expect(resp.status).toBe(401);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it("answers an unknown email exactly like a wrong password", async () => {
    const unknownEmail = await handlers.POST(
      loginRequest({ email: "ghost@darthub.dev", password: PASSWORD }),
    );
    const wrongPassword = await handlers.POST(
      loginRequest({ email: ACCOUNT_EMAIL, password: "totally-wrong-pass" }),
    );

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    // Byte for byte the same answer: no caller can tell the two cases apart,
    // so the endpoint cannot enumerate accounts.
    expect(await unknownEmail.text()).toBe(await wrongPassword.text());
  });

  it("rejects a malformed email with 400", async () => {
    const resp = await handlers.POST(loginRequest({ email: "not-an-email", password: PASSWORD }));

    expect(resp.status).toBe(400);
  });

  it("rejects a missing password with 400", async () => {
    const resp = await handlers.POST(loginRequest({ email: ACCOUNT_EMAIL }));

    expect(resp.status).toBe(400);
  });

  it("rejects a body that is not JSON with 400", async () => {
    const resp = await handlers.POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json at all",
      }),
    );

    expect(resp.status).toBe(400);
  });

  it("delegates to authService.loginUser and hands the token through unchanged", async () => {
    const calls: LoginInput[] = [];
    const user: UserRow = {
      id: "user-1",
      email: ACCOUNT_EMAIL,
      passwordHash: "$2b$12$not-a-real-hash",
      displayName: "Robin",
      role: "USER",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-01-02T03:04:05.000Z"),
    };
    const stubHandlers = createLoginRouteHandlers({
      authService: stubAuthService(async (input) => {
        calls.push(input);
        return { user, sessionToken: "token-from-the-service" };
      }),
      rateLimiter: allowAllRateLimiter,
    });

    const resp = await stubHandlers.POST(
      loginRequest({ email: ` ${ACCOUNT_EMAIL} `, password: PASSWORD }),
    );

    expect(resp.status).toBe(200);
    // The route hands the credentials to the service — it verifies the
    // password itself never.
    expect(calls).toEqual([{ email: ACCOUNT_EMAIL, password: PASSWORD }]);
    // The token is the service's, byte for byte.
    const body = (await resp.json()) as { sessionToken: string; user: { id: string } };
    expect(body.sessionToken).toBe("token-from-the-service");
    expect(body.user.id).toBe("user-1");
  });

  it("answers 500 when the service fails unexpectedly", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const stubHandlers = createLoginRouteHandlers({
        authService: stubAuthService(async () => {
          throw new Error("the store is unreachable");
        }),
      });

      const resp = await stubHandlers.POST(
        loginRequest({ email: ACCOUNT_EMAIL, password: PASSWORD }),
      );

      expect(resp.status).toBe(500);
      const body = (await resp.json()) as { error: string };
      expect(body.error).toBe("Internal Server Error");
      // The failure must not leak the password into the log.
      expect(consoleError.mock.calls.flat().join(" ")).not.toContain(PASSWORD);
    } finally {
      consoleError.mockRestore();
    }
  });
});
