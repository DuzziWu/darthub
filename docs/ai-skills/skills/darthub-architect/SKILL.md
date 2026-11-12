---
name: darthub-architect
description: This skill should be used when the user asks to "where should this code go", "review the architecture", "add a module", "refactor the structure", "is this the right layer" or otherwise decides the shape of a change in DartHub. Holds the authoritative layer map, the dependency-direction rules and the list of stale architectural documentation that must not be trusted.
triggers:
  - architecture
  - layering
  - where should this live
  - module structure
  - refactor structure
  - code organization
---

# DartHub Architect

Guide for placing new code correctly and keeping DartHub's layering intact.

## Use the real tree, not the documented one

`docs/ARCHITECTURE.md` now describes the real layout — the earlier version
listed **intended** directories that the code does not use (`src/services/`,
`src/repositories/`, `src/domain/`, `src/game/`, `src/infrastructure/`,
`src/pages/`). Treat any path in this skill that disagrees with the working
tree as stale and trust the tree.

The code is organised by **feature**, and the engine lives in `src/game-engine/`
rather than `src/game/`. Use this map:

```text
app/                    Next.js App Router: pages + REST route handlers
  api/                  Route handlers, grouped by feature
src/
  game-engine/          Pure TS core — no React, no Socket.IO, no Node built-ins
  board/                Board geometry; owns the BoardSegment vocabulary
  components/           board/ game/ shell/ ui/ — shared React components
  auth/                 Service, repository, JWT session, guest linking, requireAuth
  career/               Quest engine, progression, rewards
  rating/               Elo + performance ratings
  realtime/             Socket.IO server, GameStateMachine, rooms, anti-cheat
  ai/                   Stateless statistical AI opponent
  camera/               ICameraService abstraction + vision stubs
  friends/              Social graph, invitations
  privacy/              GDPR export, deletion, audit log
prisma/schema.prisma    8 models, 4 enums
tests/                  unit/ integration/ (Vitest) — mirror the source tree
e2e/                    Playwright specs
```

> The stale docs are a known issue (Finding F1 in
> `docs/ai-skills/README.md`). Do not follow them, and do not "fix" them as a
> side effect of an unrelated change — correct them as their own task.

## The feature-slice convention

A feature is a directory under `src/` that owns its whole vertical slice:

```text
src/<feature>/
  repository.ts              the interface (port)
  prisma<Feature>Repository.ts  the Prisma implementation (adapter)
  <feature>Service.ts        the business logic
  <feature>Routes.ts         the transport layer
  <feature>Runtime.ts        the default dependency wiring
  errors.ts                  the feature's error types
```

A service depends on the _interface_, never on the Prisma implementation. This
is what lets unit tests pass an in-memory double.

## Dependency direction

Allowed:

```text
app/            -> src/<feature>/<x>Runtime
src/realtime/   -> src/game-engine
src/components/ -> src/game-engine, src/board, src/components/*
src/<feature>/  -> its own repository.ts interface
src/<feature>/  -> other features only through their public seam
```

Forbidden:

```text
src/game-engine/ -> src/components, src/realtime, react, next, socket.io, node:*
src/<feature>/   -> another feature's prisma<Feature>Repository.ts
src/<feature>/   -> @prisma/client directly (go through repository.ts)
```

The engine boundary is the strictest one: `src/game-engine/types.ts` states
that the engine must never import UI frameworks, networking layers or
Node/browser-only built-ins, so it can run unchanged on the server and in the
browser.

## Reuse the extension points that already exist

Before introducing an abstraction, check whether one is already there:

| Interface          | Location                         | Purpose                            |
| ------------------ | -------------------------------- | ---------------------------------- |
| `DartGameMode`     | `src/game-engine/types.ts`       | a game variant's rules             |
| `ICameraService`   | `src/camera/ICameraService.ts`   | camera input abstraction           |
| `ICameraProcessor` | `src/camera/ICameraProcessor.ts` | frame processing                   |
| `IRoomStore`       | `src/realtime/IRoomStore.ts`     | room persistence (memory / Redis)  |
| `AuthGateway`      | `src/career/auth/authGateway.ts` | the career module's seam onto auth |
| `AuthRepository`   | `src/auth/repository.ts`         | user persistence                   |

## Layer responsibilities

| Layer           | Owns                        | Must not               |
| --------------- | --------------------------- | ---------------------- |
| Route handler   | wiring only                 | contain business logic |
| Service         | business logic, validation  | import Prisma directly |
| Repository      | data access, mapping        | contain business rules |
| Domain / engine | rules and invariants        | import UI or transport |
| Component       | presentation, token classes | hold game rules        |

## Checklist for a structural change

1. Confirm the target directory exists in the real tree (§ above).
2. Place the code in the layer that owns the concern.
3. Keep the dependency direction legal.
4. Define an interface if the feature will need a second implementation
   (test double, Redis vs. memory, camera stub vs. CV).
5. Add a unit test at `tests/unit/<feature>/` mirroring the source path.
6. Update `docs/ARCHITECTURE.md` if the public structure changed — and, if the
   module table is touched, correct its stale entries at the same time.

## Additional Resources

### Reference Files

- **`references/layer-map.md`** — the complete directory-to-layer map, the
  allowed dependency arrows, and the list of stale documentation paths with
  the correct replacement for each.
