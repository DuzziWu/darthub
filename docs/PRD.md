# Product Requirements Document (PRD)

## Table of Contents

- [Overview](#overview)
- [Goals and Non-Goals](#goals-and-non-goals)
- [User Model](#user-model)
- [Core Features](#core-features)
- [Rating System](#rating-system)
- [AI Opponents](#ai-opponents)
- [Multiplayer](#multiplayer)
- [Camera Integration](#camera-integration)
- [Social Features](#social-features)
- [Career Mode](#career-mode)
- [Privacy and Compliance](#privacy-and-compliance)
- [Deployment](#deployment)
- [Success Metrics](#success-metrics)
- [Out of Scope](#out-of-scope)
- [Related Documents](#related-documents)

## Overview

DartHub is a brand-new, modular, server-authoritative multiplayer dart game. The client is a Next.js and React front-end; the backend follows a clean domain-driven design with service and repository layers. The product includes a reusable Dart game engine, real-time authoritative multiplayer over WebSockets, and an extensible camera-recognition interface for automated dart scoring.

This document describes the planned product. Items are marked as **designed** (architecture and contracts agreed) or **not yet implemented** (modules under construction by parallel work streams).

## Goals and Non-Goals

### Goals

- Provide a realistic, rules-correct dart experience supporting 501, 301, and Cricket modes with out rules, bust, checkout, leg, and set logic.
- Keep all game state authoritative on the server; clients only propose moves.
- Offer a fair hybrid rating that blends Elo progression with raw performance metrics.
- Ship a free-tier MVP deployable with Docker on an inexpensive self-hosted VPS.
- Respect user privacy from day one: data export and account deletion must work at MVP time.

### Non-Goals

- Voice or text chat.
- Advanced machine-learning AI opponents.
- Regional or national ranking boards (future phase).
- Paid subscriptions or monetisation features.
- Production-grade performance optimisation beyond MVP needs.

## User Model

**Designed. Guest plumbing implementation in progress.**

- **Guest players**: can join and play immediately without an account. Guest identity, matches, and ratings are stored server-side with a lightweight profile.
- **Registered players**: authenticate via Auth.js (OAuth providers with credentials as an option). Registered accounts unlock friends, career mode persistence, and rating history.
- **Migration path**: a guest can upgrade to a registered account. The migration is transactional so guest matches, ratings, and careers are preserved. Data loss during migration is treated as a release blocker.

## Core Features

### Dart Game Engine

**Designed. Engine module under construction (task 035 and follow-ups).**

The engine is isolated in `src/game-engine/` and is importable by both client (for local practice rendering) and server (for authoritative play). It covers:

- 501 and 301 countdown modes with double-out start and finish options.
- Cricket with standard scoring and closing rules.
- Bust detection, required checkout, leg and set flow, and tie-breaking throw order.

See `docs/API.md` for the public engine contract summary and the task 040 integration guide addendum.

### Server Authority

Every throw is validated on the server: legality of the target segment, arithmetic correctness of the score, and turn sequencing. Clients never compute winning state.

## Rating System

**Designed. Storage and APIs scheduled in tasks 005 and 006.**

A hybrid model combines two signals per player and per game mode:

- **Elo**: standard two-player Elo updated after each rated match, with K-factor decay per games played.
- **Performance**: rolling statistical profile (three-dart average, checkout percentage, first-nine average) stored alongside Elo and surfaced in the profile UI.

Ratings are stored per mode so a Cricket rating never pollutes a 501 rating. Batch recalculation runs nightly to self-heal any drift.

## AI Opponents

**Designed. Engine delivered by tasks 007 and 008.**

The AI is a stateless statistical throw model, not an ML system:

- Difficulty tiers (beginner, casual, club, expert) parameterise hit-probability distributions per target.
- Personalities adjust target selection: cautious checkers, aggressive maxers, and balanced all-rounders.
- AI moves are deterministic given a seed, allowing checksum validation of AI turns on the server.

## Multiplayer

**Designed. Transport and rooms delivered by tasks 009 through 011.**

- Transport: Socket.IO with a separate real-time module under `src/realtime/`.
- Private rooms: created via invitation codes, joinable only with the code.
- Matchmaking: random matchmaking queue with state persisted outside the socket process (Redis planned, see `docs/DECISIONS.md`).
- Reconnection: a player reconnecting within a grace window resumes their match without loss of state.
- Anti-cheat: server-side validation middleware for every event; see `docs/SECURITY.md`.

## Camera Integration

**Designed. Abstraction delivered by task 012; smartphone stub by task 013.**

- `src/camera/` exposes an `ICameraService` interface with frame ingestion, calibration, and hit-event output.
- First implementation is a smartphone camera stub using MediaDevices API.
- Computer-vision hit detection, calibration, and perspective correction are a future phase (task 045); hardware-specific code is always behind the same interface.

## Social Features

**Designed. Delivered by tasks 014 and 015.**

- Friend list with requests and acceptance between registered users.
- Username search limited to exact and prefix matches to resist enumeration.
- Invitation codes for private games; codes are single-use or short-lived.

## Career Mode

**Designed. Engine scaffold delivered by task 020; content and progression in tasks 041 to 043.**

- Quests are defined in JSON files under `src/career/quests/`, keeping content data-driven and moddable.
- Story structure with NPCs, rivals, and training lessons.
- Adaptive difficulty hooks scale AI strength to the player's recent results.
- Progression, rewards, and unlocks persist per registered account. Guests may play careers progress is not retained after migration until linked.

## Privacy and Compliance

**Designed. Endpoints delivered by tasks 016, 017, and 030.**

- Full data export as machine-readable JSON, including profile, ratings, matches, friends, and career progress.
- Account deletion with cascade cleanup across all owned rows and an audit record of the deletion event.
- Minimum data collection for guests; no tracking pixels or third-party analytics.

## Deployment

**Designed. Delivered by tasks 018, 019, and 029.**

- Docker and Docker Compose packaging for the app plus PostgreSQL.
- Deployment documentation covering fresh install and safe update procedure on a clean VPS.
- Cost profile is free-tier friendly; see `docs/COSTS.md`.

## Success Metrics

- All defined tasks have passing Vitest tests with coverage at or above 80 percent.
- Docker deployment works on a fresh VPS with only documented steps.
- GDPR export and delete endpoints are functional and audited.
- A full rated 501 match between two browsers completes with correct rating updates.

## Out of Scope

- Voice or text chat.
- Advanced ML-based AI.
- Regional and national ranking boards.
- Monetisation of any form in the MVP.

## Related Documents

- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [API Specification](./API.md)
- [Roadmap](./ROADMAP.md)
- [Testing Strategy](./TESTING.md)
- [Security](./SECURITY.md)
- [Costs](./COSTS.md)
- [Decision Log](./DECISIONS.md)
