# Task 006: Expose rating APIs (GET/POST) for Elo and Performance

**Status**: completed
**Depends on**: 005
**Retry count**: 0

## Description
Create Next.js API routes to fetch and update a user's Elo and Performance ratings, with proper authentication and validation.

## Context
- Files: `pages/api/rating/[userId].ts` (GET), `pages/api/rating/update.ts` (POST).
- Use the services from Task 005.

## Requirements (Test Descriptions)
- [x] `it returns 401 for unauthenticated requests`
- [x] `it returns current Elo and Performance for a valid user`
- [x] `it validates input when updating ratings`
- [x] `it updates ratings and persists to database`
- [x] `it emits a rating change event for real‑time updates`

## Acceptance Criteria
- All endpoints pass integration tests using Vitest with a test DB.
- Proper error codes and messages are returned.
