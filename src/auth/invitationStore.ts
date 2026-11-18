/**
 * Simple in‑memory invitation code store.
 * In production this would be persisted (e.g., Prisma model) but for the MVP a Set
 * suffices and keeps the implementation trivial.
 */

import { randomBytes } from "node:crypto";

/** The characters a code is made of. Lowercase and digits, so a code can be
 * read out loud and typed without a keyboard that has a different layout. */
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 8;

/**
 * The number of byte values a code may not use: the last few values of a
 * byte would be picked more often than the others by a plain modulo, so
 * they are thrown away. Rejection sampling keeps every code equally likely.
 */
const REJECTED_BYTES = 256 - (256 % CODE_ALPHABET.length);

const invitationCodes = new Set<string>();

/** Generates a new invitation code and stores it.
 * Returns the code string.
 *
 * The randomness comes from the operating system's cryptographic generator.
 * `Math.random()` is not a cryptographic source: its output is predictable
 * once a few of its values are known, and a predictable invitation code is
 * an invitation code that can be guessed.
 */
export function generateInvitationCode(): string {
  let code = "";
  while (code.length < CODE_LENGTH) {
    const bytes = randomBytes(CODE_LENGTH);
    for (const byte of bytes) {
      if (byte >= REJECTED_BYTES) {
        continue;
      }
      const character = CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (character === undefined) {
        continue;
      }
      code += character;
      if (code.length === CODE_LENGTH) {
        break;
      }
    }
  }
  invitationCodes.add(code);
  return code;
}

/** Validate and consume a code.
 * Returns true if the code existed and is now removed, false otherwise.
 */
export function consumeInvitationCode(code: string): boolean {
  if (invitationCodes.has(code)) {
    invitationCodes.delete(code);
    return true;
  }
  return false;
}

/** For testing/debugging – expose current codes (read‑only). */
export function listInvitationCodes(): readonly string[] {
  return Array.from(invitationCodes);
}
