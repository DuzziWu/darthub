# 006 — Containervariante verifizieren (Image-Build, Bridge-Erreichbarkeit, Prefix-Gate)

**Owner:** implementer (Task-Branch `cez/d0144677`)
**Auslöser:** Restpunkt 5 aus dem abgeschlossenen Task „Repo-Fix: BASE_PATH im Docker-Build,
Prefix-Gate scharf, Regressionstest" — die Containervariante war dokumentiert, aber nicht
verifiziert.
**Status:** done

## Kontext

`AGENTS.md` und `docs/DEPLOYMENT.md` nennen zwei Topologien:

| Server                          | `HOSTNAME`  |
| ------------------------------- | ----------- |
| Live preview (Port 3000, Host)  | `127.0.0.1` |
| Container image (Port 3000)     | `0.0.0.0`   |
| Playwright servers (3100, 3111) | `127.0.0.1` |

Die Host-Vorschau ist verifiziert. Die Containervariante war es nicht: der Regressionstest
`tests/unit/live-preview.test.ts` prüft nur Dateiinhalte. Unbelegt war, ob

1. der Prefix als Build-Argument im Image ankommt und das Gate `scripts/check-asset-prefix.mjs`
   mit demselben Wert läuft,
2. ein Build, der seinen Prefix verliert, am **Image-Build** scheitert,
3. der Container in der Bridge-Topologie vom Host erreichbar ist und auf `0.0.0.0` bindet,
4. die ausgelieferte Seite `/darthub/_next/…` trägt.

## Scope

