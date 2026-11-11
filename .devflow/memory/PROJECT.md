# Project Overview

Last verified: 2026-11-10 (repo `E:\coding\darthub`, branch `feature/darthub-design-implementation`).

## Purpose

DartHub is a modular, server-authoritative multiplayer darts game: a Next.js/React
front end over a domain-driven backend, with a reusable Dart game engine, real-time
WebSocket authority and an extensible camera-recognition interface.
Sources: `CLAUDE.md:1-5`, `README.md:1-4`, `docs/PRD.md:23`.

The single-player game modes and the design system are the parts that are actually
built and shipped today (see `.devflow/memory/CURRENT_STATE.md`).

## Users and primary workflows

Designed user model (`docs/PRD.md:45-52`):

- **Guest player** — plays without an account. Auth.js exposes a `guest` credentials
  provider that creates a guest row (`src/auth/nextauth.ts:51-61`).
- **Registered player** — Auth.js credentials provider over email/password
  (`src/auth/nextauth.ts:34-50`), stored in `prisma/schema.prisma` `User`.
- **Guest → registered migration** — `POST /api/auth/link-guest` (`app/api/auth/link-guest/route.ts`),
  proof of ownership via a hashed one-time token on `Guest.migrationTokenHash`
  (`prisma/schema.prisma:81`).

Workflows with code behind them:

| Workflow                                               | Entry point                                                                       | Verified state                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Play 501 / 301 / Cricket / Around The Clock / Shanghai | `/game`, `/game/301`, `/game/cricket`, `/game/around-the-clock`, `/game/shanghai` | Engine runs in the browser (`src/components/x01/X01MatchView.tsx:80`)                                                                  |
| Browse game modes and rules                            | `/game-center`                                                                    | Rule sheet generated from the mode registry (`src/game-engine/modes/registry.ts:1`)                                                    |
| Friends (list, request, accept/decline)                | `/api/friends`, `/api/friends/[requestId]`                                        | `src/friends/FriendService.ts:33`, Prisma repository                                                                                   |
| Private-room invite codes                              | `/api/invite/create`, `/api/invite/join`                                          | `src/realtime/inviteService.ts:11` (in-memory map)                                                                                     |
| Rating profile / game result                           | `/api/rating/[userId]`, `/api/rating/game`                                        | `src/rating/ratingService.ts:111`, Elo + performance per mode                                                                          |
| Career quests                                          | `/api/career/quest`, `/api/career/complete`, `/api/career/progress`               | JSON quests in `src/career/quests/`; progress persisted **in memory only** (`src/career/questRuntime.ts:29-36`)                        |
| GDPR export / deletion                                 | `/api/privacy/export` (GET), `/api/privacy/account` (DELETE)                      | `src/privacy/exportService.ts:34`, `src/privacy/deleteService.ts:10`, audit log `src/privacy/auditService.ts:23`                       |
| Multiplayer via Socket.IO                              | `npm run realtime` → `src/realtime/server.ts`                                     | Rooms, state machine, anti-cheat, Redis or in-memory room store                                                                        |
| Camera / computer vision                               | `ICameraService` seam                                                             | Smartphone stub only; the vision pipeline is a stub that throws `NotImplementedInCvPhaseError` (`src/camera/vision/HitDetector.ts:40`) |

Workflows that are **designed but not implemented in the shipped UI**: the dashboard,
lobby and career pages are honest empty states (`app/dashboard/page.tsx:4-8`,
`app/lobby/page.tsx:4-7`), and `e2e/login.spec.ts`, `e2e/career.spec.ts`,
`e2e/matchmaking.spec.ts` are entirely `test.skip`-ed.

## Constraints

From `CLAUDE.md:9-19`, `CLAUDE.md:21-27`, `CLAUDE.md:29-32`, `CLAUDE.md:52-59` and
`.claude/code-standards.md`:

- TypeScript `strict` mode everywhere.
- ESLint (recommended) + Prettier; `npm run lint`, `npm run format:check`,
  `npm run typecheck` are the CI gates (`.github/workflows/ci.yml`).
- Tailwind CSS utility classes; shadcn/ui for component primitives — **shadcn/ui is
  not installed** (no `clsx`/`tailwind-merge`/`cva`, no `cn()` helper anywhere in
  `src/` or `app/`), so the rule is currently unmet by design.
- Tests for new code, ≥80% coverage target; Vitest for unit/integration,
  Playwright for E2E.
- Service classes + repository pattern; clear UI / domain / infrastructure separation.
- No CQRS, no event sourcing in the MVP.
- No paid services, APIs or subscriptions without explicit approval.
- Autonomous development: tasks must be verifiable; an agent may not mark a task
  complete without validated results (`CLAUDE.md:29-32`).
- **Commit policy (plans, not CLAUDE.md):** no commit without the user's explicit
  consent — `.claude/plans/darthub-design-implementation/_plan.md:139-140`,
  `.claude/plans/game-center-styling-fix/_plan.md:103-104`.

## Technology and key links

Stack from `package.json`: Next.js 16.4.5, React 19.3.1, TypeScript 6.0.3 (strict),
Prisma 6.19.3 + PostgreSQL, next-auth 5.0.0-beta.32, Socket.IO 4.8.4, ioredis 6,
Tailwind CSS 4.3.5 (CSS-first `@theme`, no `tailwind.config.*`), lucide-react,
bcryptjs, jose; dev: Vitest 4.1.12, Playwright 1.65, ESLint 10, Prettier 3.9,
tsx. Node ≥ 20.

