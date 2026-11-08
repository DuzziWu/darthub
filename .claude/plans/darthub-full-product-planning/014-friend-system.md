# Task 014: Add friend system (list, request, accept)

**Status**: completed
**Depends on**: 003, 002
**Retry count**: 0

## Description
Create API endpoints and database tables to allow users to send friend requests, accept them, and retrieve a friends list.

## Context
- Files: `src/friends/FriendService.ts`, API routes under `/api/friends/*`.
- Prisma models from Task 002 (Friend relationship).

## Requirements (Test Descriptions)
- [x] `it sends a friend request from user A to user B`
- [x] `it allows user B to accept the request`
- [x] `it lists all accepted friends for a user`
- [x] `it prevents duplicate friend entries`
- [x] `it validates that both users exist`

## Acceptance Criteria
- All endpoints pass integration tests with authentication.
- Database constraints enforce uniqueness.
