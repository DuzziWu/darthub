# Task 002: Restore the live preview on the published port

**Status**: done
**Depends on**: 001
**Retry count**: 0

## Description
Bring the published app back up on the port the host-side proxy forwards to, with a bind address the host can actually reach, serving the build that matches the `/darthub` mount, and detached so it survives the end of the session.

## Context
- The published port is **3000** (the container publishes 3000 to the host; `AGENTS.md` and `docs/DEPLOYMENT.md` both name it).
- The live preview must serve the **prefix build** (`.next-prefixed`), because Tailscale Serve strips `/darthub` before forwarding while the browser still requests `/darthub/_next/...`. The root build emits unprefixed asset URLs and would reproduce issue #7.
- The root build currently occupies port 3000 (PID 362028) and is only needed by the Playwright suite, which starts its own server on `HOSTNAME=127.0.0.1`.
- Port 3111 must keep serving the prefix build on `127.0.0.1` — `e2e/subpath-preview.spec.ts` depends on it (`BACKEND_PORT = 3111`).
- Port 3121 is held by PID 243292, whose working directory is deleted (`…/standalone (deleted)`).

## Requirements (Check Descriptions)
- [ ] `it serves the prefix build on the published port`
- [ ] `it binds the published port to 0.0.0.0, not to 127.0.0.1`
- [ ] `it answers 200 on the container's own non-loopback address`
- [ ] `it stays reachable after the starting session ends`
- [ ] `it leaves the port the E2E suite depends on untouched`
- [ ] `it frees the port held by the process whose working directory no longer exists`

## Acceptance Criteria
- The port 3000 listener is bound to `0.0.0.0`, verified in `/proc/net/tcp`.
- The served HTML on port 3000 carries `/darthub/_next/...` asset URLs and those assets answer 200.
- The server process is detached: `ps -o pid,ppid,sid,cmd -p <pid>` shows **PPID 1** and a session id of its own.
- The startup banner shows `Network: http://0.0.0.0:3000`.
- Port 3111 still serves the prefix build on `127.0.0.1` and is unchanged.
- No process with a deleted working directory is left running.
- The startup uses `setsid -f`, so the process is adopted by PID 1 and outlives the session — `AGENTS.md` is explicit that without `-f` the server dies with the session.
- No source file is modified. The change surface is process configuration only.

## Implementation Notes

Follow `AGENTS.md` §"Serving the live preview" exactly — it is the documented procedure and it is what worked on 2026-11-13:

```bash
cd /projects/darthub
setsid -f env HOSTNAME=0.0.0.0 PORT=3000 node .next-prefixed/standalone/server.js
```

`setsid -f` is not optional: without the `-f` the process stays a child of the starting shell and dies with the session, which is one of the failure modes this incident must not leave behind.

Before starting, free port 3000 (the root-build server) and port 3121 (the zombie with the deleted cwd). Terminate by **exact PID**, never with a `pkill` pattern — there are several Next.js processes here and the pattern would take the wrong ones.

Do **not** stop the server on port 3111: the Playwright suite uses it. Do **not** change the Tailscale Serve configuration: the proxy side is correct.

If the prefix build turns out to be stale relative to `HEAD`, rebuild it with `npm run build:prefixed` and copy `public/` and `.next-prefixed/static` next to the standalone server the way the Dockerfile's runner stage does. The current build is newer than `HEAD`, so this is a check, not a step.

## Acceptance criteria note

The published app must answer **200** at `/darthub/game` with a styled, hydrated page. A 200 that serves unprefixed assets is a regression against issue #7 and must not be accepted.
