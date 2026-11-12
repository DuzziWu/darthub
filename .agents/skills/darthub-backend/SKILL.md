---
name: darthub-backend
description: This skill should be used when the user asks to "add an API route", "change the Prisma schema", "write a migration", "add a websocket event", "write a repository", "change the auth flow" or otherwise touches DartHub's server side. Encodes the thin-route-handler pattern, the repository and service seams, the Prisma conventions, the server-authority rule and the GDPR surface.
paths:
  - "app/api/**"
  - "src/auth/**"
  - "src/realtime/**"
  - "src/privacy/**"
  - "src/friends/**"
  - "src/rating/**"
  - "src/career/**"
  - "src/ai/**"
  - "prisma/**"
---

# DartHub Backend

Guide for implementing server-side work — REST routes, the data layer, the
real-time authority and authentication — without breaking the layering the
codebase is built on.

## Route handlers are thin

A route handler wires a runtime into a route factory. It contains no business
logic. The canonical example, `app/api/rating/game/route.ts`:

```ts
import { defaultRatingRuntime } from "@/rating/ratingRuntime";
import { createRatingRouteHandlers } from "@/rating/ratingRoutes";

const { POST } = createRatingRouteHandlers({
  ratingService: defaultRatingRuntime.ratingService,
  authGateway: defaultRatingRuntime.authGateway,
});

export { POST };
```

The same shape is used by `app/api/career/*/route.ts` and the friends and
invite routes. When adding a route:

1. Put the logic in the feature's service file (`src/<feature>/<x>Service.ts`).
2. Put the transport concerns in a `routes.ts` next to it that exports
   `createXRouteHandlers(deps)`.
3. Put a `runtime.ts` next to it that builds the default dependencies.
4. Let `app/api/.../route.ts` do nothing but wire and re-export.

## Service and repository seams

Each feature owns a `repository.ts` interface and a Prisma-backed
implementation beside it:

```text
src/auth/     repository.ts   prismaAuthRepository.ts   authService.ts
src/friends/  repository.ts   prismaFriendRepository.ts FriendService.ts
src/career/   careerProgressRepository.ts  repositories/prismaCareerProgressRepository.ts
```

Services take their repository through dependency injection, so unit tests
can pass an in-memory double (see `tests/support/inMemoryAuthRepository.ts`).
A service must not import the Prisma client directly.

## Authentication is a seam, not a dependency

`src/auth/requireAuth.ts` reads a `Bearer <JWT>` header and returns a
discriminated result. It **never throws**:

```ts
const result = requireAuth(request, deps);
if (!result.ok) return result.response; // 401
const { identity } = result;
```

The career module reaches auth through its own `AuthGateway` seam
(`src/career/auth/authGateway.ts`) so it does not depend on the auth module's
internals. When adding an authenticated route, use the existing seam rather
than reading the token again.

## Prisma conventions

`prisma/schema.prisma` holds 8 models and 4 enums. Follow its conventions
exactly:

- Model names PascalCase, table and column names mapped to snake_case with
  `@@map` / `@map`.
- UUID primary keys with an explicit `@db.Uuid` type.
- Timestamps as `@db.Timestamptz(6)` with `@default(now())`.
- Strings with an explicit width, e.g. `@db.VarChar(64)`.
- Composite uniqueness where it carries meaning, e.g.
  `@@unique([userId, mode])` on the rating models.
- Enums are mapped to snake_case tables, e.g. `@@map("user_roles")`.

Migration sequence for a schema change:

```bash
npx prisma generate          # npm 12 blocks the postinstall, so run it explicitly
npm run db:migrate
```

Never edit the schema without a matching migration. The repository has tests
that assert the schema and the migrations agree — `tests/unit/db-schema/`.

## The server is authoritative

The client never writes game state. `src/realtime/GameStateMachine.ts` owns the
authoritative state of a room and hands out JSON-safe snapshots only; every
mutation goes through it.

- Room state: `src/realtime/GameRoom.ts`, `GameStateMachine.ts`.
- Storage is behind `IRoomStore`, with `InMemoryRoomStore` and
  `RedisRoomStore` implementations chosen by `roomStoreFactory.ts`.
- Anti-cheat validation belongs in `src/realtime/antiCheat.ts` and
  `antiCheatMiddleware.ts` — validate client input at the socket boundary,
  never in the engine.
- The realtime server runs standalone (`npm run realtime`, `src/realtime/server.ts`),
  fully independent of the Next.js request pipeline.

## GDPR and the audit trail

`src/privacy/` holds export, delete and audit services. Data-export and
account-deletion changes are privacy-relevant and must keep the audit log
writing. The invite and friend features also touch personal data
(`src/friends/`, `src/realtime/inviteService.ts`).

## Environment prerequisites

- `npx prisma generate` after install — npm 12 blocks the postinstall.
- `DATABASE_URL` for anything that touches the database.
- `POSTGRES_PASSWORD` for `docker compose up` — compose fails fast without it.

## Verification

```bash
npx vitest run tests/integration/ tests/unit/auth/ tests/unit/privacy/
```

Integration tests need a reachable PostgreSQL; without one they fail with
Prisma error P1012. Read `references/test-matrix.md` for the known baseline.

## Additional Resources

### Reference Files

- **`references/data-and-api.md`** — the Prisma model reference, the
  route-handler checklist and the Socket.IO event catalogue.
- **`references/test-matrix.md`** — test categories, required environment and
  known failures.
