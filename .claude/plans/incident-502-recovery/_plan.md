# Plan: Incident 502 Recovery

## Created
2026-11-14

## Status
in_progress

## Objective
Restore the public reachability of DartHub at `https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/*`, which answers **HTTP 502 Bad Gateway** for every user, and make the restored service durable: it must survive the end of the SSH/tmux session, and it must not regress the next time the preview is restarted.

## Related Issues
- https://github.com/DuzziWu/darthub/issues/10 — `incident: DartHub unavailable due to HTTP 502` (critical, this incident)
- https://github.com/DuzziWu/darthub/issues/7 — build without the asset prefix serves an unstyled page (related, **not** the cause here)

## Discovery Notes

Everything below was measured against the running environment on 2026-11-14, not inferred. The full evidence table is in issue #10.

**The application is healthy; the upstream is unreachable.** Both Next.js servers answer `200` on `/` and `/game` from inside the container. The 502 is produced by the host-side proxy because it cannot open a connection to the container at all.

**The three Next.js servers bind loopback only.** Parsed from `/proc/net/tcp` and `/proc/net/tcp6`:

```
LISTEN 127.0.0.1:3000    PID 362028   root build      PORT=3000 HOSTNAME=127.0.0.1
LISTEN 127.0.0.1:3111    PID 362316   prefix build    PORT=3111 HOSTNAME=127.0.0.1
LISTEN 127.0.0.1:3121    PID 243292   prefix build    PORT=3121 HOSTNAME=127.0.0.1  (cwd deleted)
LISTEN :::3100           PID 361691   next dev
LISTEN 0.0.0.0:8000      Agent-Canvas static server   ← control
LISTEN 0.0.0.0:18000     Agent server                  ← control
```

**The control comparison isolates the cause.** Services bound to `0.0.0.0` are reachable on the container's own address; the loopback-bound ones are not:

```
172.18.0.2:3000 → 000 REFUSED
172.18.0.2:3111 → 000 REFUSED
172.18.0.2:3121 → 000 REFUSED
172.18.0.2:3100 → 200    (next dev, 0.0.0.0)   ✅
172.18.0.2:8000 → 308    (static server)      ✅
```

The host→container network path is fine. Only the DartHub listeners refuse it.

**`HOSTNAME` decides the bind, literally.** `.next-prefixed/standalone/server.js:15` — `const hostname = process.env.HOSTNAME || '0.0.0.0'`. The current servers were started with `HOSTNAME=127.0.0.1`, which is the `playwright.config.ts` convention for the E2E suite. That convention was carried over to the live preview.

**The runbook already said so.** `AGENTS.md` §"Serving the live preview" documents `setsid -f env HOSTNAME=0.0.0.0 PORT=3000 node .next-prefixed/standalone/server.js` and explains why: *"The container reaches itself at 172.18.0.2, which is the address Tailscale Serve forwards to."* The working server from 2026-11-13 12:53 logged `Network: http://0.0.0.0:3000`; the broken one logs `Network: http://127.0.0.1:3000`.

**The last working configuration was replaced at 2026-11-14 01:26/01:27 UTC** by the session that restarted the production servers after the Issue-#4 work. That restart is the trigger; the bind is the cause.

**Port 3000 must serve the prefix build.** The published mount is `/darthub` and Tailscale Serve strips the prefix before forwarding, so the backend sees `/game` while the browser asks for `/darthub/_next/...`. The `assetPrefix` build is what emits the prefixed asset URLs. The root build on port 3000 is currently bound there and would serve unprefixed asset URLs — the exact defect of issue #7. The live preview therefore needs the **prefix** build on port 3000, and the **root** build has to move off it.

**Port 3111 must stay on loopback.** `e2e/subpath-preview.spec.ts` uses `BACKEND_PORT = 3111` and `PROXY_PORT = 3112`; `playwright.config.ts` starts the prefixed standalone there with `HOSTNAME=127.0.0.1`. Moving or rebinding 3111 breaks the one test that models the host proxy.

