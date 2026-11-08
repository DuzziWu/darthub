/**
 * Persistence seam for game rooms.
 *
 * Allows swapping between in-memory (local dev) and Redis (production)
 * storage without touching the socket layer.
 */
import type { GameRoom } from "@/realtime/GameRoom";

export interface IRoomStore {
  /** Persists a room. Implementations decide serialization strategy. */
  save(room: GameRoom, ttlSeconds?: number): Promise<void>;

  /** Looks up a room by its public room code. */
  findByCode(roomCode: string): Promise<GameRoom | undefined>;

  /** Returns all known rooms (for listing / cleanup). */
  findAll(): Promise<GameRoom[]>;

  /** Removes a room from the store. */
  delete(roomCode: string): Promise<void>;
}
