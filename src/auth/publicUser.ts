/**
 * The public shape of a user account.
 *
 * The password hash is the one field of a `UserRow` that must never leave
 * the server, and it used to leave it: `app/api/auth/invitation` answered
 * with the whole row, hash included. Every other auth route built its
 * answer field by field and was therefore correct by construction — but
 * three copies of that field list are three chances to add a field to the
 * wrong side.
 *
 * This module is the single place that knows which fields a client may see.
 * It is an **allow list**: a field that is not named here is not sent. A
 * new column on the user row therefore cannot leak by accident — it has to
 * be named here first, in a place a reviewer reads.
 */

import type { UserRow } from "./repository";

/** The user as a client may see it. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

/**
 * The account without the password hash.
 *
 * The hash is not "removed" from the row — the result is built from the
 * named fields only, so a field that does not appear in {@link PublicUser}
 * cannot appear in the answer.
 */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
