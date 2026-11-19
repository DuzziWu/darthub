/** Thin Auth.js (next-auth v5) configuration.
 *
 * All logic lives in the testable services under `src/auth/authService.ts`
 * and `src/auth/guest.ts`: the credentials providers only bridge the
 * credentials into `loginUser` / `createGuestSession` and map results onto
 * Auth.js users. APIBearer tokens for route middleware are issued by the
 * same services (`requireAuth` verifies them), so the browser cookie session
 * (Auth.js) and the `Authorization: Bearer` header path share one issuer.
 *
 * `AUTH_SECRET` must be configured at runtime; no secrets are hard-coded.
 */

import { PrismaClient } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";
import { createAuthService } from "./authService";
import { createGuestService } from "./guest";
import { createPrismaAuthRepository } from "./prismaAuthRepository";
import { assertSessionSecretUsable } from "./session";

/**
 * The secret Auth.js signs and verifies its session cookies with.
 *
 * Auth.js takes the secret as a plain string and derives the cookie key
 * from it, so it cannot pass through `readSessionSecret()` — the place
 * where the application's own session tokens get their check. The value is
 * read once, here, because this is the value Auth.js is configured with.
 */
const authJsSecret = process.env.AUTH_SECRET;

/**
 * Refuses a secret that must not be used, when one is configured.
 *
 * A secret that is published in the repository — the placeholder from
 * `.env.example` — lets anyone forge a session cookie, so the Auth.js path
 * refuses it as well.
 *
 * A secret that is not set at all is left to Auth.js: it explains the
 * missing variable better than this module could. The message names the
 * reason and never the secret itself.
 */
function assertUsableAuthJsSecret(): void {
  if (authJsSecret !== undefined && authJsSecret.length > 0) {
    assertSessionSecretUsable(authJsSecret);
  }
}

/** Builds the Auth.js exports. Split from the module singleton so tests can
 * never accidentally instantiate the real `PrismaClient`; the route handler
 * imports `nextAuthHandlers` below. */
function buildNextAuth(secret: string | undefined) {
  const prisma = new PrismaClient();
  const repository = createPrismaAuthRepository(prisma);
  const authService = createAuthService({ repository });
  const guestService = createGuestService({ repository });

  return NextAuth({
    secret,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
      Credentials({
        name: "email",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = typeof credentials?.email === "string" ? credentials.email : "";
          const password = typeof credentials?.password === "string" ? credentials.password : "";
          try {
            const { user } = await authService.loginUser({ email, password });
            return { id: user.id, email: user.email, name: user.displayName };
          } catch {
            return null;
          }
        },
      }),
      Credentials({
        id: "guest",
        name: "guest",
        // No credentials: any sign-in attempt with this provider creates a
        // fresh anonymous guest.
        credentials: {},
        async authorize() {
          const { guest } = await guestService.createGuestSession({});
          return { id: guest.id, name: guest.nickname, email: null };
        },
      }),
    ],
  });
}

const authJsHandlers = buildNextAuth(authJsSecret).handlers;

/**
 * Handler exports consumed by `app/api/auth/[...nextauth]/route.ts`.
 *
 * The handlers are handed to Auth.js unchanged; the check in front of them
 * runs before Auth.js sees a request, so a session is never signed or
 * verified with a secret that must not be used. It covers the session read
 * and the provider callbacks alike, which is where the secret is used.
 *
 * The wrappers are `async`, so a refusal is a rejected promise rather than
 * a synchronous throw: the route handler always answers with a promise.
 */
export const nextAuthHandlers: Record<"GET" | "POST", (req: NextRequest) => Promise<Response>> = {
  GET: async (req: NextRequest) => {
    assertUsableAuthJsSecret();
    return authJsHandlers.GET(req);
  },
  POST: async (req: NextRequest) => {
    assertUsableAuthJsSecret();
    return authJsHandlers.POST(req);
  },
};
