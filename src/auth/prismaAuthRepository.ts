/** Prisma-backed {@link AuthRepository}. Delegates stay thin: every call maps
 * 1:1 onto a Prisma query, transactions go through `prisma.$transaction`, so
 * unit tests can swap in the in-memory double while integration code runs the
 * real client. This module is exercised by type checking and the schema tests
 * (no live PostgreSQL exists in CI; see task file implementation notes). */

import type { Guest, PrismaClient } from "@prisma/client";
import type {
  AuthRepository,
  AuthUnitOfWork,
  CreateGuestInput,
  CreateUserInput,
  GuestRow,
  GuestStore,
  ProgressStore,
  UserRow,
  UserStore,
} from "./repository";

/** Minimal structural subset of the generated client, so callers can pass
 * `PrismaClient` or a test double with the same surface. */
export type AuthPrismaClient = Pick<PrismaClient, keyof PrismaClient & keyof AuthPrismaSurface>;
type AuthPrismaSurface = {
  user: PrismaClient["user"];
  guest: PrismaClient["guest"];
  eloRating: PrismaClient["eloRating"];
  performanceRating: PrismaClient["performanceRating"];
  score: PrismaClient["score"];
  gameSession: PrismaClient["gameSession"];
  friend: PrismaClient["friend"];
  $transaction: PrismaClient["$transaction"];
};

function mapUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "USER" | "ADMIN";
  createdAt: Date;
  updatedAt: Date;
}): UserRow {
  return { ...user };
}

function mapGuest(guest: Guest): GuestRow {
  return {
    id: guest.id,
    userId: guest.userId,
    nickname: guest.nickname,
    migrationTokenHash: guest.migrationTokenHash,
    createdAt: guest.createdAt,
    lastSeenAt: guest.lastSeenAt,
  };
}

function createUserStore(client: AuthPrismaSurface): UserStore {
  return {
    async findByEmail(email: string): Promise<UserRow | null> {
      const found = await client.user.findUnique({ where: { email: email.toLowerCase() } });
      return found ? mapUser(found) : null;
    },
    async findById(id: string): Promise<UserRow | null> {
      const found = await client.user.findUnique({ where: { id } });
      return found ? mapUser(found) : null;
    },
    async create(input: CreateUserInput): Promise<UserRow> {
      const created = await client.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
        },
      });
      return mapUser(created);
    },
    async delete(id: string): Promise<void> {
      await client.user.delete({ where: { id } });
    },
    async findAll(): Promise<UserRow[]> {
      return (await client.user.findMany()).map(mapUser);
    },
  };
}

function createGuestStore(client: AuthPrismaSurface): GuestStore {
  return {
    async findById(id: string): Promise<GuestRow | null> {
      const found = await client.guest.findUnique({ where: { id } });
      return found ? mapGuest(found) : null;
    },
    async create(input: CreateGuestInput): Promise<GuestRow> {
      const created = await client.guest.create({
        data: {
          nickname: input.nickname,
          userId: input.userId,
          migrationTokenHash: input.migrationTokenHash,
        },
      });
      return mapGuest(created);
    },
    async update(guest: GuestRow): Promise<GuestRow> {
      const updated = await client.guest.update({
        where: { id: guest.id },
        data: {
          userId: guest.userId,
          nickname: guest.nickname,
          migrationTokenHash: guest.migrationTokenHash,
          lastSeenAt: new Date(),
        },
      });
      return mapGuest(updated);
    },
  };
}

function createProgressStore(client: AuthPrismaSurface): ProgressStore {
  return {
    /** Reassigns every progress row owned by the guest's mirror user. Uses
     * `updateMany` per table. NOTE for task 004: if the target user already
     * owns rows for the same (mode) or (sessionId), PostgreSQL rejects the
     * unique violation — the full migration flow must merge first. */
    async reassign(fromUserId: string, toUserId: string): Promise<number> {
      let moved = 0;
      moved += (
        await client.eloRating.updateMany({
          data: { userId: toUserId },
          where: { userId: fromUserId },
        })
      ).count;
      moved += (
        await client.performanceRating.updateMany({
          data: { userId: toUserId },
          where: { userId: fromUserId },
        })
      ).count;
      moved += (
        await client.score.updateMany({ data: { userId: toUserId }, where: { userId: fromUserId } })
      ).count;
      moved += (
        await client.gameSession.updateMany({
          data: { playerOneId: toUserId },
          where: { playerOneId: fromUserId },
        })
      ).count;
      moved += (
        await client.gameSession.updateMany({
          data: { playerTwoId: toUserId },
          where: { playerTwoId: fromUserId },
        })
      ).count;
      // Wins are reassigned last: a session could keep fromUserId as winner
      // only after the participation columns moved; updating by winnerId is
      // independent and idempotent.
      moved += (
        await client.gameSession.updateMany({
          data: { winnerId: toUserId },
          where: { winnerId: fromUserId },
        })
      ).count;
      // Friend graph edges keep their uniqueness per direction; the complete
      // merge rules (dedup on both directions) belong to task 004.
      moved += (
        await client.friend.updateMany({
          data: { requesterId: toUserId },
          where: { requesterId: fromUserId },
        })
      ).count;
      moved += (
        await client.friend.updateMany({
          data: { addresseeId: toUserId },
          where: { addresseeId: fromUserId },
        })
      ).count;
      return moved;
    },
  };
}

function unitFor(client: AuthPrismaSurface): AuthUnitOfWork {
  return {
    users: createUserStore(client),
    guests: createGuestStore(client),
    progress: createProgressStore(client),
  };
}

export function createPrismaAuthRepository(client: AuthPrismaClient): AuthRepository {
  const surface = client as AuthPrismaSurface;
  return {
    ...unitFor(surface),
    async runInTransaction<T>(fn: (tx: AuthUnitOfWork) => Promise<T>): Promise<T> {
      return client.$transaction(async (tx) => fn(unitFor(tx as unknown as AuthPrismaSurface)));
    },
  };
}

/** Rows are re-exported for callers that want ORM-level typing. */
export type { Guest, Score } from "@prisma/client";
