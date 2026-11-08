/**
 * Shared helpers for the Socket.IO realtime server integration tests.
 * The server is started on an ephemeral port (127.0.0.1:0) and driven
 * with real socket.io-client instances.
 */
import type { Socket } from "socket.io-client";
import type { Ack } from "@/realtime/types";
import type { MatchState } from "@/game-engine";

/** Membership payload returned by room:create / room:join. */
export interface RoomMembershipView {
  roomCode: string;
  inviteCode: string;
  playerId: string;
  playerToken: string;
  status: string;
  roster: { playerId: string; playerName: string; isAI: boolean }[];
  matchState?: MatchState | null;
}

/** Emits an event that expects an acknowledgement payload. */
export function emitAck<T = undefined>(
  socket: Socket,
  event: string,
  payload: unknown = {},
): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.timeout(2000).emit(event, payload, (error: Error | null, response: Ack<T>) => {
      if (error) {
        resolve({ ok: false, error: "ack-timeout", code: "invalidPayload" });
        return;
      }
      resolve(response);
    });
  });
}

/** Resolves with the next payload received for `event`. */
export function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export async function closeSocket(socket: Socket): Promise<void> {
  if (!socket.connected) {
    return;
  }
  await new Promise<void>((resolve) => {
    socket.once("disconnect", (_reason: string) => resolve());
    socket.disconnect();
  });
}
