# Task 046: Abstract room persistence layer with pluggable backends

**Status**: completed
**Depends on**: 010
**Retry count**: 0

## Description
Refactor the matchmaking/room manager to use a persistence interface (`IRoomStore`) instead of hard‑coded in‑memory storage. Provide two implementations:
- `InMemoryRoomStore` (default for local development).
- `RedisRoomStore` (optional, used when Redis is enabled).
The server selects the implementation based on an environment variable (`USE_REDIS`).

## Context
- Files: `src/realtime/IRoomStore.ts`, `src/realtime/InMemoryRoomStore.ts`, `src/realtime/RedisRoomStore.ts`.
- Updated `src/realtime/RoomRegistry.ts` to accept an `IRoomStore` via constructor.
- Updated `src/realtime/socketServer.ts` to use `createRoomStore()` for the store selection.

## Implementation Notes
- `IRoomStore` interface defines `save(room, ttlSeconds?)`, `findByCode`, `findAll`, `delete`.
- `InMemoryRoomStore` uses a simple `Map<string, GameRoom>`.
- `RedisRoomStore` serializes room state to JSON with optional TTL using ioredis.
- `createRoomStore()` factory selects Redis when `USE_REDIS` env var is set, otherwise InMemory.
- `RoomRegistry` accepts a store via constructor and persists rooms on creation.
- `RealtimeServerOptions` in `types.ts` gained an optional `roomStore` field for injection.

## Requirements (Test Descriptions)
- [x] `it stores and retrieves room state using the selected backend`
- [x] `it falls back to InMemory when Redis is not configured`
- [x] `it includes unit tests for both implementations`

## Acceptance Criteria
- Matchmaking works with either backend.
- Local development requires no Redis installation.

## Files Created
- `src/realtime/IRoomStore.ts` - Interface definition
- `src/realtime/InMemoryRoomStore.ts` - Default in-memory implementation
- `src/realtime/RedisRoomStore.ts` - Redis-backed implementation
- `src/realtime/roomStoreFactory.ts` - Factory for store selection
- `tests/unit/realtime/roomStore.test.ts` - Unit tests
