# Current State

Last verified: 2026-11-10 (repo `E:\coding\darthub`, branch `feature/darthub-design-implementation`).

## Working functionality

Verified by reading the code and the committed test files. Every claim below points at
an implementation and, where one exists, a test file.

**Game core**

- `src/game-engine/GameEngine.ts:27` (class), `startMatch:38`, `recordThrow:62` —
  mode-agnostic.
- Modes: x01 (`src/game-engine/modes/StandardMode.ts`, wrappers `Standard501Mode:195`,
  `Standard301Mode:202` — both default to `outRule: "double"`), `CricketMode`,
  `AroundTheClockMode`, `ShanghaiMode`, plus `NeutralScoreMode`
  (`src/game-engine/NeutralScoreMode.ts`) for the realtime layer.
- Rules: `src/game-engine/rules/OutRules.ts` (`straight`/`double`/`master`, bust,
  stranded bust) and `src/game-engine/rules/LegSetManager.ts` (legs/sets).
- Tests: `tests/unit/game-engine/**` (`GameEngine.test.ts`, `GameEngineValidation.test.ts`,
  `modes/*.test.ts`, `rules/*.test.ts`).

**Board & design system**

- `src/board/boardGeometry.ts` — board-plane millimetres, `resolveBoardHit(xMm, yMm):97`,
  `toBoardMm:129`, `BOARD_DIAMETER_MM:16`; `src/board/boardSource.ts` — the three source
  modes (virtual / camera / smart), only virtual implemented.
- `src/components/board/DartBoard.tsx:283` — SVG board authored in millimetres
  (`viewBox="-225.5 -225.5 451 451"`).
- Token layer in `app/globals.css:14` (`@theme static`, semantic `--color-*`, `--space-*`,
  `--radius-*`).
- App shell (`src/components/shell/*`, skip link, one `<main>` per route) and the shared
  game components (`src/components/game/*`).
- Tests: `tests/unit/board/**`, `tests/unit/game/**`, `tests/unit/game-center/**`,
  `tests/unit/shell/**`, `tests/unit/tailwind/**`.

**Pages** — `/`, `/game-center`, `/game`, `/game/301`, `/game/cricket`,
`/game/around-the-clock`, `/game/shanghai`, `/dashboard`, `/lobby`, `/career`
(`app/`). Dashboard, lobby and career are deliberate empty states, not data-backed.

**Backend modules (code present, exercised by unit/integration tests)**

- Auth: Auth.js credentials + guest providers (`src/auth/nextauth.ts:23`), bearer session
  tokens (`src/auth/session.ts`), `requireAuth` seam (`src/auth/requireAuth.ts:56`).
- Friends, ratings (Elo + performance, per mode), GDPR export/delete + audit log.
- Career: JSON quest loader/schema/service, adaptive difficulty, progression and rewards.
- AI: stateless statistical engine with difficulty/personality configs (`src/ai/`),
  injected into the realtime server through the `AIProvider` seam
  (`src/realtime/types.ts:60`) — the server never imports `@/ai` directly.
- Realtime: Socket.IO server (`src/realtime/socketServer.ts:194`), room registry,
  state machine, invite codes, anti-cheat middleware, in-memory and Redis room stores
  (`src/realtime/roomStoreFactory.ts:11`, selected by `USE_REDIS`).
- Camera: `ICameraService` contract + smartphone stub. The vision pipeline
  (`src/camera/vision/`) is **stubs only** — every method raises
  `NotImplementedInCvPhaseError`; no image processing exists.

**Infrastructure** — `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`,
Husky pre-commit hook, GitHub Actions CI running lint / format:check / typecheck / test.
Playwright config exists with 6 spec files; `game-center`, `hub-pages` and `visual-qc`
are active, `login` / `career` / `matchmaking` are fully skipped.

## Active work

**Nothing from the 2026-11-09/10 design-implementation plan is committed.** The repo has
5 commits total (`983cc49`, `fdbfe5f`, `82a0e46`, `663f7a0`, `dc946a4`); everything the
design plan produced is still in the working tree.

Uncommitted and untracked (new files):
`app/game/`, `app/game-center/`, `app/globals.css`, `postcss.config.mjs`, `src/board/`,
`src/components/`, `src/game-engine/modes/AroundTheClockMode.ts`,
`src/game-engine/modes/ShanghaiMode.ts`, `src/game-engine/modes/registry.ts`,
`DESIGN.md`, `design-system/`, `docs/LOCAL_SETUP.md`, `AGENTS.md`,
`.claude/agents/`, `.claude/skills/`, `.claude/plans/{darthub-design-implementation,
darthub-design-system,game-center-styling-fix}/`, `e2e/{game-center,hub-pages,
visual-qc}.spec.ts`, `e2e/visual-qc-helpers.ts`, and new test files under
`tests/unit/{board,game,game-center,shell,tailwind}/`, `tests/integration/invite/`,
`tests/unit/realtime/inviteService.test.ts`.

