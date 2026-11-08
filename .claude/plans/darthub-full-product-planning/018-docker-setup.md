# Task 018: Write Dockerfile and Docker‑Compose for app + PostgreSQL

**Status**: completed
**Depends on**: 001
**Retry count**: 0

## Description
Create a multi‑stage Dockerfile for the Next.js app and a `docker-compose.yml` that brings up the app and a PostgreSQL container, wiring environment variables.

## Context
- Files: `Dockerfile`, `docker-compose.yml` at repository root.
- Follow best practices for production image size.

## Requirements (Test Descriptions)
- [x] `it builds a production image with node:18-alpine` — **DEVIATION (documented, not silent)**: Next.js 16 requires Node >= 20 (`package.json` declares `engines.node >= 20`), so `node:18-alpine` would fail `next build`. The production image is built on `node:22-alpine` instead; the test asserts this explicitly. Verified statically (multi-stage FROM chain, final stage `node:22-alpine`) plus a local isolated `next build` that produced `.next/standalone/server.js`. Docker image build itself deferred (see caveat below).
- [x] `it runs the app inside the container and serves on port 3000` — VERIFIED (static + local substitute): Dockerfile exposes 3000, sets `PORT=3000`/`HOSTNAME=0.0.0.0`/`NODE_ENV=production`, `CMD ["node", "server.js"]`, runs as non-root `nextjs` user; compose publishes `3000:3000`. Live substitute evidence: the produced standalone artifact (`node server.js`) served HTTP 200 with "DartHub" content on localhost:3000. Container runtime itself: (live verification deferred — Docker daemon unavailable in this environment).
- [x] `it starts PostgreSQL with persistent volume` — VERIFIED statically: `postgres:16-alpine` service with named volume `postgres-data:/var/lib/postgresql/data`, top-level volume declaration, and `pg_isready` healthcheck. (live verification deferred — Docker daemon unavailable in this environment)
- [x] `it injects DATABASE_URL correctly` — VERIFIED: `DATABASE_URL=postgresql://${POSTGRES_USER:-darthub}:${POSTGRES_PASSWORD:?...}@postgres:5432/${POSTGRES_DB:-darthub}` wired into the `app` service via `environment`, host points at the `postgres` service, gated on postgres health via `depends_on: condition: service_healthy`.
- [x] `it can be started with docker compose up without errors` — VERIFIED statically (compose YAML parses cleanly, both services + healthcheck + depends_on present, `POSTGRES_PASSWORD` is a required (`:?`) interpolation variable so `docker compose up` fails fast instead of silently using a committed credential). `docker compose config` / `docker compose up` execution: (live verification deferred — Docker daemon unavailable in this environment).

## Acceptance Criteria
- `docker compose up -d` launches both containers and the app is reachable. (statically verified; live run deferred — Docker unavailable)
- No sensitive env vars are hard‑coded. — VERIFIED: `POSTGRES_PASSWORD` is required-interpolated (`${POSTGRES_PASSWORD:?...}`), never defaulted; no credentials committed. Test asserts no plaintext password value appears in the compose file.

## Implementation Notes

### Environment caveat (IMPORTANT)
Docker is NOT available in this environment (`docker`/`docker compose` CLI absent, no daemon), so `docker compose up -d --build` could not be executed. All runtime checkboxes are verified statically via `tests/unit/docker.test.ts` plus a real local Next.js build/start substitution (details below). This test file also includes a runtime branch: if a Docker CLI is present, it runs `docker compose config --quiet` with test env vars; without Docker, the structural checks are the verification level.

### Files created
- `Dockerfile` — multi-stage (deps / builder / runner) on `node:22-alpine`, `npm ci`, `next build` in builder, minimal runner carrying only `.next/standalone`, public assets, and `.next/static`; non-root (`nextjs:1001`), `EXPOSE 3000`, `CMD ["node", "server.js"]`.
- `docker-compose.yml` — `app` (build target `runner`, port 3000, DATABASE_URL wiring, depends on healthy postgres) + `postgres` (16-alpine, named volume `postgres-data`, `pg_isready` healthcheck). Comment block documents exactly how the future realtime Socket.IO service (task 009) slots in as a second Node service sharing the same DATABASE_URL wiring.
- `next.config.ts` — `output: "standalone"` (needed for the slim runner image; the repo had no next config before).
- `public/.gitkeep` — the runner stage copies `/app/public`; this keeps the directory present/tracked until real static assets exist (otherwise `COPY --from=builder /app/public` would fail).
- `.dockerignore` — minimal (node_modules, .next, .git, coverage, tsbuildinfo, next-env.d.ts, .env*). Task 029 owns the full `.dockerignore`; this minimal set is included here because a Dockerfile whose build context ships node_modules is not a correct deliverable.
- `tests/unit/docker.test.ts` — the 5 requirement tests (Vitest, unit suite).

### Verification evidence
1. `npx vitest run tests/unit/docker.test.ts` — 5/5 passed.
2. Isolated real build (because the repo-wide `next build` currently fails typecheck on OTHER agents' in-flight files — docs/game-engine/import-order tests, none touching my files): built a temp copy containing only `app/`, `public/`, `next.config.ts`, `next-env.d.ts`, minimal package.json + fresh install of next 16.4.5/react 19.3.1. `next build` passed and emitted `.next/standalone/server.js` with `"output": "standalone"`.
3. Ran the produced standalone artifact: `PORT=3000 node .next/standalone/server.js` → HTTP 200 on `http://localhost:3000/` with the DartHub markup (exact artifact the runner stage executes). Temp artifacts and the server were cleaned up afterwards.
4. `eslint` and `prettier --check` clean for all new files; `tsc --noEmit` clean for all new files (repo-wide typecheck currently fails only in other agents' in-flight files).

### Security
- No hard-coded secrets: `POSTGRES_PASSWORD` is a required compose variable (`${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in the environment}`); supplying it is the operator's job (env file / environment). `POSTGRES_USER`/`POSTGRES_DB` default to a non-sensitive `darthub`.
- `.env*` excluded from the build context via `.dockerignore`.

### Known limitations / notes for later tasks
- Docker engine needed on a CI/dev machine to run the deferred live verification (`docker compose up -d --build`; app on :3000; `docker compose down -v`).
- Task 009: realtime service should be added to `docker-compose.yml` as outlined in the comment block.
- Task 029: expand `.dockerignore` (README, docs, tests, .github, prisma artifacts as appropriate).
- Prisma migrate (e.g. `POSTGRES_PASSWORD=... docker compose run --rm app npx prisma migrate deploy`) is deliberately NOT wired into startup here; migration/ORM work belongs to the Prisma tasks.
- Full-suite status at completion: `tests/unit/docker.test.ts` 5/5 green; repo-wide suite has 5 pre-existing failures, all confined to other agents' in-flight files (prettier/eslint/tsc/CI-workflow over `src/ai`, `src/realtime`, docs, game-engine and related test files), none referencing any file created by this task.
