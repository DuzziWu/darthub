# Plan — Deployment configuration: `BASE_PATH` in the image build, sharp prefix gate, runbook

**Status:** done
**Task branch:** `cez/<runId>` (no push, no merge into `integration/opencode-team`)
**Base:** `integration/opencode-team` @ `55fb674`

## Objective

The published site answered with Next.js' error page for every user. The cause is
not a game bug but the deployment configuration:

1. `Dockerfile` built with `npm run build` and **without** `BASE_PATH`, so the asset
   URLs were `/_next/...` instead of `/darthub/_next/...`.
2. `docker-compose.yml` had no way to pass a prefix into the build at all.
3. `scripts/check-asset-prefix.mjs` ran as a build gate **without** `BASE_PATH`. The
   script reads the prefix from `process.env.BASE_PATH`; with the variable unset it
   checks against `/_next/` and can never fail. The guard was disarmed — that is the
   actual defect.

Separately, the runbook (`AGENTS.md`, `docs/DEPLOYMENT.md`) describes a topology that
is no longer the one in use: the published preview runs as a **host process** from the
`.next-prefixed` build and the Tailscale mount points at `http://127.0.0.1:3000` on
the same host, not at a container on `172.18.0.2:3000`.

## Scope

| #   | Package                                 | Owner       | Files                                                                | Status |
| --- | --------------------------------------- | ----------- | -------------------------------------------------------------------- | ------ |
| 1   | `001-dockerfile-prefix.md`              | implementer | `Dockerfile`                                                         | done   |
| 2   | `002-compose-prefix.md`                 | implementer | `docker-compose.yml`                                                 | done   |
| 3   | `003-regression-test.md`                | implementer | `tests/unit/docker-prefix.test.ts`                                   | done   |
| 4   | `004-runbook.md`                        | implementer | `AGENTS.md`, `docs/DEPLOYMENT.md`, `tests/unit/live-preview.test.ts` | done   |
| 5   | `005-bind-address-correction.md`        | implementer | `AGENTS.md`, `docs/DEPLOYMENT.md`, `tests/unit/live-preview.test.ts` | done   |
| 6   | `006-container-variant-verification.md` | implementer | `docs/DEPLOYMENT.md`, `_plan.md`                                     | done   |

Out of scope (must not be touched): `src/**`, `app/**`, `next.config.ts`, `prisma/**`,
`playwright.config.ts`, `package.json`, `.dockerignore`,
`scripts/check-asset-prefix.mjs`, `e2e/**`.

## Acceptance criteria

- **R1** The builder stage declares `BASE_PATH` as an `ARG`, exports it as an `ENV`
  **before** `npm run build`, and the prefix gate inherits that same value. A prefixed
  build that loses its prefix fails the image build. A root build (empty `ARG`) still
  passes the gate.
- **R2** Compose passes `BASE_PATH` as a build argument; the header comment explains the
  prefixed and the root operation. The default stays the root — no behaviour change for
  existing deployments. `POSTGRES_PASSWORD` stays fail-fast, no secrets in the file.
- **R3** `tests/unit/docker-prefix.test.ts` fails against the old state (proved with a
  temporary copy, never committed).
- **R4** The runbook describes the actual topology, keeps the container variant as a
  documented alternative, and keeps the hard-won lessons: port 3000 belongs to the
  preview alone, the 502 shape, rebuild invalidates the running server (exact PID, never
  `pkill`), the proxy strips the prefix. `tests/unit/live-preview.test.ts` is adapted
  without weakening it.
- **R5** Nothing outside the scope is touched. No push, no merge, no branch surgery.
- **R6 (Owner-Entscheidung 2026-11-16)** Die Vorschau bindet **127.0.0.1**, nicht
  `0.0.0.0` — die `0.0.0.0`-Regel gehört zur **Container-Topologie**. Die
  Bind-Adressen-Tabelle nennt beide Topologien, die 502-Fehlform und die
  Port-Reservierung (3000 für die Vorschau, 3100/3111 für die E2E-Suite) bleiben
  dokumentiert. Die Assertion in `tests/unit/live-preview.test.ts` wird **ersetzt**,
  nicht gelöscht, und nagelt zusätzlich die Container-Regel fest.
- **R7** Der Image-Build mit `BASE_PATH=/darthub` ist mit echtem `docker compose build app`
  gefahren, und das Gate im selben Build meldet den Prefix `/darthub`.
- **R8** Gegenproben: ein Build, dessen Gate einen **anderen** Prefix sieht, und ein Build,
  dessen Gate **gar keinen** Prefix sieht, lassen den **Image-Build scheitern**. Der
  Root-Build besteht weiterhin.
- **R9** Der laufende Container ist vom Host **über die Bridge-Adresse** erreichbar (HTTP 200)
  und bindet im Container `0.0.0.0:3000` (Socket `00000000:0BB8`, Zustand `LISTEN`).
- **R10** Die ausgelieferte Seite trägt den Prefix in **allen** Asset-URLs.
- **R11** Kein Eingriff in die laufende Vorschau, kein Publish/Deploy, kein `down -v` an
  fremden Daten.
- **R12** `docs/DEPLOYMENT.md` und `_plan.md` halten das Ergebnis (verifiziert oder blockiert)
  mit Belegen fest.

## Verification

```bash
npm ci && npx prisma generate   # a cezar worktree has no node_modules of its own
npm run typecheck
npm run lint
npm run format:check
npm run test
```