| Area                                  | Canonical location                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| App Router routes & API handlers      | `app/`                                                                                                                      |
| Domain modules (flat feature folders) | `src/` — `ai`, `auth`, `board`, `camera`, `career`, `components`, `friends`, `game-engine`, `privacy`, `rating`, `realtime` |
| Database schema & migration           | `prisma/schema.prisma`, `prisma/migrations/20260101000000_init/migration.sql`                                               |
| Design system source of truth         | `DESIGN.md`, `design-system/darthub/MASTER.md`, `design-system/darthub/board.md`                                            |
| Design tokens (implemented)           | `app/globals.css` (`@theme static`, line 14)                                                                                |
| Plans                                 | `.claude/plans/*/_plan.md`                                                                                                  |
| Engineering docs                      | `docs/`                                                                                                                     |
| Local runbook                         | `docs/LOCAL_SETUP.md`                                                                                                       |

## Contradictions found in the source material

Recorded rather than resolved; the code is treated as the current truth.

1. **Directory layout.** `.claude/architecture.md:4-21` and `docs/ARCHITECTURE.md:65-91`
   describe `src/services/`, `src/repositories/`, `src/domain/`, `src/infrastructure/`,
   `src/dto/`, `src/game/`, `src/pages/`, `styles/`. None of these directories exist.
   The code uses flat feature folders with services/repositories colocated per feature
   (`src/rating/ratingService.ts` + `src/rating/prismaRatingRepository.ts`).
   The design-implementation plan already calls `.claude/architecture.md` "aspirational
   and stale" (`.claude/plans/darthub-design-implementation/_plan.md:32`).
2. **Engine path.** `docs/PRD.md:59` says the engine "is isolated in `src/game/`";
   it is `src/game-engine/`.
3. **Delivery status, three different answers.**
   `.claude/plans/darthub-full-product-planning/_plan.md:10` says "MVP implementation
   complete — 48/48 tasks done"; that plan's `_run-status.md` (snapshot 2026-11-07) says
   27/48 completed with 21 pending; `docs/ROADMAP.md:32-41` still marks 002, 007, 012,
   018, 020, 026 "in progress" and everything else "pending".
4. **HTTP API paths.** `docs/API.md:42-92` documents `/api/users/me`, `/api/users/migrate`,
   `/api/ratings/me`, `/api/ratings/leaderboard`, `/api/friends/requests/:id/accept`,
   `/api/invites`, `/api/invites/:code/redeem`, `/api/career/quests/:questId/start`.
   The implemented routes are `/api/auth/[...nextauth]`, `/api/auth/link-guest`,
   `/api/auth/invitation`, `/api/rating/game`, `/api/rating/[userId]`, `/api/friends`,
   `/api/friends/[requestId]`, `/api/invite/create`, `/api/invite/join`,
   `/api/career/quest`, `/api/career/complete`, `/api/career/progress`,
   `/api/privacy/export`, `/api/privacy/account` — 14 route files in total.
5. **Socket.IO event names.** `docs/API.md:94-119` documents `matchmaking:enqueue`,
   `matchmaking:dequeue`, `throw:propose`, `game:rematch`, `reconnect:claim`,
   `room:state`, `match:started`, `match:state`, `match:turn`, `match:ended`.
   Implemented constants are `realtime:welcome`, `room:create`, `room:join`,
   `state:request`, `match:start`, `throw:record`, `state:update`
   (`src/realtime/types.ts:8-23`). No matchmaking event exists at all.
6. **"Server-authoritative" vs. shipped play.** `CLAUDE.md:3`, `README.md:3` and
   `docs/ARCHITECTURE.md:43` describe a server-authoritative game. The five game pages
   run `GameEngine` in the browser (`src/components/x01/X01MatchView.tsx:80`), and the
   realtime server's state machine is bound to `NeutralScoreMode`
   (`src/realtime/GameStateMachine.ts:23-25`), so the real modes are not exercised by
   the Socket.IO path.
7. **Auth sign-in page.** Auth.js is configured with `pages: { signIn: "/login" }`
   (`src/auth/nextauth.ts:32`) but no `app/login` route exists; `e2e/login.spec.ts` is
   fully skipped.
8. **Career persistence.** `src/career/repositories/prismaCareerProgressRepository.ts:8`
   expects a `prisma.careerQuestProgress` delegate, but `prisma/schema.prisma` has no
   `CareerQuestProgress` model and the init migration creates no such table. The runtime
   deliberately falls back to the in-memory repository
   (`src/career/questRuntime.ts:29`, exported at `src/career/questRuntime.ts:37`).
9. **Testing doc.** `.claude/testing.md:4` says the test framework is "None (to be
   configured later)" and `.claude/testing.md:22` says the test command is "not yet
   functional"; Vitest 4.1.12 is
   installed and `npm run test` runs `vitest run` (`package.json:16`).
10. **shadcn/ui.** `CLAUDE.md:15` and `CLAUDE.md:55` require shadcn/ui
    primitives; the repo has none (no `clsx`/`tailwind-merge`/`cva`, no `cn()` helper in
    `src/` or `app/`), and the styling-fix plan states so explicitly
    (`.claude/plans/game-center-styling-fix/_plan.md:26`). Note that plan line also says
    there is "no `src/components/ui`" — that is now stale: `src/components/ui/` exists but
    holds two hand-written components (`SkipLink.tsx`, `VisuallyHidden.tsx`), not
    shadcn/ui primitives.
11. **Matchmaking.** `src/realtime/matchmaking.ts` defines `PublicMatchmaker`, but no
    reference to it exists in `src/realtime/socketServer.ts` or `src/realtime/server.ts`
    — the module is exercised only by `tests/unit/matchmaking.test.ts`.
