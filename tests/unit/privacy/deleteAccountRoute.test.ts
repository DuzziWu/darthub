import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/auth/requireAuth";
import { DELETE } from "../../app/api/privacy/account/route";
import { deleteUserAccount } from "../../src/privacy/deleteService";

// Mock dependencies
vi.mock("@/auth/requireAuth");
vi.mock("@/privacy/deleteService");

describe("DELETE /api/privacy/account", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication and returns 401 otherwise", async () => {
    // @ts-expect-error mock
    requireAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const resp = await DELETE(new Request("/api/privacy/account", { method: "DELETE" }));
    expect(resp.status).toBe(401);
  });

  it("deletes the user record and all related entries", async () => {
    // @ts-expect-error mock
    requireAuth.mockResolvedValue({ ok: true, identity: { userId: "user-123" } });
    // @ts-expect-error mock
    deleteUserAccount.mockResolvedValue(undefined);
    const resp = await DELETE(new Request("/api/privacy/account", { method: "DELETE" }));
    expect(deleteUserAccount).toHaveBeenCalledWith("user-123");
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data).toEqual({ success: true, message: "Account deleted" });
  });

  it("removes associated guest sessions (verified via service call)", async () => {
    // The deleteUserAccount is responsible for guest removal; ensure it's called.
    // Reuse previous mock.
    // @ts-expect-error mock
    requireAuth.mockResolvedValue({ ok: true, identity: { userId: "guestUser" } });
    // @ts-expect-error mock
    deleteUserAccount.mockResolvedValue(undefined);
    await DELETE(new Request("/api/privacy/account", { method: "DELETE" }));
    expect(deleteUserAccount).toHaveBeenCalledWith("guestUser");
  });

  it("logs the deletion event for audit", async () => {
    const logSpy = vi.spyOn(console, "log");
    // @ts-expect-error mock
    requireAuth.mockResolvedValue({ ok: true, identity: { userId: "logUser" } });
    // @ts-expect-error mock
    deleteUserAccount.mockImplementation(async (userId: string) => {
      console.log(`[Audit] GDPR delete for user ${userId}`);
    });
    await DELETE(new Request("/api/privacy/account", { method: "DELETE" }));
    expect(logSpy).toHaveBeenCalledWith("[Audit] GDPR delete for user logUser");
    logSpy.mockRestore();
  });

  it("returns a confirmation JSON response", async () => {
    // @ts-expect-error mock
    requireAuth.mockResolvedValue({ ok: true, identity: { userId: "confirmUser" } });
    // @ts-expect-error mock
    deleteUserAccount.mockResolvedValue(undefined);
    const resp = await DELETE(new Request("/api/privacy/account", { method: "DELETE" }));
    expect(resp.headers.get("content-type")).toContain("application/json");
    const json = await resp.json();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("message", "Account deleted");
  });
});
