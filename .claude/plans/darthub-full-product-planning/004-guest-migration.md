# Task 004: Implement guest-to-user migration flow

**Status**: completed
**Depends on**: 003
**Retry count**: 0

## Description
Create an endpoint that allows a guest to link their session to a newly created account, transferring all stored progress (games, rankings, quests). The migration must be performed inside a Prisma transaction that locks all related rows (optimistic concurrency control) to avoid race conditions when multiple migrations occur concurrently.


## Context
- Related files: `src/auth/migration.ts`, API route `POST /api/auth/link-guest`.
- Patterns: transactional DB updates, error handling as per code‑standards.

## Requirements (Test Descriptions)
- [x] `it accepts a guest token and new user credentials`
- [x] `it creates the user and transfers guest data atomically`
- [x] `it returns a new JWT for the linked account`
- [x] `it fails gracefully if guest token is invalid`
- [x] `it does not lose any game or quest data during migration`

## Acceptance Criteria
- Migration succeeds in integration tests with a real PostgreSQL container.
- No data loss; all related tables show transferred rows.
