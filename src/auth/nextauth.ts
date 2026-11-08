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
import { createAuthService } from "./authService";
import { createGuestService } from "./guest";
import { createPrismaAuthRepository } from "./prismaAuthRepository";

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

/** Handler exports consumed by `app/api/auth/[...nextauth]/route.ts`.
 * Built eagerly: `NextAuth()` needs no database connection until a request
 * arrives (providers run lazily), while the secret comes from the
 * environment and throws only when unset. */
export const nextAuthHandlers = buildNextAuth(process.env.AUTH_SECRET).handlers;
