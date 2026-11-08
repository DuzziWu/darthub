/**
 * Socket.IO wiring for the DartHub realtime server.
 *
 * Owns the socket-level concerns (connection lifecycle, acknowledgements,
 * per-socket room bindings, broadcasting) and delegates game decisions to
 * the room services. Nothing here trusts client-supplied identity: seats,
 * turn order and state changes are decided by the server only.
 */
import type { Server as HttpServer } from "node:http";
import type { Socket as ServerSocket, Server as SocketIoServerType } from "socket.io";
import {
  enforceSingleSocketPerPlayer,
  validateThrowPoints,
  validateMatchStart,
} from "@/realtime/antiCheatMiddleware";
import type { MatchState } from "@/game-engine";
import { DARTS_PER_TURN } from "@/game-engine";
import { GameInputError, GameStateError } from "@/realtime/GameStateMachine";
import {
  GameRoom,
  RoomChangeError,
  ROOM_MAX_PLAYERS,
  type RoomPlayer,
  type RoomRejectionCodeValue,
} from "@/realtime/GameRoom";
import { RoomRegistry } from "@/realtime/RoomRegistry";
import { createRoomStore } from "@/realtime/roomStoreFactory";
import {
  REALTIME_EVENTS,
  type Ack,
  type AIProvider,
  type ErrorCode,
  type RealtimeServerOptions,
} from "@/realtime/types";

/** Default CORS allow-list: same-origin and loopback development origins. */
const DEFAULT_CORS_ORIGINS = [/^http:\/\/([localhost|127\.0\.1])(:\d+)?$/];

/** Server-tracked room binding of a connected socket. */
interface SocketBinding {
  readonly room: GameRoom;
  readonly player: RoomPlayer;
}

/** Which socket currently sits in which room (server-side truth). */
const bindings = new Map<ServerSocket, SocketBinding>();

/** Minimal socket-level logger: message only, never payloads. */
export function logInfo(message: string): void {
  process.stdout.write(`[realtime] ${message}\n`);
}

// ---------------------------------------------------------------------------
// Ack helpers
// ---------------------------------------------------------------------------

/** Ok-acknowledgement envelope. */
function ackOk(data: unknown): Ack<unknown> {
  return { ok: true, data };
}

/** Failure-acknowledgement envelope with a stable error code. */
function ackFail(code: ErrorCode, error: string): Ack<unknown> {
  return { ok: false, error, code };
}

/** Delivers an ack, translating internal errors into stable error codes. */
function respond(
  ack: ((response: Ack<unknown>) => void) | undefined,
  run: () => Ack<unknown>,
): void {
  let response: Ack<unknown>;
  try {
    response = run();
  } catch (error) {
    response = errorToFailure(error);
  }
  if (typeof ack === "function") {
    ack(response);
  }
}

/** Translates an internal error into a client-facing ack envelope. */
function errorToFailure(error: unknown): Ack<unknown> {
  if (error instanceof RoomChangeError) {
    return ackFail(roomRejectionToCode(error.code), "Request rejected");
  }
  if (error instanceof GameInputError) {
    return ackFail("invalidThrow", "Throw rejected: points out of range");
  }
  if (error instanceof GameStateError) {
    return ackFail("notYourTurn", "Throw rejected: it is not this player's turn");
  }
  return ackFail("invalidPayload", "Request rejected");
}

/** Maps room rejections onto stable client-facing error codes. */
function roomRejectionToCode(code: RoomRejectionCodeValue): ErrorCode {
  switch (code) {
    case "hostOnly":
      return "notAuthorized";
    case "matchAlreadyStarted":
      return "matchAlreadyStarted";
    case "roomFull":
      return "roomFull";
    default:
      return "invalidInvite";
  }
}

// ---------------------------------------------------------------------------
// Payload reading
// ---------------------------------------------------------------------------

/** Reads a required non-empty string field, or null when absent. */
function readNonEmptyString(payload: unknown, field: string): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

/** Reads an optional secret token, normalized to undefined when absent. */
function readOptionalToken(payload: unknown, field: string): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** Reads an optional display name; rejects clearly invalid input. */
function readPlayerName(payload: unknown): { name: string } | { error: Ack<unknown> } {
  if (typeof payload !== "object" || payload === null) {
    return { name: "host" };
  }
  const raw = (payload as Record<string, unknown>)["playerName"];
  if (raw === undefined) {
    return { name: "host" };
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { error: ackFail("invalidPayload", "playerName must be a non-empty string") };
  }
  return { name: raw.trim() };
}

