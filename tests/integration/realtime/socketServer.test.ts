/**
 * Integration tests for the authoritative Socket.IO realtime server
 * (task 009).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { createRealtimeServer } from "@/realtime/server";
import { REALTIME_EVENTS } from "@/realtime/types";
import type { MatchState } from "@/game-engine";
import { emitAck, closeSocket, waitForEvent, type RoomMembershipView } from "./helpers";

const server = createRealtimeServer();
let port = 0;
const openSockets: Socket[] = [];

async function connectClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      reconnection: false,
    });
    openSockets.push(socket);
    socket.once("connect_error", (error: Error) => reject(error));
    // The server sends its acknowledgement on connection; the listener
    // must be registered before the handshake completes to avoid a race.
    waitForEvent<{ socketId: string }>(socket, REALTIME_EVENTS.welcome).then(
      (welcome) =>
        welcome.socketId === socket.id
          ? resolve(socket)
          : reject(new Error("welcome did not acknowledge this socket")),
      reject,
    );
  });
}

/** Waits for the next state update that satisfies the predicate. */
function waitForStateUpdate(
  socket: Socket,
  predicate: (state: MatchState) => boolean,
  timeoutMs = 2000,
): Promise<MatchState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for a state update")),
      timeoutMs,
    );
    socket.on(
      REALTIME_EVENTS.stateUpdate,
      function onUpdate(payload: { state: MatchState | null }) {
        if (payload.state === null || !predicate(payload.state)) {
          return;
        }
        socket.off(REALTIME_EVENTS.stateUpdate, onUpdate);
        clearTimeout(timer);
        resolve(payload.state);
      },
    );
  });
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, "127.0.0.1", () => {
      port = (server.httpServer.address() as { port: number }).port;
      resolve();
    });
  });
});

interface RoomSetup {
  roomCode: string;
  inviteCode: string;
  host: { socket: Socket; playerId: string };
  guests: { socket: Socket; playerId: string; playerToken: string }[];
}

/** Connects host + `guestCount` guests and starts a match in the room. */
async function createRoomWithMatch(guestCount = 1): Promise<RoomSetup> {
  const hostSocket = await connectClient();
  const createAck = await emitAck<RoomMembershipView>(hostSocket, REALTIME_EVENTS.roomCreate, {
    playerName: "host",
  });
  if (!createAck.ok) {
    throw new Error("create failed");
  }
  const guests: RoomSetup["guests"] = [];
  for (let index = 0; index < guestCount; index += 1) {
    const guestSocket = await connectClient();
    const joinAck = await emitAck<RoomMembershipView>(guestSocket, REALTIME_EVENTS.roomJoin, {
      roomCode: createAck.data.roomCode,
      inviteCode: createAck.data.inviteCode,
    });
    if (!joinAck.ok) {
      throw new Error("join failed");
    }
    guests.push({
      socket: guestSocket,
      playerId: joinAck.data.playerId,
      playerToken: joinAck.data.playerToken,
    });
  }
  const startAck = await emitAck<MatchState>(hostSocket, REALTIME_EVENTS.matchStart, {
    roomCode: createAck.data.roomCode,
  });
  if (!startAck.ok) {
    throw new Error("match start failed");
  }
  return {
    roomCode: createAck.data.roomCode,
    inviteCode: createAck.data.inviteCode,
    host: { socket: hostSocket, playerId: createAck.data.playerId },
    guests,
  };
}

afterAll(async () => {
  for (const socket of openSockets) {
    socket.disconnect();
  }
  await server.stop();
});