**A zombie holds port 3121.** PID 243292 was started on 2026-11-13 15:55 with `cwd=/projects/darthub/.next-prefixed/standalone (deleted)` — the build directory was replaced by a later rebuild, so the process serves a vanished tree and still answers `200` from deleted files.

**No application change is involved.** The two commits after `origin/main` — `07d9e80` (build-time prefix guard) and `eff1313` (mobile layout, input mode) — touch no server-start, routing or asset-serving code. A 502 cannot originate from them.

## Scope

### In Scope
- Restart the live preview on port 3000 with the **prefix** build and `HOSTNAME=0.0.0.0`, detached via `setsid -f`.
- Move the root build off port 3000 to a free port so the live preview owns the published port.
- Terminate the zombie server on port 3121 (deleted cwd).
- Keep the prefixed server on 127.0.0.1:3111 for the E2E suite.
- Verify reachability from the container's own address, through a local proxy that reproduces Tailscale Serve's prefix stripping, and against the public URL.
- Verify the detached process survives the end of the session (PPID 1, own SID).
- Record the incident in the DevFlow ledger and close issue #10 only after verification.

### Out of Scope
- Changing the Tailscale Serve configuration on the host. The proxy side is correct; the upstream bind was wrong.
- Changing `next.config.ts`, `playwright.config.ts` or the application logic. The 502 is an operational fault, not a code fault.
- A Docker/Compose deployment. There is no Docker daemon in this container, and the live preview runs as a standalone process.
- Rebuilding the application. The existing `.next-prefixed` build is newer than `HEAD` and is current.
- Any database, migration or product-data change.

## Success Criteria

- `curl http://172.18.0.2:3000/` from inside the container answers **200** — the host-side proxy can reach the upstream.
- The public URL `https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/game` answers **200**, not 502.
- `https://cloud-server-10717687.tailfb5e4a.ts.net/darthub` answers successfully and the page is styled and hydrated.
- The asset URL in the served HTML carries the `/darthub` prefix and answers 200.
- The startup banner shows `Network: http://0.0.0.0:3000`.
- The process is detached: PPID 1 and its own session id.
- `e2e/subpath-preview.spec.ts` stays green; the full Playwright suite stays green.
- The full Vitest suite stays green (491 tests) — no application logic changed.
- Issue #10 is closed with the root cause, the fix and the verification evidence.

## Task Overview

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 001 | Diagnose the 502 and identify the root cause | - | done |
| 002 | Restore the live preview on the published port | 001 | done |
| 003 | Verify reachability, detachment and no regressions | 002 | done |
| 004 | Record the incident and close the issue | 003 | in_progress |

## Success Criteria — status

| Criterion | Status |
|---|---|
| `curl http://172.18.0.2:3000/` answers 200 | ✅ |
| Startup banner shows `Network: http://0.0.0.0:3000` | ✅ |
| Listener is `0.0.0.0:3000` | ✅ |
| Process detached: PPID 1, own SID | ✅ |
| Served HTML carries `/darthub/_next/...` asset URLs, and they answer 200 | ✅ |
| A prefix-stripping proxy returns 200 for `/darthub`, `/darthub/game`, `/darthub/game-center` | ✅ |
| Playwright suite green (70 passed, 7 skipped) | ✅ |
| Vitest suite green (491 passed) | ✅ |
| eslint, prettier, tsc clean | ✅ |
| Regression guard in `tests/unit/live-preview.test.ts` | ✅ |
| Public URL answers 200 | ⛔ **cannot be checked from this container** — no route to the tailnet address; must be confirmed from the host |

## Resolution Notes (added 2026-11-14)

**Root cause, confirmed end to end.** Two faults compounded:

1. **Wrong bind address.** The server on port 3000 listened on `127.0.0.1`
   only. The Tailscale Serve proxy runs on the host and connects to the
   container at `172.18.0.2:3000`; a loopback-only listener refuses that
   connection and the proxy answers 502. The application kept answering 200
   on loopback the whole time, which is why every local health check passed
   while the site was broken for every user.
