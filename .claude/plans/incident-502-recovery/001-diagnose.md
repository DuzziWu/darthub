# Task 001: Diagnose the 502 and identify the root cause

**Status**: completed
**Depends on**: none
**Retry count**: 0

## Description
The public URL `https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/game` answers HTTP 502 for every user. Determine whether the fault lies in the Next.js application, the reverse proxy, Tailscale, or the container's network bindings — and name the exact cause with evidence, rather than guessing from the symptom.

## Context
- The app is published under the path prefix `/darthub` behind a host-side Tailscale Serve proxy that strips the prefix before forwarding.
- `AGENTS.md` §"Serving the live preview" documents the intended startup procedure.
- `e2e/subpath-preview.spec.ts` is the executable model of the host-side proxy.
- The container has no `tailscale` binary, no `/var/lib/tailscale` and no Docker daemon socket, so the host side can only be observed indirectly.

## Requirements (Check Descriptions)
- [x] `it enumerates every listening TCP socket with its exact local address (IPv4 and IPv6)`
- [x] `it maps every Next.js process to its port, bind address, working directory and env`
- [x] `it proves which listening ports are reachable on the container's own non-loopback address`
- [x] `it identifies the 502 code path in the proxy`
- [x] `it rules out an application-side or build-side cause`
- [x] `it names the exact trigger event`

## Acceptance Criteria
- The root cause is stated in one sentence and supported by measured evidence.
- The application is explicitly exonerated (or not) with the measurements that prove it.
- The trigger — the specific restart that changed the bind — is identified with timestamps.
- The hypothesis is tested against a **control**: a service bound to `0.0.0.0` in the same container, reached over the same path.

## Findings

The cause is a **bind-address regression in the operating procedure**, not a defect in the application.

The three Next.js standalone servers listen on `127.0.0.1` only (`/proc/net/tcp`: `LISTEN 127.0.0.1:3000`, `:3111`, `:3121`). The Tailscale Serve proxy runs on the VPS host and forwards into the container's published address `172.18.0.2:3000`; that connection is refused, so the proxy answers 502.

The control settles it: `172.18.0.2:3100` (next dev, bound to `::`) answers **200** and `172.18.0.2:8000` (static server, bound to `0.0.0.0`) answers **308**, while `172.18.0.2:3000` and `:3111` are **refused**. The host→container path works; only the loopback-bound listeners refuse it.

`HOSTNAME` is the switch: `.next-prefixed/standalone/server.js:15` reads `process.env.HOSTNAME || '0.0.0.0'`. The servers restarted on 2026-11-14 01:26/01:27 UTC with `HOSTNAME=127.0.0.1` — the `playwright.config.ts` E2E convention — instead of the `HOSTNAME=0.0.0.0` the runbook requires for the live preview. The last working server (log `/tmp/darthub/next-server.log`, 2026-11-13 12:53) logged `Network: http://0.0.0.0:3000`.

The application is healthy: `/` and `/game` answer 200 on both 3000 and 3111, and the served HTML carries the correct per-build asset prefix. The build is complete — `public/` and `.next/static` sit next to each `server.js`. The two commits after `origin/main` are build-time and client-side only and cannot produce a 502.

## Verification
`/proc/net/tcp` + `/proc/net/tcp6` parsed for every listener; `curl` against `127.0.0.1`, `172.18.0.2` and the public URL for each candidate port; `/proc/<pid>/environ` and `/proc/<pid>/cwd` for every server process; asset-prefix extraction from the served HTML; `git show --stat` on both post-`origin/main` commits.

## Next step
Task 002: restart the live preview on the published port with the correct bind.
