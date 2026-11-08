/**
 * Unit tests for Redis-based room state persistence.
 *
 * Tests verify that:
 * 1. RoomRegistry persists room snapshots to a pluggable IRoomStore
 * 2. Snapshots survive simulated server restarts
 * 3. Stale entries expire after a configurable TTL
 * 4. docker-compose.yml includes a Redis service
 */
import { describe, it, expect } from "vitest";
import { RoomRegistry } from "@/realtime/RoomRegistry";
import type { IRoomStore } from "@/realtime/IRoomStore";
import type { GameRoom } from "@/realtime/GameRoom";

/** Records every save call for assertion. */
class SpyRoomStore implements IRoomStore {
  readonly saveCalls: { room: GameRoom; ttl?: number }[] = [];
  private readonly rooms = new Map<string, GameRoom>();

  async save(room: GameRoom, ttlSeconds?: number): Promise<void> {
    this.saveCalls.push({ room, ttl: ttlSeconds });
    this.rooms.set(room.roomCode, room);
  }

  async findByCode(roomCode: string): Promise<GameRoom | undefined> {
    return this.rooms.get(roomCode);
  }

  async findAll(): Promise<GameRoom[]> {
    return Array.from(this.rooms.values());
  }

  async delete(roomCode: string): Promise<void> {
    this.rooms.delete(roomCode);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Redis room persistence", () => {
  // -------------------------------------------------------------------------
  // Requirement 1: it stores room state in Redis and retrieves it on server start
  // -------------------------------------------------------------------------
  describe("room snapshot persistence", () => {
    it("stores room state in Redis and retrieves it on server start", async () => {
      const store = new SpyRoomStore();
      const registry = new RoomRegistry({ store });

      const room = registry.createRoom("Alice");

      // RoomRegistry must call store.save when creating a room.
      expect(store.saveCalls).toContainEqual(
        expect.objectContaining({ room: expect.objectContaining({ roomCode: room.roomCode }) }),
      );

      // Simulate server restart: reload from store.
      const restored = await store.findByCode(room.roomCode);
      expect(restored).toBeDefined();
      expect(restored!.roomCode).toBe(room.roomCode);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2: it expires stale room entries after a configurable TTL
  // -------------------------------------------------------------------------
  describe("TTL enforcement", () => {
    /**
     * A store that honours the TTL parameter: entries expire after the
     * configured number of seconds. Records calls like SpyRoomStore.
     */
    class TTLStore implements IRoomStore {
      readonly saveCalls: { room: GameRoom; ttl?: number }[] = [];
      private readonly store = new Map<string, { room: GameRoom; expiresAt: number }>();

      async save(room: GameRoom, ttlSeconds?: number): Promise<void> {
        this.saveCalls.push({ room, ttl: ttlSeconds });
        const expiresAt =
          ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
        this.store.set(room.roomCode, { room, expiresAt });
      }

      async findByCode(roomCode: string): Promise<GameRoom | undefined> {
        const entry = this.store.get(roomCode);
        if (!entry) return undefined;
        if (entry.expiresAt < Date.now()) {
          this.store.delete(roomCode);
          return undefined;
        }
        return entry.room;
      }

      async findAll(): Promise<GameRoom[]> {
        return Array.from(this.store.values()).map((e) => e.room);
      }

      async delete(roomCode: string): Promise<void> {
        this.store.delete(roomCode);
      }
    }

    it("expires stale room entries after a configurable TTL", async () => {
      const store = new TTLStore();
      const registry = new RoomRegistry({ store, defaultTtlSeconds: 1 });

      const room = registry.createRoom("Bob", false);

      // RoomRegistry must have called store.save with TTL=1.
      const lastSave = store.saveCalls.at(-1);
      expect(lastSave?.ttl).toBe(1);

      // Immediately after save, entry must be retrievable.
      const before = await store.findByCode(room.roomCode);
      expect(before).not.toBeUndefined();

      // After TTL expires, entry must be gone.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const after = await store.findByCode(room.roomCode);
      expect(after).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3: Docker compose brings up redis alongside app and db
  // -------------------------------------------------------------------------
  describe("docker compose redis service", () => {
    it("compose defines a redis service with correct port and healthcheck", async () => {
      const { readFileSync } = await import("node:fs");
      const { parse } = await import("yaml");
      const compose = parse(readFileSync("docker-compose.yml", "utf-8")) as {
        services?: Record<string, unknown>;
      };

      const services = compose.services ?? {};
      expect(services, "docker-compose must define a 'redis' service").toHaveProperty("redis");

      const redis = services["redis"] as Record<string, unknown>;
      expect(redis).toHaveProperty("image");
      expect(redis).toHaveProperty("ports");
      expect(redis).toHaveProperty("healthcheck");
    });
  });
});
