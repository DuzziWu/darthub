import { describe, it, expect, vi } from "vitest";
import {
  validateThrowPoints,
  enforceSingleSocketPerPlayer,
  validateMatchStart,
  MAX_THROW_POINTS,
} from "@/realtime/antiCheatMiddleware";
import { GameRoom } from "@/realtime/GameRoom";
import { RoomChangeError, RoomRejectionCode } from "@/realtime/GameRoom";
import { GameInputError } from "@/realtime/GameStateMachine";

describe("Anti‑cheat middleware", () => {
  it("rejects throws with points outside 0‑60", () => {
    const payload = { points: MAX_THROW_POINTS + 1 } as unknown;
    expect(() => validateThrowPoints(payload)).toThrowError(GameInputError);
    const payloadNeg = { points: -1 } as unknown;
    expect(() => validateThrowPoints(payloadNeg)).toThrowError(GameInputError);
  });

  it("prevents the same player ID from joining multiple rooms simultaneously", () => {
    const mockSocket1 = { disconnect: vi.fn() } as unknown as import("socket.io").Socket;
    const mockSocket2 = { disconnect: vi.fn() } as unknown as import("socket.io").Socket;
    const playerId = "player-123";
    enforceSingleSocketPerPlayer(playerId, mockSocket1);
    // Second socket should cause first to be disconnected.
    enforceSingleSocketPerPlayer(playerId, mockSocket2);
    expect(mockSocket1.disconnect).toHaveBeenCalledOnce();
  });

  it("blocks illegal state transitions (starting a match twice)", () => {
    const room = GameRoom.create("host");
    // First start should succeed.
    room.startMatch(room.getHostSeat().playerId);
    // Second start should be blocked by middleware.
    // Note: toThrowError with an arrow-function predicate is avoided here due to
    // a vitest 4.x quirk where it tries to read .prototype.constructor.name on
    // the predicate function. Instead we catch the error and assert its properties.
    let caughtError: unknown;
    expect(() => {
      try {
        validateMatchStart(room, room.getHostSeat().playerId);
      } catch (e) {
        caughtError = e;
        throw e;
      }
    }).toThrowError(RoomChangeError);
    expect(caughtError).toBeInstanceOf(RoomChangeError);
    expect((caughtError as RoomChangeError).code).toBe(RoomRejectionCode.matchAlreadyStarted);
  });
});
