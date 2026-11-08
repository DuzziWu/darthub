/**
 * Registry of active private rooms.
 *
 * Delegates room persistence to a pluggable IRoomStore implementation.
 * Uses InMemoryRoomStore by default for local development.
 */
import { GameRoom } from "@/realtime/GameRoom";
import { InMemoryRoomStore } from "@/realtime/InMemoryRoomStore";
import type { IRoomStore } from "@/realtime/IRoomStore";

/** Default TTL for room persistence in seconds (1 hour). */
const DEFAULT_TTL_SECONDS = 3600;

/** Constructor options for RoomRegistry. */
export interface RoomRegistryOptions {
  /** Persistence store; defaults to InMemoryRoomStore. */
  store?: IRoomStore;
  /** Default TTL in seconds for saved room snapshots. */
  defaultTtlSeconds?: number;
}

/** In-memory store of live rooms keyed by room code. */
export class RoomRegistry {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly store: IRoomStore;
  private readonly defaultTtlSeconds: number;

  constructor(options: RoomRegistryOptions = {}) {
    this.store = options.store ?? new InMemoryRoomStore();
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  /** Creates a new private room with the given host name. */
  createRoom(hostPlayerName: string, withAiOpponent = false): GameRoom {
    const room = GameRoom.create(hostPlayerName, withAiOpponent);
    this.rooms.set(room.roomCode, room);
    void this.persistRoom(room);
    return room;
  }

  /** Finds a live room by its public code, if any. */
  findByCode(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode);
  }

  /** Returns the persistence store (for testing). */
  getStore(): IRoomStore {
    return this.store;
  }

  /** Persists a room snapshot to the configured store. */
  private async persistRoom(room: GameRoom): Promise<void> {
    await this.store.save(room, this.defaultTtlSeconds);
  }
}
