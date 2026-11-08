/** Typed in-memory double for {@link AuthRepository}. Mirrors the Prisma
 * implementation's behaviour closely enough for unit tests to reason about
 * data preservation without touching a live database. */

import { randomUUID } from "node:crypto";
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
} from "@/auth/repository";

export interface InMemoryAuthStore {
  users: Map<string, UserRow>;
  guests: Map<string, GuestRow>;
  /** Progress rows keyed by owner user id; each row carries its own id and
   * a labelled table name so preservation can be asserted per table. */
  progress: Map<string, ProgressRecord[]>;
}

export interface ProgressRecord {
  table: "EloRating" | "PerformanceRating" | "Score" | "GameSession";
  id: string;
  userId: string;
  payload: Record<string, unknown>;
}

function userIndexByEmail(users: Map<string, UserRow>): Map<string, UserRow> {
  const byEmail = new Map<string, UserRow>();
  for (const user of users.values()) {
    byEmail.set(user.email.toLowerCase(), user);
  }
  return byEmail;
}

function createUserStore(users: Map<string, UserRow>): UserStore {
  const byEmail = () => userIndexByEmail(users);

  return {
    async findByEmail(email) {
      const found = byEmail().get(email.toLowerCase());
      return found ? cloneUser(found) : null;
    },
    async findById(id) {
      const found = users.get(id);
      return found ? cloneUser(found) : null;
    },
    async create(input: CreateUserInput) {
      const now = new Date();
      const user: UserRow = {
        id: randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: "USER",
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      return cloneUser(user);
    },
    async delete(id) {
      users.delete(id);
    },
    async findAll() {
      return [...users.values()].map(cloneUser);
    },
  };
}

function cloneUser(user: UserRow): UserRow {
  return { ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) };
}

function createGuestStore(guests: Map<string, GuestRow>): GuestStore {
  return {
    async findById(id) {
      const found = guests.get(id);
      return found
        ? { ...found, createdAt: new Date(found.createdAt), lastSeenAt: new Date(found.lastSeenAt) }
        : null;
    },
    async create(input: CreateGuestInput) {
      const now = new Date();
      const guest: GuestRow = {
        id: randomUUID(),
        userId: input.userId,
        nickname: input.nickname,
        migrationTokenHash: input.migrationTokenHash,
        createdAt: now,
        lastSeenAt: now,
      };
      guests.set(guest.id, guest);
      return { ...guest };
    },
    async update(guest) {
      if (!guests.has(guest.id)) {
        throw new Error(`Guest ${guest.id} not found`);
      }
      guests.set(guest.id, { ...guest });
      return { ...guest };
    },
  };
}

function createProgressStore(progress: Map<string, ProgressRecord[]>): ProgressStore {
  return {
    async reassign(fromUserId, toUserId) {
      const rows = progress.get(fromUserId) ?? [];
      progress.delete(fromUserId);
      const target = progress.get(toUserId) ?? [];
      // Mirrors the Prisma updateMany: ownership is rewritten on each row.
      const moved = rows.map((row) => ({ ...row, userId: toUserId }));
      progress.set(toUserId, [...target, ...moved]);
      return moved.length;
    },
  };
}

export function unitForStore(store: InMemoryAuthStore): AuthUnitOfWork {
  return {
    users: createUserStore(store.users),
    guests: createGuestStore(store.guests),
    progress: createProgressStore(store.progress),
  };
}

export function createInMemoryAuthRepository(
  store: InMemoryAuthStore = {
    users: new Map(),
    guests: new Map(),
    progress: new Map(),
  },
): AuthRepository & { backingStore: InMemoryAuthStore } {
  const repository: AuthRepository & { backingStore: InMemoryAuthStore } = {
    backingStore: store,
    ...unitForStore(store),
    async runInTransaction<T>(fn: (tx: AuthUnitOfWork) => Promise<T>): Promise<T> {
      return fn(unitForStore(store));
    },
  };
  return repository;
}