| Datei                                                                        | Änderung                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/DEPLOYMENT.md`                                                         | Abschnitt „The container variant" + „Verification Status". |
| `.opencode/plans/deployment-base-path/006-container-variant-verification.md` | dieses Paket.                                              |
| `.opencode/plans/deployment-base-path/_plan.md`                              | Paket 006 in der Task-Tabelle, Status, Progress log.       |

**Nicht anfassen:** `src/**`, `app/**`, `next.config.ts`, `prisma/**`, `playwright.config.ts`,
`package.json`, `.dockerignore`, `scripts/check-asset-prefix.mjs`, `e2e/**`, `Dockerfile`,
`docker-compose.yml`, `tests/**`, `AGENTS.md`.

Die **Gegenproben** liefen gegen temporäre Kopien des `Dockerfile` ausserhalb des
Repositories (`$TMP/Dockerfile.wrong-prefix`, `$TMP/Dockerfile.disarmed-gate`) — die echten
Dateien blieben unangetastet (`git status --short Dockerfile` → leer).

## Acceptance criteria

- **R7** Der Image-Build mit `BASE_PATH=/darthub` ist mit echtem `docker compose build app`
  gefahren, und das Gate im selben Build meldet den Prefix `/darthub`.
- **R8** Gegenproben: ein Build, dessen Gate einen **anderen** Prefix sieht, und ein Build,
  dessen Gate **gar keinen** Prefix sieht, lassen den **Image-Build scheitern** (Exit ≠ 0).
  Zusätzlich: der Root-Build (ohne `BASE_PATH`) besteht weiterhin.
- **R9** Der laufende Container ist vom Host **über die Bridge-Adresse** erreichbar (HTTP 200)
  und bindet im Container `0.0.0.0:3000` (Socket `00000000:0BB8`, Zustand `LISTEN`).
- **R10** Die ausgelieferte Seite trägt den Prefix in **allen** Asset-URLs.
- **R11** Kein Eingriff in die laufende Vorschau, kein Publish/Deploy, kein `down -v` an
  fremden Daten.
- **R12** `docs/DEPLOYMENT.md` und `_plan.md` halten das Ergebnis (verifiziert oder blockiert)
  mit Belegen fest.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test -- tests/unit/live-preview.test.ts tests/unit/docker-prefix.test.ts
```

## Result

### 1 — Image-Build mit Prefix (R7)

```
$ cd <worktree>
$ BASE_PATH=/darthub docker compose --env-file <env> build app
…
#16 [app builder 7/7] RUN node scripts/check-asset-prefix.mjs
#16 1.464 ✓ 17 asset URLs carry the expected prefix "/darthub/_next/" (checked .next/server/app/game.html).
#16 DONE 1.5s
…
 app  Built
```

Der Prefix ist damit im Image angekommen **und** das Gate hat mit demselben Wert gelaufen —
hätte das Gate einen anderen Wert gesehen, wäre der Build an dieser Stelle gescheitert
(Gegenprobe 2 unten).

### 2 — Gegenproben (R8)

Alle vier Zeilen sind echte Image-Builds (Legacy-Builder, weil `docker buildx` auf dieser
Maschine nicht installiert ist — `docker buildx version` → `unknown command`).

| #   | Build-Prefix      | Gate-Aufruf                                             | Ergebnis                                                                   |
| --- | ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `/darthub`        | `node scripts/check-asset-prefix.mjs`                   | **Exit 0** — `✓ 17 asset URLs carry the expected prefix "/darthub/_next/"` |
| 2   | `/darthub`        | `BASE_PATH=/falsch node …`                              | **Exit 1** — der Image-Build scheitert                                     |
| 3   | `/darthub`        | `BASE_PATH= node …`                                     | **Exit 1** — der Image-Build scheitert                                     |
| 4   | `/falsch`         | `node scripts/check-asset-prefix.mjs` (sieht `/falsch`) | **Exit 0** — der Image-Build besteht                                       |
| 5   | ohne (`ARG` leer) | `node scripts/check-asset-prefix.mjs`                   | **Exit 0** — `✓ 17 asset URLs carry the expected prefix "/_next/"`         |

Gegenprobe 2 (falscher Prefix am Gate):

```
Step 14/27 : RUN BASE_PATH=/falsch node scripts/check-asset-prefix.mjs
✗ The build is published under the prefix "/falsch", but 17 of 17 asset URLs carry no prefix:
    href="/darthub/_next/static/media/066ba92c8fc1c222-s.p.3lj349bs9hfu1.woff2"
    …
  The proxy strips the prefix from the path, so those requests find no mount and answer 404: the page arrives unstyled and unhydrated.
The command '/bin/sh -c BASE_PATH=/falsch node scripts/check-asset-prefix.mjs' returned a non-zero code: 1
COUNTERCHECK_WRONG_PREFIX_EXIT=1
```

Gegenprobe 3 (entwaffnetes Gate, `BASE_PATH` leer):

```
Step 14/27 : RUN BASE_PATH= node scripts/check-asset-prefix.mjs
✗ The build carries a "/darthub" asset prefix, but BASE_PATH is not set. The prefix in the build and the prefix in the proxy's mount point must be the same.
The command '/bin/sh -c BASE_PATH= node scripts/check-asset-prefix.mjs' returned a non-zero code: 1
COUNTERCHECK_DISARMED_EXIT=1
```

**Befund zur Auftragsannahme:** das Gate ist ein **Konsistenz-**, kein **Gültigkeits-Gate**.
Zeile 4 zeigt es empirisch: ein _falscher_ Prefix, der im Build **und** im Gate konsistent
ist, lässt den Image-Build **nicht** scheitern. Das Gate kann nicht wissen, welcher Prefix
der gemeinte ist — das weiss nur der Mount-Punkt des Proxys. Gefangen wird genau der Fehler,
der die Seite zerstört: Build und Gate widersprechen sich.

### 3 — Stack und Erreichbarkeit (R9)

```
$ docker compose --env-file <env> -f docker-compose.yml -f <override> up -d --no-build
 Container darthub-postgres-1  Started
 Container darthub-redis-1     Started
 Container darthub-app-1       Started
UP_EXIT=0

$ docker compose ps
NAME                 IMAGE                STATUS                   PORTS
darthub-app-1        darthub-app          Up                       0.0.0.0:3200->3000/tcp, [::]:3200->3000/tcp
darthub-postgres-1   postgres:16-alpine   Up (healthy)             5432/tcp
darthub-redis-1      redis:7-alpine       Up (healthy)             6379/tcp
```

```
$ APP_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' darthub-app-1)
$ echo $APP_IP
172.18.0.4

# 1) Host -> veroeffentlichter Port
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/
200
# 2) Host -> BRIDGE-Adresse (der Proxy-Pfad)
$ curl -s -o /dev/null -w '%{http_code}\n' http://172.18.0.4:3000/
200
# 3) im Container auf Loopback
$ docker exec darthub-app-1 wget -qO- -T 10 http://127.0.0.1:3000/ > /dev/null && echo 200
200
# 4) Listener-Socket im Container (0BB8 = 3000, 0A = LISTEN)
$ docker exec darthub-app-1 cat /proc/net/tcp | awk '$2 ~ /:0BB8$/ {print}'
0: 00000000:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1001  0 16792641 1 0000000000000000 100 0 0 10 0
```

`00000000:0BB8` ist `0.0.0.0:3000` — der Listener bindet **jedes** Interface, wie es die
Container-Topologie verlangt. Eine Loopback-Bindung wäre `0100007F:0BB8` und die Fehlerform,
die zum 502 führt.

**Abweichung von der Auftragsbeschreibung (mit Grund):**

- Der Auftrag nennt `curl` von `127.0.0.1:3000`. Port 3000 ist auf dieser Maschine von der
  **Live-Vorschau** belegt (`ss -ltnp` → `127.0.0.1:3000 users:(("next-server (v16.4.5)",pid=814916,fd=21))`).
  Der Auftrag verbietet jeden Eingriff in die laufende Vorschau, also wurde der
  **Host-Port** der Verifikation auf `3200` gelegt (`!override` in einer Override-Datei
  ausserhalb des Repos). Der Container-Port und die Bridge-Adresse sind unverändert; die
  Aussage des Checks — „der Host erreicht den Container" — bleibt identisch.
- Die Bridge-Adresse war **`172.18.0.4`**, nicht `172.18.0.2`: das Netz `darthub_default`
  (`172.18.0.0/16`) vergibt die Adressen in Startreihenfolge, und `redis` bekam `172.18.0.2`,
  `postgres` `172.18.0.3`. Die in `AGENTS.md` und `docs/DEPLOYMENT.md` genannte Adresse
  `172.18.0.2` ist damit ein **Beispiel, keine Konstante** — in `docs/DEPLOYMENT.md`
  korrigiert (Adresse mit `docker inspect` auslesen).
- `postgres`/`redis` publishes keine Host-Ports mehr, weil der Host bereits ein
  PostgreSQL (5432) und ein Redis (6379) betreibt. Für die Erreichbarkeit des App-Containers
  ist das ohne Bedeutung — der App spricht die Dienste über das Compose-Netz an.

### 4 — Asset-URLs der ausgelieferten Seite (R10)

```
$ curl -s http://172.18.0.4:3000/ -o /tmp/page.html -w '%{http_code} %{size_download}\n'
200 45499

gesamt:     15
mit Prefix: 15   (href="/darthub/_next/static/chunks/1mm5xdtm9xssx.css", src="/darthub/_next/static/chunks/0cz1d0mv5g_q7.js", …)
ohne Prefix: 0
```

Zusatzbefunde:

```
$ curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://172.18.0.4:3000/darthub/_next/static/chunks/1mm5xdtm9xssx.css
200 text/css; charset=UTF-8
$ curl -s -o /dev/null -w '%{http_code}\n' http://172.18.0.4:3000/_next/static/chunks/nicht-da.css
404
$ for p in / /game /darthub /darthub/game; do curl -s -o /dev/null -w "$p -> %{http_code}\n" http://172.18.0.4:3000$p; done
/ -> 200
/game -> 200
/darthub -> 404
/darthub/game -> 404
```

Der Container liefert die Assets auch unter dem Prefix aus (Next.js-`assetPrefix`), die
**Routen** aber nicht: `/darthub/game` ist 404. Der Proxy muss den Prefix also strippen —
genau die dokumentierte Regel.

### 5 — Doku (R12)

- `docs/DEPLOYMENT.md`, Abschnitt „The container variant": ergänzt um
  - „The bridge address is assigned, not fixed" (Adresse dynamisch, mit `docker inspect`),
  - „What the container listens on" (`/proc/net/tcp`, `00000000:0BB8` vs. `0100007F:0BB8`),
  - „Verified on 2026-11-16" (Prüftabelle),
  - die gemessene Gate-Matrix (inklusive der Aussage: Konsistenz-Gate, kein Gültigkeits-Gate).
- `docs/DEPLOYMENT.md`, Abschnitt „Verification Status": von „deferred" auf eine Status-Tabelle
  umgestellt (verifiziert am 2026-11-16; der Clean-Room-Lauf auf einem VPS bleibt offen).
- `_plan.md`: Paket 006 in der Task-Tabelle, Status, Progress log.

### Verifikation

```text
npm run typecheck    → exit 0
npm run lint         → exit 0
npm run format:check → "All matched files use Prettier code style!"  (exit 0)
npm run test -- tests/unit/live-preview.test.ts tests/unit/docker-prefix.test.ts
                    → Test Files 2 passed (2) | Tests 9 passed (9) | exit 0
npm run test         → Test Files 109 passed (109) | Tests 606 passed | 1 skipped (607) | exit 0
                      (Dauer 780.70 s)
```

### Aufräumen

- `docker compose down` (ohne `-v`) für den Verifikations-Stack; die beiden von diesem Lauf
  angelegten Volumes (`darthub_postgres-data`, `darthub_redis-data`) wurden entfernt, weil sie
  ausschliesslich von diesem Lauf erzeugt wurden und keine fremden Daten enthielten.
- Die Gegenprobe-Images (`darthub-verify:*`) wurden entfernt; das Verifikations-Image
  `darthub-app:latest` bleibt als Artefakt des dokumentierten Build-Befehls stehen.
- Die laufende Vorschau (pid 814916) wurde nicht angefasst — `ss -ltnp` nach dem Lauf
  unverändert.

### Offene Punkte (nicht in diesem Paket)

- `AGENTS.md` nennt die Bridge-Adresse weiterhin als `172.18.0.2` und ohne den Hinweis, dass
  sie dynamisch vergeben wird. Die Datei gehört dem Architect-Agenten; die Korrektur ist
  identisch mit dem Abschnitt „The bridge address is assigned, not fixed" in
  `docs/DEPLOYMENT.md`.
- `playwright.config.ts:40-45` kommentiert noch die alte Regel (aus Paket 005) — unverändert,
  die Datei steht auf der Verbotsliste.
