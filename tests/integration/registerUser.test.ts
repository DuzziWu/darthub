import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { createRegisterRouteHandlers } from "@/auth/registerRoutes";
import { verifyPassword } from "@/auth/password";
import { allowAllRateLimiter } from "../support/allowAllRateLimiter";
import { createInMemoryAuthRepository } from "../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const PASSWORD = "correct horse battery staple";

/** Wires the route handler to an in-memory repository, so the test never
 * needs a live database. */
function buildHandlers() {
  const repository = createInMemoryAuthRepository();
  const authService = createAuthService({
    repository,
    sessionSecret: STRONG_SECRET,
    issueUserSession: async () => "stub-session-token",
  });
  return {
    repository,
    handlers: createRegisterRouteHandlers({ authService, rateLimiter: allowAllRateLimiter }),
  };
}

function registerRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  it("creates the account and answers with the user", async () => {
    const { repository, handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({ email: "player@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(201);
    const body = (await resp.json()) as {
      user: { id: string; email: string; displayName: string; role: string };
      sessionToken: string;
    };
    expect(body.user.email).toBe("player@darthub.dev");
    expect(body.user.role).toBe("USER");
    expect(typeof body.user.id).toBe("string");
    expect(typeof body.sessionToken).toBe("string");

    // The account really exists and the password is stored hashed.
    const stored = await repository.users.findByEmail("player@darthub.dev");
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored?.passwordHash ?? "")).toBe(true);
  });

  it("never answers with the password hash", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({ email: "player@darthub.dev", password: PASSWORD }),
    );
    const raw = await resp.text();

    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain("passwordHash");
    // A bcrypt hash would be recognisable by its prefix.
    expect(raw).not.toMatch(/\$2[aby]\$/);
  });

  it("derives the display name from the email when the form sends none", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({ email: "newplayer@darthub.dev", password: PASSWORD }),
    );

    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { user: { displayName: string } };
    expect(body.user.displayName).toBe("newplayer");
  });

  it("keeps the display name the client sent", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({
        email: "player@darthub.dev",
        password: PASSWORD,
        displayName: "Robin",
      }),
    );

    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { user: { displayName: string } };
    expect(body.user.displayName).toBe("Robin");
  });

  it("rejects a missing email with 400", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(registerRequest({ password: PASSWORD }));

    expect(resp.status).toBe(400);
  });

  it("rejects a malformed email with 400", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({ email: "not-an-email", password: PASSWORD }),
    );

    expect(resp.status).toBe(400);
  });

  it("rejects a missing password with 400", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(registerRequest({ email: "player@darthub.dev" }));

    expect(resp.status).toBe(400);
  });

  it("rejects a too short password with 400", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      registerRequest({ email: "player@darthub.dev", password: "short" }),
    );

    expect(resp.status).toBe(400);
  });

  it("rejects a body that is not JSON with 400", async () => {
    const { handlers } = buildHandlers();

    const resp = await handlers.POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json at all",
      }),
    );

    expect(resp.status).toBe(400);
  });

  it("answers 409 when the email is already registered", async () => {
    const { repository, handlers } = buildHandlers();

    const first = await handlers.POST(
      registerRequest({ email: "player@darthub.dev", password: PASSWORD }),
    );
    expect(first.status).toBe(201);

    const second = await handlers.POST(
      registerRequest({ email: "PLAYER@darthub.dev", password: PASSWORD }),
    );

    expect(second.status).toBe(409);
    // The first account survives the refused second registration.
    expect(await repository.users.findAll()).toHaveLength(1);
  });
});
