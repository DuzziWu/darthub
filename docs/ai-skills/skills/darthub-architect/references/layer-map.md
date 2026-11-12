# DartHub Layer Map

The authoritative directory-to-layer map, the allowed dependency arrows, and
the stale documentation paths with their correct replacements.

## Directory → layer

| Path                  | Layer                   | May depend on                                                  |
| --------------------- | ----------------------- | -------------------------------------------------------------- |
| `app/api/**/route.ts` | transport               | the feature's `*Runtime` and `*Routes`                         |
| `app/**/*.tsx`        | presentation            | `src/components`, `src/game-engine` (read-only), `src/board`   |
| `src/components/**`   | presentation            | `src/components/*`, `src/game-engine` (read-only), `src/board` |
| `src/game-engine/**`  | domain                  | `src/board` only                                               |
| `src/board/**`        | domain                  | nothing                                                        |
| `src/realtime/**`     | transport / application | `src/game-engine`, `src/ai`, `src/auth`                        |
| `src/auth/**`         | application             | its own `repository.ts`, `session.ts`, `password.ts`           |
| `src/career/**`       | application             | its own repository interface, `src/career/auth/authGateway.ts` |
| `src/rating/**`       | application             | its own repository interface                                   |
| `src/friends/**`      | application             | its own repository interface                                   |
| `src/privacy/**`      | application             | `src/auth` seams                                               |
| `src/ai/**`           | domain                  | nothing                                                        |
| `src/camera/**`       | domain (interface)      | nothing                                                        |

## Allowed dependency arrows

```text
app/api        -> src/<feature>/*Runtime
app/**/*.tsx   -> src/components, src/game-engine, src/board
src/components -> src/components, src/game-engine, src/board
src/realtime   -> src/game-engine, src/ai, src/auth
src/game-engine-> src/board
src/<feature>  -> its own repository.ts (interface only)
```

## Forbidden arrows

```text
src/game-engine  -> src/components, src/realtime, react, next, socket.io, node:*
src/<feature>    -> another feature's prisma<Feature>Repository.ts
src/<feature>    -> @prisma/client (go through repository.ts)
src/components   -> src/auth, src/prisma, src/realtime internals
```

## Existing extension points

| Interface          | Location                         | Reuse it for                       |
| ------------------ | -------------------------------- | ---------------------------------- |
| `DartGameMode`     | `src/game-engine/types.ts`       | a new game variant's rules         |
| `ICameraService`   | `src/camera/ICameraService.ts`   | a new camera source                |
| `ICameraProcessor` | `src/camera/ICameraProcessor.ts` | a new frame processor              |
| `IRoomStore`       | `src/realtime/IRoomStore.ts`     | a new room persistence backend     |
| `AuthGateway`      | `src/career/auth/authGateway.ts` | the career module's seam onto auth |
| `AuthRepository`   | `src/auth/repository.ts`         | user persistence                   |

## Feature-slice layout

Each feature under `src/` owns its vertical slice:

```text
src/<feature>/
  repository.ts                 the port (interface)
  prisma<Feature>Repository.ts  the adapter (Prisma)
  <feature>Service.ts           the business logic
  <feature>Routes.ts            the transport layer
  <feature>Runtime.ts           the default dependency wiring
  errors.ts                     the feature's error types
```

Observed instances:

| Feature | Repository interface          | Prisma implementation                                         | Service                                                        | Routes                                | Runtime            |
| ------- | ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------- | ------------------ |
| auth    | `repository.ts`               | `prismaAuthRepository.ts`                                     | `authService.ts`                                               | —                                     | `runtime.ts`       |
| career  | `careerProgressRepository.ts` | `repositories/prismaCareerProgressRepository.ts`              | `progressionService.ts`, `questService.ts`, `rewardService.ts` | `progressRoutes.ts`, `questRoutes.ts` | `questRuntime.ts`  |
| friends | `repository.ts`               | `prismaFriendRepository.ts`                                   | `FriendService.ts`                                             | —                                     | —                  |
| rating  | `ratingRepository.ts`         | `prismaRatingRepository.ts` (+ `inMemoryRatingRepository.ts`) | `ratingService.ts`, `eloService.ts`, `performanceService.ts`   | `ratingRoutes.ts`                     | `ratingRuntime.ts` |

Not every feature needs every file. The rule is that the service depends on
the interface, never on the Prisma implementation.

## Stale documentation paths

These paths used to be described in the documentation but **do not exist** in
the codebase. The docs have since been corrected, but the mapping is kept here
so a stale reference is still recognised when it appears in a comment, a
branch, or an older doc. Do not follow them; do not create them.

| Stale path (documented)             | Actual path                                                    | Where the stale path appeared         |
| ----------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `src/game/`                         | `src/game-engine/`                                             | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/services/`                     | `src/<feature>/<feature>Service.ts`                            | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/repositories/`                 | `src/<feature>/repository.ts` + `prisma<Feature>Repository.ts` | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/domain/`                       | `src/game-engine/`, `src/board/`, `src/ai/`                    | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/infrastructure/`               | `prisma/schema.prisma` + the per-feature Prisma repositories   | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/dto/`                          | `src/camera/CameraDTO.ts` (the only true DTO)                  | `docs/ARCHITECTURE.md` (now fixed)    |
| `src/pages/`                        | `app/` (App Router)                                            | `docs/ARCHITECTURE.md` (now fixed)    |
| `styles/`                           | `app/globals.css`                                              | `.claude/architecture.md` (now fixed) |
| `tests/e2e/`                        | `e2e/`                                                         | `.claude/testing.md` (now fixed)      |
| `src/game/` (camera interface note) | `src/camera/`                                                  | `.claude/architecture.md`             |

Also stale in `.claude/testing.md`: it said "Test Framework: None (to be
configured later)" and "command not yet functional". Vitest and Playwright
are both configured and running, and `.claude/testing.md` now points at
`docs/TESTING.md`. The real configuration is `vitest.config.ts` and
`playwright.config.ts`.

## Correcting the documentation

When correcting a stale path, update all three of:

1. `.claude/architecture.md` — the directory structure section.
2. `docs/ARCHITECTURE.md` — the module table and the directory structure.
3. `.claude/testing.md` — the framework and command sections.

Do it as its own change, with its own review — not as a side effect of an
unrelated feature.

`tests/unit/docs/docs.test.ts` reads the module list from the `src/` directory
on disk, so the documentation check cannot drift away from the repository
layout — but the prose above still has to match the tree.
