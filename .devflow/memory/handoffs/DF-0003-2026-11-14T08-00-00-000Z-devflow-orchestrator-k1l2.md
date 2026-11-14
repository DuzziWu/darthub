# Handoff: DF-0003 — Restore DartHub public availability and prevent recurrence

- Date: 2026-11-14T08:00:00.000Z
- Task: DF-0003
- Agent: devflow-orchestrator
- Recorded by: devflow-orchestrator
- Status: completed

## Outcome

DF-0003 is complete. The DartHub public URL answered 502 Bad Gateway for every
user; the cause was an operational fault, not an application fault, and the
service is restored.

The root cause had two compounding parts. The server on port 3000 bound
`127.0.0.1` only, so the host-side Tailscale Serve proxy — which reaches the
container at `172.18.0.2:3000` — had its connection refused and answered 502,
while the application kept answering 200 on loopback. That bind had been
replaced because `playwright.config.ts` also ran its root-build E2E server on
port 3000 and, with `reuseExistingServer`, silently displaced the live preview
and took the port bound to loopback.

The fix restores the prefix build on port 3000 with `HOSTNAME=0.0.0.0`,
detached (`setsid -f`, PID 378890, PPID 1, own SID), and moves the suite's
root server to port 3100 so the published port can never be taken by a test
run again.

Two findings from the specialist work are worth carrying forward:

- **The trigger and the documentation gap were the same defect.** The
  application side was hardened twice (`ff98d43`, `07d9e80`); the operational
  side was only documented (`8b979ad`) and then violated. `HOSTNAME=0.0.0.0`
  existed only in `AGENTS.md` and never in `docs/DEPLOYMENT.md`. The
  regression test added in this task asserts on the content of both documents
  precisely so that the gap cannot silently reopen.
- **The 502 was exonerated from the application side with evidence, not
  assumption.** `07d9e80` is build-time only, `eff1313` is purely client-side,
  and the proxy turns an upstream _connection error_ into 502 while passing a
  404/500 response through verbatim — a 502 is a reachability signal and never
  a routing signal.

## Changed files

- playwright.config.ts
- AGENTS.md
- docs/DEPLOYMENT.md
- tests/unit/live-preview.test.ts (new)
- .claude/plans/incident-502-recovery/_plan.md
- .claude/plans/incident-502-recovery/002-restore-live-preview.md
- .claude/plans/incident-502-recovery/003-verify.md
- .claude/plans/incident-502-recovery/004-record-and-close.md
- .devflow/tasks/tasks.json
- .devflow/memory/handoffs/DF-0003-*.md (six new handoffs)

No application logic was changed: no game rule, score mode, undo behaviour,
API route, data model or UI. The `GameEngine` was not touched.

## Verification

- `curl http://172.18.0.2:3000/` → 200; `/game` → 200; `/game-center` → 200.
- Control comparison on the same address: `172.18.0.2:8000` → 308 and
  `:18000` → 200 (wildcard-bound platform services), while the loopback-bound
  `:3111` is refused. Port 3000 now behaves exactly like the working controls.
- A local proxy reproducing Tailscale Serve's prefix stripping answers 200 for
  `/darthub`, `/darthub/game`, `/darthub/game-center` and the prefixed assets.
- Listeners: `0.0.0.0:3000` and `127.0.0.1:3111` only.
- `ps -o pid,ppid,sid,cmd -p 378890` → `378890  1  378890  next-server (v16.4.5)`.
- Server log → no error line; banner `Network: http://0.0.0.0:3000`.
- **The decisive check:** after a full `npx playwright test` run (70 passed,
  7 skipped), PID 378890 was still serving `0.0.0.0:3000` and answering 200.
  Before the fix that same run displaced the live preview.
- `npx vitest run` → 491 passed. `npx eslint .` → exit 0.
  `npx prettier --check` → all files formatted. `npx tsc --noEmit` → exit 0.
- The new regression test was proven to fail when the suite's root server is
  put back on port 3000.

## Open issues

- **The public 200 is not confirmed.** The URL cannot be reached from inside
  the container: the name resolves to `100.85.154.18`, but the container has no
  route into the tailnet (`:443` and `:22` on that address are equally
  unreachable, and the browser tool times out on the same URL). Every
  container-side precondition is met, but the public check has to run from the
  host. Issue #10 is therefore **not** closed.
- **No supervisor.** The process is detached and outlives the agent session,
  but there is no systemd unit, supervisor config or cron job, so it does not
  survive a container restart. Making the preview durable is a separate change.
- **Two latent application defects, both unable to cause a 502**, recorded and
  deliberately not fixed here: `usePathname()` returns the prefixed path
  under the prefix build, so the current-route marker is lost after a
  client-side navigation (`withoutBasePath()` exists but is never imported);
  and the `Dockerfile` never sets `BASE_PATH`, so the prefix gate can detect a
  mismatch but never an omission.
- `npm run lint` is broken independently of this incident (`next lint --dir`
  is rejected by Next.js 16 with `unknown option '--dir'`); the direct
  `eslint .` invocation passes.

## Documentation impact

- Impact: yes
- Documentation status: updated
- Documentation files: AGENTS.md, docs/DEPLOYMENT.md

## Next step

Run `curl -I https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/game` from
the host. On 200, close issue #10 and set DF-0003 and the incident plan to
closed. On a 502, the failure is on the host side — most likely the
`tailscale serve --set-path=/darthub` mount pointing at the wrong upstream —
and the container-side work stands.
