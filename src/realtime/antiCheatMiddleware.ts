import type { Server as ServerSocket } from "socket.io";
import { GameInputError } from "@/realtime/GameStateMachine";
import { RoomChangeError, RoomRejectionCode } from "@/realtime/GameRoom";
import { GameRoom } from "@/realtime/GameRoom";

/** Maximum allowed throw points (triple 20). */
export const MAX_THROW_POINTS = 60 as const;

/**
 * Validates that the supplied payload contains a valid integer "points" field
 * between 0 and {@link MAX_THROW_POINTS}. Returns the numeric value.
 * Throws {@link GameInputError} when validation fails.
 */
export function validateThrowPoints(payload: unknown): number {
  if (typeof payload !== "object" || payload === null) {
    throw new GameInputError("Invalid payload");
  }
  const points = (payload as Record<string, unknown>)["points"];
  if (
    typeof points !== "number" ||
    !Number.isInteger(points) ||
    points < 0 ||
    points > MAX_THROW_POINTS
  ) {
    throw new GameInputError("Throw points out of range");
  }
  return points;
}

/**
 * Tracks which socket is associated with each player ID to prevent duplicate
 * connections. If a different socket is already bound, it is disconnected.
 */
const playerSocketMap = new Map<string, ServerSocket>();
export function enforceSingleSocketPerPlayer(playerId: string, socket: ServerSocket): void {
  const existing = playerSocketMap.get(playerId);
  if (existing && existing !== socket) {
    // Disconnect the old socket; cleanup will be handled by its own logic.
    existing.disconnect(true);
    playerSocketMap.delete(playerId);
  }
  playerSocketMap.set(playerId, socket);
}

/**
 * Validates that a match can be started by the given player in the given room.
 * Throws {@link RoomChangeError} with appropriate code if the match is already
 * started or the caller is not the host.
 */
export function validateMatchStart(room: GameRoom, callerPlayerId: string): void {
  if (!room.isHostSeat(callerPlayerId)) {
    throw new RoomChangeError(RoomRejectionCode.hostOnly);
  }
  if (room.hasStarted()) {
    throw new RoomChangeError(RoomRejectionCode.matchAlreadyStarted);
  }
}
