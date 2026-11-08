/**
 * Registry of active private rooms.
 *
 * Keeps the room lookup seam narrow so later tasks (015 invite codes,
 * 046/047 room persistence) can swap the in-memory implementation
 * without touching the socket layer.
 */
import { GameRoom } from "@/realtime/GameRoom";

/** In-memory store of live rooms keyed by room code. */
export class RoomRegistry {
  private readonly rooms = new Map<string, GameRoom>();
  /** Simple in‑memory backup of room snapshots for persistence. */
  private readonly backup: { roomCode: string; data: unknown }[] = [];

  /** Creates a new private room with the given host name. */
  createRoom(hostPlayerName: string, withAiOpponent = false): GameRoom {
    const room = GameRoom.create(hostPlayerName, withAiOpponent);
    this.rooms.set(room.roomCode, room);
    // Store a shallow snapshot for backup; real implementation would serialize state.
    this.backup.push({ roomCode: room.roomCode, data: room.getMembership(room.getHostSeat()) });
    return room;
  }

  /** Finds a live room by its public code, if any. */
  findByCode(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode);
  }

  /** Returns the persisted backup entries (for testing). */
  getBackup(): readonly { roomCode: string; data: unknown }[] {
    return this.backup;
  }
}
