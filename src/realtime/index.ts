/**
 * Public entry point of the realtime (Socket.IO) server layer.
 */
export { createRealtimeServer, start, type RealtimeServer } from "@/realtime/server";
export { createSocketIoServer } from "@/realtime/socketServer";
export {
  GameRoom,
  RoomChangeError,
  RoomRejectionCode,
  ROOM_MAX_PLAYERS,
} from "@/realtime/GameRoom";
export type {
  RoomMembership,
  RoomPlayer,
  RosterPlayer,
  RoomRejectionCodeValue,
} from "@/realtime/GameRoom";
export { GameStateMachine, GameStateError, GameInputError } from "@/realtime/GameStateMachine";
export { RoomRegistry } from "@/realtime/RoomRegistry";
export { generateRoomCode, generateSecretToken } from "@/realtime/ids";
export { REALTIME_EVENTS } from "@/realtime/types";
export type { Ack, AIProvider, ErrorCode, RealtimeServerOptions } from "@/realtime/types";
