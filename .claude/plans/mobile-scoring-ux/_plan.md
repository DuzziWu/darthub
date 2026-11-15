# Plan: Mobile Scoring UX — Eingabemodi, Spieleranzeige, Spielstand

## Created
2026-11-15

## Status
implemented — WP-1 to WP-8 done.

Verified on 2026-11-15: `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test` (105 files / 526 tests), `npm run build`, `npm run build:prefixed` and
`npx playwright test` (70 passed, 7 skipped) are green. The measured geometry at
390×844 matches the success criteria; see the DevFlow task DF-0004 and its handoff
`.devflow/memory/handoffs/DF-0004-2026-11-15T09-40-00-000Z-devflow-orchestrator-openhands.md`.

Two deviations from the plan, both measured and recorded in the handoff:

- The board preview's well is `max-w-[310px]` (300 px of painted diameter plus
  padding and borders, as `board.md` §8.3 prescribes) instead of the 358 px it
  measured before. The live board keeps 400 px — there it is an input.
- The board preview is the **last** block of the phone order, not the second. The
  fixed tab bar (`z-40`, 64 px) owns the viewport rows 780–844, and a block whose
  centre lands there is not clickable; the preview has to sit below the fold.

**Review (WP-8).** The diff was reviewed line by line against the criteria above and
re-measured in the browser. No Critical or Major finding. The contracts hold at 390×844
with one and with four players: exactly one `Current visit` list, exactly one button
named exactly "Undo", exactly one "3× Treble" radio, no horizontal overflow, the miss
key ends at 629 px, the board starts at 344 px, the overview is visible from y=123,
`data-score` stays exclusive to `ScoreDisplay`, and the band switch is rendered once.
The engine imports no UI and no browser globals, and the rules, the five modes, the
checkout behaviour and the correction flow are unchanged.

Three points that were checked because they looked risky, and that turned out to be
correct by design rather than by accident:

- **The pad disappears in the board mode, so the "Miss" key disappears with it.** The
  board is its own miss surface: a tap outside the painted circle resolves to a miss
  (`resolveBoardHit` → `hit: false`), and the tap was measured to register ("MISS"
  in the turn tracker). The keyboard route has the same reach through the board's
  62 `data-cell` buttons.
- **The correction in the board mode has no value pad to type into.** The board is
  that pad: the armed dart is replaced by the next tap on the board. Measured:
  S3 → S1, remaining 298 → 300.
- **Cricket has no `data-remaining` marker.** Cricket has no score column — the
  closed targets are the score, and the overview counts them ("0 / 7 closed"). The
  marker is absent on purpose and the unit test pins it.

## Objective
Auf dem verbindlichen Viewport **390×844** die Spielansicht aller fünf Modi so umbauen, dass

1. die Eingabemodi **Board** und **Manual** klar getrennt sind und jeweils nur eine Eingabefläche existiert,
2. die Spielerliste, der aktive Spieler und der Restpunktestand sofort erkennbar sind,
3. Undo und die Korrektur falsch eingegebener Würfe zuverlässig und an erreichbarer Stelle bleiben,
4. die bestehende `GameEngine`-Logik unverändert weiterverwendet wird.

## Related Issues
- GitHub #6 — Integration und Regressionstests für Undo/Wurfkorrektur und mobile Scoring-UX über alle fünf Spielmodi.
- GitHub #2 — Wurfkorrektur (Unterbau von WP-3; keine Änderung an der Engine).

---

## Discovery Notes

Gezielte Analyse der Spiel-UI, der Engine und der bestehenden Tests — **kein** Vollrepo-Scan. Alle Messungen gegen den laufenden Live-Preview (Port 3000, Build `.next-prefixed/standalone`) und die echte `GameEngine`.

### Der Ist-Zustand, gemessen bei 390×844 auf `/game/301`

| Element | manuell | Board-Modus |
| --- | --- | --- |
| App-Header | 0–56 | 0–56 |
| `MATCH_STRIP` (sticky `top-14`) | 56–167 (**h = 111**, drei Zeilen) | 56–167 (h = 111) |
| Dart-Pad | 199–575 (h = 376) | 199–575 (**h = 376 — weiterhin im DOM**) |
| Dartboard | 591–949 (h = 358, `aria-hidden="true"`, 0 Buttons) | 591–949 (h = 358, **62 Buttons**) |
| ScoreSheet | 987–1061 | 987–1061 |
| `docHeight` | 1184 | 1162 |
| `overflowX` | 0 | 0 |

Die **Pad-Oberkante bei 199 px** und der **ScoreSheet bei 987 px** sind die beiden Defekte:

