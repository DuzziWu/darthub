import { describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/authService";
import { GuestMigrationError } from "@/auth/errors";
import { createGuestService } from "@/auth/guest";
import { verifySessionToken } from "@/auth/session";
import {
  createInMemoryAuthRepository,
  type ProgressRecord,
} from "./helpers/inMemoryAuthRepository";

// 64 hex characters of entropy — tests inject their own strong secret.
const STRONG_SECRET = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("guestService", () => {
  it("creates a guest session without email", async () => {
    const repository = createInMemoryAuthRepository();
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const result = await guestService.createGuestSession({
      nickname: "Sharpshooter",
    });

    expect(result.guest.nickname).toBe("Sharpshooter");
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    // Proof of ownership for the later migration (one-time token).
    expect(result.migrationToken).toHaveLength(64);

    const claims = await verifySessionToken(result.sessionToken, STRONG_SECRET);
    expect(claims.kind).toBe("guest");
    expect(claims.sub).toBe(result.guest.id);
    expect(claims.nickname).toBe("Sharpshooter");

    // The guest is durable in the database with progress owner (mirror user).
    const storedGuest = await repository.guests.findById(result.guest.id);
    expect(storedGuest).not.toBeNull();
    expect(storedGuest?.userId).toBeTruthy();

    // Nothing about the guest flow requires an email: the only user row the
    // guest touches is the mirror user in the reserved guest domain.
    const mirrorUser = await repository.users.findById(storedGuest?.userId ?? "");
    expect(mirrorUser?.email).toMatch(/@guests\.darthub\.invalid$/);
  });

  it("gives guest sessions a week-long expiration", async () => {
    const repository = createInMemoryAuthRepository();
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const before = Math.floor(Date.now() / 1000);
    const result = await guestService.createGuestSession({});
    const after = Math.floor(Date.now() / 1000);
    const claims = await verifySessionToken(result.sessionToken, STRONG_SECRET);

    expect(claims.exp).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60);
    expect(claims.exp).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60);
  });

  it("refuses registration of addresses in the reserved guest domain", async () => {
    const repository = createInMemoryAuthRepository();
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const result = await guestService.createGuestSession({});
    const mirrorUser = await repository.users.findById(
      (await repository.guests.findById(result.guest.id))?.userId ?? "",
    );

    await expect(
      authService.registerUser({
        email: mirrorUser?.email ?? "",
        password: "attacker-chosen-password",
        displayName: "Attacker",
      }),
    ).rejects.toThrow();
  });
});

describe("guestService.migrateGuestToUser", () => {
  it("migrates guest data to a registered user preserving progress", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const guestSession = await guestService.createGuestSession({
      nickname: "Sharpshooter",
    });

    // Verify one real account through the normal registration flow.
    const { user } = await authService.registerUser({
      email: "veteran@darthub.dev",
      password: "long-enough-password",
      displayName: "Veteran",
    });

    // The guest built up progress while anonymous, all owned by the mirror
    // user behind the guest row.
    const guestRow = await repository.guests.findById(guestSession.guest.id);
    const mirrorUserId = guestRow?.userId ?? "";
    const guestProgress: ProgressRecord[] = [
      {
        table: "EloRating",
        id: "elo-1",
        userId: mirrorUserId,
        payload: { rating: 1245, gamesPlayed: 12, wins: 7, losses: 5 },
      },
      {
        table: "GameSession",
        id: "game-1",
        userId: mirrorUserId,
        payload: { mode: "X01", status: "FINISHED" },
      },
    ];
    repository.backingStore.progress.set(mirrorUserId, guestProgress);

    const result = await guestService.migrateGuestToUser({
      guestId: guestSession.guest.id,
      migrationToken: guestSession.migrationToken,
      targetUserId: user.id,
    });

    // The guest now belongs to the real account and its proof was burned.
    expect(result.guest.userId).toBe(user.id);
    const storedGuest = await repository.guests.findById(guestSession.guest.id);
    expect(storedGuest?.userId).toBe(user.id);
    expect(storedGuest?.migrationTokenHash).toBeNull();

    // Progress survived, now owned by the registered user.
    expect(result.migratedProgressRows).toBe(2);
    const migrated = repository.backingStore.progress.get(user.id) ?? [];
    expect(migrated.map((row) => row.table).sort()).toEqual(["EloRating", "GameSession"]);
    expect(migrated.every((row) => row.userId === user.id)).toBe(true);
    expect(migrated.find((row) => row.table === "EloRating")?.payload).toEqual({
      rating: 1245,
      gamesPlayed: 12,
      wins: 7,
      losses: 5,
    });

    // The mirror identity is gone; only the real account remains.
    expect(await repository.users.findById(mirrorUserId)).toBeNull();
  });

  it("refuses a guest migration without the one-time migration token", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const guestSession = await guestService.createGuestSession({});
    const { user } = await authService.registerUser({
      email: "veteran@darthub.dev",
      password: "long-enough-password",
      displayName: "Veteran",
    });

    const wrongToken = "e".repeat(64);
    await expect(
      guestService.migrateGuestToUser({
        guestId: guestSession.guest.id,
        migrationToken: wrongToken,
        targetUserId: user.id,
      }),
    ).rejects.toThrow(GuestMigrationError);

    // The guest keeps its mirror identity; nothing was linked and the real
    // holder's proof is untouched, so they can still migrate.
    const storedGuest = await repository.guests.findById(guestSession.guest.id);
    expect(storedGuest?.userId).not.toBe(user.id);
    expect(storedGuest?.migrationTokenHash).not.toBeNull();
  });

  it("burns the migration token so it cannot replay the migration", async () => {
    const repository = createInMemoryAuthRepository();
    const authService = createAuthService({
      repository,
      sessionSecret: STRONG_SECRET,
    });
    const guestService = createGuestService({
      repository,
      sessionSecret: STRONG_SECRET,
    });

    const guestSession = await guestService.createGuestSession({});
    const { user } = await authService.registerUser({
      email: "first@darthub.dev",
      password: "long-enough-password",
      displayName: "First",
    });

    await guestService.migrateGuestToUser({
      guestId: guestSession.guest.id,
      migrationToken: guestSession.migrationToken,
      targetUserId: user.id,
    });

    const second = await authService.registerUser({
      email: "second@darthub.dev",
      password: "another-long-password",
      displayName: "Second",
    });
    await expect(
      guestService.migrateGuestToUser({
        guestId: guestSession.guest.id,
        migrationToken: guestSession.migrationToken,
        targetUserId: second.user.id,
      }),
    ).rejects.toThrow(GuestMigrationError);
  });
});
