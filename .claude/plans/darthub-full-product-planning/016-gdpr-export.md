# Task 016: GDPR export endpoint (JSON)

**Status**: completed
**Depends on**: 003
**Retry count**: 0

## Description
Create an authenticated endpoint that returns all personal data for a user (profile, game history, rankings, friends, quests) in a machine‑readable JSON format. The endpoint must log an audit event via a lightweight audit logger.

## Context
- Files: `src/privacy/exportService.ts`, API route `GET /api/privacy/export`.
- Must respect data minimisation.

## Requirements (Test Descriptions)
- [x] `it requires authentication and returns 401 otherwise`
- [x] `it returns user profile, game sessions, rankings, friends, and quests`
- [x] `it omits internal system fields (e.g., passwordHash)`
- [x] `it streams JSON for large datasets`

## Acceptance Criteria
- Export conforms to GDPR expectations and passes security review.
- Response size limited to reasonable chunking.
