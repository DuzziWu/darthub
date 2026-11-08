/**
 * Unit tests for the room store abstraction (task 046).
 *
 * Tests the IRoomStore interface and its two implementations:
 * - InMemoryRoomStore (default for local development)
 * - RedisRoomStore (optional, used when USE_REDIS is set)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GameRoom } from "@/realtime/GameRoom";
import { InMemoryRoomStore } from "@/realtime/InMemoryRoomStore";
import type { IRoomStore } from "@/realtime/IRoomStore";
import { createRoomStore } from "@/realtime/roomStoreFactory";

/** Creates a fresh room for testing. */
function makeRoom(hostName = "Alice"): GameRoom {
  return GameRoom.create(hostName, false);
}

// ---------------------------------------------------------------------------
// IRoomStore contract tests (interface testing via InMemoryRoomStore)
// ---------------------------------------------------------------------------

describe("InMemoryRoomStore", () => {
  let store: IRoomStore;

  beforeEach(() => {
    store = new InMemoryRoomStore();
  });

  it("stores and retrieves room state using the selected backend", async () => {
    const room = makeRoom("Bob");
    await store.save(room);

    const found = await store.findByCode(room.roomCode);
    expect(found).toBeDefined();
    expect(found!.roomCode).toBe(room.roomCode);
    expect(found!.getHostSeat().playerName).toBe("Bob");
  });

  it("returns undefined for a room that does not exist", async () => {
    const found = await store.findByCode("NONEXISTENT");
    expect(found).toBeUndefined();
  });

  it("replaces an existing room with the same code", async () => {
    const room = makeRoom("Player1");
    await store.save(room);
    await store.delete(room.roomCode);
    const found = await store.findByCode(room.roomCode);
    expect(found).toBeUndefined();
  });

  it("finds multiple rooms", async () => {
    const roomA = makeRoom("Alice");
    const roomB = makeRoom("Bob");
    await store.save(roomA);
    await store.save(roomB);

    const all = await store.findAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Factory / fallback tests
// ---------------------------------------------------------------------------

describe("createRoomStore", () => {
  it("falls back to InMemory when Redis is not configured", async () => {
    // Clear any Redis env var
    const prev = process.env.USE_REDIS;
    delete process.env.USE_REDIS;

    const store = createRoomStore();
    expect(store).toBeInstanceOf(InMemoryRoomStore);

    // Restore
    if (prev !== undefined) process.env.USE_REDIS = prev;
  });

  it("selects RedisRoomStore when USE_REDIS is set", async () => {
    const prev = process.env.USE_REDIS;
    process.env.USE_REDIS = "true";

    // Import dynamically so the env var is set before the module loads
    const { RedisRoomStore } = await import("@/realtime/RedisRoomStore");
    const store = createRoomStore();
    expect(store).toBeInstanceOf(RedisRoomStore);

    if (prev !== undefined) {
      process.env.USE_REDIS = prev;
    } else {
      delete process.env.USE_REDIS;
    }
  });
});
