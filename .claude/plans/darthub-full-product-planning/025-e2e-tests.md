# Task 025: End‑to‑end Playwright tests for login, matchmaking, career flow

**Status**: pending
**Depends on**: 024
**Retry count**: 0

## Description
Create Playwright scripts that cover the full user journey: sign‑up/login (including guest conversion), entering matchmaking, playing a short game, and completing a career quest.

## Context
- Files: `e2e/login.spec.ts`, `e2e/matchmaking.spec.ts`, `e2e/career.spec.ts`.
- Use the built Docker‑Compose environment for testing.

## Requirements (Test Descriptions)
- [ ] `it signs up a new user and logs in`
- [ ] `it converts a guest session to a registered account`
- [ ] `it joins a public matchmaking queue and is paired`
- [ ] `it completes a quest and sees reward`
- [ ] `it records rating changes after a game`

## Acceptance Criteria
- Playwright tests run in CI and pass on a headless browser.
- Screenshots on failure are saved.
