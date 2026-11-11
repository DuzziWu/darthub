# Architecture

Last verified: 2026-11-10 (repo `E:\coding\darthub`, branch `feature/darthub-design-implementation`).

## System overview

DartHub is a Next.js 16 App Router application with a separate Socket.IO process and a
shared, framework-free TypeScript game engine.

```text
Browser (React 19, Tailwind v4 token layer)
  ├─ Next.js App Router pages        app/
  │    └─ client components           src/components/{shell,board,game,x01,ui}
  │         └─ pure TS modules        src/board, src/game-engine   ← run in the browser
  └─ REST  /api/*  →  route handlers (app/api/**/route.ts)
                        └─ route factories + runtime wiring
                             src/{auth,friends,rating,career,privacy,realtime}
                                  └─ services / repositories
                                       └─ Prisma  →  PostgreSQL
  └─ Socket.IO (separate process)    src/realtime/server.ts
       └─ socketServer → GameRoom / RoomRegistry / GameStateMachine
            └─ src/game-engine (GameEngine + modes)   [currently NeutralScoreMode]
            └─ AIProvider seam  ← src/ai (injected, never imported by the server)
       └─ IRoomStore → InMemoryRoomStore | RedisRoomStore (USE_REDIS)
```

The real layout is **flat feature folders** under `src/`
(`ai, auth, board, camera, career, components, friends, game-engine, privacy, rating,
realtime`). There is no `src/domain/`, `src/services/`, `src/repositories/`,
`src/infrastructure/`, `src/dto/` or `src/game/` — see
`.devflow/memory/PROJECT.md` contradiction 1.

## Boundaries and data flows

### 1. REST request → route → service → repository → Prisma

Thin handlers compose a _route factory_ with a _runtime_ that wires the real
dependencies, so route modules can be unit-tested without a database.

```text
app/api/rating/game/route.ts
  → src/rating/ratingRuntime.ts:26   createDefaultRatingRuntime()  (lazy PrismaClient)
      → createPrismaRatingRepository(prisma) → createRatingService({ repository })
  → src/rating/ratingRoutes.ts:49    createRatingRouteHandlers({ ratingService, authGateway })
      → authGateway.verify(request) → ratingService.recordGameResult(...)
          → prismaRatingRepository → @prisma/client → PostgreSQL
```

The same shape is used by career (`src/career/questRuntime.ts:28` +
`src/career/questRoutes.ts`), friends (`src/friends/FriendService.ts:33` +
`src/friends/prismaFriendRepository.ts`) and privacy
(`src/privacy/exportService.ts:34`, `src/privacy/deleteService.ts:10`).
`PrismaClient` is constructed lazily inside the runtime accessors so importing a route
module never opens a connection.

### 2. Authentication

`src/auth/nextauth.ts:23` builds Auth.js (next-auth v5, JWT session strategy) with two
credentials providers — email/password and guest. The providers delegate to
`src/auth/authService.ts` / `src/auth/guest.ts` and never contain logic. The same
services issue bearer tokens for API middleware; `src/auth/requireAuth.ts:56` verifies
`Authorization: Bearer <JWT>` and returns an `{ ok: true, identity }` / `{ ok: false,
response }` discriminant (`src/auth/requireAuth.ts:25`) so handlers never throw. Route
protection for the career and
rating APIs goes through an `AuthGateway` seam (`src/career/auth/authGateway.ts`,
`src/rating/authGateway.ts`) — a bearer implementation today, designed to be swapped.

### 3. WebSocket authority

`src/realtime/server.ts` starts the HTTP + Socket.IO server;
`src/realtime/socketServer.ts:194` wires the handlers.

```text
socket → event handler (socketServer.ts:217-318)
  → GameRoom / RoomRegistry            membership, host-only, room-full checks
  → GameStateMachine (GameStateMachine.ts:23)   owns the match state
      → GameEngine (game-engine/GameEngine.ts:27) + a DartGameMode
  → antiCheatMiddleware.ts:14/41/56   payload, one-socket-per-player, match-start checks
  → io.to(roomCode).emit(REALTIME_EVENTS.stateUpdate, { state })   snapshot broadcast
```

Only JSON-safe snapshots leave the server. The AI is injected through the `AIProvider`
interface (`src/realtime/types.ts:60`); the server never imports `@/ai` directly
(`socketServer.ts:331`).
Room persistence is pluggable: `src/realtime/roomStoreFactory.ts:11` picks
`RedisRoomStore` when `USE_REDIS` is set, otherwise `InMemoryRoomStore`
(`src/realtime/IRoomStore.ts`).

### 4. Camera / vision pipeline

