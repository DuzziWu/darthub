# Current State

Last verified: 2026-11-16 (repo `/projects/darthub`, branch `integration/opencode-team`, HEAD `4cba24f`; `origin/main` is still at `b07665a`).

The mobile scoring UX (DF-0004) landed on top of this state: the Board and Manual
input modes are separated, the player overview with the remaining score sits above the
input surface at 390×844, and the throw overview resets when the turn changes.

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
- **Two-player Cricket** (merged `0f11ae4`, package M1 of
  `.opencode/plans/game-modes-multiplayer/`): the setup seats two players
  (`app/game/cricket/page.tsx:194`, `maxPlayers={2}`); the score sheet is **one
  `<section>` per player** (`src/components/game/CricketScoreSheet.tsx:93-94`) and
  reads the marks of the player who threw (`currentPlayerId`, `:105`); the winner
  comes from `getCricketWinnerId` (`src/game-engine/modes/CricketMode.ts:138`).
  The sheet's props are `players` / `currentPlayerId`
  (`src/components/game/types.ts:263-275`) — the single-player `marks` /
  `playerName` are gone, not kept as aliases.
- Tests: `tests/unit/game-engine/**` (`GameEngine.test.ts`, `GameEngineValidation.test.ts`,
  `modes/*.test.ts` — including `modes/CricketMultiplayer.test.ts` — `rules/*.test.ts`).

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
`e2e/` holds **9** Playwright spec files; `game-center`, `hub-pages`, `score-entry`,
`start-match`, `subpath-preview` and `visual-qc` are active, while `login` / `career` /
`matchmaking` are fully skipped — 7 `test.skip` placeholders in total
(`e2e/login.spec.ts` 2, `e2e/matchmaking.spec.ts` 2, `e2e/career.spec.ts` 3).

## Active work

**The multiplayer game modes are being ported.** The plan is
`.opencode/plans/game-modes-multiplayer/_plan.md` — seven packages, M1 to M7, each with
one owning agent.

- **M1 — Cricket with two players and one score sheet per player: merged** as `0f11ae4`
  ("merge: M1 – Cricket mit zwei Spielern und eigenem Score-Sheet"). The state it
  produced is listed under _Game core_ above.
- **M2 — Around The Clock, one target per player: running** as a parallel cezar task on
  branch `cez/04c2e31f`.
- **M3 — Shanghai, the round advances on turns and two players score separately:
  running** as a parallel cezar task on branch `cez/0091ff2f`.
- **M4 (best-of-N legs and sets), M5 (tie and tie-break), M6 (undo from the result
  screen) and M7 (the design spec and the docs): not started.**

**M2 and M3 are not in this tree.** Their code and their tests are not counted in the
measurements below, and neither package may be started again — both are in flight.

**The mobile scoring UX (DF-0004) is committed and shipped.** It consists of the engine
half (WP-1) and the frontend half (WP-2 to WP-5):

- `src/game-engine/throwLedger.ts` — `deriveTurnThrows(throws, currentPlayerId, dartsPerTurn)`,
  the pure derivation of the darts belonging to the turn in progress. Exposed as
  `GameEngine.getCurrentTurn()` (`src/game-engine/GameEngine.ts:230`).
- `src/components/game/PlayerScoreboard.tsx` — the player overview: the active
  player as a promoted row with a 2 px brass rail and the words „AM ZUG", the other
  players as ruled rows, the mode's own number in a fixed column of tabular figures.
  The data is a union (`ScoreboardData`), one variant per mode, so no mode loses
  information to a generic field.
- `src/components/game/VisitTracker.tsx` — the turn tracker with the darts of
  the turn and the single **Undo**, placed directly above the input surface.
- `src/components/game/MatchLayout.tsx` — the reading order (strip, overview, tracker,
  band switch, input surface, everything else) and the separation of the two input
  surfaces: the manual mode keeps the pad and leaves the board as a read-only preview,
  the board mode keeps the board and removes the pad from the document entirely.

