<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository layout

- The git repository root is `darthub/` (remote: `https://github.com/DuzziWu/darthub.git`, branch `main`). The parent `/projects` directory is a separate, empty git repo that merely contains it — do not run git commands there expecting the project history.
- The `nextjs-agent-rules` block at the top of this file is re-added automatically by `next dev`. Removing it from a diff only re-creates the uncommitted change, so commit it together with your work.

## Environment setup notes

- npm 12 blocks install scripts by default. After `npm install`, `@prisma/client`, `@prisma/engines`, `esbuild` and `prisma` never run their postinstall, so the Prisma client is not generated. Run `npx prisma generate` explicitly; esbuild ships its platform binary as an optional dependency and works without the script.
- The build is **green**: typecheck, lint, format check and the full Vitest suite (96 files, 447 tests) all pass.

Two checks are conditional on the environment and skip rather than fail:

- `tests/unit/dockerignore.test.ts` needs a running Docker **daemon** — the CLI alone is not enough, and the test probes this with `docker info`.
- `tests/unit/tailwind/tailwindToolchain.test.ts` asserts against a production build in `.next/`, so it needs `npm run build` to succeed first.

`tests/unit/ci-workflow.test.ts` runs the CI steps locally, so it fails whenever typecheck or the test suite fails.

## Testing conventions

- Component tests need a per-file `// @vitest-environment jsdom` docblock; the global environment stays `"node"`.
- The Testing Library `cleanup()` is registered globally in `tests/setup.ts` (via `setupFiles` in `vitest.config.ts`). Do not add per-file `afterEach(cleanup)` calls, and do not remove the setup file — without it a React root outlives the jsdom environment and React's `setImmediate`-based scheduler throws `window is not defined`.
- Route handlers take injected services so tests need no database. Follow `src/auth/linkGuestRoutes.ts` and `src/rating/ratingRoutes.ts`: the `app/api/**/route.ts` file wires the production runtime, the `src/**/route*.ts` file holds the logic.
- Shared test doubles live in `tests/support/` (for example `tests/support/inMemoryAuthRepository.ts`).

## AI development workflows

`docs/ai-skills/` holds the plan for DartHub's project-specific AI skills:

- `docs/ai-skills/README.md` — the upstream skill evaluation, the architecture analysis, and the six `darthub-*` skills with their trigger design.
- `docs/ai-skills/skills/` — the source of truth for the six skills (`darthub-architect`, `darthub-backend`, `darthub-code-review`, `darthub-frontend`, `darthub-game-engine`, `darthub-qa`), each with a `SKILL.md` and its `references/`.

The skills are **installed** in `.agents/skills/` — the OpenHands 1.61.0 project-scoped location — and are byte-identical to `docs/ai-skills/skills/`. Edit `docs/ai-skills/skills/` and copy across, or the two will drift. `.claude/skills/` holds Claude Code format skills, which OpenHands does not read.

The skills encode the architectural invariants documented in `docs/ai-skills/README.md` §2.3. Read that section before making a structural change.
