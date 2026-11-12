# DartHub Data and API Reference

The Prisma model reference, the route-handler checklist and the real-time
event catalogue.

## Prisma models

`prisma/schema.prisma` defines 8 models and 4 enums. Model names are
PascalCase; table and column names map to snake_case.

### Enums

| Enum           | Values                                         | Table             |
| -------------- | ---------------------------------------------- | ----------------- |
| `UserRole`     | `USER`, `ADMIN`                                | `user_roles`      |
| `GameMode`     | `X01`, `CRICKET`, `AROUND_THE_CLOCK`, `CAREER` | `game_modes`      |
| `GameStatus`   | `WAITING`, `ACTIVE`, `FINISHED`, `ABANDONED`   | `game_statuses`   |
| `FriendStatus` | `PENDING`, `ACCEPTED`, `DECLINED`, `BLOCKED`   | `friend_statuses` |

### `User` → `users`

| Column                    | Type                                            | Notes                            |
| ------------------------- | ----------------------------------------------- | -------------------------------- |
| `id`                      | `String @id @default(uuid()) @db.Uuid`          | UUID primary key                 |
| `email`                   | `String @unique @db.VarChar(255)`               | unique                           |
| `passwordHash`            | `String @map("password_hash") @db.VarChar(255)` | never store a plain password     |
| `role`                    | `UserRole @default(USER)`                       |                                  |
| `displayName`             | `String @map("display_name") @db.VarChar(64)`   |                                  |
| `createdAt` / `updatedAt` | `DateTime @db.Timestamptz(6)`                   | `@default(now())` / `@updatedAt` |

Relations: `guests`, `eloRatings`, `performanceRatings`, `gamesAsPlayerOne`,
`gamesAsPlayerTwo`, `gamesAsWinner`, `scores`, `friendRequestsSent`,
`friendRequestsReceived`.

### `Guest` → `guests`

| Column                     | Type                                                   | Notes                                                                              |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `id`                       | `String @id @default(uuid()) @db.Uuid`                 |                                                                                    |
| `userId`                   | `String? @unique @map("user_id") @db.Uuid`             | nullable — a guest becomes linked when it claims an account                        |
| `nickname`                 | `String @db.VarChar(64)`                               |                                                                                    |
| `createdAt` / `lastSeenAt` | `DateTime @db.Timestamptz(6)`                          |                                                                                    |
| `migrationTokenHash`       | `String? @map("migration_token_hash") @db.VarChar(64)` | sha256 of the one-time guest migration token — proof of ownership. Null once used. |

### `EloRating` → `elo_ratings`

`id`, `userId`, `mode` (`@db.VarChar(32)`, default `X01`), `rating` (default
1000), `gamesPlayed`, `wins`, `losses`, `updatedAt`.
Unique: `@@unique([userId, mode])` — one rating per user and mode.

### `PerformanceRating` → `performance_ratings`

`id`, `userId`, `mode`, `averageTurnScore` (`@db.Decimal(6, 2)`),
`checkoutPct` (`@db.Decimal(5, 4)`), `gamesPlayed`, `updatedAt`.
Unique: `@@unique([userId, mode])`.

### `GameSession` → `game_sessions`

| Column                    | Type                                     | Notes                                      |
| ------------------------- | ---------------------------------------- | ------------------------------------------ |
| `id`                      | `String @id @default(uuid()) @db.Uuid`   |                                            |
| `mode`                    | `GameMode @default(X01)`                 |                                            |
| `status`                  | `GameStatus @default(WAITING)`           |                                            |
| `playerOneId`             | `String @map("player_one_id") @db.Uuid`  | required                                   |
| `playerTwoId`             | `String? @map("player_two_id") @db.Uuid` | nullable — a session may await an opponent |
| `winnerId`                | `String? @map("winner_id") @db.Uuid`     | nullable until finished                    |
| `createdAt` / `updatedAt` | `DateTime @db.Timestamptz(6)`            |                                            |
| `finishedAt`              | `DateTime? @db.Timestamptz(6)`           | nullable                                   |

Relations: `playerOne` (`GamesAsPlayerOne`, cascade delete), `playerTwo`
(`GamesAsPlayerTwo`, set null), `winner` (`GamesAsWinner`, set null),
`scores`.
Indexes: `playerOneId`, `playerTwoId`, `winnerId`, `status`.

### `Score` → `scores`

| Column      | Type                                   | Notes                             |
| ----------- | -------------------------------------- | --------------------------------- |
| `id`        | `String @id @default(uuid()) @db.Uuid` |                                   |
| `sessionId` | `String @map("session_id") @db.Uuid`   | → `GameSession`, cascade delete   |
| `userId`    | `String @map("user_id") @db.Uuid`      | → `User`, cascade delete          |
| `points`    | `Int`                                  | the player's score in the session |
| `createdAt` | `DateTime @db.Timestamptz(6)`          |                                   |

Unique: `@@unique([sessionId, userId])` — one score per player per session.
Index: `userId`.

### `Friend` → `friends`

| Column        | Type                                   | Notes                                |
| ------------- | -------------------------------------- | ------------------------------------ |
| `id`          | `String @id @default(uuid()) @db.Uuid` |                                      |
| `requesterId` | `String @map("requester_id") @db.Uuid` | → `User` as `friendRequestsSent`     |
| `addresseeId` | `String @map("addressee_id") @db.Uuid` | → `User` as `friendRequestsReceived` |
| `status`      | `FriendStatus @default(PENDING)`       |                                      |
| `createdAt`   | `DateTime @db.Timestamptz(6)`          |                                      |
| `respondedAt` | `DateTime? @db.Timestamptz(6)`         | nullable until answered              |

