import { describe, expect, it, beforeEach } from "vitest";
import {
  createInviteCode,
  consumeInviteCode,
  listActiveInvites,
  __resetInviteState,
} from "@/realtime/inviteService";

describe("inviteService", () => {
  beforeEach(() => {
    __resetInviteState();
  });

  it("returns an 8-character alphanumeric string", () => {
    const code = createInviteCode("room-1");
    expect(code).toBeDefined();
    expect(typeof code).toBe("string");
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-z0-9]+$/);
  });

  it("associates the code with the given roomId", () => {
    const roomId = "room-alpha";
    const code = createInviteCode(roomId);
    const roomId2 = consumeInviteCode(code);
    expect(roomId2).toBe(roomId);
  });

  it("multiple codes for the same roomId are all valid", () => {
    const roomId = "room-beta";
    const code1 = createInviteCode(roomId);
    const code2 = createInviteCode(roomId);
    const code3 = createInviteCode(roomId);

    expect(consumeInviteCode(code1)).toBe(roomId);
    expect(consumeInviteCode(code2)).toBe(roomId);
    expect(consumeInviteCode(code3)).toBe(roomId);
  });

  it("consumeInviteCode with a valid code returns the roomId and invalidates it", () => {
    const roomId = "room-gamma";
    const code = createInviteCode(roomId);

    const result = consumeInviteCode(code);
    expect(result).toBe(roomId);

    // Code is now consumed — second use returns undefined.
    expect(consumeInviteCode(code)).toBeUndefined();
  });

  it("consumeInviteCode returns undefined for a nonexistent code", () => {
    expect(consumeInviteCode("nonexist")).toBeUndefined();
  });

  it("consumeInviteCode returns undefined for an already-consumed code (single-use)", () => {
    const code = createInviteCode("room-delta");
    consumeInviteCode(code);
    expect(consumeInviteCode(code)).toBeUndefined();
  });

  it("listActiveInvites reflects active (non-consumed) codes", () => {
    const code1 = createInviteCode("room-1");
    const code2 = createInviteCode("room-2");
    createInviteCode("room-3");

    expect(listActiveInvites()).toHaveLength(3);

    consumeInviteCode(code1);
    expect(listActiveInvites()).toHaveLength(2);

    consumeInviteCode(code2);
    expect(listActiveInvites()).toHaveLength(1);
  });

  it("collision resistance: generating many codes does not produce duplicates", () => {
    const roomId = "room-echo";
    const codes = new Set<string>();
    // Generate 200 codes — statistically far more than needed to expose a broken RNG.
    for (let i = 0; i < 200; i++) {
      codes.add(createInviteCode(roomId));
    }
    expect(codes.size).toBe(200);
  });
});