describe("Socket.IO realtime server", () => {
  it("establishes a Socket.IO connection and acknowledges client", async () => {
    const socket = await connectClient();

    expect(socket.id).toBeTypeOf("string");
    socket.disconnect();
  });

  it("creates a private room and only allows invited sockets", async () => {
    const socket = await connectClient();

    const createAck = await emitAck<RoomMembershipView>(socket, REALTIME_EVENTS.roomCreate, {
      playerName: "host",
    });

    expect(createAck.ok).toBe(true);
    if (!createAck.ok) {
      throw new Error("create failed");
    }
    const host = createAck.data;
    expect(host.roomCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(host.inviteCode).toBeTypeOf("string");
    expect(host.inviteCode.length).toBeGreaterThanOrEqual(20);
    expect(host.playerId).toBeTypeOf("string");
    expect(host.playerToken).toBeTypeOf("string");
    expect(host.status).toBe("waiting");

    // A socket without a valid invite code must not join the room.
    const stranger = await connectClient();
    const strangerAck = await emitAck<undefined>(stranger, REALTIME_EVENTS.roomJoin, {
      roomCode: host.roomCode,
      inviteCode: "not-the-invite-code",
    });
    expect(strangerAck.ok).toBe(false);
    if (!strangerAck.ok) {
      expect(strangerAck.code).toBe("invalidInvite");
      expect(strangerAck.error).not.toContain(host.inviteCode);
    }

    // A guest with the invite code joins successfully.
    const guestAck = await emitAck<RoomMembershipView>(stranger, REALTIME_EVENTS.roomJoin, {
      roomCode: host.roomCode,
      inviteCode: host.inviteCode,
    });
    expect(guestAck.ok).toBe(true);
    if (!guestAck.ok) {
      throw new Error("join failed");
    }
    expect(guestAck.data.playerId).not.toBe(host.playerId);

    socket.disconnect();
    stranger.disconnect();
  });

  it("validates incoming throw data on the server side", async () => {
    const room = await createRoomWithMatch();
    const guest = room.guests[0];
    expect(guest, "a guest must be present").toBeDefined();
    if (guest === undefined) {
      throw new Error("missing guest");
    }

    const invalidPayloads: unknown[] = [
      { roomCode: room.roomCode, points: "abc" },
      { roomCode: room.roomCode, points: 61 },
      { roomCode: room.roomCode, points: -1 },
      { roomCode: room.roomCode, points: 2.5 },
      { points: 10 },
      { roomCode: room.roomCode, points: 10, playerId: guest.playerId },
    ];
    for (const payload of invalidPayloads) {
      const ack = await emitAck(room.host.socket, REALTIME_EVENTS.throwRecord, payload);
      expect(ack.ok, `payload ${JSON.stringify(payload)} must be rejected`).toBe(false);
      if (!ack.ok) {
        expect(ack.code).toBe("invalidThrow");
        expect(ack.error).not.toMatch(/player/i);
      }
    }

    // The state must remain untouched by rejected payloads.
    const stateAck = await emitAck<{ state: MatchState }>(
      room.host.socket,
      REALTIME_EVENTS.stateRequest,
      { roomCode: room.roomCode },
    );
    expect(stateAck.ok).toBe(true);
    if (!stateAck.ok) {
      throw new Error("state request failed");
    }
    expect(stateAck.data.state.throwCount).toBe(0);
    expect(stateAck.data.state.players.every((player) => player.totalPoints === 0)).toBe(true);

    // The server enforces turn order: guests cannot throw out of turn.
    const guestAck = await emitAck(guest.socket, REALTIME_EVENTS.throwRecord, {
      roomCode: room.roomCode,
      points: 10,
    });
    expect(guestAck.ok).toBe(false);
    if (!guestAck.ok) {
      expect(guestAck.code).toBe("notYourTurn");
    }
  });

  it("updates game state and broadcasts to all participants", async () => {
    const room = await createRoomWithMatch();
    const guest = room.guests[0];
    expect(guest).toBeDefined();
    if (guest === undefined) {
      throw new Error("missing guest");
    }

    const guestUpdates = waitForStateUpdate(guest.socket, (state) => state.throwCount >= 3);
    const hostUpdates = waitForStateUpdate(room.host.socket, (state) => state.throwCount >= 3);

    const firstThrow = await emitAck<{ state: MatchState }>(
      room.host.socket,
      REALTIME_EVENTS.throwRecord,
      { roomCode: room.roomCode, points: 10 },
    );
    expect(firstThrow.ok).toBe(true);
    if (!firstThrow.ok) {
      throw new Error("throw failed");
    }
    await emitAck(room.host.socket, REALTIME_EVENTS.throwRecord, {
      roomCode: room.roomCode,
      points: 20,
    });
    await emitAck(room.host.socket, REALTIME_EVENTS.throwRecord, {
      roomCode: room.roomCode,
      points: 30,
    });

    const [hostSeen, guestSeen] = await Promise.all([hostUpdates, guestUpdates]);
    expect(hostSeen.throwCount).toBe(3);
    expect(guestSeen.throwCount).toBe(3);
    expect(hostSeen.players[0]?.totalPoints).toBe(60);
    expect(guestSeen.currentPlayerId).toBe(guest.playerId);
  });

  it("handles client disconnect and allows reconnection to same room", async () => {
    const room = await createRoomWithMatch();
    const guest = room.guests[0];
    expect(guest).toBeDefined();
    if (guest === undefined) {
      throw new Error("missing guest");
    }

    // A throw happens before the disconnect so state must survive it.
    const firstThrow = await emitAck<{ state: MatchState }>(
      room.host.socket,
      REALTIME_EVENTS.throwRecord,
      { roomCode: room.roomCode, points: 10 },
    );
    expect(firstThrow.ok).toBe(true);

    await closeSocket(guest.socket);

    // The seat is preserved: the reconnected client keeps its identity.
    const reconnected = await connectClient();
    const rejoinAck = await emitAck<RoomMembershipView>(reconnected, REALTIME_EVENTS.roomJoin, {
      roomCode: room.roomCode,
      inviteCode: room.inviteCode,
      playerToken: guest.playerToken,
    });
    expect(rejoinAck.ok).toBe(true);
    if (!rejoinAck.ok) {
      throw new Error("rejoin failed");
    }
    const membership = rejoinAck.data;
    expect(membership.playerId).toBe(guest.playerId);
    expect(membership.status).toBe("inProgress");
    expect(membership.matchState?.throwCount).toBe(1);

    // The reconnected client receives subsequent broadcasts again.
    const update = waitForStateUpdate(reconnected, (state) => state.throwCount >= 2);
    const secondThrow = await emitAck(room.host.socket, REALTIME_EVENTS.throwRecord, {
      roomCode: room.roomCode,
      points: 5,
    });
    expect(secondThrow.ok).toBe(true);
    expect((await update).throwCount).toBe(2);
  });

  it("rejects reconnection with an unknown player token", async () => {
    const room = await createRoomWithMatch();
    const stranger = await connectClient();

    const rejoinAck = await emitAck<RoomMembershipView>(stranger, REALTIME_EVENTS.roomJoin, {
      roomCode: room.roomCode,
      inviteCode: room.inviteCode,
      playerToken: "unknown-token",
    });

    expect(rejoinAck.ok).toBe(false);
    if (!rejoinAck.ok) {
      expect(rejoinAck.code).toBe("matchAlreadyStarted");
    }
    expect(rejoinAck).not.toHaveProperty("data.playerToken");
  });
});
