/**
 * In-memory room store for local development.
 *
 * Rooms are kept in a Map keyed by room code. Data is lost on server restart.
 */
import type { IRoomStore } from "@/realtime/IRoomStore";
import type { GameRoom } from "@/realtime/GameRoom";

export class InMemoryRoomStore implements IRoomStore {
  private readonly rooms = new Map<string, GameRoom>();

  async save(room: GameRoom, _ttlSeconds?: number): Promise<void> {
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
