# Roadmap

## Table of Contents

- [Overview](#overview)
- [Phases](#phases)
- [Delivery Status](#delivery-status)
- [Milestones](#milestones)
- [Risks and Mitigations](#risks-and-mitigations)
- [Related Documents](#related-documents)

## Overview

Delivery is organised into phases that map one-to-one onto the plan task list in `.claude/plans/darthub-full-product-planning/_plan.md`. Tasks run in parallel where their dependencies allow; status below is a snapshot and is updated as tasks complete.

## Phases

| Phase                             | Focus                                                               | Tasks                             |
| --------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| Phase 1: Foundation               | Repository, CI, linting, formatting, Docker scaffolding             | 001, 018, 029, 032, 033, 034      |
| Phase 2: Data and Identity        | Database schema, Auth.js, guest migration, rating models            | 002, 003, 004, 005, 006           |
| Phase 3: Game Core                | Dart game engine, modes, out rules, engine documentation            | 035, 036, 037, 038, 039, 040      |
| Phase 4: Opponents and Real-Time  | Statistical AI, Socket.IO authority, rooms, matchmaking, anti-cheat | 007, 008, 009, 010, 011, 046, 047 |
| Phase 5: Vision Interface         | Camera abstraction, smartphone stub, CV design                      | 012, 013, 044, 045                |
| Phase 6: Social and Privacy       | Friends, invites, GDPR export, deletion, audit logging              | 014, 015, 016, 017, 030           |
| Phase 7: Career Mode              | Quest engine, adaptive difficulty, story content, progression       | 020, 021, 022, 041, 042, 043      |
| Phase 8: UI and Quality           | UI skeletons, UI tests, Playwright E2E                              | 023, 024, 025                     |
| Phase 9: Documentation and Review | Documentation set, reviews, acceptance                              | 026, 027, 028, 019, 048           |

## Delivery Status

| Task   | Description                                                         | Status      |
| ------ | ------------------------------------------------------------------- | ----------- |
| 001    | Repository, CI, linting, formatting                                 | completed   |
| 002    | Database schema for users, guests, rankings, games, friends, quests | in progress |
| 007    | Statistical AI opponent engine                                      | in progress |
| 012    | Camera interface abstraction                                        | in progress |
| 018    | Dockerfile and Docker Compose                                       | in progress |
| 020    | Career mode quest engine design                                     | in progress |
| 026    | Documentation set assembly                                          | in progress |
| others | Remaining tasks of the plan                                         | pending     |

## Milestones

1. **M1 Playable Core**: engine with 501 and Cricket, rooms, and two browser clients finishing a match.
2. **M2 Rated Product**: guest and registered flows, ratings persisted and displayed, friends and invites working.
3. **M3 Content and Compliance**: career mode playable, GDPR export and delete verified, Docker deployment on a fresh VPS.
4. **M4 Release Candidate**: E2E suite green, review findings closed, documentation complete.

## Risks and Mitigations

- Guest-to-user migration data loss: transactional migration plus unit tests.
- Cheating in real-time play: server-side validation of every throw and checksums of AI moves.
- Camera SDK variability: all hardware-specific code stays behind one interface.
- Elo calculation load: nightly batch updates and stored procedures if needed.
- GDPR compliance depth: exhaustive export and delete now; external audit later.

## Open Security Work

The hardening stage (branch `fix/security-auth-hardening-clean`) closed the
gaps that the code audit of 2026-11-17 found. These remain open:

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Where it lives                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | The rate limiter covers the **Auth.js provider callbacks** (credential sign-in and guest session), the guest conversion, the invitation flow and the two invite routes. The friend requests, the privacy export and the Socket.IO events carry no limit.                                                                                                                                                                                                                                                                                                                                                                                                  | `src/security/`, `src/friends/`, `src/realtime/`           |
| 2   | **The Auth.js callbacks were secured in the hardening stage, and the order matters.** The credential callback and the guest callback are counted in front of Auth.js (`src/auth/authjsRoute.ts`), so the expensive password comparison and the guest session happen only for a request the limit allowed. `AUTH_TRUST_HOST=true` — which the Auth.js path needs in a self-hosted deployment — **must not be set before this protection is in place**, and the new login page must not ship before it either. `AUTH_TRUST_HOST` is a host check, not a rate limit: it says which origins may talk to the application, not how many passwords may be tried. | `src/auth/authjsRoute.ts`, `src/auth/authjsRouteGuard.ts`  |
| 3   | **The Socket.IO handshake carries no session.** A socket is admitted to a room by the room's invite code, and the seat token it holds afterwards belongs to the room, not to an account. There is no account-scoped authentication of a socket connection, and the realtime handlers therefore resolve a room binding, not a principal. The missing authentication is **not** implemented in this stage; it is listed here as an open point.                                                                                                                                                                                                              | `src/realtime/socketServer.ts`, `src/realtime/GameRoom.ts` |
| 4   | The realtime invitation codes are still drawn from `Math.random()` — the auth codes were moved to the cryptographic generator, the realtime module belongs to the realtime vertical.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/realtime/inviteService.ts`                            |
| 5   | The invitation codes live in the memory of one process: a restart invalidates them, and several instances do not share them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `src/auth/invitationStore.ts`                              |
| 6   | The data export carries the profile only; the ratings, the matches, the friendships and the career progress are still empty placeholders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `src/privacy/exportService.ts`                             |
| 7   | The audit logger exists but the privacy routes do not call it, and the file it writes to is not part of the container image.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `src/privacy/auditService.ts`                              |
| 8   | The session tokens are stateless: a stolen token stays valid until it expires, and there is no way to revoke it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `src/auth/session.ts`                                      |
| 9   | No security headers, no origin check on the write endpoints.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `next.config.ts`                                           |
| 10  | The guest conversion is not atomic: the account is created first, the migration second.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `src/auth/linkGuestRoutes.ts`                              |
| 11  | The client address of a request comes from a header the client controls. The hardening stage reads the **last** entry of `x-forwarded-for` — the entry the closest proxy added — and binds the published port of the application to the loopback address of the host. The application must nevertheless only be reachable through a proxy that sets the address correctly; the per-account limit is the limit that holds either way. Whether the fronting proxy overwrites or appends the header, and whether the real proxy chain matches the assumed topology, are **open deployment check points** — see `docs/SECURITY.md`.                           | `src/security/clientAddress.ts`, `docker-compose.yml`      |

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing Strategy](./TESTING.md)
- [Costs](./COSTS.md)
- [Decision Log](./DECISIONS.md)