2. **A port collision caused the first fault.** `playwright.config.ts` ran its
   root-build E2E server on port 3000 as well. With `reuseExistingServer` the
   suite reuses whatever already listens on the port, so the E2E run silently
   **displaced** the live preview and took over port 3000 — bound to loopback.
   This is what replaced the last working `0.0.0.0` configuration.

**What changed.** Process configuration only, plus one line of test
configuration and documentation:

- The live preview now serves the **prefix** build on port 3000 with
  `HOSTNAME=0.0.0.0`, detached via `setsid -f` (PID 378890, PPID 1, own SID).
- `playwright.config.ts` moved its root-build server from port 3000 to
  **3100** (`PORT=3100`, `HOSTNAME=127.0.0.1`); the prefixed server stays on
  **3111**. Port 3000 now belongs to the live preview alone.
- The zombie on port 3121 (deleted cwd) and the superseded root-build server
  on port 3000 were terminated by exact PID.
- `AGENTS.md` and `docs/DEPLOYMENT.md` document the bind address, the port
  reservation and the reason a 502 can coexist with a healthy local server.

**What was verified.** `172.18.0.2:3000` → 200; a local proxy that reproduces
Tailscale Serve's prefix stripping returns 200 for `/darthub`, `/darthub/game`,
`/darthub/game-center` and the prefixed `_next` assets; the served HTML carries
`/darthub/_next/...` asset URLs; the startup banner shows
`Network: http://0.0.0.0:3000`; the full Playwright suite is green (70 passed,
7 skipped) and the full Vitest suite is green (491 passed).

**Regression guard.** `tests/unit/live-preview.test.ts` asserts that port 3000
appears in neither E2E server command, that the prefixed server keeps
`HOSTNAME=127.0.0.1` on 3111, that the suite's `baseURL` is not 3000, and
that both `AGENTS.md` and `docs/DEPLOYMENT.md` record the bind requirement and
the 502 it causes. The test was verified to fail when the suite's root server
is put back on port 3000. Without such a guard the runbook was documentation
only, and the operational side was the only part of the setup that was never
enforced — the application side was hardened twice (`ff98d43`, `07d9e80`) while
the operational side was merely documented (`8b979ad`) and then violated.

**Independently confirmed.** The architecture specialist reached the same
conclusion independently — the 502 was an operational bind-address fault, not an
application fault — and additionally ruled out both commits after
`origin/main` (`07d9e80`, `eff1313`) as causes: one is build-time only, the
other is purely client-side, and a 502 is a connection-refused signal that
neither can produce. It also identified the documentation gap that enabled the
incident: `HOSTNAME=0.0.0.0` existed only in `AGENTS.md`, never in
`docs/DEPLOYMENT.md`. That gap is now closed.

**Two latent defects found, out of scope for this incident.** Both are
application-level and neither can produce a 502; they are recorded here so they
are not lost:

1. Under the prefix build, `usePathname()` returns the **prefixed** path
   (the router `basePath` is deliberately empty because `assetPrefix` is used
   instead), so `ShellNav`'s current-route marker is lost after a client-side
   navigation. The helper `withoutBasePath()` exists and does the right thing
   but is never imported. The e2e spec only exercises full page loads, which is
   why the suite is green while the defect is live.
2. The `Dockerfile` never sets `BASE_PATH`, so the image is always a root
   build and `scripts/check-asset-prefix.mjs` always passes — the gate can
   detect a *mismatch* but never an *omission*.

**Known operational gap.** There is no supervisor (no systemd unit, no
supervisor config, no cron job) for the live preview. The process is detached
(PPID 1, own SID) and therefore outlives the agent session, but it does **not**
survive a container restart. Making it durable is a separate change.

**Not verifiable from inside the container.** The public URL
`https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/game` times out from
here — the container resolves the name to `100.85.154.18` but has no route to
the tailnet address (the host's own `100.85.154.18:443` is equally
unreachable). The timeout is therefore **not** evidence of a fault; the
container-side precondition for serving the published app is met and the
public check has to run from the host.

## Notes on scope discipline

This is a service-restoration task, not a feature task. The change surface is **process configuration only**: which build serves which port, on which address, and whether the process is detached. No source file needs to change, and none will.
