# Task 005: Implement hybrid rating models (Elo + Performance)

**Status**: completed
**Depends on**: 002
**Retry count**: 0

## Description
Create services and Prisma models for Elo rating (competitive) and Performance rating (average, checkout %). Provide APIs to read/write these ratings per user. **Take care to avoid N+1 queries by using Prisma's include/select batching when aggregating performance data.**

## Context
- Related files: `src/rating/eloService.ts`, `src/rating/performanceService.ts`, API routes under `/api/rating/*`.
- Patterns: service‑class pattern, repository for DB access.

## Requirements (Test Descriptions)
- [x] `it calculates Elo change after a win/loss using standard K-factor`
  - Evidence: `tests/unit/rating/eloService.test.ts` (5 passing) — equal-rating win/loss ±16 at K=32, 2400-vs-2000 logistic example (E≈0.9091, +3), symmetric pair deltas cancel, overflow clamping (custom + default bounds).
  - Implementation: `src/rating/eloService.ts` (pure math: `expectedScore`, `computeEloChange`, `clampRating`; K=32, baseline 1000, clamp [100, 4000]).
- [x] `it updates PerformanceRating based on recent game stats`
  - Evidence: `tests/unit/rating/performanceService.test.ts` (5 passing) — 1440 pts / 120 turns → 12.00 avg, 9/10 checkouts → 0.9, window fetched as one batched summary (single `getRecentGameStats(limit=10)` call, no per-game queries), zero-division guards, DB-precision rounding (143.29 / 0.6667).
  - Implementation: `src/rating/performanceService.ts` + repository contract `src/rating/ratingRepository.ts` (repository must batch stats; in-memory impl `src/rating/inMemoryRatingRepository.ts`).
- [x] `it stores both ratings separately for a user`
  - Evidence: `tests/unit/rating/ratingService.test.ts` (3 passing) — after `recordGameResult` the winner has one `elo_ratings`-row (1016, 1 win) AND a separate performance row (avg 23.86, checkout 0.5) in a distinct collection; per-mode rows stay separate (X01 vs CRICKET); new user starts at baseline (Elo 1000 / perf zeroes).
  - Implementation: `src/rating/ratingService.ts` facade — Elo half via `eloService` math, performance half via batched stats. Refactor applied: shares `DEFAULT_PERFORMANCE_WINDOW` instead of a magic 10.
- [x] `it returns both ratings in the GET /api/rating/:userId endpoint`
  - Evidence: `tests/integration/rating/ratingRoutes.test.ts` (6 passing) — 401 when anonymous; 200 JSON `{ userId, mode, elo: {...}, performance: {...}, perMode? }` (elo rating 1016/wins 1, perf avg 23.86/0.5); baseline defaults (elo 1000) for users without games; `?mode=CRICKET` honoured; 400 on empty id. POST `/api/rating/game` persists both participants' updates (1016/984) and 400s on malformed bodies.
  - Implementation: `src/rating/ratingRoutes.ts` factory (GET + POST), auth seam `src/rating/authGateway.ts` (to be replaced by task 003), Prisma wiring `src/rating/ratingRuntime.ts` + `src/rating/prismaRatingRepository.ts`, route files `app/api/rating/[userId]/route.ts` + `app/api/rating/game/route.ts`.

Acceptance criteria: API returns JSON with `elo` and `performance` fields — verified above.
- [x] `it does not affect guest ratings until migration`
  - Evidence: `tests/unit/rating/ratingService.test.ts` — guest-vs-guest game triggers zero `saveEloRating`/`savePerformanceRating` calls and leaves no repository rows; provisional ratings persist in memory on the service instance (1016/1 win); mixed game persists only the registered side (`member:X01`), rated against the guest's provisional pre-game rating (1015).
  - Implementation: `RatingActor` identity (`user`/`guest`) in `src/rating/ratingService.ts`; guests are stored in an in-memory `GuestProvisionalStore` and the persistence path is never invoked for guests until migration links the Guest to a User.

## Acceptance Criteria
- Rating calculations are correct (verified against known examples).
- API returns JSON with `elo` and `performance` fields.
- Unit tests cover edge cases (rating overflow, new user default values).

