import { describe, it, expect } from "vitest";
import { PublicMatchmaker } from "@/realtime/matchmaking";

describe("PublicMatchmaker", () => {
  it("matches two random guests into a public room", async () => {
    const matchmaker = new PublicMatchmaker();
    const p1Promise = matchmaker.requestMatch("Alice");
    const p2Membership = await matchmaker.requestMatch("Bob");
    const p1Membership = await p1Promise;
    expect(p1Membership.roomCode).toBe(p2Membership.roomCode);
    expect(p1Membership.playerId).not.toBe(p2Membership.playerId);
  });
});
