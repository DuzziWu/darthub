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

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing Strategy](./TESTING.md)
- [Costs](./COSTS.md)
- [Decision Log](./DECISIONS.md)
