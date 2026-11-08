# DartHub

DartHub is a brand‑new, modular, server‑authoritative multiplayer game built with a Next.js/React front‑end and a clean domain‑driven backend. The project starts from scratch with TypeScript, Tailwind CSS, shadcn/ui, Prisma for PostgreSQL, and Auth.js for authentication. It will include a reusable Dart game engine, real‑time WebSocket authority, and an extensible camera‑recognition interface.

## Feature Development

For any new feature or substantial change, use the `hcf:plan-create` skill to generate an autonomous development plan. After the plan is created, you can ask to execute it with `hcf:plan-orchestrate`. Simple bug fixes or one‑off edits can be made directly.

## Tech Stack
- **Language**: TypeScript (strict mode) 
- **Framework**: Next.js (React) 
- **Testing**: Vitest (unit & integration) – to be configured, parallel execution preferred
- **E2E Tests**: Playwright
- **Linting / Formatting**: ESLint (recommended) + Prettier
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: Auth.js (or equivalent)
- **Real‑time**: WebSockets with server authority
- **Containerization**: Docker

## Core Principles
- Modular, maintainable architecture
- Strict separation of frontend, backend, domain logic, and infrastructure
- Domain‑Driven Design with service and repository layers
- Avoid unnecessary CQRS or event sourcing in the MVP
- Open‑source tech stack, minimise recurring costs
- No paid services, APIs or subscriptions may be used without explicit approval; prefer self‑hosting and free open‑source tools

### Autonomous Development
- The central orchestrator coordinates and controls all sub‑agents.
- All agents must obey the architecture, security, and quality standards defined in the configuration files.
- Tasks must be verifiable; an agent may not mark a task as completed without validated results.

## Project Structure
See `.claude/architecture.md` for a detailed directory map. Key folders include `src/components`, `src/services`, `src/repositories`, `src/domain`, `src/game`, and `src/realtime`.

## Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Lint / format code
npm run lint

# Run tests (once Vitest is set up)
echo "Test runner not configured yet"
```

## Key Rules
- All TypeScript must enable `strict` mode
- Follow ESLint recommended rules and Prettier formatting
- Use Tailwind utility classes; shadcn/ui for component primitives
- Write tests for any new code; aim for ≥80% coverage
- Keep UI, domain, and infrastructure layers separate
- Use service classes and repository pattern for business and data access
- No CQRS or event sourcing unless a clear need emerges later

## Detailed Configuration
- Testing configuration: `.claude/testing.md`
- Code standards: `.claude/code-standards.md`
- Architecture details: `.claude/architecture.md`

✅ Project configured for autonomous development!

**Next steps**
1. Review the generated `.claude/*` files and adjust as needed.
2. Set up Vitest and Playwright when ready.
3. Describe a feature to start planning: e.g., "Help me implement player matchmaking."

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)