`ICameraService` (`src/camera/ICameraService.ts:11`) is the hardware seam: start / stop /
capture a throw. `SmartphoneCameraService` is a MediaDevices stub.
`src/camera/vision/` is a **skeleton only** — `Calibration`, `Perspective`, `HitDetector`
and `VisionProcessor` define the API surface and every method raises
`NotImplementedInCvPhaseError` (`src/camera/vision/HitDetector.ts:40-50`).
The intended contract is already fixed: board-plane millimetres, x positive = right,
y positive = above centre, and scoring delegated to
`resolveBoardHit` from the shared board module — the CV path must not re-implement the
geometry.

### 5. Board geometry (shared, framework-free)

`src/board/boardGeometry.ts` owns the radii, the 20-segment order and the resolver
(`resolveBoardHit:97`, `toBoardMm:129`). It is pure TypeScript with no DOM, React or
Node imports, so the browser, the game server and the future CV pipeline can all import
it unchanged. `src/components/board/DartBoard.tsx` renders the same geometry as SVG
authored in millimetres, and `src/game-engine/types.ts` re-exports the segment type from
the board module so the engine and the board can never disagree.

### 6. Design-token layer

`app/globals.css:14` declares the Tailwind v4 `@theme static` tokens
(`--color-board/surface/raised/sunken/rule/edge/ink*/brass*/treble/double`,
`--space-*`, `--radius-*`, `--duration-*`, `--ease-*`). Components reference semantic
utilities only (`bg-surface`, `text-ink`); board colours are consumed as `var(--board-*)`
on SVG nodes, not as utilities. `src/components/game/classes.ts` holds the shared class
strings.

## Key implementation locations

| Concern                                    | Location                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engine core                                | `src/game-engine/GameEngine.ts:27` (`startMatch:38`, `recordThrow:62`)                                                                                 |
| Engine public API                          | `src/game-engine/index.ts:1`, documented in `src/game-engine/README.md`                                                                                |
| x01 mode + wrappers                        | `src/game-engine/modes/StandardMode.ts` (`Standard501Mode:195`, `Standard301Mode:202`)                                                                 |
| Other modes                                | `src/game-engine/modes/CricketMode.ts`, `AroundTheClockMode.ts`, `ShanghaiMode.ts`                                                                     |
| Mode registry (rule sheet source of truth) | `src/game-engine/modes/registry.ts:1`                                                                                                                  |
| Checkout / bust rules                      | `src/game-engine/rules/OutRules.ts`                                                                                                                    |
| Legs & sets                                | `src/game-engine/rules/LegSetManager.ts`                                                                                                               |
| Board geometry                             | `src/board/boardGeometry.ts:97` (`resolveBoardHit`), `src/board/boardSource.ts:11`                                                                     |
| Board SVG component                        | `src/components/board/DartBoard.tsx:283`                                                                                                               |
| x01 match view (client-side engine)        | `src/components/x01/X01MatchView.tsx:80`                                                                                                               |
| Shared game components                     | `src/components/game/*` (MatchLayout, ScoreDisplay, ThrowInputPad, VisitChips, RuleSheet, BoardSourceSelector)                                         |
| App shell                                  | `src/components/shell/*`, `src/components/ui/SkipLink.tsx`, `app/layout.tsx`                                                                           |
| Design tokens                              | `app/globals.css:14`                                                                                                                                   |
| Auth (Auth.js config)                      | `src/auth/nextauth.ts:23`; bearer seam `src/auth/requireAuth.ts:56`                                                                                    |
| Auth route                                 | `app/api/auth/[...nextauth]/route.ts`                                                                                                                  |
| Friends                                    | `src/friends/FriendService.ts:33`, `src/friends/prismaFriendRepository.ts`                                                                             |
| Ratings                                    | `src/rating/ratingService.ts:111`, `eloService.ts`, `performanceService.ts`, `prismaRatingRepository.ts`, routes `src/rating/ratingRoutes.ts:49`       |
| Privacy (GDPR)                             | `src/privacy/exportService.ts:34`, `deleteService.ts:10`, `auditService.ts:23`                                                                         |
| Career                                     | `src/career/questLoader.ts:50`, `questSchema.ts`, `questService.ts`, `progressionService.ts`, `rewardService.ts`, quests in `src/career/quests/*.json` |
| Career progress repository                 | `src/career/careerProgressRepository.ts` (in-memory, active) and `src/career/repositories/prismaCareerProgressRepository.ts` (present, unused)         |
| Realtime server                            | `src/realtime/server.ts`, `src/realtime/socketServer.ts:194`                                                                                           |
| Realtime events                            | `src/realtime/types.ts:8` (`REALTIME_EVENTS`)                                                                                                          |
| Room model / registry                      | `src/realtime/GameRoom.ts`, `src/realtime/RoomRegistry.ts`                                                                                             |
| Room persistence                           | `src/realtime/IRoomStore.ts`, `InMemoryRoomStore.ts`, `RedisRoomStore.ts`, `roomStoreFactory.ts:11`                                                    |
| Anti-cheat                                 | `src/realtime/antiCheatMiddleware.ts:14,41,56`                                                                                                         |
| Invites                                    | `src/realtime/inviteService.ts:11`; routes `app/api/invite/{create,join}/route.ts`                                                                     |
| Matchmaking (unwired)                      | `src/realtime/matchmaking.ts:9`                                                                                                                        |
| AI opponent                                | `src/ai/engine.ts`, configs `src/ai/config/*.json`; seam `src/realtime/types.ts:60`                                                                    |
| Camera seam                                | `src/camera/ICameraService.ts:11`, `src/camera/SmartphoneCameraService.ts`                                                                             |
| CV skeleton                                | `src/camera/vision/*` (raises `NotImplementedInCvPhaseError`)                                                                                          |
| Data model                                 | `prisma/schema.prisma` (8 models), `prisma/migrations/20260101000000_init/migration.sql` (8 tables)                                                    |
| CI                                         | `.github/workflows/ci.yml` (lint, format:check, typecheck, test — no E2E)                                                                              |

