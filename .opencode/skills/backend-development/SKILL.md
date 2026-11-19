---
name: Backend Development
description: Use when building or changing REST route handlers, Prisma schema or repositories, Auth.js and guest sessions, Socket.IO realtime authority, or the rating, career, friends and privacy services. Covers the server-authoritative contract, input validation, authorisation, safe data handling and the verification commands.
---

# Backend development (DartHub)

Next.js 16 route handlers, Prisma + PostgreSQL, Auth.js (next-auth v5 beta)
with guest sessions, Socket.IO real-time authority.

## The contract

- **Server authority.** The client sends _intent_; the server validates it,
  applies it against the engine and the anti-cheat middleware, and broadcasts
  the resulting snapshot. A serialized match state coming from a client is
  never fed back into the engine.
- **Route → service → repository.** A handler authenticates, validates, calls
  the feature service and maps the result to a `Response`. Business logic
  never lives in the handler; persistence never happens in the handler.
- **DTOs, not ORM entities, cross a layer boundary.**
- **The domain core is read-only for you.** `src/game-engine/`, `src/board/`,
  `src/ai/` belong to the game-engine agent. Consume `@/game-engine`.
- **No new runtime dependency and no paid service without approval.** There is
  currently **no validation library** (no zod, no valibot) in `package.json` —
  validation is explicit and hand-written.

## Layout

```text
app/api/                route handlers: auth/, career/, friends/, invite/, privacy/, rating/
src/auth/               nextauth.ts, guest.ts, session.ts, requireAuth.ts, authService.ts, repository.ts
src/rating/             eloService.ts, performanceService.ts, ratingService.ts, repository, routes
src/career/             quest engine, questLoader.ts, questSchema.ts, progression, routes
src/friends/            FriendService.ts, repository.ts, prismaFriendRepository.ts
src/privacy/            exportService.ts, deleteService.ts, auditService.ts
src/realtime/           socketServer.ts, GameRoom.ts, GameStateMachine.ts, roomStore*, matchmaking, antiCheat*
prisma/                 schema.prisma, migrations/
```

## Authentication and authorisation

- `requireAuth(request)` (`src/auth/requireAuth.ts`) is the seam every route
  uses. It reads `Bearer <JWT>`, verifies the token and returns either the
  identity or a ready-to-return 401. It never throws — handlers match on the
  `ok` discriminant.
- A guest is a first-class identity; a guest can be linked to a registered
  account (`app/api/auth/link-guest`).
- **Authorise the resource, not only the caller.** A valid token for user A
  must never read or mutate user B's friends, rating, progress or account.
  This is the single most important security rule on this page.
- Passwords: `bcryptjs` via `src/auth/password.ts`. Never log a password, a
  token, a session secret or a personal identifier.

## Validation and error mapping

There is no schema library, so validation is explicit and must cover type
_and_ range:

```ts
let body: { addresseeId?: string };
try {
  body = await request.json();
} catch {
  return new Response(JSON.stringify({ error: "Invalid JSON" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
if (!body.addresseeId) {
  return new Response(JSON.stringify({ error: "addresseeId is required" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
```

- Validate body, query string, path parameters and headers.
- Status codes: 400 malformed, 401 missing/invalid identity, 403 not allowed,
  404 unknown resource, 409 conflict, 500 unexpected.
- A 500 must never leak a stack trace, a Prisma error or a database message.
- Use Prisma parameters; never interpolate user input into SQL.
- The GDPR endpoints are audited by `src/privacy/auditService.ts` — keep the
  audit trail intact.

## Real-time rules

- The room is the unit of authority: one room, one engine, one state machine.
- `src/realtime/roomStoreFactory.ts` selects `RedisRoomStore` (`USE_REDIS=1`)
  or `InMemoryRoomStore`.
- Anti-cheat (`src/realtime/antiCheatMiddleware.ts`) runs **before** a throw is
  applied. Never add a path that applies a throw without it.
- Broadcasts travel over `REALTIME_EVENTS` as JSON-safe snapshots.

## Prisma

- `prisma/schema.prisma` is the source of truth; every schema change needs a
  migration in `prisma/migrations/`.
- Never edit an applied migration in place — add a new one.
- After a schema change: `npm run db:generate`, the migration, then the tests.
- `tests/unit/db-schema/` checks the schema and the migration folder and will
  fail if a change is incomplete.
- Ratings are keyed by game mode — keep that keying intact.

## Verification

```bash
npx vitest run tests/unit/auth tests/unit/rating tests/unit/career \
  tests/unit/privacy tests/unit/realtime tests/unit/db-schema tests/integration
npm run typecheck
npm run lint
```

After a schema change additionally run `npm run db:generate`.

Quote the actual output. A route without a negative test (unauthenticated,
unauthorised, malformed, not found) is not finished.
