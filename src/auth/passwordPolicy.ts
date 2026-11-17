/**
 * The password rules of the product — in one place.
 *
 * The rules used to live only in `src/auth/registerRoutes.ts`, in the route
 * layer. Every other caller of `authService.registerUser` therefore wrote a
 * password the route would have refused: `link-guest` created an account
 * from the request body without ever looking at the password, and the
 * invitation route bypassed the route layer entirely.
 *
 * The rules belong to the service, because the service is the thing that
 * hashes the password. A rule that lives only in a caller is a rule that the
 * next caller forgets. The route layer keeps its own check so it can answer
 * with a friendly message — but it reads the constants from here, so the two
 * can never disagree.
 */

import { InvalidPasswordError } from "./errors";

/** The shortest password the product accepts. Eight characters is the
 * shortest length that is still worth calling a secret; the value was
 * already the rule of the registration route and is unchanged here. */
export const MIN_PASSWORD_LENGTH = 8;

/** bcrypt hashes at most 72 bytes of input and silently drops the rest, so
 * a longer password would be accepted with a truncated secret. It is
 * rejected instead. The value is unchanged from the registration route. */
export const MAX_PASSWORD_BYTES = 72;

/** Why a password was refused. The reason is for the caller; the message
 * the client sees never carries it. */
export type PasswordPolicyViolation = "not-a-string" | "too-short" | "too-long";

/**
 * The rule the password breaks, or `null` when it breaks none.
 *
 * The password is measured in **bytes**, not characters: bcrypt counts bytes,
 * so a password of ten multi-byte characters can still exceed the limit that
 * ten ASCII characters would not.
 */
export function passwordPolicyViolation(password: unknown): PasswordPolicyViolation | null {
  if (typeof password !== "string") {
    return "not-a-string";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "too-short";
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "too-long";
  }
  return null;
}

/** True when the password satisfies every rule. */
export function isPasswordAcceptable(password: unknown): boolean {
  return passwordPolicyViolation(password) === null;
}

/**
 * Refuses a password that breaks a rule.
 *
 * The service calls this before it writes anything, so a caller that goes
 * straight to the service — and not through the registration route — cannot
 * create an account with a password the product would have refused.
 */
export function assertPasswordPolicy(password: unknown): void {
  if (!isPasswordAcceptable(password)) {
    throw new InvalidPasswordError();
  }
}
