# DartHub Local Setup (Windows)

This guide covers running DartHub on a Windows development machine.

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org), use the LTS installer
- **npm 10+** (bundled with Node.js)

Optional (required only for features marked 🔒):

- **PostgreSQL 15+** — for auth, friends, ratings, career persistence
- **Redis** — for real-time multiplayer WebSocket room state

## Quick Start (Single-Player 501 — No Database Required)

Single-player 501 runs entirely in the browser with no database.

```powershell
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open in your browser
# http://localhost:3000/game
```

That's it. Open `/game` in your browser, enter a name, and play 501.

## Full Stack (With Database)

### 1. Install PostgreSQL

Download from [postgresql.org](https://www.postgresql.org/download/windows/) or use [Docker](https://www.docker.com):

```powershell
# Using Docker (recommended)
docker run -d `
  --name darthub-postgres `
  -e POSTGRES_DB=darthub `
  -e POSTGRES_USER=darthub `
  -e POSTGRES_PASSWORD=change-me-strong-random `
  -p 5432:5432 `
  postgres:16
```

### 2. Configure Environment

Copy the example env file and update with your values:

```powershell
Copy-Item .env .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://darthub:your-password@localhost:5432/darthub
POSTGRES_PASSWORD=your-password
JWT_SECRET=your-jwt-secret
AUTH_SECRET=your-auth-secret
```

### 3. Initialize the Database

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Start the App

```powershell
npm run dev
```

## Scripts Reference

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start Next.js dev server on port 3000     |
| `npm run build`     | Production build                          |
| `npm run start`     | Run production build                      |
| `npm run lint`      | ESLint check                              |
| `npm run format`    | Prettier format                           |
| `npm run typecheck` | TypeScript type check                     |
| `npm run test`      | Run unit/integration tests                |
| `npm run db:studio` | Open Prisma Studio (DB browser)           |
| `npm run realtime`  | Start WebSocket server (separate process) |

## Routes

| URL          | Description                             |
| ------------ | --------------------------------------- |
| `/`          | Home / landing                          |
| `/game`      | Single-player 501 game                  |
| `/lobby`     | Multiplayer lobby (requires PostgreSQL) |
| `/career`    | Career mode (requires PostgreSQL)       |
| `/dashboard` | Dashboard (requires PostgreSQL)         |

## Troubleshooting

### `Module not found` errors

```powershell
rm -Recurse node_modules, .next
npm install
```

### Port 3000 already in use

```powershell
# Find and kill the process using port 3000
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

### PostgreSQL connection refused

- Ensure PostgreSQL is running: `docker ps` (if using Docker)
- Check `DATABASE_URL` in `.env.local`
- Verify credentials match what you set when creating the DB

### Redis connection issues (real-time features)

Real-time multiplayer requires Redis. Single-player `/game` works without it.

## Stopping DartHub

```powershell
# Dev server: Ctrl+C in the terminal running npm run dev
# Docker containers:
docker stop darthub-postgres
```

## Environment Variables Summary

| Variable            | Required For                   | Default              |
| ------------------- | ------------------------------ | -------------------- |
| `DATABASE_URL`      | Auth, friends, ratings, career | Must be set manually |
| `POSTGRES_PASSWORD` | DB auth                        | Must be set manually |
| `JWT_SECRET`        | Auth                           | Must be set manually |
| `AUTH_SECRET`       | NextAuth.js                    | Must be set manually |

All four are only needed when using PostgreSQL-dependent features.
Single-player 501 (`/game`) needs none of them.