## Image build evidence

The real image build, not just the file inspection — `docker build --target builder`
(the gate is the last instruction of the builder stage):

```
$ docker build --target builder --build-arg BASE_PATH=/darthub -t darthub-prefix-check:prefixed .
Step 14/14 : RUN node scripts/check-asset-prefix.mjs
✓ 17 asset URLs carry the expected prefix "/darthub/_next/" (checked .next/server/app/game.html).
Successfully built f4e2a8774805
PREFIXED_EXIT=0

$ docker build --target builder -t darthub-prefix-check:root .
Step 14/14 : RUN node scripts/check-asset-prefix.mjs
✓ 17 asset URLs carry the expected prefix "/_next/" (checked .next/server/app/game.html).
Successfully built 93bd23dbab4d
ROOT_EXIT=0
```

Two things follow from it:

- The prefix reached `next build`: the prefixed build's asset URLs carry
  `/darthub/_next/`.
- The gate was **armed**: it compared against `/darthub/_next/`, so it ran with the
  same value the build used. Without the `ENV` the gate would have compared against
  `/_next/` and _failed_ the prefixed build ("The build carries a `/darthub` asset
  prefix, but `BASE_PATH` is not set.") — the successful prefixed build is itself the
  proof that the value reached the gate.

The root build (empty `ARG`) still passes: the gate checks against `/_next/`.

## Container variant verification (package 006, 2026-11-16)

The container variant was verified locally against a running stack. Full evidence in
`006-container-variant-verification.md`; the short version:

| Check                                         | Result                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `BASE_PATH=/darthub docker compose build app` | image built — gate: `✓ 17 asset URLs carry the expected prefix "/darthub/_next/"` |
| gate sees another prefix (`/falsch`)          | **image build fails** (exit 1)                                                    |
| gate sees no prefix (`BASE_PATH=`)            | **image build fails** (exit 1)                                                    |
| build and gate both on `/falsch`              | image build **passes** — the gate is a consistency gate, not a validity gate      |
| root build (no `BASE_PATH`)                   | passes — `✓ 17 asset URLs carry the expected prefix "/_next/"`                    |
| `docker compose up -d`                        | app, postgres and redis up; postgres and redis healthy                            |
| host → published port of the app              | HTTP 200                                                                          |
| host → bridge address `172.18.0.4:3000`       | HTTP 200 — the address is assigned, not fixed                                     |
| listening socket inside the container         | `00000000:0BB8` = `0.0.0.0:3000`, state `0A` (LISTEN)                             |
| asset URLs of the delivered page              | 15 of 15 carry `/darthub/_next/`, none unprefixed                                 |
| routes under the prefix, without a proxy      | HTTP 404 — the proxy has to strip the prefix                                      |

Two corrections came out of it: the bridge address `172.18.0.2` in the runbook is an
**example** (the app got `172.18.0.4`; redis took `172.18.0.2`), and the host port of the
verification had to move to `3200` because port 3000 belongs to the live preview, which was
not touched.

## Progress log

- 2026-11-16 — Paket 006 abgeschlossen: Containervariante **verifiziert** (Image-Build mit
  Prefix, drei Gegenproben am Image-Build, Stack laufend, Bridge-Erreichbarkeit 200,
  Listener `0.0.0.0:3000`, 15/15 Asset-URLs mit Prefix). Doku in `docs/DEPLOYMENT.md`
  („The container variant" + „Verification Status") aktualisiert. Befund: das Gate ist ein
  **Konsistenz-**, kein Gültigkeits-Gate — ein konsistent falscher Prefix lässt den Build
  bestehen; nur Build-und-Gate-Widerspruch scheitert. Die Bridge-Adresse ist dynamisch
  (`172.18.0.4` statt `172.18.0.2`) — in `docs/DEPLOYMENT.md` korrigiert, `AGENTS.md` folgt.
- 2026-11-16 — Korrektur abgeschlossen und committed (`928acc7`): Review-Befunde 2, 3
  und 4–7 behoben (Outage-Absatz topologie-eindeutig, Verdrängung ≠ 502, Tabelle und
  502-Fehlform per Assertion festgenagelt). Befund 1 (`playwright.config.ts:40-45`,
  alte Regel im Kommentar) ist **offen** — die Datei steht in R5 auf der
  Verbotsliste; fertiger Kommentar-Diff liegt in Paket 005.
- 2026-11-16 — Korrektur der Topologie-Annahme (Owner-Entscheidung 2026-11-16): die
  Vorschau bindet `127.0.0.1`; `0.0.0.0` gilt nur für die Container-Topologie.
  `AGENTS.md` (nur Runbook-Abschnitt + Bind-Adressen-Tabelle), `docs/DEPLOYMENT.md`
  und `tests/unit/live-preview.test.ts` angepasst; die Assertion wurde ersetzt und um
  die Container-Regel ergänzt. Beleg: der Test ist gegen den alten Stand (Commit
  `23fb0c2`) rot (2 von 4 Tests) und gegen die Mutation „Container-Regel entfernt"
  ebenfalls rot.
- 2026-11-16 — plan written; the four packages are sequenced because they touch
  overlapping files (the new test reads the Dockerfile and the Compose file).
- 2026-11-16 — all four packages done; the repository gates (typecheck, lint,
  format:check, the full Vitest suite) and two real image builds pass.