## Where the boundaries are still porous

Observed in the code, not inferred:

1. **The engine is not behind a server boundary in the shipped game pages.**
   `src/components/x01/X01MatchView.tsx` imports `GameEngine` and `StandardMode`
   directly and runs the match in the browser. The engine is pure TypeScript by design,
   so this is legal, but it means the "server-authoritative" claim
   (`CLAUDE.md:3`, `docs/ARCHITECTURE.md:43`) does not describe the five game routes.
2. **The realtime layer uses a placeholder mode.**
   `src/realtime/GameStateMachine.ts:23-25` constructs `GameEngine(new NeutralScoreMode())`
   (`src/game-engine/NeutralScoreMode.ts`);
   the real modes are never injected into the server. Realtime multiplayer therefore
   does not exercise the rules that the UI shows.
3. **No `src/services` / `src/repositories` / `src/domain` layer exists.** Service and
   repository code is colocated inside each feature folder, and route handlers import
   services directly (`app/api/**/route.ts` → `@/rating/ratingRuntime`,
   `@/friends/FriendService`). The layering is by convention (route → service →
   repository), not enforced by the directory structure or by any lint rule.
4. **UI imports domain code directly.** `app/game/*/page.tsx` and
   `src/components/{game,x01}/*` import `@/game-engine` and `@/board` (7 files). This
   is intentional for the pure modules, but it means the boundary is a naming convention.
5. **`src/career` and `src/rating` still use a bearer-token `AuthGateway`**
   (`src/career/auth/authGateway.ts`, `src/rating/authGateway.ts`) rather than the
   Auth.js session; the two auth paths coexist.
6. **The career Prisma repository is orphaned.** `createPrismaCareerProgressRepository`
   is exported and unit-tested but not wired into `src/career/questRuntime.ts`, and its
   `prisma.careerQuestProgress` delegate has no counterpart in `prisma/schema.prisma`.
7. **In-memory state crosses the process boundary.** `src/realtime/inviteService.ts` and
   `src/career/careerProgressRepository.ts` keep state in module-level maps, so invite
   codes and career progress do not survive a restart and are not shared between the
   Next.js process and the separate realtime process (`npm run realtime`).
8. **Anti-cheat is split.** `src/realtime/antiCheat.ts` and
   `src/realtime/antiCheatMiddleware.ts` both exist in the same folder; the middleware
   is the one imported by the socket server.

## External dependencies

- **PostgreSQL** via Prisma 6.19.3 — `DATABASE_URL` required for auth, friends, ratings,
  career persistence. Optional for the single-player game routes.
- **Redis** via ioredis 6 — optional; selected by `USE_REDIS` for the realtime room
  store.
- **Socket.IO 4.8.4** (server + client) — realtime transport.
- **next-auth 5.0.0-beta.32** — authentication; requires `AUTH_SECRET`.
- **bcryptjs** (password hashing), **jose** (JWT session tokens).
- **lucide-react** — the icon family (single 24px/2px stroke grid).
- **Google Fonts via `next/font/google`** — Barlow Condensed / Barlow / JetBrains Mono,
  self-hosted at build time; the build fails if the network is unavailable
  (`.claude/plans/darthub-design-implementation/_plan.md:126`).
- **Node ≥ 20**, npm 10+; Docker images in `Dockerfile` / `docker-compose.yml`
  (PostgreSQL 16 in the compose file).
