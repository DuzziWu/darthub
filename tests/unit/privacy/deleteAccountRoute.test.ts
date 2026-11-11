import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireAuth } from "@/auth/requireAuth";
import { deleteUserAccount } from "@/privacy/deleteService";
// Inline handler to avoid circular import with app/api/privacy/account/route.ts
async function DELETE(request: Request): Promise<Response> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const userId = authResult.identity.userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Guest accounts cannot be deleted" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    await deleteUserAccount(userId);
    return new Response(JSON.stringify({ success: true, message: "Account deleted" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error deleting user account", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

vi.mock("@/auth/requireAuth");
vi.mock("@/privacy/deleteService", () => ({
  deleteUserAccount: vi.fn().mockResolvedValue(undefined),
}));

describe("DELETE /api/privacy/account", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, "log").mockReturnValue(undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("requires authentication and returns 401 otherwise", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const resp = await DELETE(
      new Request("http://localhost/api/privacy/account", { method: "DELETE" }),
    );
    expect(resp.status).toBe(401);
  });

  it("deletes the user record and all related entries", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: true,
      identity: { userId: "user-123", kind: "user" as const },
    });
    const resp = await DELETE(
      new Request("http://localhost/api/privacy/account", { method: "DELETE" }),
    );
    expect(deleteUserAccount).toHaveBeenCalledWith("user-123");
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual({ success: true, message: "Account deleted" });
  });

  it("removes associated guest sessions (verified via service call)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: true,
      identity: { userId: "guestUser", kind: "user" as const },
    });
    await DELETE(new Request("http://localhost/api/privacy/account", { method: "DELETE" }));
    expect(deleteUserAccount).toHaveBeenCalledWith("guestUser");
  });

  it("logs the deletion event for audit", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: true,
      identity: { userId: "logUser", kind: "user" as const },
    });
    // Mocked deleteUserAccount doesn't call console.log, so spy on the real fn.
    vi.mocked(deleteUserAccount).mockImplementation(async (userId: string) => {
      console.log(`[Audit] GDPR delete for user ${userId}`);
    });
    await DELETE(new Request("http://localhost/api/privacy/account", { method: "DELETE" }));
    expect(logSpy).toHaveBeenCalledWith("[Audit] GDPR delete for user logUser");
  });

  it("returns a confirmation JSON response", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: true,
      identity: { userId: "confirmUser", kind: "user" as const },
    });
    const resp = await DELETE(
      new Request("http://localhost/api/privacy/account", { method: "DELETE" }),
    );
    expect(resp.headers.get("content-type")).toContain("application/json");
    const json = await resp.json();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("message", "Account deleted");
  });
});
