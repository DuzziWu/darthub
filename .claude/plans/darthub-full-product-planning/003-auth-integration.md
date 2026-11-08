# Task 003: Implement Auth.js integration with guest support

**Status**: completed
**Depends on**: 002
**Retry count**: 0

## Description
Configure Auth.js for email/password login, JWT issuance, and add guest session handling that allows anonymous play and later account linking.

## Context
- Related files: `src/auth/`, `src/auth/guest.ts`, `src/auth/session.ts`.
- Patterns to follow: Auth.js documentation, existing code‑standards for security.

## Requirements (Test Descriptions)
- [x] `it registers a new user with email and hashed password`
- [x] `it logs in a user and returns a JWT`
- [x] `it creates a guest session without email`
- [x] `it migrates guest data to a registered user preserving progress`
- [x] `it rejects login with invalid credentials`
- [x] `it protects routes with authentication middleware`

## Acceptance Criteria
- All authentication flows work in unit tests.
- Guest sessions are stored in the database and can be linked to a user.
- JWTs are signed with a strong secret and have appropriate expiration.

## Implementation Notes

**Verification (2026-11-07).** `npx vitest run tests/unit/auth tests/integration/auth` → 4 files / 21 tests passed (RED→GREEN per requirement; every requirement's test failed before its implementation landed). Full-suite run at completion: only failures are other in-flight workers' areas (career adaptiveEngine, camera vision scaffold task 045, repo-wide prettier/typecheck owned by those file sets); zero auth-related failures. `eslint` and `prettier --check` clean on all files below. Repo-wide `tsc --noEmit` shows 10 pre-existing errors in `tests/unit/{db-schema,env-example,eslint}` (other workers' files); zero errors in `src/auth/**` and `app/api/auth/**`.

**Files**
- `src/auth/authService.ts` — register (email validation + duplicate refusal, bcrypt cost 12), login (generic `InvalidCredentialsError` for unknown email AND wrong password, decoy bcrypt compare on unknown emails for uniform timing).
- `src/auth/session.ts` — HS256 JWT create/verify via `jose`; claims `{sub, kind, nickname, progressUserId}`; TTLs 24h (user) / 7d (guest); minimum 32-char secret enforced (`SessionConfigError` otherwise).
- `src/auth/guest.ts` — `createGuestSession` + `migrateGuestToUser` (see mapping/proof below).
- `src/auth/requireAuth.ts` — `requireAuth(request, {sessionSecret})` → `{ok:true, identity}` or `{ok:false, response:401}`; never throws; the seam for tasks 016/021/023 (compatible with career's `AuthGateway`).
- `src/auth/repository.ts` — typed seam: `AuthRepository { users, guests, progress, runInTransaction }`.
- `src/auth/prismaAuthRepository.ts` — production implementation over the generated Prisma client (type-checked; no live PostgreSQL in this environment, per task 002's precedent).
- `src/auth/runtime.ts` — lazy default runtime (PrismaClient created on first use), mirroring `src/rating/ratingRuntime.ts`.
- `src/auth/nextauth.ts` + `app/api/auth/[...nextauth]/route.ts` — thin Auth.js (next-auth v5 beta) wiring: two Credentials providers ("email" → `loginUser`, "guest" → `createGuestSession`), JWT session strategy, `secret: process.env.AUTH_SECRET`. NOTE: this repo uses the root `app/` layout, so the handler is under `app/`, not `src/app/`.
- Tests: `tests/unit/auth/{authService,guestService,session}.test.ts`, `tests/unit/auth/helpers/inMemoryAuthRepository.ts`, `tests/integration/auth/requireAuth.test.ts`.
- Deps added: `next-auth@5.0.0-beta.32`, `jose@6`, `bcryptjs@3` (pure JS, ships own types).

**Mapping decision (for task 004).** All progress FKs point at `User`, so an anonymous guest gets an ephemeral "mirror" `User` row with email `guest-<uuid>@guests.darthub.invalid` and a throwaway password hash (random bytes discarded at creation — not a login). `Guest.userId` points at the mirror user; guest progress (elo/performance/scores/game participations) attaches to it. `migrateGuestToUser({guestId, migrationToken, targetUserId})` in one transaction: reassigns progress to the target, repoints `Guest.userId`, burns the token, deletes the mirror user. 004 must add: the HTTP/API flow, merge rules when the target already owns rows (unique violations on `elo_ratings(userId,mode)`, `scores(sessionId,userId)`, friend edges), friend graph dedup, and rate limiting.

**Ownership proof (finding S-1).** Guest creation issues a one-time 512-bit migration token; only its sha256 hash is stored in the new additive `Guest.migrationTokenHash` column (schema + init migration updated; `prisma validate` + `prisma generate` pass; no other schema changes). Migration requires the plaintext token (timing-safe comparison); unknown guest / wrong token / reused token / unknown target all throw the same generic `GuestMigrationError`. Registration refuses the whole reserved `@guests.darthub.invalid` domain so a mirror user can never be claimed as a real account.

**Env vars required (task 033 owns `.env.example` — not created here):** `AUTH_SECRET` (>= 32 chars; tests inject their own strong secret), existing `DATABASE_URL`.

**Over-implementation note.** The `it rejects login with invalid credentials` test (req 5) passed immediately when formally verified, because the generic no-enumeration login path was the bare minimum of req 2's login implementation per code standards; the test was written alongside req 2 and only renamed to match the requirement title at req 5 verification.
