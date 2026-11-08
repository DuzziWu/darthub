# Task 010: Implement private rooms, random matchmaking, and reconnection logic

**Status**: completed
**Depends on**: 009
**Retry count**: 0

## Description
Add APIs for creating private rooms, matchmaking, and reconnection logic. Room state must be persisted to a fast store (e.g., Redis) to survive server restarts.

## Context
- Files: `src/realtime/matchmaking.ts`, `src/realtime/roomManager.ts`.
- Use the Socket.IO server from Task 009.

## Requirements (Test Descriptions)
- [x] `it creates a private room and returns a unique invite code`
- [x] `it matches two random guests into a public room`
- [x] `it stores room state in memory with persistence backup`
- [x] `it restores player state after a temporary disconnect`
- [x] `it prevents duplicate connections with same user ID`

## Acceptance Criteria
- All matchmaking flows are covered by integration tests.
- Reconnection restores game state within 5 seconds.
