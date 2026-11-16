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
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createAuthService } from "./authService";
import { createGuestService } from "./guest";
import { createPrismaAuthRepository } from "./prismaAuthRepository";

/** The guest provider hands out more than the Auth.js user shape: the
 * one-time migration token travels with the session, so the client can
 * convert the guest into a real account (`POST /api/auth/link-guest`). */
interface GuestSessionUser extends User {
  guestId: string;
  migrationToken: string;
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
          const { guest, migrationToken } = await guestService.createGuestSession({});
          // The one-time migration token rides along with the session: it is
          // the proof of ownership the client needs for
          // `POST /api/auth/link-guest`. Only its hash is stored
          // (`src/auth/guest.ts`), so this is the single moment the client
          // learns it.
          const guestUser: GuestSessionUser = {
            id: guest.id,
            name: guest.nickname,
            email: null,
            guestId: guest.id,
            migrationToken,
          };
          return guestUser;
        },
      }),
    ],
    callbacks: {
      // The guest provider's one-time migration token has to survive the
      // round trip through the JWT, and the session callback decides what the
      // client may read. Account sessions pass through unchanged.
      async jwt({ token, user }) {
        if (user) {
          const guestUser = user as User & Partial<GuestSessionUser>;
          if (typeof guestUser.migrationToken === "string") {
            token.guestId = guestUser.guestId;
            token.migrationToken = guestUser.migrationToken;
          }
        }
        return token;
      },
      async session({ session, token }) {
        const migrationToken = token.migrationToken;
        if (typeof migrationToken !== "string") {
          return session;
        }
        // Only a guest session carries the conversion proof; an account
        // session keeps the shape Auth.js hands out by default.
        const guestSession = {
          ...session,
          guestId: token.guestId,
          migrationToken,
        };
        return guestSession;
      },
    },
  });
}

/** Handler exports consumed by `app/api/auth/[...nextauth]/route.ts`.
 * Built eagerly: `NextAuth()` needs no database connection until a request
 * arrives (providers run lazily), while the secret comes from the
 * environment and throws only when unset. */
export const nextAuthHandlers = buildNextAuth(process.env.AUTH_SECRET).handlers;
