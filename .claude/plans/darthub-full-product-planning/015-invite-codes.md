# Task 015: Implement invitation codes and private game creation

**Status**: complete
**Depends on**: 014, 010
**Retry count**: 0

## Description
Create a service that generates unique invitation codes, validates them, and allows a private game room to be created using the code.

## Context
- Files: `src/realtime/inviteService.ts`, API route `POST /api/invite/create` and `POST /api/invite/join`.
- Uses UUID or short hash generator.

## Requirements (Test Descriptions)
- [ ] `it generates a unique 8‑character invite code`
- [ ] `it stores the code with associated room ID`
- [ ] `it validates a code and joins the correct private room`
- [ ] `it expires codes after use or timeout`
- [ ] `it rejects invalid or already‑used codes`

## Acceptance Criteria
- Invitation flow works end‑to‑end in integration tests.
- Code collisions are extremely unlikely (collision test included).
