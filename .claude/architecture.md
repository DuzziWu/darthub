# Architecture

## Directory Structure
- `src/`
  - `components/` – React UI components (shadcn/ui, Tailwind styling)
  - `pages/` – Next.js page routes
  - `app/` – (if using Next.js App Router) top‑level UI layout
  - `services/` – Service‑class implementations (business logic)
  - `repositories/` – Repository abstractions for data access (Prisma ORM)
  - `dto/` – Data Transfer Objects used between layers
  - `domain/` – Domain entities and core DDD logic
  - `infrastructure/` – Prisma client, external adapters, DB migrations
  - `auth/` – Auth.js configuration and strategies
  - `game/` – Independent Dart game engine (to be developed)
  - `realtime/` – WebSocket server / real‑time authority layer
- `public/` – Static assets
- `styles/` – Tailwind config, global CSS
- `tests/`
  - `unit/` – Unit tests (Vitest)
  - `integration/` – Integration tests (Vitest)
  - `e2e/` – End‑to‑end tests (Playwright)

## Patterns Used
- **Service classes** – encapsulate business logic in `services/`
- **Repository pattern** – data access via `repositories/` using Prisma
- **DTOs** – shape data flowing between layers
- **Modular architecture** – clear separation of UI, domain, infrastructure
- **Domain‑Driven Design (DDD)** – domain layer contains core game rules and entities
- **Avoided**: CQRS and event sourcing (not required for initial MVP)

## Conventions
- One class / module per file
- Tests mirror source structure under `tests/`
- All TypeScript files use `strict` compiler options
- Linting/formatting enforced via ESLint + Prettier
- Use Tailwind CSS utility classes for styling; shadcn/ui for component primitives

## Key Integrations
- **Prisma** – ORM for PostgreSQL; generated client lives in `infrastructure/`
- **Auth.js** – authentication, supports OAuth providers, JWT, etc.
- **WebSockets** – real‑time multiplayer authority server under `realtime/`
- **Playwright** – end‑to‑end testing of UI flows
- **Docker** – containerized development and deployment; a functional Dockerfile will be added during the initial technical setup.

## Future Extension Points
- Camera recognition interface – defined in `domain/` as an abstract service to be implemented later
- Modular game engine – isolated in `game/` and can be imported by both client and server
