/** Row shapes shared by the auth repositories. Kept structural so the
 * Prisma-backed implementation and in-memory test doubles can both satisfy
 * them without leaking ORM details into the services. */

export type UserRole = "USER" | "ADMIN";

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestRow {
  id: string;
  /** The user row that currently owns this guest's identity. While the guest
   * is anonymous this points at an ephemeral "mirror" user holding the
   * guest's progress; after migration it points at the real account. */
  userId: string | null;
  nickname: string;
  /** sha256 hash of the one-time guest migration token (proof of ownership
   * for the migration flow — security finding S-1). Null once used. */
  migrationTokenHash: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface CreateGuestInput {
  nickname: string;
  userId: string;
  migrationTokenHash: string;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  create(input: CreateUserInput): Promise<UserRow>;
  delete(id: string): Promise<void>;
  findAll(): Promise<UserRow[]>;
}

export interface GuestStore {
  findById(id: string): Promise<GuestRow | null>;
  create(input: CreateGuestInput): Promise<GuestRow>;
  update(guest: GuestRow): Promise<GuestRow>;
}

export interface ProgressStore {
  /** Reassigns every progress row owned by `fromUserId` (ratings, scores,
   * game participations) to `toUserId` and returns the number of rows moved. */
  reassign(fromUserId: string, toUserId: string): Promise<number>;
}

/** Transactional unit of work over the auth tables. */
export interface AuthUnitOfWork {
  users: UserStore;
  guests: GuestStore;
  progress: ProgressStore;
}

export interface AuthRepository extends AuthUnitOfWork {
  runInTransaction<T>(fn: (tx: AuthUnitOfWork) => Promise<T>): Promise<T>;
}