/** Highest possible single-dart score: triple 20. */
const MAX_THROW_POINTS = 60;

/** Reads a boolean payload flag; undefined when absent or not boolean. */
function readBooleanFlag(payload: unknown, field: string): boolean | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

// ---------------------------------------------------------------------------
// Room resolution
// ---------------------------------------------------------------------------

/** Result of resolving a socket's room binding for a room-scoped command. */
type BoundRoom =
  | { readonly ok: true; readonly room: GameRoom; readonly player: RoomPlayer }
  | { readonly ok: false; readonly ack: Ack<unknown> };

/** Resolves the server-tracked room binding for a room-scoped request. */
function resolveRoomSocket(
  socket: ServerSocket,
  payload: unknown,
  failureCode: ErrorCode,
): BoundRoom {
  const roomCode = readNonEmptyString(payload, "roomCode");
  if (roomCode === null) {
    return { ok: false, ack: ackFail(failureCode, "Unknown room") };
  }
  const binding = bindings.get(socket);
  if (binding === undefined || binding.room.roomCode !== roomCode) {
    return { ok: false, ack: ackFail("roomNotFound", "Unknown room") };
  }
  return { ok: true, room: binding.room, player: binding.player };
}

/** Attaches a Socket.IO server to the given HTTP server. */
export function createSocketIoServer(
  httpServer: HttpServer,
  options: RealtimeServerOptions = {},
): SocketIoServerType {
  const io = new SocketIoServer(httpServer, {
    cors: { origin: DEFAULT_CORS_ORIGINS, methods: ["GET", "POST"] },
  });
  const registry = new RoomRegistry({ store: options.roomStore ?? createRoomStore() });
  const runAiTurns = createAiTurnRunner(options.aiProvider, io);
  /** Broadcasts one state change to the room and drains AI turns. */
  const publishState = (room: GameRoom, state: MatchState): MatchState => {
    io.to(room.roomCode).emit(REALTIME_EVENTS.stateUpdate, { state });
    const aiUpdate = runAiTurns(room);
    if (aiUpdate !== null) {
      io.to(room.roomCode).emit(REALTIME_EVENTS.stateUpdate, { state: aiUpdate });
    }
    return state;
  };

  io.on("connection", (socket) => {
    logInfo(`socket connected (${socket.id})`);
    socket.emit(REALTIME_EVENTS.welcome, { socketId: socket.id });

    socket.on(
      REALTIME_EVENTS.roomCreate,
      (payload: unknown, ack?: (response: Ack<unknown>) => void) => {
        respond(ack, () => {
          const name = readPlayerName(payload);
          if ("error" in name) {
            return name.error;
          }
          const previous = bindings.get(socket);
          if (previous) {
            socket.leave(previous.room.roomCode);
            bindings.delete(socket);
          }
          const room = registry.createRoom(
            name.name,
            readBooleanFlag(payload, "aiOpponent") === true,
          );
          const host = room.getHostSeat();
          bindSocketToRoom(socket, room, host);
          logInfo(`room created (${room.roomCode})`);
          return ackOk(room.getMembership(host));
        });
      },
    );

    socket.on(
      REALTIME_EVENTS.roomJoin,
      (payload: unknown, ack?: (response: Ack<unknown>) => void) => {
        respond(ack, () => {
          const roomCode = readNonEmptyString(payload, "roomCode");
          if (roomCode === null) {
            return ackFail("invalidPayload", "roomCode is required");
          }
          const room = registry.findByCode(roomCode);
          if (room === undefined) {
            return ackFail("roomNotFound", "Unknown room");
          }
          const previous = bindings.get(socket);
          const playerToken =
            readOptionalToken(payload, "playerToken") ??
            (previous?.room === room ? previous.player.playerToken : undefined);
          const player = room.join(readNonEmptyString(payload, "inviteCode") ?? "", playerToken);
          if (previous && previous.room !== room) {
            socket.leave(previous.room.roomCode);
            bindings.delete(socket);
          }
          bindSocketToRoom(socket, room, player);
          logInfo(`socket admitted to room (${room.roomCode})`);
          return ackOk(room.getMembership(player));
        });
      },
    );

    socket.on(
      REALTIME_EVENTS.matchStart,
      (payload: unknown, ack?: (response: Ack<unknown>) => void) => {
        respond(ack, () => {
          const bound = resolveRoomSocket(socket, payload, "invalidPayload");
          if (!bound.ok) {
            return bound.ack;
          }
          // Validate match start via middleware.
          validateMatchStart(bound.room, bound.player.playerId);
          const state = publishState(bound.room, bound.room.startMatch(bound.player.playerId));
          logInfo("match started");
          return ackOk({ state });
        });
      },
    );

    socket.on(
      REALTIME_EVENTS.throwRecord,
      (payload: unknown, ack?: (response: Ack<unknown>) => void) => {
        respond(ack, () => {
          const bound = resolveRoomSocket(socket, payload, "invalidThrow");
          if (!bound.ok) {
            return bound.ack;
          }
          // Validate throw payload via middleware.
          const points = validateThrowPoints(payload);
          const state = publishState(
            bound.room,
            bound.room.recordThrow(bound.player.playerId, points),
          );
          return ackOk({ state });
        });
      },
    );

    socket.on(
      REALTIME_EVENTS.stateRequest,
      (payload: unknown, ack?: (response: Ack<unknown>) => void) => {
        respond(ack, () => {
          const bound = resolveRoomSocket(socket, payload, "invalidPayload");
          if (!bound.ok) {
            return bound.ack;
          }
          return ackOk({ state: bound.room.getMatchSnapshot() });
        });
      },
    );

    socket.on("disconnect", (reason) => {
      logInfo(`socket disconnected (${socket.id}): ${reason}`);
      bindings.delete(socket);
    });
  });

  return io;
}

