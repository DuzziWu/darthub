import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../../app/api/invite/create/route";

describe("POST /api/invite/create", () => {
  it("returns 200 with a code string for a valid roomId", async () => {
    const req = new NextRequest("http://localhost/api/invite/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room-123" }),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(typeof json.code).toBe("string");
    expect(json.code.length).toBeGreaterThan(0);
  });

  it("returns 400 when roomId is missing", async () => {
    const req = new NextRequest("http://localhost/api/invite/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toBe("Missing roomId");
  });

  it("returns 400 when roomId is an empty string", async () => {
    const req = new NextRequest("http://localhost/api/invite/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "" }),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toBe("Missing roomId");
  });
});
