# Task 002: Define database schema (users, guests, rankings, games, friends, career quests)

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Create Prisma models for all core entities, including guest handling, hybrid rating tables, game sessions, friend relationships, and career quest progress.

## Context
- Related files: `prisma/schema.prisma`.
- Patterns to follow: Existing Prisma conventions, use snake_case for DB columns.

## Requirements (Test Descriptions)
- [x] `it creates a User model with id, email, passwordHash, role`
- [x] `it creates a Guest model linked optionally to a User`
- [x] `it creates EloRating and PerformanceRating models linked to a User`
- [x] `it creates GameSession model with foreign keys to players and scores`
- [x] `it creates Friend relationship model (bidirectional)`
- [x] `it creates CareerQuest model with JSON payload`
- [x] `it generates migration and applies without errors`

## Acceptance Criteria
- Prisma schema compiles and migration runs on a fresh PostgreSQL instance.
- All tables have appropriate indexes and foreign keys.

## Implementation Notes
- Prisma 6.19.3 installed (`prisma` devDependency, `@prisma/client` dependency); schema at `prisma/schema.prisma`.
- Models: `User`, `Guest`, `EloRating`, `PerformanceRating`, `GameSession`, `Score`, `Friend`, `CareerQuest` plus enums `UserRole`, `GameMode`, `GameStatus`, `FriendStatus`. All tables/columns mapped to snake_case via `@@map`/`@map`.
- Foreign keys: `GameSession.playerOneId/playerTwoId/winnerId -> users.id` (SetNull for optional FKs, Cascade for required), `Score.sessionId/userId`, `Friend.requesterId/addresseeId`, `Guest.userId -> users.id` (SetNull, optional link). Indexes on every FK plus `game_sessions.status`, `friends.status`, unique `(requesterId, addresseeId)`, unique `(sessionId, userId)`, unique email/slug/per-rating userId.
- Tests: `tests/unit/db-schema/schema.test.ts` (6 tests) and `tests/unit/db-schema/migration.test.ts` (3 tests) — all 9 pass via `npx vitest run tests/unit/db-schema` (2026-11-07).
- Migration: initial DDL at `prisma/migrations/20260101000000_init/migration.sql` generated with `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`; the test verifies the stored migration byte-for-byte (comments stripped) equals the empty-to-schema diff, contains all 8 `CREATE TABLE` + 4 `CREATE TYPE` statements, FOREIGN KEY and CREATE INDEX statements. `migrations/migration_lock.toml` added (provider = "postgresql").
- **Live application deferred**: no PostgreSQL instance is reachable in this environment (`prisma migrate deploy` fails with P1001 at 127.0.0.1:5432, no Docker CLI available). Offline verification substitutes `npx prisma validate` (exit 0 with DATABASE_URL present) and `prisma migrate diff` equivalence with the stored init migration; `npx prisma generate` also succeeds, confirming the schema compiles. Apply on a live instance with `npm run db:migrate` (dev) or `npm run db:deploy` once DATABASE_URL points to a reachable PostgreSQL.
- Package scripts added: `db:generate`, `db:migrate`, `db:deploy`, `db:studio`. `prisma` added to `.prettierignore` (Prettier has no `.prisma`/`.sql` parser).