The working tree is clean at `4cba24f`; the repository carries 46 commits on
`integration/opencode-team`. `origin/main` is still at `b07665a`, so none of the work
above has reached the published branch yet.

Plan state: `darthub-design-implementation` and `game-center-styling-fix` and
`darthub-design-system` all say "completed"; `darthub-full-product-planning/_plan.md`
says 48/48 done while its own `_run-status.md` says 27/48 at the 2026-11-07 stop —
`docs/ROADMAP.md` now carries the measured status per task, and supersedes both.

## Known issues

Only issues I could confirm from the repo's own files and recorded outputs. The test
suite **was** run in this session (2026-11-16) — see _Verified on 2026-11-16_ below. So
no failure below was reproduced today; each is either read from code or taken from a
recorded run in the repo.

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
   server or the realtime server entry point — only by `tests/unit/matchmaking.test.ts`.
6. `docs/API.md` HTTP paths and Socket.IO event names do not match the implementation
   (full list in `.devflow/memory/PROJECT.md`, contradictions 4 and 5). The doc names
   `/api/auth/guest`, `/api/users/me` and `/api/ratings/me`, while the routes that exist
   are `/api/auth/link-guest`, `/api/privacy/*` and `/api/rating/{[userId],game}`.
7. `.claude/plans/darthub-full-product-planning/_plan.md` still says 48/48 done while its
   own `_run-status.md` says 27/48 at the 2026-11-07 stop. `docs/ROADMAP.md` now carries
   the measured status per task and supersedes both, but the Claude Code plan is a
   separate workflow's file and was not touched.
8. The root-level `*.log` artifacts (`test_full_suite_output.log`, `lint_output.log`,
   `typecheck_output.log`, `build_output.log`, …) are stale — dated 2026-11-08 and
   superseded by the measured baselines recorded in the plan documents. They should not be
   cited as current state.
9. The in-memory invite-code store (`src/realtime/inviteService.ts`) and the in-memory
   career progress store do not survive a process restart; only the room store has a
   Redis backend.

**Verified on 2026-11-16** (the tree at `4cba24f`, carrying the DF-0004 mobile UX and the
merged M1 cricket package):

- `npm run typecheck`, `npm run lint`, `npm run format:check` — **green**.
- `npx vitest run --reporter=dot` — **108 test files / 553 tests, all green**.
  `tests/unit/dockerignore.test.ts` is environment-flaky in a full run: its live
  `docker build` times out at its 900 s cap, or fails with `failed to export image: No
such image`, when another build touches the same daemon. Run alone on an idle daemon
  it passes — **3 tests passed, 546 s**. The count does **not** include the two packages
  that are still in flight (M2 and M3).
- `npm run build` and `npm run build:prefixed` — **not run in this session**; no build
  claim is made for this commit.
- `npx playwright test` — **not run in this session**. The last recorded run was
  **70 passed, 7 skipped** on 2026-11-15 (the 7 are `test.skip` placeholders).

**Not verified (unknowns)**

- The E2E suite on CI — **unknown**. The `End-to-end (Playwright)` job exists in
  `.github/workflows/ci.yml`, but its result on GitHub was not read in this session.
- `npm run build` on this exact commit — **not run**.

## Next recommended step

1. Merge M2 (`cez/04c2e31f`) and M3 (`cez/0091ff2f`) into `integration/opencode-team`
   when their cezar tasks report, then re-measure the suite counts — the ones recorded
   above do not include them.
2. Run the remaining game-mode packages in the fixed order M4 → M5 → M6 → M7
   (`.opencode/plans/game-modes-multiplayer/_plan.md`).
3. Reconcile the remaining documentation with the code: `docs/API.md` paths and event
   names, and `.claude/plans/darthub-full-product-planning/_plan.md`'s completion column.
4. Close the schema gap: add the `CareerQuestProgress` model + migration and switch
   `src/career/questRuntime.ts` to the Prisma repository.
5. Wire `PublicMatchmaker` into the Socket.IO server, or drop the module — an
   unreferenced matchmaking path is the gap behind the skipped `e2e/matchmaking.spec.ts`.