Modified, tracked files (44 changed, +1752 / −331 vs `HEAD`): `src/game-engine/types.ts`,
`src/game-engine/modes/{StandardMode,index}.ts`, `src/game-engine/README.md`,
`src/camera/CameraDTO.ts`, `src/camera/vision/HitDetector.ts`, `src/career/questLoader.ts`,
`src/friends/prismaFriendRepository.ts`, `src/realtime/{socketServer,RedisRoomStore,
antiCheatMiddleware,inviteService}.ts`, the four `app/api/{auth,invite}` routes, five
`app/` pages, `package.json`, `package-lock.json`, `eslint.config.mjs`, `.gitignore`,
`.prettierignore`, the `_plan.md` of the full-product plan, and 20 test files. Three
UI snapshot files (`tests/unit/ui/__snapshots__/{career,dashboard,lobby}.test.tsx.snap`)
are deleted in the working tree.

Plan state: `darthub-design-implementation` and `game-center-styling-fix` and
`darthub-design-system` all say "completed"; `darthub-full-product-planning/_plan.md`
says 48/48 done while its own `_run-status.md` says 27/48 at the 2026-11-07 stop.

## Known issues

Only issues I could confirm from the repo's own files and recorded outputs. **The test
suite was not run in this session** — `npm run test` writes outside `.devflow/`
(Vitest cache, `test-results/`), which this task forbids. So no failure below was
reproduced today; each is either read from code or taken from a recorded run in the repo.

1. `tests/integration/linkGuest.test.ts` fails without a PostgreSQL server on
   `localhost:5432` (recorded in `test_latest_output.log`, 2026-11-08: "expected 500 to be
   400"; also listed as a known environmental failure in
   `.claude/plans/game-center-styling-fix/_plan.md:33`). Environmental, not a regression.
2. `prisma/schema.prisma` has no `CareerQuestProgress` model and the init migration
   creates no such table, while `src/career/repositories/prismaCareerProgressRepository.ts:8`
   expects `prisma.careerQuestProgress`. Career progress therefore persists only in
   memory (`src/career/questRuntime.ts:29-36`) and is lost on restart.
3. Auth.js is pointed at `/login` (`src/auth/nextauth.ts:32`); no `app/login` route
   exists, so the configured sign-in page 404s.
4. The realtime server's state machine is bound to `NeutralScoreMode`
   (`src/realtime/GameStateMachine.ts:23-25`); the shipped x01 / Cricket / Around The Clock
   / Shanghai modes are not used by the Socket.IO path.
5. `src/realtime/matchmaking.ts` (`PublicMatchmaker`) is not referenced by the socket
   server or the realtime server entry point.
6. `docs/API.md` HTTP paths and Socket.IO event names do not match the implementation
   (full list in `.devflow/memory/PROJECT.md`, contradictions 4 and 5).
7. `docs/ROADMAP.md:32-41` and
   `.claude/plans/darthub-full-product-planning/_run-status.md` disagree with
   `.claude/plans/darthub-full-product-planning/_plan.md` on completion
   status; `.claude/architecture.md` and `docs/ARCHITECTURE.md` describe directories that
   do not exist.
8. The UI snapshot files for career/dashboard/lobby are deleted in the working tree while
   the corresponding tests are modified — whether the remaining snapshot assertions still
   match is **not verified** (suite not run).
9. The root-level `*.log` artifacts (`test_full_suite_output.log`, `lint_output.log`,
   `typecheck_output.log`, `build_output.log`, …) are stale — dated 2026-11-08 and
   superseded by the measured baselines recorded in the plan documents. They should not be
   cited as current state.
10. The in-memory invite-code store (`src/realtime/inviteService.ts`) and the in-memory
    career progress store do not survive a process restart; only the room store has a
    Redis backend.

**Not verified (unknowns)**

- Current pass/fail status of `npm run lint`, `npm run typecheck`, `npm run format:check`,
  `npm run test` and `npm run build` on the present working tree — **not run**.
- Current Playwright results — **not run**.
- Whether the three deleted snapshot files' tests still pass — **not run**.
- CI has never run the E2E suite (`.github/workflows/ci.yml` runs lint/format/typecheck/test
  only) — the E2E status on CI is therefore **unknown**.

## Next recommended step

1. Get explicit user consent, then commit the design-implementation work as one
   checkpoint (the plan commit policy forbids committing without it), so the design
   system, board module and mode registry stop living only in the working tree.
2. Immediately re-run the full gate on that tree — `npm run lint`, `npm run typecheck`,
   `npm run format:check`, `npm run test`, `npm run build`, then the Playwright suite —
   and record the fresh numbers, because the only baselines on record are from 2026-11-09
   and predate the current uncommitted changes.
3. Reconcile the documentation with the code: `docs/API.md` paths and event names,
   `docs/ARCHITECTURE.md` directory map, `docs/ROADMAP.md` status table, and
   `.claude/architecture.md`.
4. Close the schema gap: add the `CareerQuestProgress` model + migration and switch
   `src/career/questRuntime.ts` to the Prisma repository.