- **Problem A — Board und Manual sind nicht getrennt.** `MatchLayout` rendert im Board-Modus **beides**: das Pad (`input`-Prop) *und* das Board. Auf 390 px füllt das Pad allein 376 px; das Board beginnt erst bei y = 591 und ist damit praktisch unterhalb der Falz. Der Spieler tippt ein Board an, das er nicht sieht.
- **Problem B — die Spielerübersicht ist unter der Falz.** Das ScoreSheet liegt bei y = 987. Der Restpunktestand ist damit erst nach dem Scrollen sichtbar — auf einem Telefon, das man mit einer Hand hält, ist das der wichtigste Wert überhaupt.
- **Problem C — Undo liegt 900 px vom Fehler entfernt.** Der Undo-Button steckt im `MATCH_STRIP`, 111 px hoch und sticky, oben auf der Seite. Der Fehler passiert aber unten, am Pad.

### Der vierte Befund, den die Messung erst zutage förderte

Nach drei Würfen wechselt der Spieler — die **Wurfübersicht setzt sich aber nicht zurück**:

```
nach 3 Würfen (2 Spieler):
  [data-row=player1] → "Alice S20 S20 S20 241"
  [data-row=player2] → "Bob ON TURN 301"      ← Bob ist am Zug
  Current-visit-Liste → ["S20", "S20", "S20"] ← das sind *Alices* Würfe
```

`useMatchHistory` nimmt `visits.at(-1)` (`useMatchHistory.ts:30`). `deriveVisitIndexes` (`src/game-engine/throwLedger.ts:29-35`) beendet einen Visit nach drei gezählten Würfen **nicht** — der Visit läuft über den Spielerwechsel hinweg weiter. Die Anzeige zeigt also die Würfe des *vorherigen* Spielers, während der *aktuelle* Spieler bereits am Zug ist. Das ist genau die Anforderung „nach einem Spielerwechsel die Wurfübersicht korrekt zurücksetzen".

### Die Engine ist bereits die richtige Quelle

`GameEngine` hält das Ledger aller Würfe und leitet den Spielzustand daraus durch Replay ab. `undoLastThrow()` und `correctThrow()` sind die einzigen Schreibpfade. Für die UI heißt das:

- **Keine parallele Undo-Implementierung.** Der Undo bleibt `engine.undoLastThrow()`.
- **Keine Frontend-Buchhaltung.** Die Wurfübersicht ist eine *Ableitung* aus dem Ledger.
- **Die Visit-Grenze ist nicht die Turn-Grenze.** `getVisits()` gruppiert nach Besuch (Ein-Ball-Gruppen, ein Bust schließt den Besuch). Für „welche Würfe gehören zu *meinem* laufenden Zug" braucht es eine eigene, ebenfalls reine Ableitung.

### Das Designsystem sagt, wie die Übersicht auszusehen hat

`design-system/darthub/pages/match.md` §4 und §8:

- §4: „**No cards. No rounded boxes. No colour wash per player.** The sheet is ruled rows on the page ground."
- §4: Aktiver Spieler = 2 px Messing-Rail **plus** sichtbares **„ON TURN"** — Farbe nie allein.
- §4: Die Score-Figur ist `font-mono` `text-score-xl` `tabular-nums` `min-w-[3ch]` — **feste Ziffernspalte**, damit die Zahl beim Wechsel nicht springt.
- §5: Die Spaltenüberschrift ist **modusabhängig**: `REMAINING` (x01), `HIT` (ATC), `MARKS` (Shanghai), bei Cricket **keine** Score-Spalte.
- §8 (390 px): „throw strip (compact) → **the active player's score card (promoted)** → **the other players' rows** → the status line → the **pad** → the board preview."

Das Designsystem verlangt also **beides**: eine prominente Karte *und* die restlichen Reihen. Es verbietet aber das Karten-Raster als *Ausweg* — der aktive Spieler ist eine hervorgehobene **Zeile**, keine Kachel-Sammlung.

### Die Grenzen, die die bestehenden Tests ziehen

Gemessen am laufenden Stand, nicht geraten:

