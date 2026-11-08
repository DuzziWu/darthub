/**
 * In‑memory invitation service for private game rooms.
 * Generates short 8‑character codes, maps them to a room ID, and expires
 * them after first use. This is a lightweight implementation sufficient for
 * the MVP and unit tests.
 */

const codeToRoom = new Map<string, string>();

/** Generate an 8‑character alphanumeric code and associate it with a room ID. */
export function createInviteCode(roomId: string): string {
  let code: string;
  // Very low collision risk; loop until unique.
  do {
    code = Math.random().toString(36).substring(2, 10);
  } while (codeToRoom.has(code));
  codeToRoom.set(code, roomId);
  return code;
}

/** Validate a code, return the associated room ID and invalidate the code. */
export function consumeInviteCode(code: string): string | undefined {
  const roomId = codeToRoom.get(code);
  if (roomId) {
    // Invalidate after single use.
    codeToRoom.delete(code);
    return roomId;
  }
  return undefined;
}

/** For debugging/tests – list active codes. */
export function listActiveInvites(): readonly { code: string; roomId: string }[] {
  return Array.from(codeToRoom.entries()).map(([code, roomId]) => ({ code, roomId }));
}
