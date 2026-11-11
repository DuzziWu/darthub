import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { createInviteCode } from "@/realtime/inviteService";
import { POST } from "../../../app/api/invite/join/route";

describe("POST /api/invite/join", () => {
  it("returns 200 and roomId for a valid unused code", async () => {
    const roomId = "room-123";
    const code = createInviteCode(roomId);
    const req = new NextRequest("http://localhost/api/invite/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json).toEqual({ roomId });
  });

  it("returns 400 for a nonexistent code", async () => {
    const req = new NextRequest("http://localhost/api/invite/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "nonexistent" }),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json).toEqual({ error: "Invalid or used invitation code" });
  });

  it("returns 400 for a code that has already been consumed", async () => {
    const roomId = "room-456";
    const code = createInviteCode(roomId);

    // First use succeeds.
    const req1 = new NextRequest("http://localhost/api/invite/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const resp1 = await POST(req1);
    expect(resp1.status).toBe(200);

    // Second use fails (single-use).
    const req2 = new NextRequest("http://localhost/api/invite/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const resp2 = await POST(req2);
    expect(resp2.status).toBe(400);
    const json = await resp2.json();
    expect(json).toEqual({ error: "Invalid or used invitation code" });
  });

  it("returns 400 when code is missing from body", async () => {
    const req = new NextRequest("http://localhost/api/invite/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json).toEqual({ error: "Missing code" });
  });
});
