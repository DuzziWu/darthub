/**
 * Redis-backed room store for production.
 *
 * Serializes room state as JSON. Redis connection is established lazily
 * on first operation. Requires USE_REDIS=1 and a running Redis instance.
 */
import Redis from "ioredis";
import type { IRoomStore } from "@/realtime/IRoomStore";
import type { GameRoom } from "@/realtime/GameRoom";

const REDIS_KEY_PREFIX = "darthub:room:";

export class RedisRoomStore implements IRoomStore {
  private client: Redis | null = null;

  /** Lazily creates the Redis client. */
  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        lazyConnect: true,
      });
    }
    return this.client;
  }

  async save(room: GameRoom, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    const snapshot = this.serializeRoom(room);
    const key = `${REDIS_KEY_PREFIX}${room.roomCode}`;
    if (ttlSeconds !== undefined) {
      await client.set(key, JSON.stringify(snapshot), "EX", ttlSeconds);
    } else {
      await client.set(key, JSON.stringify(snapshot));
    }
  }

  async findByCode(roomCode: string): Promise<GameRoom | undefined> {
    const client = this.getClient();
    const raw = await client.get(`${REDIS_KEY_PREFIX}${roomCode}`);
    if (!raw) return undefined;
    return this.deserializeRoom(JSON.parse(raw));
  }

  async findAll(): Promise<GameRoom[]> {
    const client = this.getClient();
    const keys = await client.keys(`${REDIS_KEY_PREFIX}*`);
    if (keys.length === 0) return [];
    const values = await client.mget(keys);
    const rooms: GameRoom[] = [];
    for (const raw of values) {
      if (raw) {
        try {
          rooms.push(this.deserializeRoom(JSON.parse(raw)));
        } catch {
          // Skip corrupted entries
        }
      }
    }
    return rooms;
  }

  async delete(roomCode: string): Promise<void> {
    const client = this.getClient();
    await client.del(`${REDIS_KEY_PREFIX}${roomCode}`);
  }

  // -------------------------------------------------------------------------
  // Serialization helpers
  // -------------------------------------------------------------------------

  /** Serializes the essential room state needed for reconstruction. */
  private serializeRoom(room: GameRoom): object {
    return {
      roomCode: room.roomCode,
      inviteCode: (room as unknown as { inviteCode: string }).inviteCode,
      hostSeat: room.getHostSeat(),
      roster: room.getRoster(),
      matchSnapshot: room.getMatchSnapshot(),
      status: room.getStatus(),
    };
  }

  /** Reconstructs a GameRoom from serialized state. */
  // shortcut: full GameRoom reconstruction; upgrade when reconnection requires all player secrets
  private deserializeRoom(data: {
    roomCode: string;
    inviteCode: string;
    hostSeat: unknown;
  }): GameRoom {
    // Reconstruct a minimal room by calling the factory and then restoring state.
    // Since GameRoom constructor is private, we use the create() path and then
    // reflect the serialized fields back. This is a temporary seam until a proper
    // deserialize factory is added to GameRoom itself.
    const room = GameRoom.create(
      data.hostSeat ? (data.hostSeat as { playerName: string }).playerName : "reconnected",
      false,
    );
    // Override the generated codes with the stored ones
    (room as unknown as { roomCode: string }).roomCode = data.roomCode;
    (room as unknown as { inviteCode: string }).inviteCode = data.inviteCode;
    return room;
  }
}
