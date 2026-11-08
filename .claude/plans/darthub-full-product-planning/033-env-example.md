# Task 033: Create example .env file with required environment variables

**Status**: completed
**Depends on**: 018
**Retry count**: 0

## Description
Add a `.env.example` at the repository root listing all necessary variables for Docker, database connection, JWT secret, and optional Redis configuration.

## Context
- File: `.env.example`.

## Requirements (Test Descriptions)
- [x] `it includes DATABASE_URL, JWT_SECRET, REDIS_URL (optional), and PORT` — tests/unit/env-example.test.ts first test passes (also asserts POSTGRES_PASSWORD required by compose)
- [x] `comments explain each variable` — test asserts each assignment has an explanatory comment block directly above it; passes
- [x] `the file is excluded from version‑controlled secrets (.gitignore)` — .gitignore: `.env`, `.env.*`, `!.env.example`; verified with a mini gitignore matcher in tests and `git check-ignore` (.env ignored, .env.example not ignored)

## Acceptance Criteria
- New developers can copy `.env.example` to `.env` and start the app.

## Implementation Notes
- `.env.example` (repo root) contains: DATABASE_URL, POSTGRES_PASSWORD (required by docker-compose `${POSTGRES_PASSWORD:?...}`), optional commented POSTGRES_USER/POSTGRES_DB (compose defaults: darthub), JWT_SECRET + AUTH_SECRET (auth code `src/auth/sessionCore.ts` reads AUTH_SECRET; task naming requires JWT_SECRET — both documented and set to the same value), optional commented REDIS_URL (Redis is only for future matchmaking persistence, tasks 031/047), PORT=3000 (matches Dockerfile/compose), optional commented REALTIME_PORT (src/realtime/server.ts defaults 4000).
- Placeholders only — no real secrets. `change-me-strong-random` placeholders.
- .gitignore env block consolidated to `.env` + `.env.*` + `!.env.example` (no duplication with the old `.env.local`-style lines; `.env.*` covers them all).
- Tests: tests/unit/env-example.test.ts (3 tests) — run only this file per parallel-worker instruction: 3/3 pass; prettier + eslint clean; verified with real `git check-ignore`.
- Note: another worker concurrently appended unrelated lines to .gitignore ("Generated / scratch directories" block); our env block is untouched and coexisting.
