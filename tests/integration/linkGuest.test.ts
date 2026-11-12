import { describe, it, expect } from "vitest";
import { createAuthService } from "@/auth/authService";
import { createGuestService } from "@/auth/guest";
import { createLinkGuestRouteHandlers } from "@/auth/linkGuestRoutes";
import { createInMemoryAuthRepository } from "../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

/** Wires the route handler to in-memory repositories, so the test never
 * needs a live database. */
function buildHandlers() {
  const repository = createInMemoryAuthRepository();
  const authService = createAuthService({
    repository,
    sessionSecret: STRONG_SECRET,
    issueUserSession: async () => "stub-session-token",
  });
  const guestService = createGuestService({
    repository,
    sessionSecret: STRONG_SECRET,
    issueGuestSession: async () => "stub-guest-session-token",
  });
  return { repository, handlers: createLinkGuestRouteHandlers({ authService, guestService }) };
}

function linkGuestRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/auth/link-guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/link-guest", () => {
  it("accepts a guest token and new user credentials", async () => {
    const { handlers } = buildHandlers();
    const resp = await handlers.POST(
      linkGuestRequest({
        guestId: "nonexistent",
        migrationToken: "invalid",
        email: "newuser@example.com",
        password: "Secret123!",
        displayName: "New User",
      }),
    );
    // Since the guest does not exist, we expect a 400 response.
    expect(resp.status).toBe(400);
  });

  it("links a real guest session to a newly registered account", async () => {
    const { repository, handlers } = buildHandlers();
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
      issueGuestSession: async () => "stub-guest-session-token",
    });

    const { guest, migrationToken } = await guestService.createGuestSession({
      nickname: "Guest",
    });

    const resp = await handlers.POST(
      linkGuestRequest({
        guestId: guest.id,
        migrationToken,
        email: "newuser@example.com",
        password: "Secret123!",
        displayName: "New User",
      }),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { sessionToken: string };
    expect(typeof body.sessionToken).toBe("string");
  });

  it("rejects a request whose body is missing required fields", async () => {
    const { handlers } = buildHandlers();
    const resp = await handlers.POST(linkGuestRequest({ email: "newuser@example.com" }));
    expect(resp.status).toBe(400);
  });
});
