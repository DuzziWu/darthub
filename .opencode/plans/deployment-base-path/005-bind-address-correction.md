# 005 — Bind-Adresse der Vorschau: Host-Loopback statt 0.0.0.0

**Owner:** implementer (Task-Branch `cez/<runId>`)
**Auslöser:** Owner-Entscheidung 2026-11-16 (nach dem Start des Runs)
**Status:** done

## Kontext

Der Owner hat die Topologie-Annahme aus dem laufenden Betrieb korrigiert: Die
veröffentlichte Vorschau läuft jetzt als **Host-Prozess** mit **Bind-Adresse
`127.0.0.1`** — nicht `0.0.0.0`. Der Umstieg ist abgeschlossen und verifiziert:

```bash
setsid -f env HOSTNAME=127.0.0.1 PORT=3000 node .next-prefixed/standalone/server.js
# tailscale serve status:
# |-- /darthub proxy http://127.0.0.1:3000
```

Verifiziert am laufenden System:

```
$ ss -ltnp | grep :3000
LISTEN 0 511 127.0.0.1:3000 0.0.0.0:* users:(("next-server (v1",pid=814916,fd=21))
```

Die frühere Regel („`HOSTNAME=0.0.0.0`") galt für die **Container-Topologie**: dort
läuft der Proxy auf dem Host und erreicht den Container über die Bridge-Adresse
`172.18.0.2:3000`; ein nur an Loopback gebundener Container verweigert diese
Verbindung. Auf dem Host ist die **Loopback-Bindung die richtige und sichere Wahl**:
der Proxy läuft auf demselben Rechner, der Mount zeigt auf `127.0.0.1:3000` — und
nichts auf Tailnet oder LAN erreicht die Vorschau.

## Scope

| Datei                             | Änderung                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                       | Nur der Runbook-Abschnitt „Serving the live preview" und die Tabelle der Bind-Adressen.                                                                             |
| `docs/DEPLOYMENT.md`              | Live-Preview-Abschnitt und der Abschnitt zur Bind-Adresse.                                                                                                          |
| `tests/unit/live-preview.test.ts` | Assertion von `HOSTNAME=0.0.0.0 PORT=3000` auf `HOSTNAME=127.0.0.1 PORT=3000` umgestellt (ersetzen, **nicht** löschen), Container-Variante zusätzlich festgenagelt. |

**Nicht anfassen:** `src/**`, `app/**`, `next.config.ts`, `prisma/**`,
`playwright.config.ts`, `package.json`, `.dockerignore`,
`scripts/check-asset-prefix.mjs`, `e2e/**`, `Dockerfile`, `docker-compose.yml`.

**Merge-Sicherheit:** `AGENTS.md` wird parallel von Task `e4416a2a` (Doku-Catch-up)
im Abschnitt „Environment setup notes" und in der Ownership-Tabelle editiert. Dieser
Task fasst **ausschließlich** den Runbook-Abschnitt „Serving the live preview" und
die Bind-Adressen-Tabelle an — die Environment-Zahlen und die Ownership-Tabelle
bleiben unberührt, damit die Zusammenführung konfliktfrei bleibt.

## Acceptance criteria

- **R4a** `AGENTS.md` und `docs/DEPLOYMENT.md` nennen für die Vorschau
  `HOSTNAME=127.0.0.1 PORT=3000` und begründen, warum Loopback hier richtig und sicher
  ist.
- **R4b** Die `0.0.0.0`-Regel bleibt für die **Container-Topologie** erhalten
  (Runner-Stage, `172.18.0.2:3000`, `curl`-Check) — mit der Begründung, dass der Proxy
  den Container über die Bridge erreicht.
- **R4c** Die Schutzwirkung bleibt vollständig erhalten:
  - Port 3000 gehört der Vorschau allein, die E2E-Suite nutzt **3100/3111**,
  - die **502-Fehlform** („Seite für alle kaputt, alle lokalen Checks grün") bleibt
    dokumentiert,
  - Rebuild invalidiert den laufenden Server → PID statt `pkill`,
  - der Proxy strippt den Prefix.
- **R4d** `tests/unit/live-preview.test.ts` nagelt **beide** Topologien fest:
  `HOSTNAME=127.0.0.1 PORT=3000` für die Vorschau **und** `HOSTNAME=0.0.0.0` für die
  Containervariante; keine Assertion wurde gelöscht, eine wurde ersetzt.
- **R4e** Der Test ist gegen den alten (falschen) Stand rot — Beleg mit echter
  Ausgabe.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
```

Zusätzlich: der Test muss mit simuliertem Altstand rot werden (Beleg).

## Result

### Geänderte Dateien

| Datei                                                                 | Änderung                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `AGENTS.md`                                                           | Nur § „Serving the live preview" + Bind-Adressen-Tabelle.                   |
| `docs/DEPLOYMENT.md`                                                  | Live-Preview-Abschnitt + Abschnitt „The bind address follows the topology". |
| `tests/unit/live-preview.test.ts`                                     | Assertion ersetzt (nicht gelöscht), Container-Regel ergänzt.                |
| `.opencode/plans/deployment-base-path/004-runbook.md`                 | Vermerk „superseded by 005".                                                |
| `.opencode/plans/deployment-base-path/_plan.md`                       | R6 als Acceptance criterion, Status, Progress log.                          |
| `.opencode/plans/deployment-base-path/005-bind-address-correction.md` | dieses Paket.                                                               |

### Vorher / Nachher (wörtlich)

**`AGENTS.md`, Startbefehl der Vorschau**

```diff
-setsid -f env HOSTNAME=0.0.0.0 PORT=3000 node .next-prefixed/standalone/server.js
+setsid -f env HOSTNAME=127.0.0.1 PORT=3000 node .next-prefixed/standalone/server.js
```

Neu direkt darunter:

> The server binds the **loopback address**, because the proxy that forwards to it runs
> on the same host and the mount points at `http://127.0.0.1:3000`. Loopback is the
> correct and the safe choice in this topology: the published site reaches the server,
> and nothing else on the tailnet or in the LAN does. `0.0.0.0` belongs to the
> container topology — see "The container variant" below.

**`AGENTS.md`, Bind-Adressen-Tabelle** — die Zeile „Live preview" ist von `0.0.0.0`
auf `127.0.0.1` umgestellt, und die **Container-Zeile ist neu**:

| Server                          | `HOSTNAME`  | neu?            |
| ------------------------------- | ----------- | --------------- |
| Live preview (port 3000)        | `127.0.0.1` | geändert        |
| Container image (port 3000)     | `0.0.0.0`   | **neu**         |
| Playwright servers (3100, 3111) | `127.0.0.1` | Text präzisiert |

**`docs/DEPLOYMENT.md`**: `HOSTNAME=0.0.0.0 PORT=3000` → `HOSTNAME=127.0.0.1 PORT=3000`
(Zeile 199); der Abschnitt „### The server must listen on every interface" heißt jetzt
„### The bind address follows the topology" und nennt beide Topologien in einer
Tabelle.

**`tests/unit/live-preview.test.ts`** — die Assertion wurde **ersetzt**, nicht gelöscht:

```diff
-    expect(agents).toContain("HOSTNAME=0.0.0.0 PORT=3000");
+    expect(agents).toMatch(
+      /setsid -f env HOSTNAME=127\.0\.0\.1 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
+    );
+    expect(agents).not.toMatch(
+      /setsid -f env HOSTNAME=0\.0\.0\.0 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
+    );
```

in der Container-Variante **ergänzt** und die Tabelle festgenagelt:

```diff
      expect(agents).toMatch(/172\.18\.0\.2/);
      expect(agents).toContain("BASE_PATH=/darthub");
+    expect(agents).toContain("HOSTNAME=0.0.0.0");
+    expect(agents).toMatch(/\|\s*Live preview \(port 3000\)\s*\|\s*`127\.0\.0\.1`/);
+    expect(agents).toMatch(/\|\s*Container image \(port 3000\)\s*\|\s*`0\.0\.0\.0`/);
```

Dazu in beiden Dateien: die 502-**Fehlform** statt nur des Wortes (`502 Bad Gateway`
plus „broken for every user while every local health check passes"), die
Port-Reservierung als Satz (`port 3000 belongs to the live preview alone` /
`port 3000 is reserved for the published app alone`) und `3100`/`3111` zusammen.

### Review (code-reviewer, unabhängig, read-only)

Verdikt: **APPROVE_WITH_COMMENTS** — kein CRITICAL, kein HIGH; die Prämisse wurde vom
Reviewer live verifiziert (`ss -ltnp` → `127.0.0.1:3000`, `tailscale serve status` →
`/darthub proxy http://127.0.0.1:3000`, öffentliche URL → 200).

| #          | Befund                                                                                                                          | Disposition                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (MEDIUM) | `playwright.config.ts:40-45` kommentiert noch die alte Regel („bound to 0.0.0.0 … leave the published site answering 502")      | **offen, nicht angefasst** — `playwright.config.ts` steht in R5 auf der Verbotsliste und war nicht Teil des Owner-Auftrags. Fertiger Ersatztext liegt im Bericht vor.                |
| 2 (MEDIUM) | Der Absatz zum Ausfall vom 2026-11-14 mischte die Topologien (Verweigerung und „200 auf Loopback" galten für den **Container**) | **behoben** — der Absatz nennt jetzt den Bridge-Pfad `172.18.0.2:3000` und die E2E-Konvention, belegt an der Incident-Record (`.claude/plans/incident-502-recovery/001-diagnose.md`) |
| 3 (MEDIUM) | `docs/DEPLOYMENT.md` schrieb die 502 einer Portverdrängung zu — im Host-Topologie trifft das nicht zu                           | **behoben** — die Verdrängung liefert jetzt „der falsche Build ohne Prefix", die 502 bleibt der Listener-Fall aus der Container-Zeile                                                |
| 4 (LOW)    | Die Bind-Adressen-Tabelle war von keiner Assertion erfasst                                                                      | **behoben** — beide Zeilen werden per Regex festgenagelt                                                                                                                             |
| 5 (LOW)    | „502" war nur als Wort geprüft, nicht die Fehlform                                                                              | **behoben** — `502 Bad Gateway` + „broken for every user while every local health check passes"                                                                                      |
| 6 (LOW)    | Die Port-Assertions waren freistehende Ziffern                                                                                  | **behoben** — `PORT=3100\b` in der Config, `3100\D+3111` plus der Reservierungssatz in den Doku-Assertions                                                                           |
| 7 (LOW)    | Der Docblock des Tests wiederholte die vermischte Outage-Story                                                                  | **behoben** — der Docblock nennt jetzt den Bridge-Pfad                                                                                                                               |
| 8 (LOW)    | Paket 005 hatte keinen Result-Abschnitt                                                                                         | **behoben** (dieser Abschnitt)                                                                                                                                                       |

### Beleg: der Test ist gegen den alten Stand rot

Der Test liest `AGENTS.md` und `docs/DEPLOYMENT.md` relativ zu `process.cwd()`. Der
Altstand (Commit `23fb0c2`) wurde in ein temporäres Verzeichnis gelegt und der
**aktuelle** Test dagegen laufen gelassen:

```
$ cd <tmp>/oldstate && npx vitest run --root <worktree> tests/unit/live-preview.test.ts
 × documents the published server's bind address and the 502 failure form
 × records the port reservation in the deployment guide
AssertionError: expected '<!-- BEGIN:nextjs-agent-rules -->\n\n…' to match /setsid -f env HOSTNAME=127…/standalone\
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

Die Gegenprobe — die Container-Regel entfernt, alles andere korrekt:

```
 × keeps the container variant documented as an alternative
 × records the port reservation in the deployment guide
AssertionError: expected '<!-- BEGIN:nextjs-agent-rules -->\n\n…' to contain 'HOSTNAME=0.0.0.0'
 Tests  2 failed | 2 passed (4)
```

Und die dritte Mutation — nur die Tabellenzeile der Vorschau kippt, der Startbefehl
bleibt richtig:

```
 × documents the published server's bind address and the 502 failure form
 × records the port reservation in the deployment guide
AssertionError: expected '<!-- BEGIN:nextjs-agent-rules -->\n\n…' to match /\|\s*Live preview \(port 3000\)\s*\|\…/
 Tests  2 failed | 2 passed (4)
```

Alle drei Richtungen haben Zähne: die alte Topologie, ein Verlust der Container-Regel
und ein Auseinanderlaufen von Tabelle und Startbefehl fallen auf.

### Verifikation

```text
npm run typecheck    → exit 0
npm run lint         → exit 0
npm run format:check → "All matched files use Prettier code style!"
npm run test         → Test Files 108 passed (108) | Tests 550 passed (550) | EXIT=0
```

Der Lauf umfasste die **komplette** Suite inklusive `tests/unit/dockerignore.test.ts`
(dauer 1903 s — der Docker-Daemon war durch die Builds der Nachbar-Tasks
kontendiert).

### Offene Punkte

- **`playwright.config.ts:40-45`** widerspricht der korrigierten Regel noch. Die Datei
  steht in R5 auf der Verbotsliste und war nicht Teil des Owner-Auftrags, deshalb
  wurde sie **nicht** angefasst. Vorschlag (nur Kommentar, kein Verhaltenswechsel):

  ```diff
  -  // The root server listens on 3100, not on 3000. Port 3000 belongs to the
  -  // live preview (see AGENTS.md, "Serving the live preview"), which serves the
  -  // *prefixed* build bound to 0.0.0.0 so the host-side Tailscale Serve proxy
  -  // can reach it. With `reuseExistingServer` the suite reuses whatever already
  -  // listens on the port, so a root build on 3000 would silently displace the
  -  // live preview and leave the published site answering 502.
  +  // The root server listens on 3100, not on 3000. Port 3000 belongs to the
  +  // live preview (see AGENTS.md, "Serving the live preview"), which serves the
  +  // *prefixed* build bound to 127.0.0.1 — the mount points at
  +  // http://127.0.0.1:3000 on this host. With `reuseExistingServer` the suite
  +  // reuses whatever already listens on the port, so a root build on 3000 would
  +  // silently displace the live preview and the published site would serve a
  +  // build without the path prefix.
  ```

- Die **Container-Variante** bleibt im Runbook als dokumentierte Alternative — sie ist
  nicht verifiziert worden, weil das die einzige Topologie ist, die der Owner nicht
  betreibt. Ihre Regel (`0.0.0.0` im Runner-Stage, `172.18.0.2:3000`) ist unverändert
  aus dem bestehenden Stand übernommen.
- `AGENTS.md` wird parallel von Task `e4416a2a` editiert (Abschnitt „Environment
  setup notes" und Ownership-Tabelle). Dieser Task fasst **nur** den Runbook-Abschnitt
  und die Bind-Adressen-Tabelle an — die Zusammenführung sollte konfliktfrei bleiben.
