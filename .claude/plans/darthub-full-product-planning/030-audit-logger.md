# Task 030: Implement lightweight audit logger for GDPR actions

**Status**: completed
**Depends on**: 016, 017
**Retry count**: 0

## Description
Create `src/privacy/auditService.ts` providing functions to log audit events (export, delete) to a persistent store (e.g., append‑only file or simple DB table). Ensure logs include timestamp, user ID, action type, and IP address.

## Context
- Files: `src/privacy/auditService.ts`.
- Used by exportService (Task 016) and deleteService (Task 017).

## Requirements (Test Descriptions)
- [x] `it writes an audit record with required fields for an export action`
- [x] `it writes an audit record for a delete action`
- [x] `it can be queried for recent audit events`

## Implementation Notes
- `src/privacy/auditService.ts` exports `AuditEvent` interface, `writeAuditEvent`, and `queryAuditEvents`.
- JSON Lines format (one JSON object per line) persisted to `data/audit.log`.
- Directory auto-created if missing using `fs/promises` only.
- No external dependencies beyond Node.js built-ins (`fs`, `fs/promises`, `crypto`).
- Tests use `vi.mock` on `node:fs/promises` and `node:fs` to avoid real file I/O.

## Acceptance Criteria
- Audit records are persisted and can be inspected.
- No sensitive data beyond what is required is logged.
