import { describe, it, expect } from "vitest";
import { POST } from "../../app/api/auth/link-guest/route";

describe("POST /api/auth/link-guest", () => {
  it("accepts a guest token and new user credentials", async () => {
    const req = new Request("http://localhost/api/auth/link-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: "nonexistent",
        migrationToken: "invalid",
        email: "newuser@example.com",
        password: "Secret123!",
        displayName: "New User",
      }),
    });
    // Since the guest does not exist, we expect a 400 response.
    const resp = await POST(req);
    expect(resp.status).toBe(400);
  });
});