// ---------------------------------------------------------------------------
// AI seam (task 007)
//
// The AI engine is injected, never imported here. Only seats explicitly
// marked as automated play automatically, and their throws run through
// the exact same validated path as human throws (server authority).
// ---------------------------------------------------------------------------

/** Safety bound so a broken provider cannot loop forever. */
const MAX_AI_TURNS_PER_UPDATE = ROOM_MAX_PLAYERS * DARTS_PER_TURN;

/** Creates the automatic-turn runner for injected AI providers. */
function createAiTurnRunner(
  aiProvider: AIProvider | undefined,
  io: SocketIoServerType,
): (room: GameRoom) => MatchState | null {
  if (aiProvider === undefined) {
    return () => null;
  }
  return (room: GameRoom): MatchState | null => {
    let lastState: MatchState | null = null;
    let turns = 0;
    let snapshot = room.getMatchSnapshot();
    while (
      snapshot !== null &&
      snapshot.status === "inProgress" &&
      snapshot.currentPlayerId !== null &&
      room.isAiSeat(snapshot.currentPlayerId) &&
      turns < MAX_AI_TURNS_PER_UPDATE
    ) {
      const points = aiProvider.selectThrowPoints(snapshot);
      if (!isThrowPoints(points)) {
        break;
      }
      const next = aiTurn(room, snapshot.currentPlayerId, points);
      if (next === null) {
        break;
      }
      lastState = next;
      io.to(room.roomCode).emit(REALTIME_EVENTS.stateUpdate, { state: next });
      turns += 1;
      snapshot = room.getMatchSnapshot();
    }
    return lastState;
  };
}

/** Validates points coming from the AI provider before recording. */
function isThrowPoints(points: unknown): points is number {
  return (
    typeof points === "number" &&
    Number.isInteger(points) &&
    points >= 0 &&
    points <= MAX_THROW_POINTS
  );
}

/** Runs one AI turn and returns the resulting state (or null on failure). */
function aiTurn(room: GameRoom, playerId: string, points: number): MatchState | null {
  try {
    return room.recordThrow(playerId, points);
  } catch (error) {
    logInfo(`automatic turn rejected (${error instanceof Error ? error.name : "unknown"})`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Socket-room bindings
// ---------------------------------------------------------------------------

/** Admits a socket to a room: stores the binding and joins the io room. */
function bindSocketToRoom(socket: ServerSocket, room: GameRoom, player: RoomPlayer): void {
  // Ensure a player has only one active socket.
  // The anti‑cheat middleware handles disconnecting any previous socket.
  enforceSingleSocketPerPlayer(player.playerId, socket);
  bindings.set(socket, { room, player });
  socket.join(room.roomCode);
}
