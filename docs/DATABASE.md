# Database Design

## Table of Contents

- [Overview](#overview)
- [Technology](#technology)
- [Entity Overview](#entity-overview)
- [Entities](#entities)
- [Indexes and Constraints](#indexes-and-constraints)
- [Migrations](#migrations)
- [Retention and Cleanup](#retention-and-cleanup)
- [Related Documents](#related-documents)

## Overview

All durable state lives in a single PostgreSQL database accessed exclusively through Prisma repositories in `src/repositories/`. No other layer may issue queries. This document describes the designed schema; the Prisma schema file itself is being delivered by task 002.

## Technology

- **Database**: PostgreSQL 16.
- **ORM**: Prisma with the generated client in `src/infrastructure/`.
- **Access pattern**: repository classes only; services depend on repository interfaces, not on Prisma directly.

## Entity Overview

```text
User 1--1 Guest (optional link after migration)
User 1--1 RatingProfile (per game mode)
User 1--N GameParticipant N--1 Game
User 1--N Friendship / FriendshipRequest (either side)
User 1--N InviteCode
User 1--N CareerProgress N--1 CareerQuest (JSON content)
User 1--N AuditEvent (privacy actions)
```

## Entities

### User

| Field                 | Type                 | Notes                         |
| --------------------- | -------------------- | ----------------------------- |
| id                    | uuid pk              |                               |
| email                 | text unique nullable | null for guests               |
| username              | text unique          | display and search handle     |
| passwordHash          | text nullable        | only for credentials accounts |
| isGuest               | boolean              | guests keep no email          |
| createdAt / updatedAt | timestamps           |                               |

### Guest

Guests are modelled as rows in `User` with `isGuest = true` plus a guest token for session reattachment. On migration to a registered account the row is updated, not recreated, so foreign keys (matches, ratings, career progress) survive transactionally.

### RatingProfile

| Field          | Type                                          | Notes                        |
| -------------- | --------------------------------------------- | ---------------------------- |
| id             | uuid pk                                       |                              |
| userId         | fk User                                       | cascade delete               |
| mode           | enum (FIVE_ZERO_ONE, THREE_ZERO_ONE, CRICKET) |                              |
| elo            | decimal                                       | per-mode Elo                 |
| performanceAvg | decimal                                       | three-dart average           |
| checkoutPct    | decimal                                       | doubles and checkouts landed |
| gamesPlayed    | int                                           | drives K-factor decay        |
| updatedAt      | timestamp                                     |                              |

Unique constraint on (userId, mode). Nightly batch jobs may recompute derived fields.

### Game

| Field                  | Type                                         | Notes              |
| ---------------------- | -------------------------------------------- | ------------------ |
| id                     | uuid pk                                      |                    |
| mode                   | enum                                         |                    |
| visibility             | enum (PRIVATE, RANKED)                       |                    |
| status                 | enum (WAITING, RUNNING, FINISHED, ABANDONED) |                    |
| roomCode               | text nullable                                | private rooms only |
| winnerUserId           | fk User nullable                             |                    |
| startedAt / finishedAt | timestamps                                   |                    |

### GameParticipant

| Field                | Type             | Notes                   |
| -------------------- | ---------------- | ----------------------- |
| id                   | uuid pk          |                         |
| gameId               | fk Game          | cascade delete          |
| userId               | fk User nullable | null for AI opponents   |
| aiDifficulty         | text nullable    | set for seeded AI seats |
| eloBefore / eloAfter | decimal nullable | rating delta audit      |
| score                | json             | per-turn score history  |

Throw-level telemetry is embedded in `score` JSON rather than a separate table to keep matches I/O-light.

### Friendship and FriendshipRequest

- `Friendship`: unique pair of user ids, enforced with an ordered pair constraint and checked in the repository.
- `FriendshipRequest`: fromUserId, toUserId, status (PENDING, ACCEPTED, REJECTED), createdAt.

### InviteCode

| Field     | Type             | Notes              |
| --------- | ---------------- | ------------------ |
| id        | uuid pk          |                    |
| code      | text unique      | short, unguessable |
| createdBy | fk User          |                    |
| gameId    | fk Game nullable |                    |
| expiresAt | timestamp        |                    |
| usedBy    | fk User nullable | single-use         |

### CareerProgress

| Field       | Type                                | Notes                    |
| ----------- | ----------------------------------- | ------------------------ |
| id          | uuid pk                             |                          |
| userId      | fk User                             | cascade delete           |
| questId     | text                                | identifier of JSON quest |
| status      | enum (LOCKED, AVAILABLE, COMPLETED) |                          |
| rewardState | json                                | earned items and unlocks |

Quest definitions themselves live in JSON under `src/career/quests/`, not in the database.

### AuditEvent

Append-only privacy audit trail used by `src/privacy/` (see `docs/SECURITY.md`): actor id, action (EXPORT, DELETE), target id, timestamp. Never user-editable.

## Indexes and Constraints

- Unique: user email, username, invite code, (userId, mode) on RatingProfile.
- Foreign keys cascade from User to RatingProfile, GameParticipant, friendships, invites, career progress, so GDPR deletion is a single transaction root.
- Indexes: `Game(status)`, `GameParticipant(userId)`, `FriendshipRequest(toUserId, status)` for matchmaking and social queries.
- Names and casing follow Prisma conventions; SQL identifiers stay snake_case via mapping.

## Migrations

- Migrations live in `src/infrastructure/` and are applied by `prisma migrate deploy` inside the Docker image entry point.
- Every schema change ships with a migration in the same change set; no manual SQL in deployment docs.

## Retention and Cleanup

- Abandoned WAITING games older than one day are pruned by a scheduled job.
- Invitation codes expire automatically via `expiresAt`.
- Account deletion removes all owned rows and leaves one AuditEvent per privacy action (see `docs/PRD.md` Privacy section).

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [API Specification](./API.md)
- [Security](./SECURITY.md)
- [Costs](./COSTS.md)
