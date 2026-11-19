# 501 — Technische Entscheidungen und Ist-Stand

Begleitdokument zu [501-spec.md](./501-spec.md). Hält fest, was heute existiert, was
wiederverwendet wird und welche technischen Entscheidungen die Umsetzung prägen.

Geprüfter Stand: 2026-11-18, Branch `fix/security-auth-hardening`, Commit `f2ff92f`.

Die fachlichen Entscheidungen E-1 bis E-5 sind getroffen und in
[501-spec.md](./501-spec.md) festgehalten. Dieses Dokument übersetzt sie in technische
Festlegungen: D-11 bis D-14 folgen aus E-1, E-2, E-4 und E-5. Die offenen technischen
Fragen T-1 bis T-8 bleiben offen; T-4 ist durch E-4 entschieden.

## Inhalt

- [Bestandsaufnahme](#bestandsaufnahme)
  - [Bereits vorhanden und verwendbar](#bereits-vorhanden-und-verwendbar)
  - [Teilweise vorhanden](#teilweise-vorhanden)
  - [Noch zu entwickeln](#noch-zu-entwickeln)
- [Technische Entscheidungen](#technische-entscheidungen)
- [Offene technische Fragen](#offene-technische-fragen)

## Bestandsaufnahme

### Bereits vorhanden und verwendbar

| Baustein                     | Datei                                                                                                                                                                                                                                                             | Was daraus reused wird                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spielmotor mit Wurfprotokoll | `src/game-engine/GameEngine.ts`                                                                                                                                                                                                                                   | `recordThrow`, `undoLastThrow`, `correctThrow`, `getState`, `getVisits`. Der Zustand wird aus dem Protokoll neu abgeleitet (Replay), nicht inkrementell geführt.                     |
| 501-Modus                    | `src/game-engine/modes/StandardMode.ts`                                                                                                                                                                                                                           | `StandardMode` (Startpunktzahl, Out-Regel, Legs/Sets), `Standard501Mode` (501 + Double Out als Vorgabe).                                                                             |
| Out-Regeln                   | `src/game-engine/rules/OutRules.ts`                                                                                                                                                                                                                               | `straight`, `double` (+ `master`). Enthält `isCheckout` (Finish-Regel) und `isStrandedBust` (auf 1 gelandet). `isValidSegmentScore` prüft Segment/Punkte-Kombinationen.              |
| Leg-/Set-Verwaltung          | `src/game-engine/rules/LegSetManager.ts`                                                                                                                                                                                                                          | „Best of N"-Zählung, Fortschritt in `modeData.legSet`, Neustart einer Leg mit zurückgesetzten Punkten.                                                                               |
| Aufnahmen-/Zug-Ableitung     | `src/game-engine/throwLedger.ts`                                                                                                                                                                                                                                  | `deriveVisitIndexes`, `deriveTurnThrows`, `deriveTurnIndexes`, `groupVisits`. Grenzen werden nie gespeichert, sondern immer neu abgeleitet — die Grundlage für korrekte Korrekturen. |
| Fehlercodes                  | `src/game-engine/types.ts`                                                                                                                                                                                                                                        | `GameEngineErrorCode` als stabiler Vertrag; `GameEngineBustError` trägt den Code `BUST`.                                                                                             |
| Spieloberfläche x01          | `src/components/x01/X01MatchView.tsx`                                                                                                                                                                                                                             | Die Ansicht für 501 und 301. Phasen `setup` → `playing` → `result`, Aufnahme der Engine, Verarbeitung von Refusals.                                                                  |
| Spielerübersicht             | `src/components/game/PlayerScoreboard.tsx`                                                                                                                                                                                                                        | Aktiver-Spieler-Markierung (`data-active-player`), Restpunktspalte (`data-remaining`), Kopfzeile mit Leg-/Set-Zähler.                                                                |
| Scoreblatt                   | `src/components/game/ScoreDisplay.tsx`                                                                                                                                                                                                                            | Restpunkte je Spieler (`data-score`), letzte Aufnahme mit Bust-Chips.                                                                                                                |
| Wurfhistorie                 | `src/components/game/ThrowHistoryControls.tsx`                                                                                                                                                                                                                    | Wurfchips des laufenden Zugs, Armieren eines Wurfes als Korrekturziel.                                                                                                               |
| Undo-Steuerung               | `src/components/game/VisitTracker.tsx`                                                                                                                                                                                                                            | Undo-Button an der Eingabefläche.                                                                                                                                                    |
| Korrektur-/Undo-Logik        | `src/components/game/useMatchHistory.ts`                                                                                                                                                                                                                          | Auswahl des Korrekturziels, Bestätigungslogik bei abgeschlossenen Aufnahmen, Weiterleitung an die Engine.                                                                            |
| Dart-Pad                     | `src/components/game/ThrowInputPad.tsx`                                                                                                                                                                                                                           | Manuelle Eingabe: Band wählen (1×/2×/3×), Sektor tippen, Bulls, Miss.                                                                                                                |
| Interaktives Dartboard       | `src/components/board/DartBoard.tsx`                                                                                                                                                                                                                              | Realistisches SVG-Board, Trefferauflösung über `src/board/boardGeometry.ts`, `armedSegment`-Bandwahl.                                                                                |
| Eingabemodus-Umschalter      | `src/components/game/InputModeSwitch.tsx`, `useInputMode.ts`                                                                                                                                                                                                      | Umschalten zwischen Board und Pad, jederzeit, mit Erinnerung im Local Storage.                                                                                                       |
| Boardgeometrie               | `src/board/boardGeometry.ts`                                                                                                                                                                                                                                      | Radien, Sektorfolge, `resolveBoardHit` — die gemeinsame Wahrheit für Board und Motor.                                                                                                |
| Fehlertexte                  | `src/components/game/playerErrors.ts`                                                                                                                                                                                                                             | Code → Spielersatz, für alle fünf Moden.                                                                                                                                             |
| KI-Motor                     | `src/ai/engine.ts`, `src/ai/dartboard.ts`                                                                                                                                                                                                                         | Statistischer Wurf: Zielwahl, Gaußscher Zielfehler, Auflösung gegen die echte Boardgeometrie.                                                                                        |
| KI-Konfiguration             | `src/ai/config/*.json`, `src/ai/difficultyConfig.ts`                                                                                                                                                                                                              | Schema und Validierung der Stufen; `checkoutSuccessRate` als Sollwert je Stufe.                                                                                                      |
| KI-Prüfstand                 | `tests/unit/ai/difficultyMeans.test.ts`                                                                                                                                                                                                                           | Misst den 3-Dart-Mittelwert einer Stufe reproduzierbar über Seeds — die Vorlage für den Average-Test.                                                                                |
| KI-Provider-Naht             | `src/realtime/types.ts` (`AIProvider`), `src/realtime/socketServer.ts`                                                                                                                                                                                            | Injektionspunkt für einen KI-Wurf pro Schritt — im Realtime-Pfad bereits erprobt, im lokalen 501-Pfad nicht verdrahtet.                                                              |
| Modusregister                | `src/game-engine/modes/registry.ts`                                                                                                                                                                                                                               | 501-Eintrag (`/game`), `OUT_RULE_CHOICES`, `sheetFootnote`.                                                                                                                          |
| Tests                        | `tests/unit/game-engine/modes/StandardMode.test.ts`, `tests/unit/game-engine/UndoCorrect.test.ts`, `tests/unit/game-engine/modes/CorrectionReplay.test.ts`, `tests/unit/game/x01CorrectionRefusal.test.tsx`, `e2e/score-entry.spec.ts`, `e2e/game-center.spec.ts` | Vorhandene Regressionsabdeckung für 501, Undo, Korrektur und Refusals.                                                                                                               |

### Teilweise vorhanden

| Bereich                                   | Befund                                                                                                                                                                                                                                                                                                            | Auswirkung                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bust und Aufnahme                         | Der Motor lässt einen Spieler nach einem Bust weiterwerfen: der Zug wechselt nicht (`NOT_YOUR_TURN` für den Gegner). Geprüft mit `StandardMode` und 100 Startpunkten. Zudem wird der Punktestand der Aufnahme **nicht** zurückgesetzt: nach T20 und Bust steht der Spieler weiterhin bei 40 statt wieder bei 100. | Abweichung von der 501-Regel. Entscheidung E-1, Issues 501-I11 und 501-I12.                                                    |
| Bestätigung nach dem Bust                 | Es gibt keinen Wartezustand „Bust eingetreten, Spielerwechsel ausstehend". Der Motor kennt weder eine Wartephase noch einen Aufruf, der den Spielerwechsel nachträglich vollzieht.                                                                                                                                | E-1 verlangt beides. Neue Motorfähigkeit. Entscheidung D-11, Issue 501-I11.                                                    |
| Startreihenfolge der Folge-Leg            | Nach einer gewonnenen Leg startet die nächste Leg mit dem Sieger der vorherigen. Die übliche Regel beginnt mit dem Verlierer der Leg.                                                                                                                                                                             | Abweichung von der 501-Regel. Entscheidung E-2, Entscheidung D-13, Issue 501-I13.                                              |
| Korrektur über die Partie                 | `correctThrow` funktioniert über den gesamten Protokollindex; korrigiert werden dürfen auch Würfe vergangener Aufnahmen. Die Oberfläche bietet die Auswahl aber **nur** für den laufenden Zug (`ThrowHistoryControls` zeigt `currentTurn`).                                                                       | Die geforderte Korrektur vergangener Aufnahmen ist in der Engine vorhanden, in der Oberfläche nicht erreichbar. Issue 501-I14. |
| Undo nach Spielende                       | `undoLastThrow` ist auch im abgeschlossenen Match erlaubt, und `GameResultBanner` kennt eine `onUndo`-Requisite — die 501-Ansicht reicht sie aber nicht durch.                                                                                                                                                    | Der matchentscheidende Wurf lässt sich im Ergebnisbildschirm nicht zurücknehmen. Issue 501-I15.                                |
| Leg- und Spielabschluss in der Oberfläche | `LegSetManager` zählt Legs korrekt, `X01MatchView` zeigt „Leg 2/3" und den Endstand. Es fehlt eine deutliche Ansage, dass eine Leg gewonnen wurde und warum die Punktzahlen zurückgesetzt wurden.                                                                                                                 | Die Punkte springen ohne erklärten Grund auf 501 zurück. Issue 501-I17.                                                        |
| Spielformat-Auswahl                       | `X01MatchView` bietet Single Leg, Best of 3 und Best of 5. Best of 7 und Best of 9 fehlen.                                                                                                                                                                                                                        | Anforderung 4.2 nicht erfüllt. Issue 501-I03.                                                                                  |
| Teilnehmerzahl                            | `PlayerSetup` erlaubt 1 bis 4 Spieler, die 501-Ansicht fordert nur Mindestens 1. Die Anforderung verlangt 2 bis 4 und mindestens einen Menschen.                                                                                                                                                                  | Konfiguration zu weit gefasst. Issue 501-I01.                                                                                  |
| Spielerreihenfolge                        | Die Reihenfolge folgt der Reihenfolge der Namensfelder. Ein explizites Umsortieren fehlt.                                                                                                                                                                                                                         | Anforderung 4.2 nur mittelbar erfüllt. Issue 501-I04.                                                                          |
| KI-Konfiguration                          | Der KI-Motor kennt vier feste Stufen (easy, medium, hard, expert) mit festen Sigma-Werten. Ein 3-Dart-Average als einstellbarer Parameter existiert nicht.                                                                                                                                                        | Anforderung 4.6 nicht erfüllt. Issue 501-I18.                                                                                  |
| KI in der lokalen Partie                  | Der KI-Motor wird nur im Realtime-Pfad verwendet; die lokale 501-Ansicht kennt keinen KI-Platz.                                                                                                                                                                                                                   | Anforderung 4.1 (Einzelspieler gegen KI) nicht erfüllt. Issue 501-I21.                                                         |
| Checkout-Berechnung                       | `selectCheckoutAim` in `src/ai/engine.ts` beherrscht nur den direkten Abschluss und eine sichere Einstellung; mehrdartige Routen (etwa 170) fehlen.                                                                                                                                                               | Anforderung 4.6 (Checkout-Wege berechnen) nur teilweise erfüllt. Issue 501-I19.                                                |
| Statistiken                               | Es gibt keine 501-Statistik. `src/rating/performanceService.ts` führt `averageTurnScore` und `checkoutPct`, speist diese aber aus Spieltabellen der Datenbank und kennt weder First-9 noch Highest Checkout noch 180er.                                                                                           | Anforderung 4.7 nicht erfüllt. Issues 501-I23 und 501-I24.                                                                     |
| Manuelle Eingabe mit direkter Punktzahl   | Das Dart-Pad wählt zuerst ein Band und dann einen Sektor. Eine direkte Zahleneingabe („Punkte direkt eingeben") fehlt.                                                                                                                                                                                            | Anforderung 4.4 nur mittelbar erfüllt. Issue 501-I08.                                                                          |
| Board-Marker                              | `DartBoard` kennt eine `markers`-Requisite, die bisher niemand belegt.                                                                                                                                                                                                                                            | Kosmetisch; Issue 501-I09.                                                                                                     |
| Leg-Grenzen im Protokoll                  | Das Protokoll kennt keine Leg-Grenze: die Legzählung steckt nur in `modeData.legSet`. „First 9" und „Best Leg" brauchen jedoch die Zuordnung eines Wurfes zu einer Leg.                                                                                                                                           | Statistik-Arbeit benötigt eine Ableitung. Issue 501-I23.                                                                       |
| Statistische Kennzahlen und Ablage        | Es gibt keine 501-Statistik. `src/rating/performanceService.ts` führt `averageTurnScore` und `checkoutPct`, speist diese aber aus Spieltabellen der Datenbank und kennt weder First-9 noch Highest Checkout noch 180er. Eine lokale Ablage von Statistiken gibt es ebenfalls nicht.                               | Anforderung 4.7 nicht erfüllt. Issues 501-I23, 501-I24 und 501-I25.                                                            |

### Noch zu entwickeln

- Sitzverwaltung mit gemischten menschlichen und KI-Plätzen in der Spielkonfiguration.
- Einstellbares 3-Dart-Average für KI-Plätze inklusive Kalibrierung der Streuung.
- Vollständige Wurfhistorie über die gesamte Partie in der Oberfläche.
- Leg- und Spielauswertung mit Statistiken je Spieler.
- Lokale Speicherung der Spielerstatistiken über Partien hinweg (E-4).
- Bust-Auflösung mit Wartezustand, Aufnahmerücksetzung und Bestätigungsschaltfläche
  (E-1).

## Technische Entscheidungen

### D-1 — Die Engine bleibt die einzige Quelle der Wahrheit

Der 501-Modus rechnet **nicht** selbst. `StandardMode` liefert die Punkte, `LegSetManager`
die Legzählung, `OutRules` die Finish-Regel. Jede Anzeige liest den Zustand aus dem
Motor.

**Begründung:** Der Motor leitet den gesamten Zustand aus dem Wurfprotokoll neu ab
(Replay). Eine zweite Buchführung in der Oberfläche würde bei Undo und Korrektur
auseinanderlaufen — genau der Fehler, den Issue 3 (2024) bereits einmal produziert hat.

**Folge:** Jede neue 501-Funktion, die einen Punktestand betrifft, braucht keine eigene
Berechnung in der Oberfläche.

### D-2 — Die lokale 501 bleibt clientseitig (E-5)

Die Partie läuft im Browser über `X01MatchView` und `GameEngine`. Es wird kein
Server-Roundtrip eingeführt; Realtime-501 und Multiplayer gehören nicht zum ersten
501-MVP.

**Begründung:** Der lokale Mehrspieler am selben Gerät braucht keine Autorität. Der
Realtime-Pfad ist für netzwerkbasiertes Spielen gebaut und nutzt `NeutralScoreMode`.

**Folge:** Der KI-Platz wird im Browser berechnet. Für eine spätere Server-Autorität
müsste der KI-Wurf in eine serverseitige Schleife wandern — der Provider-Nahtpunkt in
`src/realtime/types.ts` ist dafür bereits vorhanden.

**Folge für die Architektur (E-5):** Damit eine spätere Erweiterung nicht erschwert
wird, bleibt die Spiellogik framework-unabhängig im Motor, die Statistikberechnung
bleibt eine reine Funktion (D-14), und die KI bleibt hinter dem bestehenden
Provider-Nahtpunkt austauschbar. Keine dieser Festlegungen ist 501-spezifisch; sie
gelten für den ganzen Motor und stehen daher nicht im Konflikt mit einem späteren
Realtime-Ausbau.

### D-3 — Der KI-Motor wird um einen Average-Parameter erweitert, nicht ersetzt

`StatisticalAiEngine` bekommt eine neue Achse: statt vier fester Stufen mit festen
Sigma-Werten wird der gewünschte 3-Dart-Average als Parameter geführt. Die Stufen
25/40/55/70/85 werden zu vorkalibrierten Profilen, die den Average treffen.

**Begründung:** Der Motor ist statistisch sauber (echte Boardgeometrie, Gaußscher
Zielfehler, `mulberry32` für reproduzierbare Seeds) und bereits getestet. Der Average
ist eine Kennzahl der Streuung, kein neuer Motor.

**Folge:** `tests/unit/ai/difficultyMeans.test.ts` wird zum Average-Test: er misst
bereits über 2000 Aufnahmen je Seed den Mittelwert einer Stufe und prüft ihn gegen einen
Sollwert. Dieselbe Vorlage gilt für die Average-Stufen.

### D-4 — Scoring, Wurfmodell und Checkout-Strategie bleiben getrennt

Der KI-Motor wird in drei Einheiten geteilt:

| Einheit            | Aufgabe                                          | Ort                                           |
| ------------------ | ------------------------------------------------ | --------------------------------------------- |
| Wurfmodell         | Ziel wählen, Zielfehler ziehen, Treffer auflösen | `src/ai/engine.ts` (bestehend)                |
| Scoring-Modell     | Zielgewichte je Average-Stufe                    | `src/ai/config/*.json` (bestehend, erweitert) |
| Checkout-Strategie | Route zum Abschluss planen, Fehler zulassen      | neue Einheit in `src/ai/`                     |

**Begründung:** Die Anforderung verlangt genau diese Trennung. Der Ist-Stand hat Wurf
und Scoring vermischt (die Zielgewichte liegen je Stufe in der Scoring-Konfiguration, die
Checkout-Logik steckt in `selectCheckoutAim`).

**Folge:** `selectCheckoutAim` wird aus dem Motor in die Strategie-Einheit verschoben.

### D-5 — Undo und Wurfkorrektur bleiben zwei getrennte Wege

- **Undo** ist ein Button an der Eingabefläche und entfernt den letzten Wurf.
- **Wurfkorrektur** ist das Armieren eines Wurfes in der Historie; der nächste
  eingegebene Wurf ersetzt ihn.

Beide delegieren an die Engine (`undoLastThrow`, `correctThrow`), die den Zustand neu
ableitet. Die Oberfläche hält keine eigene Punktestandslogik.

**Begründung:** Der Motor lehnt Korrekturen ab, die die Zugrotation verändern
(`TURN_ROTATION_CHANGED`), die den korrigierten Wurf busten lassen
(`CORRECTION_WOULD_BUST`) oder einen späteren Wurf busten lassen
(`LATER_DART_WOULD_BUST`). Jede eigene Logik in der Oberfläche würde diese Regeln
duplizieren und driftend halten.

**Folge:** Der Korrekturtext muss immer einen Ausweg nennen, den es wirklich gibt
(„zurücknehmen und neu werfen"), sonst schickt er den Spieler in eine Refusal-Schleife.

### D-6 — Statistische Kennzahlen werden aus dem Wurfprotokoll abgeleitet

Alle Kennzahlen — 3-Dart-Average, First-9-Average, Highest Checkout, Checkout-Quote,
180er, 140er+, 100er+, Best Leg — entstehen aus dem Wurfprotokoll, nicht aus
zwischengespeicherten Zählern.

**Begründung:** Nur so bleiben die Kennzahlen nach Undo und Korrektur richtig: sie
werden neu berechnet, statt gegen den alten Stand gepatcht zu werden.

**Folge:** Für „First 9" und „Best Leg" braucht es die Zuordnung eines Wurfes zu seiner
Leg. Das Protokoll führt diese Grenze heute nicht; sie wird aus den Leg-Ereignissen
abgeleitet (Issue 501-I23). Der Motor wird dafür um ein ableitbares Leg-Signal
erweitert, nicht um gespeicherte Zähler.

**Folge aus E-1:** Eine ungültige Aufnahme (mit Bust) zählt mit 0 Punkten, ihre
geworfenen Würfe aber als geworfen. Das ergibt sich aus derselben Ableitung, weil die
Aufnahmegrenze und der Aufnahmestand aus dem Protokoll stammen (D-12).

### D-7 — Die Spieloberfläche wird nicht neu gebaut

`MatchLayout`, `PlayerScoreboard`, `ScoreDisplay`, `ThrowInputPad`, `DartBoard` und
`InputModeSwitch` bleiben unverändert, soweit es geht. Neue Bausteine (etwa die
Sitzverwaltung oder der Statistikblock) folgen dem Muster der vorhandenen: getrennte
Komponente, `src/components/game/`-Variant des Modus-Datenmodells, Anbindung über
`ScoreboardData` beziehungsweise als eigene Fläche.

**Begründung:** Der Auftrag verlangt ausdrücklich, vorhandene gute Komponenten
weiterzuverwenden. Die fünf Modi teilen sich diese Bausteine bereits; eine
Neugestaltung würde Cricket, Around The Clock und Shanghai mitreißen.

### D-8 — Neue Bausteine für 501 kommen in `src/components/x01/`

Die 501-Ansicht teilt sich Code mit der 301-Ansicht. Alles, was **nur** 501 betrifft
(Sitzverwaltung mit KI-Plätzen, Statistikblock, erweiterte Historie), kommt in
`src/components/x01/` oder ein neues Verzeichnis `src/components/501/`.

**Begründung:** `X01MatchView` wird von 501 und 301 gemeinsam genutzt. 501-spezifische
Merkmale dort einzubauen, würde die 301 mitverändern.

**Folge:** Werden beide Modi gleich behandelt, ist `src/components/x01/` der richtige
Ort.

### D-9 — Neue Module müssen in `docs/ARCHITECTURE.md` stehen

`tests/unit/docs/docs.test.ts` prüft, dass **jedes** Verzeichnis unter `src/` in der
Modultabelle von `docs/ARCHITECTURE.md` beschrieben ist.

**Folge:** Ein neues Verzeichnis (etwa `src/components/501/` oder `src/stats/`) erzwingt
eine Zeile in `docs/ARCHITECTURE.md`. Wird das vergessen, schlägt die Dokumentations-
Prüfung fehl.

### D-10 — Neue Issues tragen das Präfix `501-`

Alle Issues dieses Vorhabens heißen `501-I01` bis `501-I26` und tragen das Label
`501`. Bestehende Labels des Repositories (`enhancement`, `bug`, `documentation`,
`accessibility`) kommen ergänzend dazu.

**Begründung:** Die Nummerierung bleibt stabil, auch wenn GitHub später umsortiert.

### D-11 — Der Motor wartet nach einem Bust auf die Bestätigung (E-1)

Nach E-1 endet ein Bust die Aufnahme sofort, die Punkte der Aufnahme werden
zurückgesetzt, und der Spielerwechsel erfolgt **erst nach** der Bestätigung durch den
Menschen („Weiter"). Der Motor hält den Zustand also zwischen „Bust ist eingetreten"
und „Spielerwechsel ist vollzogen" an.

Der Motor bekommt dafür eine Zustandsphase, in der auf die Bestätigung gewartet wird.
Sie ist JSON-sicher und reist wie der übrige Zustand mit. Der Motor nimmt in dieser
Phase keine weiteren Würfe entgegen und liefert einen stabilen Fehlercode, wenn doch
einer eingereicht wird.

**Begründung:** Die Bestätigung ist ein Teil des Spielablaufs, nicht der Oberfläche.
Legt die Oberfläche sie fest, entstehen zwei Wahrheiten: der Motor wüsste nicht, dass die
Aufnahme beendet ist, und Undo oder Korrektur in dieser Phase könnten den Zustand
verfälschen. Der Motor ist nach D-1 die einzige Quelle der Wahrheit.

**Folge:** Die Oberfläche bindet die Schaltfläche „Weiter" an einen neuen
Engine-Aufruf, der den Spielerwechsel vollzieht. Die Bust-Rückmeldung und die
gesperrte Eingabe ergeben sich aus dem Motorzustand, nicht aus einem lokalen Merkmal
der Ansicht.

### D-12 — Die Aufnahme-Berechnung wird um den Aufnahmestand erweitert (E-1)

E-1 verlangt, dass die Punkte einer ungültigen Aufnahme vollständig zurückgesetzt
werden. Dazu muss der Motor den Punktestand **zu Beginn der Aufnahme** kennen, nicht
nur den aktuellen.

Der Motor führt diesen Stand nicht als eigene Buchführung, sondern leitet ihn aus dem
Wurfprotokoll ab: die Aufnahme beginnt nach dem letzten Spielerwechsel oder nach dem
letzten Bust, und ihr Startwert ist der Punktestand zu diesem Zeitpunkt.

**Begründung:** Ein gespeicherter Startwert wäre eine zweite Wahrheit, die nach Undo
und Korrektur veralten würde. Die Ableitung aus dem Protokoll ist mit D-1 und D-6
konsistent.

**Folge:** Das Protokoll muss die Aufnahmegrenze führen (siehe T-1). Dieselbe
Ableitung trägt anschließend die Statistik (501-I23): eine ungültige Aufnahme zählt mit
0 Punkten, ihre Würfe aber als geworfen.

### D-13 — Die Starterregel ist eine benannte, getestete Funktion (E-2)

Wer die nächste Leg beginnt, wird an **einer** Stelle im Motor entschieden. Die
übliche Regel: der Spieler, der die gerade beendete Leg **nicht** gewonnen hat, beginnt
die nächste. Die Regel ist damit unabhängig davon, wer gewonnen hat, und folgt der
Sitzreihenfolge — bei zwei Spielern ist das der Verlierer der Leg, bei mehreren
Spielern der nächste in der Sitzreihenfolge nach dem Verlierer.

**Begründung:** „Übliche Dartregeln" ist eine Anforderung an das Verhalten, nicht an
die Formel. Eine einzige, benannte Funktion macht die Regel nachvollziehbar
(nachvollziehbar im Sinne der Anforderung) und zuverlässig testbar; die Reihenfolge
lässt sich damit für beliebig viele Spieler eindeutig festlegen.

**Folge:** Die Regel wird mit einem Test je Spielerzahl (2, 3 und 4 Spieler) belegt,
damit die Reihenfolge nicht von der jeweiligen Partie abhängt.

### D-14 — Statistiken werden lokal abgelegt, hinter einer schmalen Schnittstelle (E-4)

E-4 legt fest: Statistiken werden zunächst lokal gespeichert, eine serverseitige
Speicherung bleibt eine spätere Betrachtung, und für den ersten 501-MVP wird keine
Datenbank- oder Cloud-Architektur eingeführt.

Die Ablage liegt hinter einer schmalen Schnittstelle, die die Statistiken je Spieler
und Modus lesen und schreiben kann. Die erste Umsetzung schreibt in den
Local Storage des Browsers. Die Berechnung der Kennzahlen selbst bleibt eine reine
Funktion ohne Browser-Zugriff.

**Begründung:** So bleibt E-5 erfüllbar — eine spätere serverseitige Ablage ersetzt die
Implementierung hinter der Schnittstelle, ohne die Spiellogik oder die Berechnung
anzufassen. Das Repository hat bereits eine Local-Storage-Konvention
(`darthub:input-mode` in `src/components/game/useInputMode.ts`), an der sich die
Ablage orientiert.

**Folge:** Für die Anmeldung einer Statistik genügt ein stabiler Schlüssel je Spieler.
Eine serverseitige Ablage braucht später eine echte Spieleridentität; für den lokalen
MVP genügt der konfigurierte Name, solange die Schnittstelle das nicht fest verdrahtet.

## Offene technische Fragen

| Nr. | Frage                                                                                                                         | Vorschlag                                                                                                                                                | Blockiert        |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| T-1 | Wie wird der Bust im Protokoll abgebildet, damit die Aufnahme endet und die Statistik „Best Leg" die richtige Wurfzahl zählt? | Das Protokoll um ein `visitEnded` / Leg-Signal ergänzen, das die Replay-Ableitung mitführt. Der Aufnahmestand wird daraus abgeleitet (D-12).             | 501-I11, 501-I23 |
| T-2 | Wo liegen die KI-Profile (Average → Sigma und Zielgewichte)?                                                                  | Als JSON unter `src/ai/config/` neben den bestehenden Stufen, mit derselben Validierung.                                                                 | 501-I18          |
| T-3 | Wie werden die Checkout-Routen berechnet?                                                                                     | Statische Tabelle der Standardrouten (1–170) plus Zufallswahl unter gleichen Alternativen; die Tabelle liegt in `src/ai/`.                               | 501-I19          |
| T-4 | Wie werden Spielstatistiken über Partien hinweg gespeichert?                                                                  | **Durch E-4 entschieden:** lokal im Local Storage, hinter einer schmalen Schnittstelle (D-14). Keine Prisma-Migration im MVP.                            | 501-I25          |
| T-5 | Bekommt die 501 einen eigenen Pfad (`/game/501`) neben `/game`?                                                               | `/game` beibehalten; die 501 teilt die Ansicht mit der 301 und braucht keinen eigenen Pfad.                                                              | —                |
| T-6 | Wie verhält sich der KI-Platz bei Korrekturen?                                                                                | Der KI-Wurf läuft durch dieselbe Engine wie ein Menschenwurf; eine Korrektur eines KI-Wurfes ist über die Historie genauso möglich.                      | 501-I21          |
| T-7 | Wie hoch ist der Aufwand der direkten Zahleneingabe im Pad?                                                                   | Das Pad erhält ein Zahlenfeld mit Bestätigung; das vorhandene Band-/Sektor-Raster bleibt. Die Gültigkeitsprüfung liegt bereits in `isValidSegmentScore`. | 501-I08          |
| T-8 | Wie wird der Bust der KI behandelt?                                                                                           | Wie bei einem Menschen: die Aufnahme endet, die Punkte werden zurückgesetzt, die Bestätigung „Weiter" erfolgt am Gerät durch den Menschen (E-1).         | 501-I21          |
