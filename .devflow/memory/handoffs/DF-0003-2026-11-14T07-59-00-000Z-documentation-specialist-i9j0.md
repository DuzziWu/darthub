# Handoff: DF-0003 — Restore DartHub public availability and prevent recurrence

- Date: 2026-11-14T07:59:00.000Z
- Task: DF-0003
- Agent: documentation-specialist
- Recorded by: documentation-specialist
- Status: completed

## Outcome

The runbook now states, in both places a reader is likely to look, the three
things that were missing when the incident happened.

**Why the live preview binds `0.0.0.0` and the E2E server binds
`127.0.0.1`.** The two bindings look arbitrary side by side; they are not.
The live preview is published, so the host-side proxy must be able to reach it
on the container's published address, and a loopback-only listener refuses
that connection. The E2E servers are not published and exist to model an
upstream for a local test proxy, so they stay on loopback on purpose. The
table in `AGENTS.md` spells this out with the reason for each.

**That the published port serves the prefix build.** The mount is `/darthub`
and Tailscale Serve strips the prefix before forwarding, so the browser still
requests `/darthub/_next/...` while the backend sees `/game`. Only the prefix
build emits asset URLs under the prefix, so the published port must serve
`.next-prefixed`. This is the contract that a root build silently violates —
visually the page loads and every asset 404s.

**That a rebuild invalidates a running standalone server's working directory.**
Replacing the build directory leaves the old process serving a deleted working
directory (`/proc/<pid>/cwd` shows `(deleted)`) while still holding its port.
That is exactly the state the orphaned server on port 3121 was found in. The
runbook now says to terminate the old process by exact PID and never with a
`pkill` pattern, because several Next.js servers run side by side.

The documentation gap that enabled the incident is closed: `HOSTNAME=0.0.0.0`
existed only in `AGENTS.md` and never in `docs/DEPLOYMENT.md`, so the
deployment guide actively contradicted the runbook by omission. Both now
carry the bind requirement, the port reservation, the 502 it produces and the
health-check procedure.

## Changed files

- AGENTS.md
- docs/DEPLOYMENT.md

## Verification

- `npx prettier --check AGENTS.md docs/DEPLOYMENT.md` → all files formatted.
- `npx eslint .` → exit 0.
- `npx tsc --noEmit` → exit 0.
- The new `tests/unit/live-preview.test.ts` asserts on the content of both
  documents, so a future edit that drops the bind requirement or the 502
  explanation fails the test suite rather than silently re-opening the gap.
- The port reservation is now unambiguous across the three ports in use:
  3000 published live preview, 3100 the suite's root build, 3111 the suite's
  prefixed build.

## Open issues

- The documents describe the live preview as a process, not a supervised
  service. There is no systemd unit, supervisor config or cron job, so the
  server does not survive a container restart. The docs state this explicitly
  rather than implying a durability that does not exist. Making it durable is
  a separate change.
- `docs/DEPLOYMENT.md` describes a Docker Compose topology that does not
  match this environment (there is no Docker daemon in the container; the app
  runs as a bare standalone process, and postgres listens on 5433, not the
  documented 5432). Correcting that topology description is out of scope for
  this incident and was deliberately left alone rather than half-changed.

## Documentation impact

- Impact: yes
- Documentation status: updated
- Documentation files: AGENTS.md, docs/DEPLOYMENT.md

## Next step

None. The documentation status for DF-0003 is resolved to `updated`.
