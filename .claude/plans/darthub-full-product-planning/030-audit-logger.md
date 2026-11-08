# Task 030: Implement lightweight audit logger for GDPR actions

**Status**: blocked
**Depends on**: 016, 017
**Retry count**: 0

## Description
Create `src/privacy/auditService.ts` providing functions to log audit events (export, delete) to a persistent store (e.g., append‑only file or simple DB table). Ensure logs include timestamp, user ID, action type, and IP address.

## Context
- Files: `src/privacy/auditService.ts`.
- Used by exportService (Task 016) and deleteService (Task 017).

## Requirements (Test Descriptions)
- [ ] `it writes an audit record with required fields for an export action`
- [ ] `it writes an audit record for a delete action`
- [ ] `it can be queried for recent audit events`

## Acceptance Criteria
- Audit records are persisted and can be inspected.
- No sensitive data beyond what is required is logged.
