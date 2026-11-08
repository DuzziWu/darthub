/** Guest sessions: anonymous players who can play and hold progress without
 * an email account, and who can later be migrated onto a real account.
 *
 * Mapping decision (documented for task 004): the current schema attaches all
 * progress rows (ratings, scores, game participations) to `User` ids through
 * foreign keys, so every guest receives an ephemeral "mirror" `User` row in
 * the reserved `@guests.darthub.invalid` domain. The mirror user is not a
 * login (its password hash is a throwaway of random bytes, and registration
 * refuses the whole reserved domain). `Guest.userId` points at the mirror
 * user; migration reassigns the progress to the real account.
 *
 * Ownership proof (security finding S-1): guest creation issues a one-time
 * 512-bit migration token; only its sha256 hash is stored, and
 * `migrateGuestToUser` refuses any migration without it. Callers hand the
 * plaintext token to the guest's client exactly once.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { GuestMigrationError } from "./errors";
import { hashPassword } from "./password";
import { createSessionToken, GUEST_SESSION_TTL_SECONDS, readSessionSecret } from "./session";
import type { AuthRepository, GuestRow } from "./repository";

/** Reserved subdomain for synthetic guest identities. Registration must
 * refuse it so a mirror user can never be claimed as a real account. */
export const RESERVED_GUEST_DOMAIN = "guests.darthub.invalid";

export function isReservedGuestDomainEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${RESERVED_GUEST_DOMAIN}`);
}

function hashMigrationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const DEFAULT_GUEST_NICKNAME = "Guest";
const NICKNAME_MAX_LENGTH = 64;

export interface CreateGuestInput {
  nickname?: string;
}

export interface GuestSessionResult {
  guest: GuestRow;
  sessionToken: string;
  /** Plaintext one-time migration token; only its hash is stored server-side. */
  migrationToken: string;
}

export interface GuestServiceDeps {
  repository: AuthRepository;
  /** Signing secret; falls back to `process.env.AUTH_SECRET` in production. */
  sessionSecret?: string;
  hashPassword?(plain: string): Promise<string>;
  issueGuestSession?(guest: GuestRow, progressUserId: string): Promise<string>;
}

export interface GuestService {
  createGuestSession(input: CreateGuestInput): Promise<GuestSessionResult>;
  /** Links the guest to a real account inside one transaction: progress is
   * reassigned to the target user, `Guest.userId` is repointed and the
   * one-time token is burned. Task 004 builds the API flow on this seam. */
  migrateGuestToUser(input: MigrateGuestInput): Promise<MigrateGuestResult>;
}

/** Proof of ownership: the caller must present the plaintext one-time token
 * issued when the guest session was created (finding S-1). */
export interface MigrateGuestInput {
  guestId: string;
  migrationToken: string;
  targetUserId: string;
}

export interface MigrateGuestResult {
  guest: GuestRow;
  migratedProgressRows: number;
}

function tokenHashMatches(storedHash: string | null, presentedToken: string): boolean {
  if (storedHash === null) {
    return false;
  }
  const presentedHash = hashMigrationToken(presentedToken);
  const a = Buffer.from(storedHash, "utf8");
  const b = Buffer.from(presentedHash, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

async function defaultIssueGuestSession(
  guest: GuestRow,
  progressUserId: string,
  secret: string,
): Promise<string> {
  return createSessionToken(
    { sub: guest.id, kind: "guest", nickname: guest.nickname, progressUserId },
    secret,
    { expiresIn: GUEST_SESSION_TTL_SECONDS },
  );
}

export function createGuestService(deps: GuestServiceDeps): GuestService {
  const { repository, issueGuestSession } = deps;
  const hashPasswordImpl = deps.hashPassword;

  return {
    async createGuestSession(input: CreateGuestInput): Promise<GuestSessionResult> {
      const nickname = (input.nickname ?? DEFAULT_GUEST_NICKNAME).slice(0, NICKNAME_MAX_LENGTH);

      return repository.runInTransaction(async (tx) => {
        // Throwaway credential: the plain secret is never returned or
        // stored, so nobody can log in as the mirror user.
        const throwawayPassword = randomBytes(32).toString("hex");

        const mirrorUser = await tx.users.create({
          email: `guest-${randomUUID()}@${RESERVED_GUEST_DOMAIN}`,
          passwordHash: await (hashPasswordImpl ?? hashPassword)(throwawayPassword),
          displayName: nickname,
        });

        // One-time migration token issued exactly once; only its hash is
        // persisted (ownership proof for the later migration — S-1).
        const migrationToken = randomBytes(32).toString("hex");
        const guest = await tx.guests.create({
          nickname,
          userId: mirrorUser.id,
          migrationTokenHash: hashMigrationToken(migrationToken),
        });

        const issue =
          issueGuestSession ??
          ((resolvedGuest: GuestRow, progressUserId: string) =>
            defaultIssueGuestSession(
              resolvedGuest,
              progressUserId,
              deps.sessionSecret ?? readSessionSecret(),
            ));
        const sessionToken = await issue(guest, mirrorUser.id);

        return { guest, sessionToken, migrationToken };
      });
    },

    async migrateGuestToUser(input: MigrateGuestInput): Promise<MigrateGuestResult> {
      // One generic failure for unknown guests, missing/wrong tokens and
      // already-burned tokens — responses never narrow down why.
      return repository.runInTransaction(async (tx) => {
        const guest = await tx.guests.findById(input.guestId);
        if (guest === null || !tokenHashMatches(guest.migrationTokenHash, input.migrationToken)) {
          throw new GuestMigrationError();
        }

        const targetUser = await tx.users.findById(input.targetUserId);
        if (targetUser === null) {
          throw new GuestMigrationError();
        }
        const mirrorUserId = guest.userId;
        if (mirrorUserId === null || mirrorUserId === targetUser.id) {
          throw new GuestMigrationError();
        }

        // 1) The progress (ratings, scores, game participations) moves to
        //    the real account before anything else is removed.
        const migratedProgressRows = await tx.progress.reassign(mirrorUserId, targetUser.id);

        // 2) Repoint the guest, 3) burn the one-time proof, 4) retire the
        //    mirror identity (its leftovers cascade away with it).
        const migratedGuest = await tx.guests.update({
          ...guest,
          userId: targetUser.id,
          migrationTokenHash: null,
        });
        await tx.users.delete(mirrorUserId);

        return { guest: migratedGuest, migratedProgressRows };
      });
    },
  };
}