| Vertrag | Wo | Konsequenz |
| --- | --- | --- |
| Genau **eine** Liste mit `aria-label="Current visit"` | `e2e/score-entry.spec.ts:29` | Die neue Wurfübersicht muss dieses `aria-label` behalten und **in beiden Eingabemodi** rendern. |
| Genau **ein** Button mit dem Namen „Undo" | `e2e/score-entry.spec.ts:37` (`/^undo$/i`), `tests/unit/game/undoAcrossModes.test.tsx` (`getByRole("button", { name: /undo/i })`) | **Zwei** Undo-Buttons brechen beide Tests. Es darf nur **einen** geben — mit dem exakten Namen „Undo". |
| Dart-Chips heißen `Dart N: S20` | `e2e/score-entry.spec.ts:57`, `tests/unit/game/ThrowHistoryControls.test.tsx` | Der Korrekturweg (`selectThrow`) muss bestehen bleiben. |
| `[data-score]` ist eindeutig | `e2e/score-entry.spec.ts:75` (`.first()`) | Das neue Scoreboard darf **kein** `data-score` führen; `data-score` bleibt exklusiv im bestehenden `ScoreDisplay`. |
| Miss-Key endet ≤ 779 px | `e2e/score-entry.spec.ts:117` | Der Miss-Key darf nicht unter die Tab-Bar (844 − 64 = 780) rutschen. |
| Board beginnt < 844 px | `e2e/score-entry.spec.ts:123` | Nur der **Start** muss im Falz liegen. |
| Genau **ein** sichtbares Radio „3× Treble" | `e2e/score-entry.spec.ts:126` | Zwei Band-Schalter mit demselben Namen brechen den Test (Playwright Strict Mode). |
| Genau **eine** Segment-Radiogroup | `e2e/visual-qc.spec.ts` („keyboard route") | Der Band-Schalter darf nicht doppelt sichtbar sein. |
| Board im manuellen Modus bleibt im DOM (`aria-hidden="true"`, 0 Buttons) | `e2e/visual-qc.spec.ts` („read-only preview") | „Aus dem DOM entfernen" gilt für das **Pad im Board-Modus**, nicht für das Board im manuellen Modus. |
| `data-score`, `data-row`, „ON TURN", `min-w-[3ch]`, `font-mono`, `tabular-nums`, „Leg 2/5", „Set 1/3" | `tests/unit/game/scoreDisplay.test.tsx` | Der bestehende `ScoreDisplay` bleibt unverändert renderbar. |

### Der Basisstand, gegen den gemessen wird

`npm run test` → **102 Testdateien, 494 Tests, alle grün** (gemessen am 2026-11-15, Commit `85d4424`). `npm run typecheck`, `npm run lint` und `npm run format:check` sind ebenfalls grün.

Zwei Tests skippen umgebungsbedingt und gelten **nicht** als Regression: `tests/unit/dockerignore.test.ts` (kein Docker-Daemon) und `tests/unit/tailwind/tailwindToolchain.test.ts` (kein Production-Build in `.next/`).

---

## Scope

### In Scope

- **WP-1** — Ableitung des laufenden Turns in der Engine (`deriveTurnThrows`, `getCurrentTurn`), rein, ohne UI-Bezug.
- **WP-2** — Neue Scoreboard-Komponente **oben** in der Spielansicht: aktiver Spieler hervorgehoben, großer Restpunktestand, modusspezifische Angaben, 3–4 Spieler ohne horizontalen Überlauf.
- **WP-3** — Wurfübersicht mit drei Slots und **Undo im Eingabebereich**, abgeleitet aus dem Ledger, mit korrektem Reset nach dem Spielerwechsel.
- **WP-4** — `MatchLayout`: Trennung der Eingabemodi (Pad bzw. Board — nie beide), Reihenfolge 1–6, kompakterer Strip.
- **WP-5** — Verdrahtung der fünf Modus-Views; jede View liefert ihre modusspezifischen Daten aus der Engine.
- **WP-6** — Unit-, Integrations- und E2E-Regressionstests über alle fünf Modi.
- Dokumentation: DevFlow-Ledger, Projektgedächtnis, Handoff.

### Out of Scope

- **Keine Änderung an Regeln, Modi, Bust-Semantik oder Checkout.** Die Engine bleibt unverändert; `recordThrow`, `undoLastThrow` und `correctThrow` bleiben die einzigen Schreibpfade.
- **Keine Vereinheitlichung der fünf Modi.** Ein generisches „Scorefeld für alle Modi" wäre die stärkste Regelverletzung. Die Modus-Varianten bleiben getrennt.
- **Keine neue Abhängigkeit.** Kein Radix, kein Dialog-Bibliothek, kein Icon-Set-Zusatz.
- **Kein Realtime.** Der Socket.IO-Pfad hat heute keinen Client.
- **Keine neuen Design-Tokens.** Das vorhandene Vokabular trägt alles.
- **Keine Änderung am App-Header oder an der Mobile-Tab-Bar.** Der Header bleibt 56 px, die Tab-Bar 64 px.
- **Keine Board-Marker.** Die `markers`-Prop existiert, wird aber von keiner View gesetzt — das gehört nicht zu diesem Auftrag.

---

## Success Criteria

- [ ] Bei 390×844 existiert **genau eine** Eingabefläche: im manuellen Modus das Pad, im Board-Modus das Board. Das jeweils andere ist nicht im DOM.
- [ ] Die Spielerübersicht steht **oberhalb** der Eingabefläche und ist ohne Scrollen sichtbar.
- [ ] Der aktive Spieler ist durch **Form und Text** erkennbar (Rail + „AM ZUG"), nicht durch Farbe allein.
- [ ] Der Restpunktestand steht als große, feste Ziffernspalte (`min-w-[3ch]`, `tabular-nums`) in der Übersicht.
- [ ] Die Übersicht ist **modusspezifisch**: x01 zeigt den Restpunktestand, Cricket die Marks/geschlossenen Targets, ATC Ziel und Fortschritt, Shanghai die Runde und ihre Treffer.
- [ ] Bei 3 und 4 Spielern entsteht bei 390 px **kein** horizontaler Überlauf (`scrollWidth ≤ clientWidth`).
- [ ] Der Undo sitzt **im Eingabebereich**, heißt exakt „Undo" und es gibt **genau einen** davon im Screen.
- [ ] Die Wurfübersicht zeigt drei Slots; ein noch nicht geworfener Dart ist als solcher erkennbar.
- [ ] **Nach einem Spielerwechsel** zeigt die Wurfübersicht die leere Aufnahme des neuen Spielers, nicht die Würfe des vorherigen.
- [ ] Undo und Korrektur funktionieren **unverändert** über `GameEngine` in allen fünf Modi.
- [ ] Der Miss-Key bleibt bei ≤ 779 px erreichbar; das Board beginnt im Board-Modus im ersten Falz.
- [ ] Kein bestehender Test wird entfernt, deaktiviert oder geschwächt.
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` und `npm run test:e2e` sind grün.
- [ ] Keine Palette-Utilities, kein rohes Hex, kein Emoji, kein neuer Token.
- [ ] `src/game-engine` importiert weiterhin **keine** UI.

---

## Task Overview

| Task | Description | Depends On | Status |
| --- | --- | --- | --- |
| WP-1 | Turn-Ableitung in der Engine (`deriveTurnThrows`, `getCurrentTurn`) | – | done |
| WP-2 | Scoreboard-Komponente mit Union-Datenmodell | WP-1 | done |
| WP-3 | Wurfübersicht mit drei Slots und Undo im Eingabebereich | WP-1 | done |
| WP-4 | `MatchLayout`: Modus-Trennung, Reihenfolge, kompakter Strip | WP-2, WP-3 | done |
| WP-5 | Die fünf Modus-Views verdrahten | WP-2, WP-3, WP-4 | done |
| WP-6 | Regressionstests (Unit, Integration, E2E) über alle fünf Modi | WP-5 | done |
| WP-7 | Dokumentation: DevFlow-Ledger, Projektgedächtnis, Handoff | WP-6 | done |
| WP-8 | Unabhängiges Review des Gesamtauftrags | WP-6, WP-7 | done |

---

## Architecture Notes

### Der Schnitt: die Engine besitzt die Regeln, die View liest

Die Übersicht zeigt **was die Engine hergibt**, nicht was die View errechnet. Jede Modus-View baut aus `matchState` ein typisiertes Union-Objekt; die geteilte Komponente rendert es. Damit kann keine View eine Regel erfinden, und keine Komponente muss eine kennen.

```ts
/** Was die große Zahl einer Spielerkarte bedeutet. */
export type ScoreboardKind = "x01" | "cricket" | "aroundTheClock" | "shanghai";

/** Ein Spieler in der Übersicht. */
export interface ScoreboardPlayer {
  readonly id: string;
  readonly name: string;
  /** Die Zahl der Karte — je nach Modus eine andere Größe. */
  readonly value: number;
  /** True für den Spieler, dessen Zug ist. */
  readonly isCurrent: boolean;
}

/** Die x01-Variante: Restpunkte und die geltende Checkout-Regel. */
export interface X01ScoreboardData {
  readonly kind: "x01";
  readonly checkoutLabel: string;
  readonly leg?: { readonly current: number; readonly total: number };
  readonly set?: { readonly current: number; readonly total: number };
}

/** Die Cricket-Variante: die Marks jedes Spielers auf jedem Target. */
export interface CricketScoreboardData {
  readonly kind: "cricket";
  readonly marks: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly targets: readonly number[];
  readonly marksToClose: number;
}

/** Die Around-The-Clock-Variante: das gemeinsame Ziel und der Fortschritt. */
export interface AroundTheClockScoreboardData {
  readonly kind: "aroundTheClock";
  readonly currentTarget: number;
  readonly targetIndex: number;
  readonly targetCount: number;
  readonly playerProgress: Readonly<Record<string, number>>;
}

/** Die Shanghai-Variante: die laufende Runde und ihre Treffer. */
export interface ShanghaiScoreboardData {
  readonly kind: "shanghai";
  readonly currentRound: number;
  readonly totalRounds: number;
  readonly target: number;
  readonly roundRecords: Readonly<
    Record<string, { marks: number; hitSingle: boolean; hitDouble: boolean; hitTriple: boolean }>
  >;
}

/** Die Modus-Daten der Übersicht — eine Form je Modus, nie eine gemergte. */
export type ScoreboardData =
  | X01ScoreboardData
  | CricketScoreboardData
  | AroundTheClockScoreboardData
  | ShanghaiScoreboardData;
```

`switch (data.kind)` ist dadurch **vollständig und erschöpfend**: ein neuer Modus muss eine Variante bekommen, sonst bricht der Typecheck. Kein Modus verliert Informationen — Cricket behält die ganze Markierungslage, ATC den Spielerfortschritt, Shanghai die S/D/T-Treffer.

### Der Turn ist nicht der Visit — und genau das ist der Reset

`deriveVisitIndexes` beendet einen Visit nach drei gezählten Würfen **nicht** und beendet ihn bei einem Bust. Die Wurfübersicht des Eingabebereichs braucht aber den **Turn**: die Würfe des Spielers, dessen Zug ist. Das ist eine eigene, genauso reine Ableitung:

```ts
/**
 * The darts of the turn in progress.
 *
 * The visit groups the ledger into one-ball rounds; the turn groups it by
 * the player who is throwing. They are not the same: after three darts the
 * turn passes to the next player while the visit continues, so the turn in
 * progress is empty — which is the reset the score strip needs.
 *
 * A bust is part of the turn: it was thrown by this player, it just scored
 * nothing.
 */
export function deriveTurnThrows(
  throws: readonly RecordedThrow[],
  currentPlayerId: string | null,
  dartsPerTurn: number,
): RecordedThrow[]
```

Die Ableitung läuft **rückwärts** vom Ledger-Ende: solange der letzte Wurf dem aktuellen Spieler gehört, sammeln; ein Wechsel des Spielers beendet den Turn. Ein Bust zählt als Wurf des Turns (er wurde geworfen), verbraucht aber keinen Platz. `currentPlayerId === null` (Match beendet) ergibt ein leeres Array.

`GameEngine.getCurrentTurn()` reicht das weiter — symmetrisch zu `getVisits()`, ohne UI-Bezug.

**Invariante:** Die Turn-Grenze wird **nicht** in `MatchState` gespeichert (Falle A5). Sie wird abgeleitet, wie die Visit-Grenze. Sonst ginge sie nach einer Korrektur stale.

### Der Korrekturweg bleibt, das Pad bleibt

Der Korrekturweg (`selectThrow` → `engine.correctThrow`) hängt an den **Dart-Chips** mit dem Namen `Dart N: S20`. Diese Chips bleiben bestehen — sie wandern lediglich aus dem Strip in den Eingabebereich, wo der Fehler passiert. Der Undo wandert ebenfalls dorthin.

Damit bleibt die Korrektur älterer Würfe möglich und der Auftrag aus Issue #2 („Wurfkorrektur") gewahrt.

### Der Strip wird einzeilig — und das ist die Voraussetzung

Der `MATCH_STRIP` misst **111 px** (drei Zeilen durch `flex-wrap`), weil er Titel, Badge, Quelle, `InputModeSwitch`, Wurf-Chips **und** Aktionen trägt. Solange die Wurf-Chips darin liegen, ist die geforderte Reihenfolge 1–6 bei 390×844 **nicht darstellbar** — das Pad rutscht zwangsläufig unter die Falz.

Wandern die Wurf-Chips (und damit der Undo) in den Eingabebereich, fällt der Strip auf **eine Zeile (56 px)** zurück. Das ist die Voraussetzung dafür, dass

```
56 (Header) + 56 (Strip) + Übersicht + Wurfübersicht + Pad ≤ 844
```

mit einem erreichbaren Miss-Key aufgeht. **Das Falz-Budget ist die knappe Ressource dieses Auftrags** — jede neue Höhe über dem Pad kostet direkt die Erreichbarkeit.

### Kein magic Sticky-Offset

Der `MATCH_STRIP` ist `sticky top-14 z-30`; der App-Header ist 56 px. Eine **zusätzliche** sticky Spielerübersicht bräuchte einen Offset wie `top-[calc(3.5rem+56px)]`, dessen Wert von der (inhaltsabhängigen) Strip-Höhe abhängt.

**Entscheidung: Die Spielerübersicht ist nicht sticky.** Gründe:

- Der Offset wäre fragil — jede Änderung am Strip verschiebt ihn.
- Zwei sticky-Bänder (111 px + ~136 px) fräßen 31 % des nutzbaren Falzes und verdeckten den Pad-Oberteil.
- Die Information ist am Kopf der Seite; wer tief unten tippt, scrollt ohnehin.

Falls später ein sticky Scoreboard gewünscht wird, dann als **ein** gemeinsamer Wrapper mit dem Strip — nie über einen magic Offset.

### Der Schnitt „Modus-Fläche" — die eine heikle Stelle

Im manuellen Modus trägt das Pad seinen eigenen Band-Schalter; im Board-Modus muss **ein** Schalter **über dem Board** stehen, damit der Spieler das Board bedienen kann, ohne ans Pad-Ende zu scrollen. Zwei gleichnamige Radios („3× Treble") würden den Strict-Mode von `e2e/score-entry.spec.ts:126` brechen.

**Entscheidung:** Der Band-Schalter wird **einmal** gerendert und über `order` positioniert:

- manuell → über dem Pad (`idPrefix="dart-pad-segment"`),
- Board → über dem Board (`idPrefix="board-segment"`).

Dazu braucht das Pad die Fähigkeit, seinen Schalter **abzuschalten** (`showSegmentControl`, Default `true` — damit `tests/unit/game/throwInputPad.test.tsx` unverändert grün bleibt). Die Entscheidung fällt in der **View**, die den Eingabemodus kennt; `MatchLayout` reicht sie über einen Prop durch.

Der Band-Schalter im Board-Modus wird **ohne** `compact` gerendert, damit sein Name „3× Treble" bleibt und die bestehende Rollenabfrage greift.

---

## Deliverable

### WP-1 — Turn-Ableitung in der Engine

**Neu:** `src/game-engine/throwLedger.ts` → `deriveTurnThrows(throws, currentPlayerId, dartsPerTurn)`.
**Geändert:** `src/game-engine/GameEngine.ts` → `getCurrentTurn(): readonly RecordedThrow[]`; `src/game-engine/index.ts` → Export; `src/game-engine/README.md` → Doku (die `publicApi.test.ts` prüft die README gegen die echten Signaturen).

**Tests:** `tests/unit/game-engine/turnThrows.test.ts` — Reset beim Spielerwechsel, Bust bleibt im Turn, höchstens `dartsPerTurn` gezählte Würfe, leeres Array bei `currentPlayerId === null`.

**Falle:** Die Funktion muss pur bleiben — `tests/unit/game-engine/frameworkAgnostic.test.ts` scannt `src/game-engine/**` auf `window|document|localStorage|process`.

### WP-2 — Scoreboard-Komponente

**Neu:** `src/components/game/PlayerScoreboard.tsx`; Union-Typen in `src/components/game/types.ts`; neue Klassen in `src/components/game/classes.ts` (kein eigener Focus-Ring, keine eigene Target-Größe).

**Aufbau:** Eine hervorgehobene Zeile für den aktiven Spieler (2 px `border-l-2 border-l-brass`, Name in `text-ink`, „AM ZUG" in `text-brass`), darunter die übrigen Spieler als **regulierte Zeilen** — keine Kacheln, kein Farbschleier, wie `match.md` §4 es verlangt. Die große Zahl in `font-mono` `text-score-xl` `tabular-nums` `min-w-[3ch]`, die passive in `text-score-lg`.

**Marker:** `data-remaining` und `data-active-player` — **kein** `data-score` (das bleibt exklusiv im `ScoreDisplay`, sonst wird `[data-score]` mehrdeutig und `e2e/score-entry.spec.ts:75` zielt ins Leere).

**Tests:** `tests/unit/game/playerScoreboard.test.tsx` — aktiver Spieler mit Rail und Beschriftung, feste Ziffernspalte, Spaltenüberschrift je Modus, Marks je Spieler (Cricket), Fortschritt je Spieler (ATC), Runde und Treffer (Shanghai), Leg/Set wenn vorhanden, stabile Sitzordnung.

### WP-3 — Wurfübersicht und Undo im Eingabebereich

**Neu:** `src/components/game/VisitTracker.tsx` — drei Slots (geworfener Dart als Chip, leerer Slot als umrandeter Platzhalter), der Undo daneben.

**Geändert:** `src/components/game/useMatchHistory.ts` → `currentTurn`, `currentTurnOffset`; `src/components/game/ThrowHistoryControls.tsx` → der Undo wandert heraus, die Dart-Chips bleiben (Korrekturweg).

**Der Undo heißt exakt „Undo"** (`aria-label="Undo"`), damit `getByRole("button", { name: /^undo$/i })` und `getByRole("button", { name: /undo/i })` weiter greifen. **Genau ein** Undo im Screen.

**Die Liste behält `aria-label="Current visit"`** und rendert in **beiden** Eingabemodi.

**Tests:** `tests/unit/game/visitTracker.test.tsx` — drei Slots, gefüllt gegen leer, „Dart N: not thrown", Bust als Bust, Undo ruft die Engine, `disabled` bei leerem Ledger; `tests/unit/game/useMatchHistory.test.ts` — `currentTurn` und der Reset nach dem Spielerwechsel.

### WP-4 — `MatchLayout`

**Geändert:** `src/components/game/MatchLayout.tsx`, `src/components/game/types.ts`, `src/components/game/classes.ts`, `src/components/game/SegmentControl.tsx`, `src/components/game/InputModeSwitch.tsx`, `src/components/game/ThrowInputPad.tsx`.

**Modus-Trennung (Problem A):** Das Pad rendert **nur**, wenn das Pad die Eingabefläche ist; das Board wird nur dann zur Eingabe, wenn der Board-Modus gewählt ist. Das jeweils andere ist **nicht im DOM** — kein verstecktes fokussierbares Element, kein `aria-hidden`-Rätsel. Der `armedSegment` bleibt Eigentum der Match-View und ist von der Trennung unberührt.

**Reihenfolge (Problem B/C):**

| Stufe | Inhalt |
| --- | --- |
| 1 | Match-Kopfzeile (`MATCH_STRIP`, sticky, jetzt 56 px statt 111 px) |
| 2 | Spielerübersicht (`PlayerScoreboard`) |
| 3 | Aktueller Spieler + Wurfübersicht + Undo (`VisitTracker`) |
| 4 | Band-Schalter (über der aktiven Eingabefläche) |
| 5 | Aktive Eingabefläche (Pad **oder** Board) |
| 6 | Weitere Infos (bestehende `ScoreDisplay`, `MatchStatus`, Modus-Blätter) |

**Erreichbarkeit:** Der Miss-Key muss bei ≤ 779 px enden, das Board im Board-Modus im ersten Falz beginnen. **Nach der Umsetzung messen**, nicht annehmen.

### WP-5 — Die fünf Modus-Views

**Geändert:** `src/components/x01/X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`.

Jede View baut ihr Union-Objekt aus `matchState` (`players`, `currentPlayerId`, `modeData`) und den exportierten Engine-Konstanten (`MARKS_TO_CLOSE`, `CRICKET_TARGETS`, `AROUND_THE_CLOCK_TARGETS`, `SHANGHAI_ROUNDS`, `roundTarget`, `LEG_SET_MODE_DATA_KEY`).

**Achtung Layer:** `LEG_SET_MODE_DATA_KEY` ist über den Root-Barrel **nicht** exportiert (nur der Typ `LegSetProgress`). Die View importiert ihn direkt aus `@/game-engine/rules` — legal, weil `src/components/` → `src/game-engine` erlaubt ist. Sauberer ist die Ergänzung des Barrels.

**Achtung Test:** `tests/unit/game/modeViews.test.tsx` verbietet, dass eine Page eine Komponente deklariert (`/^\s*function [A-Z]\w*\s*\(/m`). Das Mapping muss als reine Helferfunktion ohne Großbuchstaben-Start oder in `src/components/game/` stehen.

**Tests:** `tests/unit/game/modeViews.test.tsx` und `tests/unit/game/x01MatchView.test.tsx` um die Scoreboard-Varianten erweitern.

### WP-6 — Regressionstests

**Neu:** `e2e/mobile-scoring-ux.spec.ts` — über alle fünf Modi bei 390×844:

1. Genau eine Eingabefläche (Pad-Bereich **oder** Board-Bereich, nicht beide).
2. Reihenfolge per `boundingBox().y`: Übersicht < Wurfübersicht < Eingabefläche.
3. Falz-Budget: Miss-Key endet ≤ 779 px; Board beginnt < 844 px.
4. **Reset:** nach drei Würfen zeigt die Wurfübersicht die leere Aufnahme des neuen Spielers.
5. Overflow bei drei und vier Spielern: `scrollWidth − clientWidth ≤ 0`.
6. Undo im Eingabebereich: genau ein Button „Undo", und er rechnet den Wurf weg.
7. Der aktive Spieler ist ohne Farbe erkennbar (Rail **und** Text).

**Erweitert:** `e2e/score-entry.spec.ts` (Board im Falz, Undo-Ort, 4-Spieler-Overflow), `e2e/visual-qc.spec.ts` (4-Spieler-Oberfläche in `SURFACES`).

**Nicht verändern:** `tests/unit/game/tokenLayer.test.ts`, `tests/unit/game/scoreDisplay.test.tsx`, `tests/unit/game/ThrowHistoryControls.test.tsx` (solange die Komponenten unverändert bleiben).

---

## Risks

| # | Risiko | Gegenmaßnahme |
| --- | --- | --- |
| R1 | **Zwei „3× Treble"-Radios** brechen `e2e/score-entry.spec.ts:126` (Strict Mode) | Der Band-Schalter wird **einmal** gerendert, `idPrefix` wechselt mit dem Modus; im Board-Modus ohne `compact`, damit der Name „3× Treble" bleibt. **Nach der Umsetzung nachprüfen.** |
| R2 | **Zwei Undo-Buttons** brechen `undoAcrossModes.test.tsx` und `cricketCorrection.test.tsx` | Genau ein Undo im Screen, exakt benannt „Undo". |
| R3 | **`[data-score]` mehrdeutig** durch das neue Board | Das neue Board führt `data-remaining`; `data-score` bleibt exklusiv im `ScoreDisplay`. |
| R4 | **Das Falz-Budget reicht nicht** — Übersicht und Wurfübersicht schieben den Miss-Key unter die Tab-Bar | Der Strip wird einzeilig (−55 px). Miss-Key nach der Umsetzung messen; bei 4 Spielern wächst die Höhe nicht (die Zeile der passiven Spieler scrollt, statt zu stapeln). |
| R5 | **Der Band-Schalter ist im Board-Modus unerreichbar**, wenn das Pad über dem Board steht | Ein Schalter, per `order` positioniert — im Board-Modus über dem Board. |
| R6 | **Die Wurfübersicht zeigt nach dem Spielerwechsel die alten Würfe** | `deriveTurnThrows` statt `visits.at(-1)`. Der E2E-Test WP-6/4 sichert das ab. |
| R7 | **Palette-Utilities oder rohes Hex** in den neuen Dateien | Nur `bg-surface|bg-raised|bg-sunken`, `text-ink|text-ink-muted|text-ink-faint|text-brass`, `border-rule|border-edge|border-brass`; `tests/unit/game/tokenLayer.test.ts` und `tests/unit/tailwind/designTokens.test.ts` prüfen das. |
| R8 | **Neue Tokens** nötig → `MASTER.md` + `@theme` + `@source inline` + Token-Test | Keine neuen Tokens nötig; das vorhandene Vokabular trägt alles. |
| R9 | **`src/game-engine` importiert UI** | `deriveTurnThrows` ist pur; `frameworkAgnostic.test.ts` deckt das ab. |
| R10 | **Ein Modus verliert seine Information** durch die Union | `switch (data.kind)` ist erschöpfend; die Modus-Tests decken jede Variante ab. |
| R11 | **Der Korrekturweg geht verloren**, wenn die Chips aus dem Strip wandern | Die Chips behalten Namen und Verhalten; `ThrowHistoryControls` bleibt renderbar und getestet. |
| R12 | **Die Tab-Bar verdeckt den letzten Block** | Das `<main>` reserviert bereits `pb-[calc(4rem+env(safe-area-inset-bottom))]` — geprüft in `app/layout.tsx:56`. |

---

## Documentation Notes

- **DevFlow-Ledger:** ein neuer Task (DF-0004) mit den Workpackages, Akzeptanzkriterien und den Agentenzuordnungen.
- **Projektgedächtnis:** `.devflow/memory/CURRENT_STATE.md` (der gemessene Ist-Zustand und der neue), `ARCHITECTURE.md` (die Union, die Turn-Ableitung), `PROJECT.md` (der Umfang).
- **Handoff:** `.devflow/memory/handoffs/` — ein Handoff mit dem Ergebnis und der Verifikation.
- **`src/game-engine/README.md`:** die neuen öffentlichen Signaturen (`getCurrentTurn`, `deriveTurnThrows`).

---

## Open Questions

1. **Soll die Spielerübersicht zusätzlich sticky sein?** Der Plan sagt nein (siehe „Kein magic Sticky-Offset"). Wenn die Anforderung das verlangt, ist der Weg ein **gemeinsamer** sticky Wrapper mit dem Strip, nicht ein Offset.
2. **Soll das Pad im Board-Modus ganz entfallen?** Der Plan lässt es im DOM (Band-Schalter als Rückfall, Korrektur-Eingabe), weil das den bestehenden E2E-Vertrag (`Miss ≤ 779`, `Board < 844`) intakt hält. Ein Verzicht wäre die konsequentere Trennung, würde die Korrektur aber ohne Wertgeber treffen.
3. **Wie eng darf das Board sein?** Auf 390 px ist das Board quadratisch und damit breitengetrieben; eine echte Vergrößerung ist nur über die Position (in den Falz) möglich, nicht über die Breite.
