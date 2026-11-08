# Decision Log

## Table of Contents

- [Overview](#overview)
- [Decision Register](#decision-register)
- [Context Notes](#context-notes)
- [Open Decisions](#open-decisions)
- [Related Documents](#related-documents)

## Overview

This log records the architectural and product decisions fixed during planning, with a short rationale for each, and tracks the decisions that remain open. Decisions follow an ADR-lite format: statement, rationale, and status. See `docs/ROADMAP.md` for how decisions translate into delivered tasks.

## Decision Register

| Decision                                                     | Status  | Rationale                                                                |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------ |
| Guest and registered user model with a migration path        | Decided | Instant play lowers friction; migration preserves guest investment       |
| Hybrid Elo plus performance rating                           | Decided | Elo gives competitive progression; performance shows real skill trends   |
| Stateless statistical AI with difficulties and personalities | Decided | Deterministic, cheap, testable, and anti-cheat friendly                  |
| Socket.IO based real-time server authority                   | Decided | Mature transport, rooms, and reconnection; one authority prevents desync |
| Camera abstraction with smartphone-first implementation      | Decided | Widest hardware reach now; CV is deferrable behind one interface         |
| Friend list, username search, and invite codes               | Decided | Social retention without chat complexity                                 |
| GDPR export and delete at MVP time                           | Decided | Privacy-by-design and cheap to build early, expensive to retrofit        |
| Docker Compose deployment                                    | Decided | Reproducible single-node VPS install and updates                         |
| JSON-driven career mode quest engine                         | Decided | Content as data keeps quests moddable and engine-testable                |
| No CQRS or event sourcing in the MVP                         | Decided | Not needed; simpler architecture with service-repository layering        |
| No voice or text chat in the MVP                             | Decided | Removes moderation burden and abuse surface                              |

## Context Notes

- The stack (Next.js, React, TypeScript strict, Prisma, PostgreSQL, Auth.js, Tailwind, shadcn/ui, Vitest, Playwright, Docker) is fixed by the repository scaffold.
- Ratings are stored per game mode so modes are ranked independently.
- Career quest content lives in JSON under `src/career/quests/`; the database stores only progress and rewards.

## Open Decisions

### Matchmaking persistence backend

The matchmaking and room state store uses an in-process implementation now; the Redis backend (tasks 031 and 047) keeps it pluggable.
Rationale: start simple and avoid another moving part; the persistence layer is abstracted so Redis can be adopted without touching matchmaking logic. The decision to switch stays open until real multiplayer load exists.

### Computer-vision hit detection approach

Detection, calibration, and perspective correction (task 045) are designed only as an interface boundary today.
Rationale: hardware variability is high and the smartphone stub unblocks play; choosing an algorithm (classical CV versus a lightweight model) is deferred until real camera data is collected.

### Regional and national ranking boards

Ranking remains global per mode; regional scopes are explicitly out of the MVP.
Rationale: the rating schema is mode-keyed, so regional boards can be added later without rework, but MVP effort is better spent on the core loop.

### Monetisation and hosting growth path

Any payment feature or paid infrastructure requires explicit approval before design begins.
Rationale: the MVP cost profile must remain free-tier friendly (see `docs/COSTS.md`); the trigger point for revisit is sustained load that a single VPS cannot serve.

### External GDPR audit timing

Exhaustive export and delete endpoints are in scope for the MVP; an external compliance audit is scheduled for a later phase.
Rationale: the audit is meaningful only once the data model and flows are stable; the audit logger (task 030) already provides the trail an auditor will need.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [API Specification](./API.md)
- [Roadmap](./ROADMAP.md)
- [Security](./SECURITY.md)
- [Costs](./COSTS.md)
