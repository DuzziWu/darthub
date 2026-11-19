/** Password hashing via bcrypt. Kept behind functions so services never
 * depend on the hashing library directly. */

import { randomBytes } from "node:crypto";
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
    // Malformed hashes must behave like a failed comparison, not a crash.
    return false;
  }
}

/**
 * The hash the login path compares against when the address is unknown.
 *
 * The point of the comparison is that an unknown address and a wrong
 * password cost the same. That only works if the hash is a **real** bcrypt
 * hash: bcrypt rejects a malformed hash immediately, so a placeholder
 * string made the unknown-address path answer in well under a millisecond
 * while the known-account path paid the full cost factor. The difference
 * was three orders of magnitude — large enough to name every registered
 * address one request at a time.
 *
 * The hash is computed from random bytes that are thrown away, once per
 * process, and it is never stored anywhere. It cannot match a password:
 * the secret behind it no longer exists.
 */
let dummyHash: Promise<string> | null = null;

export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hash(randomBytes(32).toString("hex"), BCRYPT_COST);
  return dummyHash;
}
