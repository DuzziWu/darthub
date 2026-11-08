# Task 046: Abstract room persistence layer with pluggable backends

**Status**: pending
**Depends on**: 010
**Retry count**: 0

## Description
Refactor the matchmaking/room manager to use a persistence interface (`IRoomStore`) instead of hard‑coded in‑memory storage. Provide two implementations:
- `InMemoryRoomStore` (default for local development).
- `RedisRoomStore` (optional, used when Redis is enabled).
The server should select the implementation based on an environment variable (`USE_REDIS`).

## Context
- Files: `src/realtime/IRoomStore.ts`, `src/realtime/InMemoryRoomStore.ts`, `src/realtime/RedisRoomStore.ts`.
- Update `src/realtime/roomManager.ts` to depend on `IRoomStore`.

## Requirements (Test Descriptions)
- [ ] `it stores and retrieves room state using the selected backend`
- [ ] `it falls back to InMemory when Redis is not configured`
- [ ] `it includes unit tests for both implementations`

## Acceptance Criteria
- Matchmaking works with either backend.
- Local development requires no Redis installation.