## Implementation Notes

### Schema (review finding A-1 — per-mode ratings)
- `prisma/schema.prisma`: `EloRating` and `PerformanceRating` now carry a `mode String @default("X01") @db.VarChar(32)` column (free-form so test/admin modes work; no new enum needed) with composite `@@unique([userId, mode])`, FK cascade retained. `PerformanceRating.accuracy` (unused) was replaced by `checkoutPct Decimal(5,4)` + `gamesPlayed` per DATABASE.md's RatingProfile spec; `User` relations became arrays (`eloRatings`, `performanceRatings`).
- Migration equivalence: `prisma/migrations/20260101000000_init/migration.sql` was regenerated in place from the datamodel with `prisma migrate diff --from-empty`. It was regenerated a second time at the end because task 003 concurrently added `Guest.migrationTokenHash`; the final combined migration keeps both changes and `tests/unit/db-schema` passes 9/9 (validate + generate + script equivalence green).

### Services (`src/rating/`)
- `eloService.ts` — pure Elo math: `expectedScore` (logistic, /400), `computeEloChange` (K=32 default, baseline 1000), `clampRating` overflow guard to [100, 4000] (custom bounds supported). Verified against known examples (equal ratings ±16; 2400-vs-2000 E≈0.9091 → +3); mirrored win/loss deltas cancel exactly.
- `performanceService.ts` — rolling recent-stats window (default 10 games): average points per turn (2 dp), checkout ratio (4 dp), games played; zero-division guarded. Reads a PRE-AGGREGATED `GameStatsSummary` from the repository — the window is folded server-side into one grouped/aggregate query, so aggregating is O(1) queries, never per-row (the N+1 requirement is structural, not incidental).
- `ratingService.ts` — facade; simultaneous Elo update (both sides rated against pre-game ratings — a fix to an initial sequential-draft bug caught by integration tests 1016/985 → 1016/984). Identities are `RatingActor` (`user`/`guest`); guests live in an in-memory `GuestProvisionalStore` and the persistence path is never invoked for a guest identity until migration links `Guest.userId` (test observes zero save calls + in-memory provisional state + mixed-game persistence of only the registered side).
- `ratingRepository.ts` — contract; `getRecentGameStats`/`getEloRatingsForUser`/`getPerformanceRatingsForUser` are documented as single batched queries. In-memory impl `inMemoryRatingRepository.ts`; Prisma impl `prismaRatingRepository.ts` uses the `userId_mode` compound unique, batched `findMany`s, one `score.aggregate` over the window (checkouts derived from leg wins; per-dart telemetry is out of the settled-schema scope — noted in the file). Typed to the generated client; not exercised without a live DB.
- `authGateway.ts` — narrow bearer-token seam (task 003 replaces it); `ratingRuntime.ts` wires the Prisma repo with a lazily constructed client (no import-time DB access).

### API (`app/api/rating/`)
- `GET /api/rating/[userId]` → `{ userId, mode, elo: {...}, performance: {...}, perMode? }` (`perMode` = all modes via two batched reads; `?mode=` selects one mode). `POST /api/rating/game` → `{ recordedBy, winner: {elo, performance}, loser: {elo, performance} }` with body `{ winnerId, loserId }`. 401 anonymous (default gateway denies until 003), 400 on malformed input.

### Test evidence
- `npx vitest run tests/unit/rating tests/integration/rating` → 20/20 passing.
- `npx vitest run tests/unit/db-schema` → 9/9 passing (after the combined migration regeneration).
- ESLint clean on `src/rating`, `app/api/rating`, `tests/{unit,integration}/rating`; Prettier clean on all touched files (only `tests/unit/db-schema/schema.test.ts` rating test restructured).
- Note: full-project `tsc --noEmit` has PRE-EXISTING errors in `tests/unit/db-schema/migration.test.ts` and `schema.test.ts` line 12 (`ProcessEnv` typing / `noUncheckedIndexedAccess` from task 002, lines outside this task's scope); no type errors in any rating file.
