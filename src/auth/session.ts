/** Session token creation and verification: HS256 JWTs via `jose`.
 *
 * Secrets come from `process.env.AUTH_SECRET` at runtime (see
 * `readSessionSecret`); tests inject their own strong secret. No secrets are
 * ever hard-coded here.
 */

import { SignJWT, jwtVerify } from "jose";
import { SessionConfigError } from "./sessionErrors";

/** Session kinds: a registered account (`user`) or an anonymous guest. */
export type SessionKind = "user" | "guest";

export interface SessionClaims {
  /** Subject: the user id for `user` sessions, the guest id for `guest` sessions. */
  sub: string;
  kind: SessionKind;
  nickname?: string;
  /** Only on guest sessions: the id of the (mirror) user row that currently
   * owns the guest's progress. */
  progressUserId?: string;
  /** Standard JWT claims added on signing. */
  exp?: number;
  iat?: number;
}

/** Registered accounts stay authenticated for a day. */
export const USER_SESSION_TTL_SECONDS = 24 * 60 * 60;
/** Guests get a week so anonymous players aren't logged out mid-session. */
export const GUEST_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** HS256 keys should carry at least 256 bits of entropy; 64 hex characters
 * is the documented strong-secret floor. */
const MIN_SECRET_CHARS = 32;

/**
 * The placeholder secrets the example file ships.
 *
 * A deployment that copies `.env.example` and changes nothing would
 * otherwise sign its sessions with a secret that is published in the
 * repository. The placeholder is long enough to pass the length check, so
 * the length check alone does not stop it — this list does.
 */
export const KNOWN_PLACEHOLDER_SECRETS: readonly string[] = [
  "change-me-with-openssl-rand-base64-32",
];

/**
 * Refuses a secret that must not be used to sign or verify a token.
 *
 * Exported so that the Auth.js configuration can refuse it too: Auth.js
 * takes the secret as a plain string, so it cannot go through
 * {@link readSessionSecret}, and a session signed with a published secret
 * can be forged.
 */
export function assertSessionSecretUsable(secret: string | undefined): void {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_CHARS) {
    throw new SessionConfigError(
      `The session secret must be at least ${MIN_SECRET_CHARS} characters long.`,
    );
  }
  if (KNOWN_PLACEHOLDER_SECRETS.includes(secret)) {
    throw new SessionConfigError(
      "The session secret is still the placeholder from the example file. " +
        "Generate a real one with `openssl rand -base64 32`.",
    );
  }
}

export function readSessionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (typeof secret !== "string" || secret.length === 0) {
    throw new SessionConfigError("AUTH_SECRET is not configured.");
  }
  // The secret is checked here as well as in the token functions, so that a
  // secret that is too short — or that is still the placeholder from the
  // example file — never reaches anything that signs or verifies.
  assertSessionSecretUsable(secret);
  return secret;
}

export interface CreateSessionOptions {
  /** Overrides the default TTL; negative values produce an expired token. */
  expiresIn?: number;
}

export async function createSessionToken(
  claims: Omit<SessionClaims, "exp" | "iat">,
  secret: string,
  options: CreateSessionOptions = {},
): Promise<string> {
  assertSessionSecretUsable(secret);
  const ttlSeconds = options.expiresIn ?? USER_SESSION_TTL_SECONDS;
  // jose treats a numeric expiration as an absolute epoch timestamp, so the
  // relative TTL is converted to unix seconds here.
  const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;

  return new SignJWT({
    kind: claims.kind,
    nickname: claims.nickname,
    progressUserId: claims.progressUserId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresAtEpochSeconds)
    .sign(new TextEncoder().encode(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims> {
  assertSessionSecretUsable(secret);
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

  return {
    sub: String(payload.sub),
    kind: payload.kind as SessionKind,
    nickname: typeof payload.nickname === "string" ? payload.nickname : undefined,
    progressUserId: typeof payload.progressUserId === "string" ? payload.progressUserId : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
  };
}
