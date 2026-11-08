# Task 011: Build anti‑cheat validation middleware

**Status**: complete
**Depends on**: 010, 007
**Retry count**: 0

## Description
Create server‑side validation that checks every throw submitted by a client against plausible score ranges, time intervals, and AI‑generated expectations to prevent tampering.

## Context
- Files: `src/realtime/antiCheat.ts`.
- Integrated into Socket.IO event handlers.

## Requirements (Test Descriptions)
- [x] `it rejects throws with impossible scores (e.g., >180 in a single turn)`
- [x] `it flags unusually fast successive throws as suspicious`
- [x] `it compares AI‑predicted distribution and detects outliers`
- [x] `it logs violations for audit purposes`

## Acceptance Criteria
- Middleware blocks cheating attempts in integration tests.
- No false positives for normal high‑skill players.
