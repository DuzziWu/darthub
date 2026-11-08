/**
 * Simple in‑memory invitation code store.
 * In production this would be persisted (e.g., Prisma model) but for the MVP a Set
 * suffices and keeps the implementation trivial.
 */

const invitationCodes = new Set<string>();

/** Generate a new invitation code and store it.
 * Returns the code string.
 */
export function generateInvitationCode(): string {
  // Use a short, URL‑safe random string.
  const code = Math.random().toString(36).substring(2, 10);
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
