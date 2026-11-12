# Architecture

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [System Layers](#system-layers)
- [Modules and Responsibilities](#modules-and-responsibilities)
- [Directory Structure](#directory-structure)
- [Patterns Used](#patterns-used)
- [Key Integrations](#key-integrations)
- [Real-Time Authority Flow](#real-time-authority-flow)
- [Conventions](#conventions)
- [Extension Points](#extension-points)
- [Related Documents](#related-documents)

## Overview

DartHub follows a clean, layered, domain-driven architecture. The front-end (Next.js and React) talks to a backend composed of domain logic, services, and repositories backed by PostgreSQL through Prisma. Real-time play is handled by a dedicated Socket.IO server module that owns all game state. Every hardware or data-source dependency is abstracted behind an interface so implementations can be swapped or deferred.

This document describes the designed system. Modules marked as under construction are being built by parallel work streams; see `docs/ROADMAP.md` for current delivery status.

## Architecture Diagram

**The rendered architecture diagram is to be added later.** It will show the browser client, the Next.js server, the Socket.IO real-time server, the Prisma and PostgreSQL persistence layer, and the external camera sources. The textual layer model below is authoritative until the diagram lands.

## System Layers

```text
Browser client (React, Tailwind, shadcn/ui)
        |  REST (route handlers)        |  Socket.IO events
Next.js server (app/)                    Real-time server (src/realtime)
        \                                /
         Feature services (src/auth, src/career, src/friends,
                            src/privacy, src/rating)
                  |
            Domain core (src/game-engine, src/ai, src/board, src/camera)
                  |
            Repository layer (src/friends, src/rating — Prisma adapters)
                  |
            Prisma client (prisma/schema.prisma) -> PostgreSQL
```

The client never writes game state directly. REST handles profile, social, privacy, and career APIs; Socket.IO handles live match state.

## Modules and Responsibilities

| Module             | Responsibility                                                            | Status      |
| ------------------ | ------------------------------------------------------------------------- | ----------- |
| `app/`             | Next.js App Router pages, route handlers for REST endpoints, page shells  | in progress |
| `src/components/`  | React UI components built on shadcn/ui primitives with Tailwind styling   | in progress |
| `src/game-engine/` | Independent dart game engine shared by client and server                  | in progress |
| `src/realtime/`    | Socket.IO server, authoritative game loop, rooms, and matchmaking         | in progress |
| `src/ai/`          | Stateless statistical AI opponent with difficulty tiers and personalities | in progress |
| `src/auth/`        | Auth.js configuration, strategies, guest sessions, and access tokens      | in progress |
| `src/camera/`      | Camera abstraction exposing ICameraService plus the smartphone stub       | in progress |
| `src/board/`       | Board geometry and board-source abstraction shared by client and engine   | in progress |
| `src/privacy/`     | GDPR export and deletion services plus the audit logger                   | in progress |
| `src/career/`      | Career mode quest engine and JSON quest definitions                       | in progress |
| `src/friends/`     | Friend service and its Prisma-backed repository adapter                   | in progress |
| `src/rating/`      | Elo rating, performance records, and their repository adapters            | in progress |
| `prisma/`          | Prisma schema, migrations, and the generated client                       | in progress |
| `tests/`           | Vitest unit and integration suites, plus Playwright end-to-end specs      | in progress |
| `e2e/`             | Playwright end-to-end specs and fixtures                                  | in progress |

## Directory Structure

```text
app/             Next.js App Router pages and REST route handlers
src/
  components/    React UI components (shadcn/ui, Tailwind styling)
  game-engine/   Independent Dart game engine
  realtime/      Socket.IO real-time authority layer
  ai/            Statistical AI opponent engine
  auth/          Auth.js configuration and strategies
  board/         Board geometry and board-source abstraction
  camera/        Camera abstraction and smartphone stub
  privacy/       GDPR services and audit logger
  career/        Career mode engine and quest JSON content
  friends/       Friend service and Prisma repository adapter
  rating/        Elo rating, performance records, repository adapters
prisma/          Prisma schema and migrations
public/          Static assets
design-system/   Design tokens and shared visual primitives
tests/
  unit/          Unit tests (Vitest)
  integration/   Integration tests (Vitest)
e2e/             End-to-end tests (Playwright)
docs/            Product and engineering documentation
.agents/skills/  OpenHands project skills (see docs/ai-skills/README.md)
```

## Patterns Used

- **Feature-scoped services**: business logic lives beside the feature that owns it (`src/auth`, `src/career`, `src/friends`, `src/privacy`, `src/rating`) and never leaks into route handlers or UI.
- **Repository pattern**: persistence flows through feature-local repository adapters (for example `src/friends/prismaFriendRepository.ts`) over Prisma, with in-memory implementations for tests.
- **DTOs**: data flowing between layers is shaped explicitly, never passed as raw ORM entities.
- **Dependency injection**: the AI engine and camera implementations are injected via provider interfaces.
- **Layered DDD**: the domain layer contains core game rules and entities with no framework imports.
- **Deliberately avoided**: CQRS and event sourcing, which are not required for the MVP.

## Key Integrations

- **Prisma**: ORM for PostgreSQL; the schema lives in `prisma/schema.prisma` and the generated client is consumed by the feature repository adapters.
- **Auth.js**: authentication with OAuth providers and guest session support.
- **Socket.IO**: real-time multiplayer authority server under `src/realtime/`.
- **Playwright**: end-to-end testing of UI flows.
- **Docker**: containerised development and deployment for app and database.

## Real-Time Authority Flow

1. A client connects to the Socket.IO server and joins a room (private code or matchmaking).
2. The server runs the game engine for that room and broadcasts state snapshots.
3. A throw proposal is validated against engine rules and anti-cheat middleware before being applied.
4. AI turns are generated from a seeded statistical model and checksummed.
5. On match end, the rating service updates Elo and performance records and the result is persisted.

## Conventions

- One class or module per file.
- Tests mirror the source structure under `tests/`.
- All TypeScript uses strict compiler options.
- Linting and formatting are enforced via ESLint and Prettier.
- Styling uses Tailwind utility classes and shadcn/ui primitives.

## Extension Points

- **Camera recognition**: `ICameraService` in `src/camera/` (with `ICameraProcessor` alongside it) accepts new hardware sources such as USB or HDMI capture without touching game logic.
- **Modular game engine**: isolated in `src/game-engine/` and importable by both client and server.
- **Room persistence backends**: the matchmaking and room store is pluggable, with a Redis backend planned (see `docs/DECISIONS.md`).
- **Ranking scopes**: the rating tables are keyed by mode, allowing regional boards later without schema rework.

## Related Documents

- [Product Requirements](./PRD.md)
- [Database Design](./DATABASE.md)
- [API Specification](./API.md)
- [Roadmap](./ROADMAP.md)
- [Security](./SECURITY.md)
- [Decision Log](./DECISIONS.md)
