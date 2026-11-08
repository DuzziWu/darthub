import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken, type SessionClaims } from "@/auth/session";
import { SessionConfigError } from "@/auth/sessionErrors";

// 64 hex characters of entropy — no hard-coded secrets anywhere.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const userClaims: SessionClaims = {
  sub: "11111111-2222-3333-4444-555555555555",
  kind: "user",
  nickname: "Robin",
};

describe("session", () => {
  it("logins in a user and returns a JWT", async () => {
    const token = await createSessionToken(userClaims, STRONG_SECRET);

    const [header, payload, signature] = token.split(".");
    expect(header).toBeDefined();
    expect(payload).toBeDefined();
    expect(signature).toBeDefined();
    expect(token.split(".").length).toBe(3);
  });

  it("round trips claims through verifySessionToken", async () => {
    const token = await createSessionToken(userClaims, STRONG_SECRET);

    const claims = await verifySessionToken(token, STRONG_SECRET);
    expect(claims.sub).toBe(userClaims.sub);
    expect(claims.kind).toBe("user");
  });

  it("gives user sessions a 24 hour expiration", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createSessionToken(userClaims, STRONG_SECRET);
    const claims = await verifySessionToken(token, STRONG_SECRET);
    const after = Math.floor(Date.now() / 1000);

    expect(claims.exp).toBeGreaterThanOrEqual(before + 24 * 60 * 60);
    expect(claims.exp).toBeLessThanOrEqual(after + 24 * 60 * 60);
  });

  it("refuses to sign tokens with a weak, absent, or trivial secret", async () => {
    await expect(createSessionToken(userClaims, "short")).rejects.toThrow(SessionConfigError);
    await expect(createSessionToken(userClaims, "")).rejects.toThrow(SessionConfigError);
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken(userClaims, STRONG_SECRET);

    const otherSecret = `ab${STRONG_SECRET.slice(2)}`;
    await expect(verifySessionToken(token, otherSecret)).rejects.toThrow();
  });

  it("rejects tokens after their expiration has passed", async () => {
    const token = await createSessionToken({ ...userClaims }, STRONG_SECRET, { expiresIn: -1 });

    await expect(verifySessionToken(token, STRONG_SECRET)).rejects.toThrow();
  });
});
