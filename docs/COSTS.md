# Costs

## Table of Contents

- [Overview](#overview)
- [Cost Principles](#cost-principles)
- [Component Costs](#component-costs)
- [Development Environment](#development-environment)
- [Scaling Considerations](#scaling-considerations)
- [Related Documents](#related-documents)

## Overview

DartHub is planned as a free-tier MVP. All tooling is open source, and the only recurring cost is a small self-hosted VPS. No paid services, APIs, or subscriptions are used without explicit approval, per the project principles.

## Cost Principles

- Prefer self-hosted, open-source components.
- No managed services that lock pricing to usage growth in the MVP.
- Keep the deployment single-node until the player base justifies otherwise.
- Measure first: scale only on evidence from real load.

## Component Costs

| Component           | Choice                                                         | Recurring Cost   |
| ------------------- | -------------------------------------------------------------- | ---------------- |
| Application hosting | Next.js server on a small VPS via Docker Compose               | VPS line item    |
| Real-time server    | Socket.IO inside the same container                            | none (co-hosted) |
| Database            | PostgreSQL in a Docker Compose service                         | none (co-hosted) |
| Matchmaking store   | In-process store now, optional Redis later                     | none now         |
| Authentication      | Auth.js with free OAuth providers                              | none             |
| AI opponents        | In-process statistical model                                   | none             |
| CI                  | GitHub-hosted runners within free tier for a public repository | none             |
| Domain              | One domain name                                                | small annual fee |
| Monitoring          | Self-hosted or log-file based                                  | none             |

## Development Environment

- Development runs locally with Docker Compose for the database, costing nothing.
- Tests run in Vitest and Playwright on developer machines and free CI minutes.
- No cloud SDKs are required for development.

## Scaling Considerations

- The first scaling step is separating the Socket.IO process from the Next.js process, which the module layout in `docs/ARCHITECTURE.md` already anticipates.
- Redis persistence for matchmaking (tasks 031 and 047) runs in the same VPS memory budget initially.
- Ratings batch jobs are scheduled at off-peak hours to avoid larger instance sizing.
- Horizontal growth is a later phase; nothing in the MVP blocks it.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [Roadmap](./ROADMAP.md)
- [Decision Log](./DECISIONS.md)
