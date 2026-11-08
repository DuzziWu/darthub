# Task 031: Add Redis (or fast store) for matchmaking state persistence

**Status**: completed
**Depends on**: 010
**Retry count**: 0

## Description
Integrate Redis into the Docker Compose setup to store matchmaking room snapshots and player reconnection data, enabling state recovery after server restarts.

## Context
- Files: `docker-compose.yml` (add Redis service), `src/realtime/roomManager.ts` (use Redis client).
- Use `ioredis` or `redis` npm package.

## Requirements (Test Descriptions)
- [x] `it stores room state in Redis and retrieves it on server start`
- [x] `it expires stale room entries after a configurable TTL`
- [x] `Docker compose brings up redis alongside app and db`

## Acceptance Criteria
- Reconnection works with persisted state.
- No data loss between container restarts.
