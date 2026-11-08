# Task 047: Integrate optional Redis backend into matchmaking persistence

**Status**: pending
**Depends on**: 046, 031
**Retry count**: 0

## Description
Implement `RedisRoomStore` using the `ioredis` client. Ensure it respects the `USE_REDIS` env flag and serializes room state appropriately. Add configuration to `docker-compose.yml` to expose the Redis service when enabled.

## Context
- Files: `src/realtime/RedisRoomStore.ts` (implementation), updates to `docker-compose.yml`.
- Environment variable `USE_REDIS` determines which `IRoomStore` implementation is instantiated.

## Requirements (Test Descriptions)
- [ ] `it connects to Redis using the URL from env`
- [ ] `it saves room snapshots and can restore them after a restart`
- [ ] `it clears stale rooms after a TTL`
- [ ] `integration test spins up a Redis container and verifies persistence`

## Acceptance Criteria
- When `USE_REDIS=true` the server uses Redis for room state.
- Local dev without Redis continues to use the in‑memory store.
