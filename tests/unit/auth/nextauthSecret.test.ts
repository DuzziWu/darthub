import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { KNOWN_PLACEHOLDER_SECRETS } from "@/auth/session";

/**
 * The secret check of the Auth.js path.
 *
 * Auth.js takes the secret as a plain string, so it cannot go through
 * `readSessionSecret()`. The check therefore sits in front of the Auth.js
 * handlers (`src/auth/nextauth.ts`) — and it has to be proven there, because
 * a check that is only documented is a check that does not exist.
 */

const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

const previousSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = previousSecret;
  }
  vi.resetModules();
});

/**
 * Imports the Auth.js configuration with the secret of the environment.
 *
 * The error class comes from the same module registry, so `instanceof`
 * works: `vi.resetModules()` gives every import its own copy of a class,
 * and a class imported before the reset is a different one.
 */
async function importNextAuth() {
  vi.resetModules();
  const nextauth = await import("@/auth/nextauth");
  const { SessionConfigError } = await import("@/auth/sessionErrors");
  return { ...nextauth, SessionConfigError };
}

describe("the secret of the Auth.js path", () => {
  it("refuses the placeholder from the example file", async () => {
    const placeholder = KNOWN_PLACEHOLDER_SECRETS[0] ?? "";
    process.env.AUTH_SECRET = placeholder;

    const { nextAuthHandlers, SessionConfigError } = await importNextAuth();

    // The refusal happens before Auth.js sees the request, so no session is
    // signed or verified with a secret that is published in the repository.
    await expect(
      nextAuthHandlers.GET(new NextRequest("http://localhost/api/auth/session")),
    ).rejects.toThrow(SessionConfigError);
    await expect(
      nextAuthHandlers.POST(
        new NextRequest("http://localhost/api/auth/callback/credentials", { method: "POST" }),
      ),
    ).rejects.toThrow(SessionConfigError);
  });

  it("refuses a secret that is too short", async () => {
    process.env.AUTH_SECRET = "short";

    const { nextAuthHandlers, SessionConfigError } = await importNextAuth();

    await expect(
      nextAuthHandlers.GET(new NextRequest("http://localhost/api/auth/session")),
    ).rejects.toThrow(SessionConfigError);
  });

  it("does not put the secret into the refusal", async () => {
    const placeholder = KNOWN_PLACEHOLDER_SECRETS[0] ?? "";
    process.env.AUTH_SECRET = placeholder;

    const { nextAuthHandlers } = await importNextAuth();

    // The message names the reason and never the secret itself.
    let message = "";
    try {
      await nextAuthHandlers.GET(new NextRequest("http://localhost/api/auth/session"));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/secret/i);
    expect(message).not.toContain(placeholder);
  });

  it("accepts a strong secret and hands the request to Auth.js", async () => {
    process.env.AUTH_SECRET = STRONG_SECRET;

    const { nextAuthHandlers } = await importNextAuth();

    // The request reaches Auth.js: the check does not block a deployment
    // that configured its secret properly.
    const response = await nextAuthHandlers.GET(
      new NextRequest("http://localhost/api/auth/session"),
    );

    expect(response.status).toBeLessThan(500);
  });
});
