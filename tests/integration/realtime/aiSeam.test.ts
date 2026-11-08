/**
 * Integration verification for the injected {@link AIProvider} seam of the
 * realtime server. The AI module itself (task 007) is not imported here;
 * a stub provider stands in for it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { createRealtimeServer } from "@/realtime/server";
import { REALTIME_EVENTS } from "@/realtime/types";
import type { MatchState } from "@/game-engine";
import { emitAck, type RoomMembershipView } from "./helpers";

let port = 0;
let stop: () => Promise<void> = async () => {};
const sockets: Socket[] = [];

function connect(): Promise<Socket> {
  return new Promise((resolve) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(socket);
    socket.once("connect", () => resolve(socket));
  });
}

beforeAll(async () => {
  const server = createRealtimeServer({
    aiProvider: { selectThrowPoints: () => 20 },
  });
  server.httpServer.listen(0, "127.0.0.1", () => {
    port = (server.httpServer.address() as { port: number }).port;
  });
  await new Promise<void>((resolve) => server.httpServer.once("listening", resolve));
  stop = server.stop;
});

afterAll(async () => {
  for (const socket of sockets) {
    socket.disconnect();
  }
  await stop();
});

describe("AI provider seam", () => {
  it("throws automatically for AI seats when a provider is injected", async () => {
    const host = await connect();
    const createAck = await emitAck<RoomMembershipView>(host, REALTIME_EVENTS.roomCreate, {
      aiOpponent: true,
    });
    expect(createAck.ok).toBe(true);
    if (!createAck.ok) {
      throw new Error("create failed");
    }
    const aiSeat = createAck.data.roster.find((entry) => entry.isAI);
    expect(aiSeat, "room must carry an AI seat").toBeDefined();
    expect(aiSeat?.playerId).toMatch(/^ai-/);

    const startAck = await emitAck<MatchState>(host, REALTIME_EVENTS.matchStart, {
      roomCode: createAck.data.roomCode,
    });
    expect(startAck.ok).toBe(true);

    // Host spends its turn; the AI then completes its own 3 darts.
    for (const points of [10, 20, 30]) {
      const throwAck = await emitAck(host, REALTIME_EVENTS.throwRecord, {
        roomCode: createAck.data.roomCode,
        points,
      });
      expect(throwAck.ok).toBe(true);
    }

    const stateAck = await emitAck<{ state: MatchState }>(host, REALTIME_EVENTS.stateRequest, {
      roomCode: createAck.data.roomCode,
    });
    expect(stateAck.ok).toBe(true);
    if (!stateAck.ok) {
      throw new Error("state request failed");
    }
    const state = stateAck.data.state;
    expect(state.throwCount).toBe(6);
    expect(state.currentPlayerId).toBe(createAck.data.playerId);
    const aiPoints = state.players.find((player) => player.id === aiSeat?.playerId)?.totalPoints;
    expect(aiPoints).toBe(60);
  });
});
