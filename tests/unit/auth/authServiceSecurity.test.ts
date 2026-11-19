import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { InvalidCredentialsError, InvalidPasswordError } from "@/auth/errors";
import { createInMemoryAuthRepository } from "../../support/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const ACCOUNT_EMAIL = "player@darthub.dev";
const PASSWORD = "correct horse battery staple";

function buildService(): ReturnType<typeof createAuthService> {
  return createAuthService({
    repository: createInMemoryAuthRepository(),
    sessionSecret: STRONG_SECRET,
    issueUserSession: async () => "stub-session-token",
  });
}

describe("authService — password rules", () => {
  it("refuses a password that is too short, before it writes anything", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
      issueUserSession: async () => "stub-session-token",
    });

    await expect(
      authService.registerUser({
        email: ACCOUNT_EMAIL,
        password: "short",
        displayName: "Robin",
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);

    // Nothing was written: the rules are checked before the transaction.
    expect(await repository.users.findAll()).toHaveLength(0);
  });

  it("refuses a password that is longer than bcrypt can hash", async () => {
    const authService = buildService();

    await expect(
      authService.registerUser({
        email: ACCOUNT_EMAIL,
        password: "a".repeat(73),
        displayName: "Robin",
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it("applies the rules to a caller that does not go through the route", async () => {
    // The guest conversion and the invitation route call the service
    // directly. The rules are the service's, so they cannot be stepped
    // around.
    const authService = buildService();

    await expect(
      authService.registerUser({
        email: ACCOUNT_EMAIL,
        password: "hunter2",
        displayName: "Robin",
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });
});

describe("authService — login timing", () => {
  it("compares an unknown address against a hash bcrypt can parse", async () => {
    const repository = createInMemoryAuthRepository();
    const compared: string[] = [];
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
      verifyPassword: async (_plain, passwordHash) => {
        compared.push(passwordHash);
        return false;
      },
    });

    await authService.registerUser({
      email: ACCOUNT_EMAIL,
      password: PASSWORD,
      displayName: "Robin",
    });
    compared.length = 0;

    await expect(
      authService.loginUser({ email: "ghost@darthub.dev", password: PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    // The unknown-address path must run a comparison, and the comparison
    // must be against a real bcrypt hash: bcrypt rejects a malformed hash
    // at once, so a placeholder made the unknown-address path the fast
    // one and the address could be told from a registered one.
    expect(compared).toHaveLength(1);
    expect(compared[0]).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("answers an unknown address exactly like a wrong password", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({ repository, sessionSecret: STRONG_SECRET });

    await authService.registerUser({
      email: ACCOUNT_EMAIL,
      password: PASSWORD,
      displayName: "Robin",
    });

    let unknownError: unknown;
    let wrongError: unknown;
    try {
      await authService.loginUser({ email: "ghost@darthub.dev", password: PASSWORD });
    } catch (error) {
      unknownError = error;
    }
    try {
      await authService.loginUser({ email: ACCOUNT_EMAIL, password: "not-the-password" });
    } catch (error) {
      wrongError = error;
    }

    expect(unknownError).toBeInstanceOf(InvalidCredentialsError);
    expect(wrongError).toBeInstanceOf(InvalidCredentialsError);
    expect((unknownError as Error).message).toBe((wrongError as Error).message);
  });

  it("does not make the unknown address dramatically faster than a wrong password", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({ repository, sessionSecret: STRONG_SECRET });

    await authService.registerUser({
      email: ACCOUNT_EMAIL,
      password: PASSWORD,
      displayName: "Robin",
    });

    // The first unknown address prepares the dummy hash. That cost is paid
    // by both paths — the known one prepares it too — so it is settled
    // before the two are measured against each other.
    await authService
      .loginUser({ email: "warmup@darthub.dev", password: PASSWORD })
      .catch(() => undefined);

    const measure = async (email: string): Promise<number> => {
      const started = process.hrtime.bigint();
      await authService.loginUser({ email, password: "not-the-password" }).catch(() => undefined);
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    const unknown = await measure("ghost@darthub.dev");
    const wrong = await measure(ACCOUNT_EMAIL);

    // A factor of ten is far beyond the jitter of two bcrypt comparisons on
    // a shared machine, and far below the three orders of magnitude that
    // the placeholder hash produced: that one made the unknown address
    // answer in under a millisecond while a registered one took the full
    // cost factor.
    expect(unknown).toBeGreaterThan(wrong / 10);
  });
});
