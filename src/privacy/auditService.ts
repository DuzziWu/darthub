import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

const LOG_PATH = "data/audit.log";

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  action: "export" | "delete";
  ipAddress: string;
}

async function ensureLogDir() {
  const dir = dirname(LOG_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function writeAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
  await ensureLogDir();
  const record: AuditEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  const line = JSON.stringify(record) + "\n";
  await appendFile(LOG_PATH, line, "utf-8");
}

export async function queryAuditEvents(userId: string, limit?: number): Promise<AuditEvent[]> {
  if (!existsSync(LOG_PATH)) return [];
  const content = await readFile(LOG_PATH, "utf-8");
  const events: AuditEvent[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as AuditEvent;
    if (event.userId === userId) {
      events.push(event);
    }
  }
  // Most recent first
  events.reverse();
  if (limit !== undefined) {
    return events.slice(0, limit);
  }
  return events;
}
