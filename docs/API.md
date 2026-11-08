# API Specification

## Table of Contents

- [Overview](#overview)
- [Conventions](#conventions)
- [Authentication Endpoints](#authentication-endpoints)
- [User and Profile Endpoints](#user-and-profile-endpoints)
- [Rating Endpoints](#rating-endpoints)
- [Friend Endpoints](#friend-endpoints)
- [Invite Endpoints](#invite-endpoints)
- [Career Endpoints](#career-endpoints)
- [Privacy Endpoints](#privacy-endpoints)
- [Socket.IO Events](#socketio-events)
- [Error Codes](#error-codes)
- [Related Documents](#related-documents)

## Overview

DartHub exposes two transport surfaces: REST route handlers for profile, social, career, and privacy operations, and Socket.IO events for live match play. This document describes the designed contracts. Route implementations are delivered by parallel tasks; see `docs/ROADMAP.md` for status.

## Conventions

- All payloads are JSON encoded as UTF-8.
- Requests and responses use DTOs from `src/dto/`; raw ORM entities are never serialised.
- Authentication uses an Auth.js session cookie; Socket.IO connections present the same session during the handshake.
- Endpoints return problem-oriented errors in the shape `{ "error": { "code": string, "message": string } }`.
- Guest requests are allowed where noted; guests receive rate limits identical to registered users for write operations.
- Camera reports are advisory: the `score` field a client includes in `CameraDTO` is a hint only and is never trusted. The server recomputes the authoritative score from the camera-reported board coordinates using board geometry (server authority) — clients never publish scores.

## Authentication Endpoints

Handled by Auth.js under `/api/auth/*`.

| Method | Path                | Auth    | Description                                    |
| ------ | ------------------- | ------- | ---------------------------------------------- |
| GET    | `/api/auth/session` | public  | Returns the current session or null for guests |
| POST   | `/api/auth/signin`  | public  | Starts an OAuth sign-in flow                   |
| POST   | `/api/auth/signout` | session | Clears the session                             |
| POST   | `/api/auth/guest`   | public  | Creates a guest session and guest profile row  |

## User and Profile Endpoints

| Method | Path                   | Auth                | Description                                        |
| ------ | ---------------------- | ------------------- | -------------------------------------------------- |
| GET    | `/api/users/me`        | session or guest    | Returns the caller profile or guest stub           |
| PATCH  | `/api/users/me`        | session             | Updates display name and preferences               |
| GET    | `/api/users/:username` | session             | Public profile with ratings summary                |
| POST   | `/api/users/migrate`   | guest + credentials | Migrates guest data into a new or existing account |

## Rating Endpoints

| Method | Path                             | Auth             | Description                                |
| ------ | -------------------------------- | ---------------- | ------------------------------------------ |
| GET    | `/api/ratings/me?mode=`          | session or guest | Own Elo and performance profile for a mode |
| GET    | `/api/ratings/leaderboard?mode=` | public           | Top players for a mode                     |
| POST   | `/api/ratings/recalculate`       | admin only       | Triggers the nightly batch recalculation   |

Rating mutations are internal: only the authoritative match pipeline writes Elo and performance values.

## Friend Endpoints

| Method | Path                               | Auth    | Description                        |
| ------ | ---------------------------------- | ------- | ---------------------------------- |
| GET    | `/api/friends`                     | session | Lists accepted friends             |
| POST   | `/api/friends/requests`            | session | Sends a friend request by username |
| POST   | `/api/friends/requests/:id/accept` | session | Accepts a pending request          |
| POST   | `/api/friends/requests/:id/reject` | session | Rejects a pending request          |
| DELETE | `/api/friends/:userId`             | session | Removes a friendship               |
| GET    | `/api/friends/search?q=`           | session | Exact and prefix username search   |

## Invite Endpoints

| Method | Path                        | Auth             | Description                                   |
| ------ | --------------------------- | ---------------- | --------------------------------------------- |
| POST   | `/api/invites`              | session or guest | Creates an invitation code for a private room |
| POST   | `/api/invites/:code/redeem` | session or guest | Joins the room bound to the code              |

## Career Endpoints

| Method | Path                                   | Auth    | Description                                 |
| ------ | -------------------------------------- | ------- | ------------------------------------------- |
| GET    | `/api/career/quests`                   | session | Lists quests with progress and unlock state |
| POST   | `/api/career/quests/:questId/start`    | session | Starts an available quest                   |
| POST   | `/api/career/quests/:questId/complete` | session | Records completion and applies rewards      |

## Privacy Endpoints

| Method | Path                  | Auth    | Description                                               |
| ------ | --------------------- | ------- | --------------------------------------------------------- |
| GET    | `/api/privacy/export` | session | Returns the full user data export as JSON                 |
| POST   | `/api/privacy/delete` | session | Deletes the account with cascade cleanup and audit record |

## Socket.IO Events

Namespace: `/play`. All events carry a typed payload validated server-side (see `docs/SECURITY.md`).

### Client to Server

| Event                 | Payload          | Notes                                   |
| --------------------- | ---------------- | --------------------------------------- |
| `room:create`         | mode, visibility | Server returns room state               |
| `room:join`           | roomCode         | Private rooms require the code          |
| `matchmaking:enqueue` | mode             | Joins the random queue                  |
| `matchmaking:dequeue` | none             | Leaves the queue                        |
| `throw:propose`       | segment, ring    | Validated by the authority loop         |
| `game:rematch`        | none             | Proposes a rematch                      |
| `reconnect:claim`     | roomCode         | Resumes a match within the grace window |

### Server to Client

| Event           | Payload               | Notes                                |
| --------------- | --------------------- | ------------------------------------ |
| `room:state`    | room snapshot         | Authoritative room and seat state    |
| `match:started` | initial score state   |                                      |
| `match:state`   | current score state   | Broadcast after each validated throw |
| `match:turn`    | seat, checksum        | Signals the seat to act              |
| `match:ended`   | result, rating deltas | Final authoritative result           |
| `error`         | code, message         | Validation or authority errors       |

## Error Codes

| Code              | HTTP | Meaning                                       |
| ----------------- | ---- | --------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                              |
| `FORBIDDEN`       | 403  | Session lacks rights for the resource         |
| `NOT_FOUND`       | 404  | Resource does not exist or is not visible     |
| `VALIDATION`      | 422  | Payload failed DTO validation                 |
| `RATE_LIMITED`    | 429  | Too many requests                             |
| `CONFLICT`        | 409  | State conflict, for example duplicate request |

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [Testing Strategy](./TESTING.md)
- [Security](./SECURITY.md)
- [Decision Log](./DECISIONS.md)
