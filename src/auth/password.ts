/** Password hashing via bcrypt. Kept behind functions so services never
 * depend on the hashing library directly. */

import { compare, hash } from "bcryptjs";

/** bcrypt cost factor. 12 is the recommended minimum for interactive login. */
const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(plain, passwordHash);
  } catch {
    // Malformed hashes (e.g. the drowsy-password decoy for unknown emails)
    // must behave like a failed comparison, not a crash.
    return false;
  }
}
