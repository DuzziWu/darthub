# Security

## Table of Contents

- [Overview](#overview)
- [Threat Model](#threat-model)
- [Server Authority and Anti-Cheat](#server-authority-and-anti-cheat)
- [Authentication and Authorization](#authentication-and-authorization)
- [Input Validation](#input-validation)
- [Rate Limiting](#rate-limiting)
- [Secrets Management](#secrets-management)
- [Data Protection and GDPR](#data-protection-and-gdpr)
- [Audit Logging](#audit-logging)
- [Reporting Issues](#reporting-issues)
- [Related Documents](#related-documents)

## Overview

Security posture for DartHub rests on server authority, exhaustive validation, session-scoped access, and privacy-by-design data handling. This document records the designed measures; the implementing middleware and services are delivered by parallel tasks.

## Threat Model

| Threat              | Vector                              | Mitigation                                                  |
| ------------------- | ----------------------------------- | ----------------------------------------------------------- |
| Score forgery       | Crafted client events               | Authoritative validation of every throw on the server       |
| AI tampering        | Modified clients replaying AI turns | Server-side AI: throws computed from a per-match-seeded RNG |
| Room hijacking      | Guessing room or invite codes       | Unguessable short-lived single-use codes                    |
| Account enumeration | Bulk profile scraping               | Prefix-only username search and rate limits                 |
| Data exfiltration   | Compromised account                 | GDPR deletion and audit trail limit blast radius            |
| Token theft         | Session fixation on reconnect       | Session revalidation on Socket.IO reconnect claim           |

## Server Authority and Anti-Cheat

- The Socket.IO server (task 009) owns all match state; clients send intent ("throw proposed"), never outcomes.
- Anti-cheat middleware (task 011) validates event shape, turn order, score arithmetic, and segment legality before the engine applies anything.
- AI is server-side: AI opponents make no client-facing calls, so there is no client-facing checksum to verify. Integrity of AI moves is ensured because the authoritative engine computes AI throws from a per-match-seeded RNG; the seed and RNG state are reproducible server-side, so every AI throw is auditable by replaying the seeded sequence on the server.
- Camera observations are advisory only (see `docs/API.md`): a client-supplied `CameraDTO.score` is a hint and is never trusted. The server recomputes the authoritative score from the camera-reported board coordinates using board geometry, so clients can never publish scores.
- Disconnection does not end a match; the reconnect claim (task 010) revalidates the session before restoring state.

## Authentication and Authorization

- Auth.js issues sessions; guests get a limited guest session token bound to their guest row.
- Every REST and Socket.IO handler resolves the principal, then a service-level authorisation check decides access; authorisation never lives in UI code.
- Guest sessions cannot access friends, career persistence, or any other user's data.
- Admin-only operations (rating recalculation) require an explicit role, not an email check.

## Input Validation

- All payloads pass through DTO validation from `src/dto/` before reaching services.
- Socket events are rejected with a typed error event on validation failure and logged at debug level.
- Database access is exclusively through Prisma with parameterised queries; no string-built SQL.

## Rate Limiting

- Write endpoints (friend requests, invites, throw proposals) are rate limited per session.
- Username search is limited to a small burst budget to resist scraping.
- Privacy export is limited per account to prevent export-forcing abuse.

## Secrets Management

- Secrets are provided by environment variables only; task 033 ships an example `.env` file with the required keys.
- The example file contains no real credentials; production secrets live only on the deployment host.
- No secret values are logged; error serializers redact unknown fields.

## Data Protection and GDPR

- Collected data is limited to profile, gameplay, ratings, and direct social relations; no third-party analytics or tracking.
- `GET /api/privacy/export` returns one JSON document covering profile, ratings, matches, friendships, and career progress (task 016).
- `POST /api/privacy/delete` cascades ownership rows in one transaction, records an AuditEvent, and leaves no recoverable copy (task 017).
- A lightweight audit logger (task 030) records export and delete actions, which are append-only.
- External audit of the GDPR implementation is scheduled as a later phase; see `docs/DECISIONS.md`.

## Audit Logging

- AuditEvent rows record actor, action, and target for privacy-relevant mutations.
- Audit rows are never editable or deletable through application APIs.
- Audit access is restricted to administration tooling.

## Reporting Issues

Security issues are handled privately: report suspicions through the repository issue tracker marked confidential, or contact the maintainers directly. Findings from automated review are tracked in the plan and must be resolved before the release milestone.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [API Specification](./API.md)
- [Testing Strategy](./TESTING.md)
- [Decision Log](./DECISIONS.md)
