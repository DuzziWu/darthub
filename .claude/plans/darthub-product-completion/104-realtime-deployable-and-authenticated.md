# Task 104: Make the realtime server deployable and socket-authenticated

**Status**: pending
**Depends on**: 100, 102
**Retry count**: 0

## Description
The realtime server exists and is tested, but it cannot be deployed and it does not authenticate its clients. `docker-compose.yml` references a `Dockerfile.realtime` that does not exist, and the server is started with `tsx`, a devDependency absent from the production image. Separately, `socketServer.ts` binds sockets to rooms without checking who the player is, so anyone who knows a room code can take a seat. This task makes the server deployable and authenticates the handshake.

## Context
- Related files: `Dockerfile.realtime` (new), `docker-compose.yml`, `src/realtime/server.ts`, `src/realtime/socketServer.ts`, `src/realtime/roomStoreFactory.ts`, `src/realtime/RedisRoomStore.ts`, `src/auth/session.ts`, `src/auth/requireAuth.ts`, `tests/integration/realtime/socketServer.test.ts`
- `docker-compose.yml` — a commented-out `realtime` service block referencing `Dockerfile.realtime`, which does not exist. Only `Dockerfile` exists in the repo.
- `src/realtime/server.ts` — creates an HTTP server with a health endpoint and attaches Socket.IO. The doc comment says to run it with `npx tsx src/realtime/server.ts`; `tsx` is a devDependency, so that does not work in the production image.
- `src/realtime/socketServer.ts` — owns connection lifecycle, room binding, acknowledgements. `requireAuth` is **never** applied to a socket handshake.
- `src/realtime/roomStoreFactory.ts` — selects `RedisRoomStore` when `process.env.USE_REDIS` is set, otherwise `InMemoryRoomStore`. The Redis path is a deferred decision and must not be reachable by accident.
- `src/auth/session.ts` — signs and verifies the HS256 bearer tokens. `src/auth/requireAuth.ts` — reads `Authorization: Bearer <token>` and returns the caller's identity.
- `tests/integration/realtime/socketServer.test.ts` and `helpers.ts` — the existing tests connect with real `socket.io-client` instances.

## Requirements (Test Descriptions)
- [ ] `it rejects a socket connection without a session token`
- [ ] `it rejects a socket connection with an invalid session token`
- [ ] `it rejects a socket connection with an expired session token`
- [ ] `it accepts a socket connection with a valid user session token`
- [ ] `it accepts a socket connection with a valid guest session token`
- [ ] `it binds the socket to the identity in its session token`
- [ ] `it refuses to admit an unauthenticated socket to a room`
- [ ] `it uses the in-memory room store when USE_REDIS is unset`
- [ ] `it uses the redis room store when USE_REDIS is set`
- [ ] `it serves a health endpoint`
- [ ] `it builds the realtime image with a compiled entry point`
- [ ] `it runs the realtime service in the compose file`

## Acceptance Criteria
- A socket connection without a valid session token is refused, and the refusal is proven by a test.
- The identity in the session token is the identity the room binds the socket to — a client cannot claim an identity it did not authenticate as.
- The realtime server runs in a production image without `tsx` and without devDependencies.
- `docker-compose.yml` contains a real `realtime` service with a healthcheck, replacing the commented block.
- The existing realtime integration tests still pass.

## Implementation Notes

**Authenticate at the handshake, not after it.** Socket.IO passes `socket.handshake.auth` — the `auth` payload the client sends with the connection — to the server before the connection is accepted. The `io()` middleware (`socket.use((socket, next) => ...)`) is the right place: call `next(new Error(...))` to refuse.

The token is issued by the same services the browser uses. The client sends it as:

```ts
io(REALTIME_URL, { auth: { token: sessionToken } });
```

Read `socket.handshake.auth.token`, verify it with `verifySessionToken` from `src/auth/session.ts` (the same function `requireAuth` uses — do not write a second verifier), and map the claims with `identityFromClaims` from `src/auth/requireAuth.ts`. Both are exported and reusable.

**A guest may play multiplayer; a stranger may not.** `identityFromClaims` returns `kind: "guest"` with a `guestId` and a `progressUserId`, and `kind: "user"` with a `userId`. The room must record which identity occupies which seat, so the server can later write a game result against the right user. Accept both kinds; reject neither-and-nobody-else.

**The `USE_REDIS` selection must stay deliberate.** `createRoomStore()` reads `process.env.USE_REDIS` truthily. In the compose file the Redis service exists but the decision is deferred, so the realtime service must **not** set `USE_REDIS`. If Redis is not selected, `RedisRoomStore` is never constructed and the `ioredis` client never opens a connection. Add a test that asserts the store selection, so a stray `USE_REDIS=1` in the environment cannot silently switch the backend.

**The realtime image needs a compiled entry point.** `tsx` is a devDependency and is not in the production image. Options:

- *Preferred*: add a build step that compiles `src/realtime/server.ts` with the TypeScript compiler to `dist/`, and run `node dist/realtime/server.js`. The project already has `typescript` as a devDependency and `tsc` is used for typechecking.
- *Alternative*: a separate `Dockerfile.realtime` stage that keeps `tsx` and the devDependencies. Simpler, but it ships the whole toolchain into a runtime image, which contradicts the `Dockerfile`'s own rationale (its comment says the standalone output "keeps the image free of node_modules/devDependencies").

Prefer the compiled build, and mirror the existing `Dockerfile`'s multi-stage structure: a `deps` stage with `npm ci`, a `builder` stage that runs `npx prisma generate` and compiles, and a `runner` stage with only the production dependencies and the compiled output.

**The server must bind to a routable address.** The standalone Next.js server needed `HOSTNAME=127.0.0.1` to be reachable at localhost — the same trap applies here. In a container the server must bind `0.0.0.0`, and the compose service must publish the port. Pick a port (3001 is the one the compose comment already suggests) and set `PORT` accordingly.

**The health endpoint already exists.** `server.ts` answers `200 {"status":"ok"}` on every request. The compose healthcheck can use it — but note it answers on *any* path, so the healthcheck should hit a specific path and the server should ideally serve it only at `/health`. Tightening that is a small, worthwhile change: a health endpoint that responds to every path is misleading.

**The existing tests will need updating.** `tests/integration/realtime/helpers.ts` connects clients directly. Once the handshake requires a token, every connection in those tests needs a valid session. The helper is the right place to add it — one change, and all the tests get it.
