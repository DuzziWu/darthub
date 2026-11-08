import * as fsPromises from "node:fs/promises";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(""),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe("auditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes an audit record with required fields for an export action", async () => {
    const { writeAuditEvent } = await import("@/privacy/auditService");
    await writeAuditEvent({
      userId: "user-123",
      action: "export",
      ipAddress: "192.168.1.1",
    });
    const appendFileCalls = (fsPromises.appendFile as ReturnType<typeof vi.fn>).mock.calls;
    const logCall = appendFileCalls.find((c: unknown[]) => (c[0] as string).endsWith(".log"));
    expect(logCall).toBeDefined();
    const loggedEvent = JSON.parse((logCall[1] as string).split("\n")[0]);
    expect(loggedEvent).toMatchObject({
      userId: "user-123",
      action: "export",
      ipAddress: "192.168.1.1",
    });
    expect(loggedEvent).toHaveProperty("id");
    expect(loggedEvent).toHaveProperty("timestamp");
  });

  it("writes an audit record for a delete action", async () => {
    const { writeAuditEvent } = await import("@/privacy/auditService");
    await writeAuditEvent({
      userId: "user-456",
      action: "delete",
      ipAddress: "10.0.0.1",
    });
    const appendFileCalls = (fsPromises.appendFile as ReturnType<typeof vi.fn>).mock.calls;
    const logCall = appendFileCalls.find((c: unknown[]) => (c[0] as string).endsWith(".log"));
    expect(logCall).toBeDefined();
    const loggedEvent = JSON.parse((logCall[1] as string).split("\n")[0]);
    expect(loggedEvent.action).toBe("delete");
    expect(loggedEvent.userId).toBe("user-456");
  });

  it("can be queried for recent audit events", async () => {
    const { queryAuditEvents } = await import("@/privacy/auditService");
    const mockLog =
      JSON.stringify({
        id: "evt-1",
        timestamp: "2026-11-08T10:00:00.000Z",
        userId: "user-789",
        action: "export",
        ipAddress: "1.2.3.4",
      }) +
      "\n" +
      JSON.stringify({
        id: "evt-2",
        timestamp: "2026-11-08T11:00:00.000Z",
        userId: "user-789",
        action: "delete",
        ipAddress: "1.2.3.4",
      }) +
      "\n" +
      JSON.stringify({
        id: "evt-3",
        timestamp: "2026-11-08T12:00:00.000Z",
        userId: "other-user",
        action: "export",
        ipAddress: "5.6.7.8",
      }) +
      "\n";
    (fsPromises.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(mockLog);
    const events = await queryAuditEvents("user-789");
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("delete");
    expect(events[1].action).toBe("export");
  });
});