Unique: `@@unique([requesterId, addresseeId])` — one edge per pair.
Indexes: `addresseeId`, `status`.

### `CareerQuest` → `career_quests`

| Column                    | Type                                   | Notes                           |
| ------------------------- | -------------------------------------- | ------------------------------- |
| `id`                      | `String @id @default(uuid()) @db.Uuid` |                                 |
| `slug`                    | `String @unique @db.VarChar(64)`       | unique                          |
| `name`                    | `String @db.VarChar(128)`              |                                 |
| `minLevel`                | `Int @default(1) @map("min_level")`    | the level required to unlock it |
| `questOrder`              | `Int @map("quest_order")`              | the order in the career         |
| `payload`                 | `Json`                                 | the quest definition itself     |
| `createdAt` / `updatedAt` | `DateTime @db.Timestamptz(6)`          |                                 |

## Conventions to preserve

1. UUID primary keys with an explicit `@db.Uuid`.
2. `@db.Timestamptz(6)` for every timestamp.
3. An explicit width on every string (`@db.VarChar(n)`).
4. `@@map` on every model, `@map` on every non-matching column.
5. A composite `@@unique` whenever uniqueness is not a single column.
6. Enums mapped to snake_case tables.
7. Every foreign key gets an index — `@@index([userId])` on `Guest`,
   `@@index([playerOneId])` on `GameSession`, and so on.

## Migration sequence

```bash
npx prisma generate     # npm 12 blocks install scripts; run this explicitly
npm run db:migrate      # creates and applies a migration
npm run db:deploy       # applies existing migrations (production)
npm run db:studio       # inspect the data
```

`tests/unit/db-schema/schema.test.ts` and
`tests/unit/db-schema/migration.test.ts` assert that the schema and the
migrations agree. A hand-edited schema without a migration fails them.

## Route-handler checklist

For a new route under `app/api/<feature>/<action>/route.ts`:

1. The route file contains only wiring and a re-export.
2. The transport concerns live in `src/<feature>/<feature>Routes.ts`, which
   exports `createXRouteHandlers(deps)`.
3. The dependencies are assembled in `src/<feature>/<feature>Runtime.ts`.
4. The behaviour lives in `src/<feature>/<feature>Service.ts`.
5. The persistence goes through `src/<feature>/repository.ts`.
6. Authentication uses `requireAuth` and its `{ ok }` discriminant, or the
   feature's `AuthGateway`.
7. Errors map to status codes in the routes file, not in the service.
8. A test exists at `tests/integration/` (route-level) and, for business
   rules, at `tests/unit/<feature>/`.

## Existing routes

| Route                                  | Purpose                                         |
| -------------------------------------- | ----------------------------------------------- |
| `app/api/auth/[...nextauth]/route.ts`  | Auth.js handler                                 |
| `app/api/auth/invitation/route.ts`     | invitation codes                                |
| `app/api/auth/link-guest/route.ts`     | claim a guest's progress with an account        |
| `app/api/career/complete/route.ts`     | complete a quest                                |
| `app/api/career/progress/route.ts`     | read career progress                            |
| `app/api/career/quest/route.ts`        | read quests                                     |
| `app/api/friends/route.ts`             | friend list and requests                        |
| `app/api/friends/[requestId]/route.ts` | act on a friend request                         |
| `app/api/invite/create/route.ts`       | create an invite code                           |
| `app/api/invite/join/route.ts`         | join with an invite code                        |
| `app/api/privacy/account/route.ts`     | account-level privacy actions                   |
| `app/api/privacy/export/route.ts`      | GDPR data export                                |
| `app/api/rating/[userId]/route.ts`     | read a user's rating                            |
| `app/api/rating/game/route.ts`         | record a finished game, apply Elo + performance |

## Real-time events

The realtime server is a standalone Socket.IO server
(`src/realtime/server.ts`, `npm run realtime`, port `REALTIME_PORT`, default
4000). It is fully independent of the Next.js request pipeline and serves a
health endpoint.

| Concern                          | Location                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Socket wiring and event handlers | `src/realtime/socketServer.ts`                                                                   |
| Event name constants             | `src/realtime/types.ts` (`REALTIME_EVENTS`)                                                      |
| Authoritative room state         | `src/realtime/GameStateMachine.ts`                                                               |
| Room lifecycle                   | `src/realtime/GameRoom.ts`, `RoomRegistry.ts`                                                    |
| Matchmaking                      | `src/realtime/matchmaking.ts`                                                                    |
| Invitations                      | `src/realtime/inviteService.ts`                                                                  |
| Input validation                 | `src/realtime/antiCheat.ts`, `antiCheatMiddleware.ts`                                            |
| Persistence                      | `src/realtime/IRoomStore.ts`, `InMemoryRoomStore.ts`, `RedisRoomStore.ts`, `roomStoreFactory.ts` |

The server emits `stateUpdate` to the room with a JSON-safe snapshot, and
`welcome` to the joining socket. Clients never receive mutable state.

## Privacy surface

| Concern               | Location                                        |
| --------------------- | ----------------------------------------------- |
| Data export           | `src/privacy/exportService.ts`                  |
| Account deletion      | `src/privacy/deleteService.ts`                  |
| Audit log             | `src/privacy/auditService.ts`                   |
| Guest migration token | `src/auth/guest.ts`, `Guest.migrationTokenHash` |

Changes in this area are privacy-relevant: keep the audit trail writing, and
keep the migration token single-use (the hash is nulled once consumed).
