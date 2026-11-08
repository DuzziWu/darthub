# Plan: DartHub Full Product Planning

## Created
2026-11-07

## Status
in_progress

## Objective
Define, design, and prepare all components needed to build the DartHub platform according to the confirmed architectural decisions, covering user model, ranking, AI, multiplayer, camera integration, social features, GDPR compliance, deployment, career mode, and supporting documentation.

## Related Issues
none

## Discovery Notes
All architectural decisions have been fixed (guest & registered users, hybrid rating, statistical AI, Socket.IO real‑time, smartphone‑camera first, friend system, free‑tier MVP, GDPR basics, Docker deployment, JSON‑quest career mode). The project stack (Next.js, React, TypeScript, Prisma, PostgreSQL, Auth.js, Tailwind, shadcn/ui, Vitest, Playwright, Docker) is suitable for all requirements.

## Scope

### In Scope
- Guest & registered user handling with migration path.
- Hybrid Elo & performance rating storage and APIs.
- Stateless statistical AI opponent module with difficulty tiers and personalities.
- Socket.IO‑based real‑time multiplayer server with private rooms, matchmaking, reconnection, and anti‑cheat safeguards.
- Camera‑interface abstraction for future smartphone, USB, HDMI sources.
- Friend list, username search, invites via codes, private game rooms.
- GDPR‑compliant data export & deletion endpoints.
- Docker‑Compose deployment scripts and documentation.
- Modular JSON‑driven career‑mode quest engine.
- Full documentation set (PRD, ARCHITECTURE, DATABASE, API, ROADMAP, TESTING, SECURITY, COSTS, DECISIONS).

### Out of Scope
- Voice or text chat.
- Advanced ML‑based AI.
- Regional/specific rankings (future phase).
- Paid subscription features or monetisation.
- Production‑grade performance optimisations beyond MVP.

## Success Criteria
- All defined tasks have passing Vitest tests.
- Code adheres to project standards (ESLint, Prettier, TypeScript strict).
- No security issues detected by automated review.
- Documentation generated and version‑controlled.
- Docker deployment works on a fresh VPS.
- GDPR export/delete endpoints functional.

## Task Overview
| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Initialise repository, CI, linting, formatting | - | completed |
| 002 | Define database schema (users, guests, rankings, games, friends, career quests) | 001 | completed |
| 003 | Implement Auth.js integration with guest support | 002 | completed |
| 004 | Implement guest‑to‑user migration flow | 003 | completed |
| 005 | Implement hybrid rating models (Elo + performance) and DB tables | 002 | completed |
| 006 | Expose rating APIs (GET/POST) | 005 | completed |
| 007 | Build statistical AI opponent engine (difficulty & personality) | 001 | completed |
| 008 | Create AI difficulty configuration and test suite | 007 | completed |
| 009 | Setup Socket.IO server with authoritative game loop | 035 | completed |
| 010 | Implement private rooms, matchmaking (random) and reconnection logic | 009 | completed |
| 011 | Build anti‑cheat validation middleware | 010, 007 | complete |
| 012 | Define camera‑interface abstraction layer (service & DTO) | 001 | completed |
| 013 | Implement smartphone‑camera stub (MediaDevices) and unit tests | 012 | completed |
| 014 | Add friend system (list, request, accept) | 003, 002 | completed |
| 015 | Implement invitation codes and private game creation | 014, 010 | complete |
| 016 | GDPR export endpoint (JSON) | 003 | completed |
| 017 | GDPR delete account endpoint and cascade cleanup | 016 | completed |
| 018 | Dockerfile & Docker‑Compose for app + db | 001 | completed |
| 019 | Write deployment documentation (install, update) | 018 | completed |
| 020 | Design JSON‑driven career‑mode quest engine | 001 | completed |
| 021 | Implement basic quest loader and progression API | 020 | completed |
| 022 | Add adaptive difficulty hook into career quests | 021 | completed |
| 023 | Create UI skeletons (dashboard, game lobby, career screen) | 001, 006, 014, 003, 043 | pending |
| 024 | Write unit & integration tests for core UI components | 023 | pending |
| 025 | End‑to‑end Playwright tests for login, matchmaking, career flow | 024 | pending |
| 026 | Assemble full documentation set (PRD, ARCHITECTURE, DATABASE, API, ROADMAP, TESTING, SECURITY, COSTS, DECISIONS) | 001 | completed |
| 027 | Conduct architecture and security review (devils‑advocate, standards‑enforcer) | 026 | completed |
| 028 | Final acceptance checklist and plan ready flag | 027 | pending |
| 029 | Add .dockerignore to exclude unnecessary files from Docker context | 018 | completed |
| 030 | Implement lightweight audit logger for GDPR actions | 016, 017 | blocked |
| 031 | Add Redis (or fast store) for matchmaking state persistence | 010 | pending |
| 032 | Add pre‑commit hook to run lint and format checks | 001 | completed |
| 033 | Create example .env file with required environment variables | 018 | completed |
| 034 | Enforce ESLint import ordering rule across new modules | 001 | completed |
| 035 | Create core Dart game engine module | 001 | completed |
| 036 | Implement 501 and 301 game modes | 035 | completed |
| 037 | Implement Cricket game mode | 035 | completed |
| 038 | Implement out rules, bust, checkout, leg and set logic | 035, 036, 037 | completed |
| 039 | Write comprehensive unit tests for the Dart game engine | 038 | pending |
| 040 | Document GameEngine public API and integration guide | 035 | completed |
| 041 | Design Career Mode story structure, NPCs, rivals, and training lessons | 020 | pending |
| 042 | Implement Career Mode progression, rewards and unlock system | 041 | pending |
| 043 | Create first playable Career Mode content (quests, NPCs, training lessons) | 042 | pending |
| 044 | Separate camera stub from future computer‑vision implementation | 012 | completed |
| 045 | Define calibration, perspective correction and hit‑detection module (future CV phase) | 044 | completed |
| 046 | Abstract room persistence layer with pluggable backends | 010 | pending |
| 047 | Integrate optional Redis backend into matchmaking persistence | 046, 031 | pending |
| 048 | Verify completeness of the development plan and Definition of Done | 034, 047, 043, 039, 028 | pending |

## Architecture Notes
- All modules are placed under `src/` respecting the service‑repository‑DTO pattern.
- The AI engine lives in `src/ai/` and is injected via a provider interface.
- Real‑time server is a separate Nest‑style module under `src/realtime/` using Socket.IO.
- Camera abstraction lives in `src/camera/` exposing `ICameraService`.
- GDPR services are in `src/privacy/`.
- Career mode JSON files reside in `src/career/quests/`.

## Risks & Mitigations
- **Guest‑to‑user migration data loss**: implement transactional migration and unit tests.
- **Cheating in real‑time**: server‑side validation of every throw; checksum of AI moves.
- **Camera SDK variability**: abstract all hardware‑specific code behind the same interface; defer concrete implementations.
- **Performance of Elo calculations**: batch updates nightly; use DB stored procedures if needed.
- **GDPR compliance**: external audit in later phase; start with exhaustive export/delete endpoints.
