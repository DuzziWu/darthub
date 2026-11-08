import { describe, expect, it } from "vitest";
import { requireAuth, type AuthIdentity } from "@/auth/requireAuth";
import { createSessionToken } from "@/auth/session";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

function bearerRequest(token: string): Request {
  return new Request("https://darthub.dev/api/anything", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("requireAuth", () => {
  it("protects routes with authentication middleware", async () => {
    // Without any credentials the route is protected: a 401 comes back and
    // no identity is exposed.
    const anonymous = await requireAuth(new Request("https://darthub.dev/api/anything"), {
      sessionSecret: STRONG_SECRET,
    });
    expect(anonymous.ok).toBe(false);
    if (!anonymous.ok) {
      expect(anonymous.response.status).toBe(401);
      expect(await anonymous.response.json()).toMatchObject({ error: expect.any(String) });
    }

    // A garbage or malformed header is rejected the same way.
    const malformed = await requireAuth(bearerRequest("not-a-jwt"), {
      sessionSecret: STRONG_SECRET,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.response.status).toBe(401);
    }

    // With a valid user session the handler gets the identity instead.
    const token = await createSessionToken(
      { sub: "11111111-2222-3333-4444-555555555555", kind: "user", nickname: "Robin" },
      STRONG_SECRET,
    );
    const authenticated = await requireAuth(bearerRequest(token), {
      sessionSecret: STRONG_SECRET,
    });
    expect(authenticated.ok).toBe(true);
    const identity: AuthIdentity = authenticated.ok
      ? authenticated.identity
      : { kind: "user", userId: "" };
    expect(identity).toEqual({
      kind: "user",
      userId: "11111111-2222-3333-4444-555555555555",
      nickname: "Robin",
    });
  });

  it("exposes the guest's progress identity from a guest session", async () => {
    const token = await createSessionToken(
      {
        sub: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        kind: "guest",
        nickname: "Guest 7",
        progressUserId: "99999999-8888-7777-6666-555555555555",
      },
      STRONG_SECRET,
    );

    const result = await requireAuth(bearerRequest(token), {
      sessionSecret: STRONG_SECRET,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity).toEqual({
        kind: "guest",
        guestId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        progressUserId: "99999999-8888-7777-6666-555555555555",
        nickname: "Guest 7",
      });
    }
  });

  it("rejects an expired token as if it were anonymous", async () => {
    const token = await createSessionToken(
      { sub: "11111111-2222-3333-4444-555555555555", kind: "user" },
      STRONG_SECRET,
      { expiresIn: -60 },
    );

    const result = await requireAuth(bearerRequest(token), {
      sessionSecret: STRONG_SECRET,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("rejects tokens signed with a foreign secret", async () => {
    const foreignSecret = "ab".padEnd(64, "c");
    const token = await createSessionToken(
      { sub: "11111111-2222-3333-4444-555555555555", kind: "user" },
      foreignSecret,
    );

    const result = await requireAuth(bearerRequest(token), {
      sessionSecret: STRONG_SECRET,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});
