/**
 * Factory that selects the appropriate IRoomStore implementation.
 *
 * - USE_REDIS=1 (or truthy) → RedisRoomStore
 * - otherwise → InMemoryRoomStore (default, no external dependencies)
 */
import type { IRoomStore } from "@/realtime/IRoomStore";
import { InMemoryRoomStore } from "@/realtime/InMemoryRoomStore";
import { RedisRoomStore } from "@/realtime/RedisRoomStore";

export function createRoomStore(): IRoomStore {
  if (process.env.USE_REDIS) {
    return new RedisRoomStore();
  }
  return new InMemoryRoomStore();
}
