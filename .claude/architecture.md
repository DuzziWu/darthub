# Architecture

The authoritative architecture reference is [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
It describes the layer model, the modules that exist today, the patterns in use, and the
extension points. Read it before making a structural change.

This file used to hold a duplicate of that description. It drifted out of date — it
described directories (`src/services/`, `src/repositories/`, `src/domain/`,
`src/infrastructure/`, `src/game/`) that the repository has never had. Keeping two
copies of a directory tree is what let the drift happen, so this file now only points
at the single source of truth.

## Conventions

These still apply and are repeated in `docs/ARCHITECTURE.md`:

- One class / module per file.
- Tests mirror the source structure under `tests/`.
- All TypeScript files use `strict` compiler options.
- Linting and formatting are enforced via ESLint + Prettier.
- Use Tailwind CSS utility classes for styling; shadcn/ui for component primitives.

## AI skills

The project-scoped OpenHands skills live in `.agents/skills/` and are documented in
[`docs/ai-skills/README.md`](../docs/ai-skills/README.md). The `darthub-architect` skill
encodes the architectural invariants that are easy to break without noticing.
