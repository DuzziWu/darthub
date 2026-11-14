# Task 003: Verify reachability, detachment and no regressions

**Status**: done
**Depends on**: 002
**Retry count**: 0

## Description
Prove the restoration actually works — from the container's own address, through a proxy that reproduces Tailscale Serve's prefix stripping, and against the public URL — and prove that nothing else regressed.

## Context
- `e2e/subpath-preview.spec.ts` already encodes the host proxy's semantics: strip the `/darthub` prefix, forward the query string unchanged, and answer 502 when the upstream connection fails. It is the reference for what the public path must do.
- The QA skill (`darthub-qa`) fixes the baseline: the Vitest suite is green at 491 tests, lint/format/typecheck pass, and the Playwright suite is the end-to-end gate.
- The public URL must be checked with the **browser**, not only with curl — the 502 page is what the user saw, and a 200 that renders an unstyled, unhydrated page is the failure mode of issue #7.

## Requirements (Check Descriptions)
- [ ] `it answers 200 on the container's own non-loopback address`
- [ ] `it answers 200 through a proxy that strips the mount prefix`
- [ ] `it answers 200 at the public URL`
- [ ] `it serves the prefixed asset URLs and those assets answer 200`
- [ ] `it hydrates the page and starts a match`
- [ ] `it survives the end of the starting session`
- [ ] `it leaves the unit suite green`
- [ ] `it leaves the end-to-end suite green`
- [ ] `it leaves lint, format and typecheck green`

## Acceptance Criteria
- `curl http://172.18.0.2:3000/` answers **200**.
- The public URL `https://cloud-server-10717687.tailfb5e4a.ts.net/darthub/game` answers **200**, and `/darthub` (home) answers successfully.
- The CSS/JS asset URLs in the served HTML carry `/darthub/_next/...` and each answers **200**.
- A browser loads the public `/darthub/game`, the page is **styled** (no unstyled fallback) and **hydrated** (a `Start match` click actually starts a match).
- The process is detached: PPID 1, own session id.
- `npm run lint`, `npm run format:check`, `npm run typecheck` pass.
- `npm run test` passes with the same test count as before the incident (491).
- `npm run test:e2e` passes, including `e2e/subpath-preview.spec.ts`.
- No new critical entries in the server log.

## Implementation Notes

The public URL is reachable from the host, not necessarily from inside this container — if the container cannot route to the tailnet address, say so explicitly and record the container-side measurements as the primary evidence. Do not present an unreachable-from-here public check as a failed service.

Reproduce the host proxy locally with the same semantics as `e2e/subpath-preview.spec.ts` (strip the prefix, keep the query string, 502 on a refused upstream) and point it at the published port. That verifies the whole path minus the host hop.

For hydration, check for a React fiber key on the `Start match` button rather than a screenshot alone: a hydrated element has a `__react…` key on its DOM node. This is the check `AGENTS.md` documents for the related "page renders but does nothing" failure.

Run the gates in the CI order the QA skill names: lint → format:check → typecheck → test → e2e.

## Reporting

Report the delta against the baseline, not against zero. Every number in the incident issue is a measured value — the verification has to produce measured values too.
