# Security

## Table of Contents

- [Overview](#overview)
- [Threat Model](#threat-model)
- [Server Authority and Anti-Cheat](#server-authority-and-anti-cheat)
- [Authentication and Authorization](#authentication-and-authorization)
- [Input Validation](#input-validation)
- [Rate Limiting](#rate-limiting)
- [Secrets Management](#secrets-management)
- [Data Protection and GDPR](#data-protection-and-gdpr)
- [Audit Logging](#audit-logging)
- [Reporting Issues](#reporting-issues)
- [Related Documents](#related-documents)

## Overview

Security posture for DartHub rests on server authority, exhaustive validation, session-scoped access, and privacy-by-design data handling. This document records what the code does today; where a measure is designed but not yet implemented, it says so.

## Threat Model

| Threat              | Vector                              | Mitigation                                                                                                                         |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Score forgery       | Crafted client events               | Authoritative validation of every throw on the server                                                                              |
| AI tampering        | Modified clients replaying AI turns | Server-side AI: throws computed from a per-match-seeded RNG                                                                        |
| Room hijacking      | Guessing room or invite codes       | Unguessable short-lived single-use codes                                                                                           |
| Account enumeration | Signing in with a list of addresses | The unknown address and the wrong password share one answer, one message and one cost; a per-account rate limit stops the guessing |
| Data exfiltration   | Compromised account                 | GDPR deletion and audit trail limit blast radius                                                                                   |
| Token theft         | A stolen session token              | The token is short-lived (24 h for an account, 7 days for a guest) and the session secret is never sent to the client              |

## Server Authority and Anti-Cheat

- The Socket.IO server owns all match state. The client sends the value of a throw, never the resulting state; the server decides whose turn it is, whether the throw is legal, and what the score becomes.
- The anti-cheat middleware validates the shape of the event, the range of the value and the turn order before the engine applies anything. The segment of a throw is **not** part of the socket payload yet, so a segment-dependent checkout (double out) cannot be validated on that path — that is part of the realtime vertical that is still to come.
- The AI opponent is a server-side statistical model with a per-match seed, so a sequence of AI throws is reproducible on the server and can be replayed. It is **not** wired into the socket server yet: the socket server takes an `AIProvider` seam, and the statistical engine does not implement it. Until the two are joined, a room with an AI seat cannot finish its match.
- Camera observations are advisory only (see `docs/API.md`): a client-supplied `CameraDTO.score` is a hint and is never trusted. The camera layer is a stub today — it produces no real detection — and no surface of the application consumes it.
- A disconnected player keeps their seat; the reconnect presents the seat's token. The seat token is not a session: it is bound to the room, not to an account.

## Authentication and Authorization

- Auth.js issues sessions; guests get a limited guest session token bound to their guest row.
- Every REST and Socket.IO handler resolves the principal, then a service-level authorisation check decides access; authorisation never lives in UI code.
- Guest sessions cannot access friends, career persistence, or any other user's data.
- Admin-only operations (rating recalculation) require an explicit role, not an email check.
- **A sign-in answers an unknown address exactly like a wrong password** — the same status, the same message, and the same work. The unknown address is compared against a real bcrypt hash, so the two paths cannot be told apart by how long they take. The placeholder that used to stand in for it was not a bcrypt hash, so bcrypt rejected it at once: the unknown address answered in under a millisecond while a registered one paid the full cost factor.
- **The password rules live in the service** (`src/auth/passwordPolicy.ts`), not in a route. A rule that lives in a caller is a rule the next caller forgets: the guest conversion and the invitation route created accounts with passwords the registration route would have refused.
- **The answer of every auth route is built from a list of public fields** (`src/auth/publicUser.ts`). The password hash is not on that list, so it cannot leave the server — the invitation route used to answer with the whole user row, hash included.

## Input Validation

- All payloads pass through the DTO validation of the feature that owns the endpoint before reaching services.
- Socket events are answered with a typed error code on validation failure.
- Database access is exclusively through Prisma with parameterised queries; no string-built SQL.

## Rate Limiting

The auth endpoints are rate limited (`src/security/`). Every request is counted
against two limits:

| Endpoint                              | Bucket            | Per address | Per account |
| ------------------------------------- | ----------------- | ----------- | ----------- |
| `POST /api/auth/login`                | `auth.login`      | 30 / 15 min | 10 / 15 min |
| `POST /api/auth/register`             | `auth.register`   | 10 / hour   | 5 / hour    |
| `POST /api/auth/link-guest`           | `auth.link-guest` | 10 / hour   | 5 / hour    |
| `POST /api/auth/invitation`           | `auth.invitation` | 10 / hour   | 5 / hour    |
| `POST /api/auth/callback/credentials` | `auth.login`      | 30 / 15 min | 10 / 15 min |
| `POST /api/auth/callback/guest`       | `auth.guest`      | 10 / hour   | —           |
| `POST /api/invite/create`             | `invite.create`   | 30 / hour   | —           |
| `POST /api/invite/join`               | `invite.join`     | 60 / hour   | —           |

**The Auth.js callbacks count in the same buckets as the own routes.** The
credential callback shares the `auth.login` bucket with `/api/auth/login`, so
a caller cannot double its budget by alternating between the two paths. The
guest callback has its own bucket, so a flood of guest sessions cannot spend
the budget of a registration.

**Why two limits.** The address of a request comes from a header the client
controls, so anyone who reaches the application directly can forge it. The
account cannot be forged: it is looked up, not declared. The account limit
is therefore the one that carries the security; the address limit is the
second line that stops one host spraying many accounts — a spray tries one
password against many accounts, and every one of those accounts has its own
budget of one.

**Why these numbers.** Ten attempts per account and quarter of an hour is
what stops a password guess, while a player who mistypes twice never notices
the limit. The address limits sit above what one person needs — people share
addresses: a household, an office, a carrier's NAT — and below what an
attacker needs.

**The counters.** With `REDIS_URL` set, which is what Docker Compose does, the
counters live in Redis and are shared by every instance. The count and the
expiry are set in **one** Lua script, so the counter is atomic across
processes and can never exist without an expiry.

**Production needs Redis.** Without `REDIS_URL` the counters live in the
process. That is enough for development and for the tests, and it is **not**
enough for production: with two instances the effective limit is twice the
configured one, and with a restart every window starts at zero again. A
production installation without a counter store therefore **refuses every
request** with a `503` — the same answer as a counter store that does not
answer. It is a misconfiguration, not a decision, and it is loud.

**A broken counter store does not open the door.** If Redis is configured and
does not answer, the request is refused with a `503` instead of being counted
as allowed. A limiter that fails open is no limiter, and nothing would show
that it had stopped counting.

**The Auth.js callbacks are counted in front of Auth.js.** Auth.js runs a
credentials provider inside its `authorize` callback, and a provider can only
answer with a user or with nothing — it cannot answer with `429`. The check
therefore sits in the route module (`src/auth/authjsRoute.ts`), in front of
the Auth.js handler: there the answer is an ordinary HTTP response, `429`
with a `Retry-After` for a reached limit and `503` for a counter store that
does not answer. The check happens **before** the password comparison and
before the guest session is created, so a refused request costs neither.

**`AUTH_TRUST_HOST` is not a rate limit.** It says which origins may talk to
the application; it says nothing about how many passwords may be tried.
`AUTH_TRUST_HOST=true` is what the Auth.js path needs in a self-hosted
deployment, and it must therefore **not** be set before the callbacks are
rate limited — and the new login page must not ship before it either.

**The application must stand behind a proxy that sets the client address
correctly.** The address of a request is read from the **last** entry of
`x-forwarded-for` — the entry the proxy closest to the application added,
and the only one a client cannot put in front of. A value that is not an IP
address is not used at all, so a caller cannot create a new counter bucket
per request by sending rubbish; such a request shares one bucket with every
other request that carries no usable address.

The proxy has to be the **only** way in. The published port of the
application is bound to the loopback address of the host
(`docker-compose.yml`), so a client cannot reach the application around the
proxy and choose the address it is counted under. The per-account limit is
the limit that holds in any case: the account is looked up, not declared, so
no header can forge it.

**The answer is uniform.** Every refused request carries the same message and
a `Retry-After` header. A client is not told which limit it reached, and the
message does not say whether the account exists.

**What is not limited yet.** The friend requests, the privacy export and the
Socket.IO events carry no limit. They need one of their own, with numbers of
their own; see `docs/ROADMAP.md`.

### The proxy the application needs

The address limit is only as good as the network path in front of the
application. Three things have to hold, and each of them is a property of
the **deployment**, not of the code:

1. **The proxy is the only way in.** The published port of the application is
   bound to the loopback address of the host, so nothing outside the host
   reaches it directly.
2. **The proxy sets the client address.** The last entry of
   `x-forwarded-for` must be the address the proxy saw. A proxy that
   **appends** its own observation leaves the entries a client supplied at
   the front — which is why the last entry is read and not the first.
3. **The proxy does not pass a client-supplied header through unchanged.**
   A proxy that forwards `x-forwarded-for` without adding its own entry
   leaves the client in charge of the address.

**What was checked on this installation, and what was not.** The reverse
proxy is Tailscale Serve; its configuration mounts `/darthub` on
`http://127.0.0.1:3000`, the mount is tailnet-only, and the application
binds the loopback address of the host, so the proxy is the only path in.
That much was read from the running configuration.

**Whether Tailscale Serve appends to or overwrites a client-supplied
`x-forwarded-for` was not verified.** The header name is known to be set,
but the behaviour could not be observed without changing the proxy
configuration or publishing a temporary listener, and neither belongs to a
deployment check. The code does not depend on the answer: reading the last
entry is correct under both behaviours, and a request that carries no
usable address shares one bucket with every other such request.

## Secrets Management

- Secrets are provided by environment variables only; `.env.example` ships the
  example file with the required keys.
- `AUTH_SECRET` is the one and only name of the session secret
  (`src/auth/session.ts`). It must be at least 32 characters long, it must
  differ on every deployment, and the application **refuses the placeholder
  from the example file** — a deployment that copied the template unchanged
  fails loudly instead of running with a secret that is published in the
  repository.
- Generate one with `openssl rand -base64 32`. Docker Compose refuses to start
  without `AUTH_SECRET`.
- The example file contains no real credentials; production secrets live only
  on the deployment host.
- No secret values are logged; error serializers redact unknown fields. The
  rate limiter logs only the _name_ of a failure, never the message of a
  database client — such a message can carry the connection string, and the
  connection string can carry a password.

## Data Protection and GDPR

- Collected data is limited to profile, gameplay, ratings, and direct social relations; no third-party analytics or tracking.
- `GET /api/privacy/export` returns one JSON document. **Today it carries the profile only** — the sections for the ratings, the matches, the friendships and the career progress are empty placeholders. The export is therefore **not yet** the complete export the product requirements ask for; see `docs/ROADMAP.md`.
- `DELETE /api/privacy/account` removes the guest rows and the account; the ownership rows cascade with it.
- A lightweight append-only audit logger exists (`src/privacy/auditService.ts`). **The export and delete routes do not call it yet** — they write a line to the application log instead — so there is no persistent, queryable trail of the privacy actions until that is wired.
- External audit of the GDPR implementation is scheduled as a later phase; see `docs/DECISIONS.md`.

## Audit Logging

- The audit logger appends JSON lines to `data/audit.log`: actor, action, target, timestamp.
- The entries are append-only through the application: there is no route that edits or deletes one.
- The logger is not yet called by the privacy routes, and the file it writes to is not part of the container image; see `docs/ROADMAP.md`.

## Reporting Issues

Security issues are handled privately: report suspicions through the repository issue tracker marked confidential, or contact the maintainers directly. Findings from automated review are tracked in the plan and must be resolved before the release milestone.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database Design](./DATABASE.md)
- [API Specification](./API.md)
- [Testing Strategy](./TESTING.md)
- [Decision Log](./DECISIONS.md)
