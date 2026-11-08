# Task 017: GDPR delete account endpoint and cascade cleanup

**Status**: completed
**Depends on**: 016
**Retry count**: 0

## Description
Create an authenticated endpoint that permanently deletes a user account and all related data (games, rankings, friends, quests, guest data). Ensure proper cascade and audit logging.

## Context
- Files: `src/privacy/deleteService.ts`, API route `DELETE /api/privacy/account`.
- Use Prisma cascade delete.

## Requirements (Test Descriptions)
- [x] `it requires authentication and returns 401 otherwise`
- [x] `it deletes the user record and all foreign‑key related entries`
- [x] `it removes associated guest sessions`
- [x] `it logs the deletion event for audit`
- [x] `it returns a confirmation JSON response`


Implementation notes:
- Added `src/privacy/deleteService.ts` with cascade delete and guest cleanup using Prisma.
- Added API route `app/api/privacy/account/route.ts` handling DELETE, auth, and response.
- Created unit tests `tests/unit/privacy/deleteAccountRoute.test.ts` covering auth, deletion, guest cleanup, audit log, and JSON response.
- Tests mock `requireAuth` and `deleteUserAccount` to avoid DB dependency.
