# Deployment Guide

This guide covers two ways to run DartHub: local development on a workstation, and
self-hosting on a VPS with Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Docker Compose Commands](#docker-compose-commands)
- [Publishing under a path prefix](#publishing-under-a-path-prefix)
- [Data Migration](#data-migration)
- [Updating the Deployment](#updating-the-deployment)
- [Rollback](#rollback)
- [Ports and Firewall Rules](#ports-and-firewall-rules)
- [Troubleshooting](#troubleshooting)
- [Verification Status](#verification-status)
- [Related Documents](#related-documents)

## Prerequisites

### Local development

- Node.js 20 or newer (`engines.node` in `package.json` requires `>=20`; the Docker
  image builds on `node:22-alpine` for the same reason - Next.js 16 needs Node >= 20).
- npm 10 or newer (shipped with recent Node.js versions).
- git, so the npm `prepare` script can wire up the Husky pre-commit hook automatically.
- No local PostgreSQL install is required for Docker-based development; for bare
  `npm run dev` you need a reachable PostgreSQL instance matching your
  `DATABASE_URL`.

### Self-hosting (Docker Compose)

- A Linux VPS with Docker Engine and Docker Compose v2 (`docker compose version`).
- Sufficient disk space for the build context, images, and the `postgres-data`
  volume.
- Outbound network access from the VPS to pull base images (`node:22-alpine`,
  `postgres:16-alpine`).

## Local Development

```bash
npm install          # installs dependencies and prepares the git hooks
npm run dev          # start the Next.js development server
```

Useful commands while developing:

```bash
npm test             # vitest run, full parallel suite
npm run lint         # eslint over the repository
npm run typecheck    # tsc --noEmit
npm run format:check # verify Prettier formatting
```

Database tooling (see [Data Migration](#data-migration) for details):

```bash
npm run db:migrate   # prisma migrate dev (development)
npm run db:deploy    # prisma migrate deploy (production)
npm run db:studio    # prisma studio
```

## Environment Variables

### Docker Compose variables

These are consumed by `docker-compose.yml` through the environment. Never commit
real values; provide them via an env file or an export before running Compose.

| Variable            | Required         | Default   | Purpose                                             |
| ------------------- | ---------------- | --------- | --------------------------------------------------- |
| `POSTGRES_USER`     | No               | `darthub` | Superuser name for the PostgreSQL container.        |
| `POSTGRES_PASSWORD` | Yes (no default) | none      | PostgreSQL password. Compose fails fast without it; |
| `POSTGRES_DB`       | No               | `darthub` | Database name created on first start.               |

`DATABASE_URL` is not set manually under Docker: `docker-compose.yml` derives it from
the three variables above as
`postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>`.
If `POSTGRES_PASSWORD` is missing, Compose aborts before starting anything.

A full annotated list of application-level variables (authentication secrets and
similar) lives in `.env.example` at the repository root - copy it to `.env` and fill
in values. See the [Security](./SECURITY.md) document for secret-handling guidance.

### Local development variables

For bare `npm run dev`, set `DATABASE_URL` (for example in `.env`) so Prisma and the
app can reach your database:

```text
DATABASE_URL="postgresql://darthub:<password>@localhost:5432/darthub"
```

## Docker Compose Commands

`docker-compose.yml` defines two services: `app` (the Next.js standalone server,
built by the multi-stage `Dockerfile`) and `postgres` (PostgreSQL 16, Alpine
variant). The `app` service waits for the `postgres` healthcheck
(`pg_isready`) before starting.

```bash
# Provide the required variables (or put them in an env file)
export POSTGRES_USER=darthub
export POSTGRES_PASSWORD='choose-a-strong-password'
export POSTGRES_DB=darthub

docker compose up -d          # build the app image and start both services
docker compose ps             # check service status and health
docker compose logs -f app    # follow application logs
docker compose down           # stop and remove containers (postgres-data volume survives)
docker compose down -v        # stop and also DELETE the postgres-data volume (destructive)
```

Rebuild after code changes:

```bash
docker compose build app      # rebuild the application image
docker compose up -d --build  # rebuild and restart in one step
```

> Warning: `docker compose down -v` removes the `postgres-data` named volume and
> with it all game data. Only use it when the data is disposable.

## Publishing under a path prefix

The app can be published under a path prefix — for example behind Tailscale
Serve, which serves it at `https://<host>.<tailnet>.ts.net/darthub`.

### How the prefix works

Tailscale Serve strips the mount prefix before it forwards the request to the
backend (`http.StripPrefix` in `ipn/ipnlocal/serve.go`). The backend therefore
receives `/game` for a browser that asked for `/darthub/game`, while the browser
resolves the stylesheet and the client bundle against the URL it was given and
asks for `/darthub/_next/...`.

The build has to account for both halves. `assetPrefix` moves the asset URLs
under the prefix while the routes stay at the root, and the app builds its own
links with the prefix so that the router, the navigation and the programmatic
navigations all stay inside the mount point.

### Build variable

`BASE_PATH` sets the prefix at build time:

```bash
BASE_PATH=/darthub npm run build
```

Without it the app is served from the root, which is what a local development
run (`http://localhost:3000`) expects. The prefix is read when the config is
loaded, so it must be set for the build, not only for the server.

`npm run build:prefixed` is the ready-made command for the `/darthub` prefix.
It writes to `.next-prefixed/` so it does not overwrite a root build.

### Serving it with Tailscale

Serve the container's port under the mount point:

```bash
tailscale serve --set-path=/darthub http://127.0.0.1:3000
```

The prefix in the build and the prefix in `--set-path` must be the same. If they
differ, the asset URLs point at a path the proxy does not serve and the page
arrives unstyled and unhydrated.

### Checking it

The end-to-end suite covers this setup: `e2e/subpath-preview.spec.ts` starts the
proxy that behaves like Tailscale Serve and asserts that the pages, the assets,
the hydration and the client-side navigation all work through the prefix.

There is also a gate that catches the most damaging misconfiguration before
the build is published:

```bash
BASE_PATH=/darthub NEXT_DIST_DIR=.next-prefixed npm run check:prefix
```

It reads the rendered HTML of a route and checks that the asset URLs carry the
prefix the app is published under. A build without `BASE_PATH` hands out asset
URLs without the prefix; the proxy strips the prefix from the path, so those
requests find no mount and answer 404. The check fails on that and on the
opposite mistake — a prefixed build published at the root.

### Recognising the broken state

The failure is quiet: the HTML arrives with **200**, so the page looks
structured, but every asset request answers **404**. What the user sees:

- browser-default buttons and inputs, default blue links, the default serif
  font, no dark mode,
- **both** navigation bars at once, because the CSS that hides one of them
  never loaded,
- controls that do nothing, because the client bundle never hydrated.

The fastest confirmation is the network tab: a **404 on `/_next/*.css`** while
the document itself is **200**. The check above reports the same thing without
a browser.

## Data Migration

The PostgreSQL schema is managed by Prisma migrations (the initial migration lives
in `prisma/migrations/`). Migrations must be applied before the app server expects
schema-correct data:

1. Start the database and wait for it to become healthy:
   `docker compose up -d postgres`
2. Apply migrations from the host, pointing Prisma at the published PostgreSQL port:

   ```bash
   DATABASE_URL="postgresql://${POSTGRES_USER:-darthub}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB:-darthub}" \
     npm run db:deploy
   ```

   (`npm run db:deploy` runs `prisma migrate deploy`: it applies pending migrations
   and is the correct tool for production.)

3. Start the application: `docker compose up -d`

Note: migrations are run from the host because the `runner` stage of the
`Dockerfile` contains only the Next.js standalone output, not the Prisma CLI. In
development, `npm run db:migrate` (`prisma migrate dev`) is the counterpart, and a
live-database caveat applies there: `migrate dev` is interactive and may prompt to
reset a development database whose drift it detects.

## Updating the Deployment

Update from a pinned git checkout on the VPS:

```bash
git fetch && git checkout <release-tag-or-commit>
export POSTGRES_USER=darthub
export POSTGRES_PASSWORD='…'
export POSTGRES_DB=darthub
npm run db:deploy
docker compose up -d --build
```

Order matters: apply migrations before (or alongside) starting the new image, then
recreate the containers. Old containers keep serving until `up -d --build` recreates
them.

## Rollback

Roll back to a previously working release when an update misbehaves:

1. Check out the previous known-good tag or commit:
   `git checkout <previous-tag-or-commit>`.
2. Rebuild and restart the containers with that source tree:
   `docker compose up -d --build`.
3. Verify with `docker compose ps` and `docker compose logs -f app`.

Database caveat: the `postgres-data` named volume persists across rollbacks.
App-level rollbacks are usually safe, but if the rollback crosses a migration
boundary (the previous release expects an older schema), Prisma `migrate deploy`
will not downgrade automatically - check `prisma/migrations/` in the checked-out
revision and restore the database from a backup taken before the update if the
schema must be reversed. Taking a database backup before every update is the
recommended safety net.

Data-level rollback (last resort for a broken database):

```bash
docker compose down
docker compose down -v   # destructive: deletes postgres-data
docker compose up -d postgres
npm run db:deploy
docker compose up -d
```

## Ports and Firewall Rules

| Container port | Published host port | Service      | Expose to the internet?                   |
| -------------- | ------------------- | ------------ | ----------------------------------------- |
| 3000           | `3000:3000`         | `app` (HTTP) | Yes, or behind a reverse proxy on 80/443. |
| 5432           | `5432:5432`         | `postgres`   | No.                                       |
| 3001           | planned             | `realtime`   | Yes, once the Socket.IO service ships.    |

`docker-compose.yml` currently publishes PostgreSQL on all interfaces
(`"5432:5432"`). On a VPS, restrict it before going live:

- Bind PostgreSQL to loopback by overriding the mapping to `"127.0.0.1:5432:5432"`,
  or remove the `ports` entry entirely so PostgreSQL is reachable only from the
  internal Compose network (the `app` service talks to it via the `postgres`
  hostname, so host publishing is optional). This is the recommended hardening.
- Alternatively, if publishing is unavoidable for host-based migration runs, keep
  the firewall closed to 5432 from external networks.

Firewall rules (ufw example):

```bash
sudo ufw allow 3000/tcp      # or 80/443 when reverse-proxying
sudo ufw deny 5432/tcp       # PostgreSQL must not be reachable externally
sudo ufw enable
```

Keep Docker's internal bridge traffic in mind: `ufw` filters external interfaces, so
the Compose-internal `postgres` reachability is unaffected by denying 5432
externally.

## Troubleshooting

### Container exits immediately with `POSTGRES_PASSWORD must be set in the environment`

The Compose file interpolates `POSTGRES_PASSWORD` with no fallback and fails fast.
Export the variable (or supply a Compose env file) and run again.

### `postgres` healthcheck failing, `app` never starts

`app` waits for `pg_isready` to succeed. Inspect the database logs:

```bash
docker compose logs postgres
```

A fresh database takes a few seconds to initialise; the healthcheck allows 10
retries at 5-second intervals. Persistent failure usually means a bad
`POSTGRES_PASSWORD` (previous volume data with a different password) or a corrupted
volume.

### `app` crash-looping with database connection errors

Migrations were likely not applied. Stop the app, run the [Data Migration](#data-migration)
steps, then start it again.

### Port already in use

`3000` or `5432` may already be bound on the host (for example by a development
server or a local PostgreSQL). Free the port or change the host side of the
mapping, for example `"13000:3000"`.

### Volume permissions

The `postgres-data` named volume is initialised by the official `postgres:16-alpine`
image, which runs as its internal `postgres` user. If a host directory were bound
instead of the named volume, ownership mismatches would break startup; stick to the
named volume declared in `docker-compose.yml`, and run
`docker compose down -v` (destructive) to reset a bad volume cleanly.

## Verification Status

The multi-stage `Dockerfile` and `docker-compose.yml` described here have been
reviewed against the repository sources; a full live end-to-end build-and-serve
verification has been deferred in this environment. Before relying on this guide
for a production host, do one clean-room run: start from a fresh VPS (or a clean
clone) and follow [Docker Compose Commands](#docker-compose-commands) through
[Data Migration](#data-migration), confirming a healthy `docker compose ps`.

## Related Documents

- [Product Requirements](./PRD.md)
- [Architecture](./ARCHITECTURE.md)
- [Database](./DATABASE.md)
- [API Specification](./API.md)
- [Security](./SECURITY.md)
- [Testing Strategy](./TESTING.md)
- Project README (../README.md)
