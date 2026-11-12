import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { InvalidCredentialsError } from "@/auth/errors";
import { verifyPassword } from "@/auth/password";
import { verifySessionToken } from "@/auth/session";
import { createInMemoryAuthRepository } from "../../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const stubTokenIssuer = { issueUserSession: async () => "stub-session-token" };

describe("authService", () => {
  it("registers a new user with email and hashed password", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({ repository, ...stubTokenIssuer });

    const { user } = await authService.registerUser({
      email: "player@darthub.dev",
      password: "correct horse battery staple",
      displayName: "Robin",
    });

    expect(user.email).toBe("player@darthub.dev");
    expect(user.displayName).toBe("Robin");

    const stored = await repository.users.findByEmail("player@darthub.dev");
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored?.passwordHash ?? "")).toBe(
      true,
    );
  });

  it("rejects registration with an invalid email address", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({ repository, ...stubTokenIssuer });

    await expect(
      authService.registerUser({
        email: "not-an-email",
        password: "long-enough-password",
        displayName: "Robin",
      }),
    ).rejects.toThrow(/email/i);
  });

  it("refuses a second registration for an already registered email", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({ repository, ...stubTokenIssuer });

    await authService.registerUser({
      email: "player@darthub.dev",
      password: "long-enough-password",
      displayName: "Robin",
    });

    await expect(
      authService.registerUser({
        email: "PLAYER@darthub.dev",
        password: "another-long-password",
        displayName: "Morgan",
      }),
    ).rejects.toThrow(/email/i);

    const users = await repository.users.findAll();
    expect(users).toHaveLength(1);
  });

  it("logs in a user and returns a JWT", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const { user } = await authService.registerUser({
      email: "player@darthub.dev",
      password: "long-enough-password",
      displayName: "Robin",
    });
    expect(user.email).toBe("player@darthub.dev");

    const login = await authService.loginUser({
      email: "Player@darthub.dev",
      password: "long-enough-password",
    });

    const claims = await verifySessionToken(login.sessionToken, STRONG_SECRET);
    expect(claims.sub).toBe(user.id);
    expect(claims.kind).toBe("user");
    // Login must not be limited to raw tokens: the token format is verified
    // above, and the login surface mirrors registration's response shape.
    expect(login.user.id).toBe(user.id);
  });

  it("rejects login with invalid credentials", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    await authService.registerUser({
      email: "player@darthub.dev",
      password: "long-enough-password",
      displayName: "Robin",
    });

    let unknownEmailError: unknown;
    try {
      await authService.loginUser({ email: "ghost@darthub.dev", password: "whatever-pass" });
    } catch (error) {
      unknownEmailError = error;
    }

    let wrongPasswordError: unknown;
    try {
      await authService.loginUser({ email: "player@darthub.dev", password: "totally-wrong-pass" });
    } catch (error) {
      wrongPasswordError = error;
    }

    expect(unknownEmailError).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsError);
    expect((unknownEmailError as Error).message).toBe((wrongPasswordError as Error).message);
  });
});
