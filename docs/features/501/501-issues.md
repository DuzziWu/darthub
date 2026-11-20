# 501 — Vorbereitete GitHub-Issues

26 Issues für den Spielmodus 501, vollständig ausgearbeitet und für die Anlage im
Repository `DuzziWu/darthub` vorbereitet.

Die Issues setzen die verbindlichen fachlichen Entscheidungen E-1 bis E-5 aus
[501-spec.md](./501-spec.md) um. Die betroffenen Issues sind entsprechend angepasst;
die Nummerierung und die Milestone-Zuordnung bleiben unverändert.

**Zustand:** Die Issues sind **nicht** auf GitHub angelegt. Im Arbeitsverzeichnis
existiert keine GitHub-Authentifizierung (`gh` ist nicht angemeldet, `GITHUB_TOKEN` ist
nicht gesetzt); ein Schreibversuch gegen die GitHub-API antwortet mit `401`. Siehe
[Auslieferung an GitHub](#auslieferung-an-github) am Ende dieses Dokuments.

## Inhalt

- [Anlagekonvention](#anlagekonvention)
- [M1: Spielvorbereitung und Konfiguration](#m1-spielvorbereitung-und-konfiguration)
- [M2: Spieloberflaeche und Scoreboard](#m2-spieloberflaeche-und-scoreboard)
- [M3: Wurfeingabe und Dartboard-Integration](#m3-wurfeingabe-und-dartboard-integration)
- [M4: Spielregeln und Punkteberechnung](#m4-spielregeln-und-punkteberechnung)
- [M5: Undo und Wurfkorrekturen](#m5-undo-und-wurfkorrekturen)
- [M6: Legs und Spielabschluss](#m6-legs-und-spielabschluss)
- [M7: KI-Gegner mit Average-Modell](#m7-ki-gegner-mit-average-modell)
- [M8: Statistiken und Spielauswertung](#m8-statistiken-und-spielauswertung)
- [M9: Qualitaetssicherung und Optimierung](#m9-qualitaetssicherung-und-optimierung)
- [Auslieferung an GitHub](#auslieferung-an-github)

## Anlagekonvention

| Konvention | Wert                                                                  |
| ---------- | --------------------------------------------------------------------- |
| Titel      | `501-I<Nummer>: <Kurzbeschreibung>`                                   |
| Labels     | `501`, `enhancement` (Bugs zusätzlich `bug`)                          |
| Milestone  | `501 — <Milestone-Name>` aus [501-milestones.md](./501-milestones.md) |
| Verweise   | Jedes Issue verweist auf die Doku in `docs/features/501/`.            |

Milestones, die angelegt werden müssen:

| #   | Milestone                                         | Beschreibung                               |
| --- | ------------------------------------------------- | ------------------------------------------ |
| 1   | `501 — M1: Spielvorbereitung und Konfiguration`   | Teilnehmer, KI-Plätze, Format, Reihenfolge |
| 2   | `501 — M2: Spieloberfläche und Scoreboard`        | Anzeige von Spieler, Punkten, Historie     |
| 3   | `501 — M3: Wurfeingabe und Dartboard-Integration` | Manuelle und Board-Eingabe                 |
| 4   | `501 — M4: Spielregeln und Punkteberechnung`      | Bust, Checkout, Leg- und Spielabschluss    |
| 5   | `501 — M5: Undo und Wurfkorrekturen`              | Korrektur über die ganze Partie            |
| 6   | `501 — M6: Legs und Spielabschluss`               | Leg-Zählung, Ansage, Ergebnis              |
| 7   | `501 — M7: KI-Gegner mit Average-Modell`          | Average, Checkout-Strategie, KI-Platz      |
| 8   | `501 — M8: Statistiken und Spielauswertung`       | Kennzahlen und Speicherung                 |
| 9   | `501 — M9: Qualitätssicherung und Optimierung`    | Regressionstests und visuelle Kontrolle    |

Zusätzlich wird das Label `501` angelegt.

---

## M1: Spielvorbereitung und Konfiguration

### 501-I01: Teilnehmerzahl der 501 auf 2 bis 4 begrenzen

**Kurzbeschreibung:** Die Spielkonfiguration der 501 akzeptiert heute 1 bis 4 Spieler.
Die Anforderung verlangt 2 bis 4 Teilnehmer insgesamt, davon mindestens ein Mensch.

**Warum:** Eine Partie mit nur einem Teilnehmer ist kein 501-Spiel. Die Grenze gehört an
die Stelle, an der die Teilnehmerzahl entsteht — in die Konfiguration, nicht in eine
Prüfung hinterher.

**Umsetzung:**

1. In `src/components/x01/X01MatchView.tsx` die Übergabe an `PlayerSetup` von
   `minPlayers={1}` auf `minPlayers={2}` ändern.
2. Prüfen, dass `PlayerSetup` bei zu wenigen Namen eine Meldung anzeigt und den Start
   verweigert (bestehende Fehlerbehandlung in `handleStart` genügt).
3. Sicherstellen, dass `maxPlayers={4}` bleibt und dass die Oberfläche genau so viele
   Plätze anbietet, wie die gewählte Zahl.
4. Den Mindestwert so setzen, dass die 301 nicht unbeabsichtigt verändert wird: prüfen,
   ob `X01MatchView` auch von der 301-Ansicht benutzt wird, und die Zahl dort belassen.

**Akzeptanzkriterien:**

- Der Start der Partie ist mit einem Teilnehmer nicht möglich; es erscheint eine
  verständliche Meldung.
- Mit zwei, drei und vier Teilnehmern startet die Partie.
- Die 301 verhält sich unverändert.

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/components/game/PlayerSetup.tsx`, `src/components/game/types.ts`

**Abhängigkeiten:** keine

**Labels:** `501`, `enhancement`

---

### 501-I02: Mensch- und KI-Plätze in der Spielkonfiguration unterscheiden

**Kurzbeschreibung:** Die 501 unterstützt gemischte Runden. Die Konfiguration muss
deshalb je Platz festhalten, ob ein Mensch oder eine KI dort sitzt.

**Warum:** Ohne diese Unterscheidung gibt es keinen Weg, einen KI-Gegner in die Partie zu
setzen — und damit auch keinen Weg, die Spielvarianten „Einzelspieler gegen KI" und
„gemischte Runde" zu erfüllen.

**Umsetzung:**

1. Eine Sitz-Beschreibung einführen, etwa
   `{ id, name, kind: "human" | "ai", average?: number }`.
2. In `src/components/game/types.ts` die Typen für das Setup erweitern; die heutige
   `PlayerSetupOptions` reicht nicht, weil sie nur Out-Regel, Boardquelle und Format
   trägt.
3. In `src/components/game/PlayerSetup.tsx` je Platz eine Wahl „Mensch" / „KI" anbieten.
   Die Wahl ist eine Segment- oder Radiogruppe, damit die Tastaturbedienung erhalten
   bleibt.
4. Nur für KI-Plätze die Average-Auswahl anzeigen (die Einstellungswerte kommen mit
   501-I18).
5. Ein KI-Platz ohne ausgewählten Average darf den Start nicht verhindern; er bekommt
   eine Vorgabestufe.
6. Namesfelder für KI-Plätze automatisch belegen (etwa „KI 1"), aber editierbar lassen.
7. Prüfen, dass die bestehenden Modi (Cricket, Around The Clock, Shanghai) den neuen
   Typ ohne Anpassung weiterverwenden können — die Auswahl „Mensch/KI" ist für sie
   sinnlos und muss dort ausgeblendet bleiben.

**Akzeptanzkriterien:**

- In der 501-Konfiguration lässt sich jeder Platz als Mensch oder KI kennzeichnen.
- Bei mindestens einem KI-Platz erscheint die Average-Auswahl an diesem Platz.
- Ein KI-Platz zeigt einen Namen, der sich ändern lässt.
- Die anderen Spielmodi zeigen keine KI-Auswahl.
- Die Sitzliste enthält nach dem Start die Information „Mensch" beziehungsweise „KI"
  und den Average des KI-Platzes.

**Relevante Dateien:** `src/components/game/PlayerSetup.tsx`,
`src/components/game/types.ts`, `src/components/x01/X01MatchView.tsx`

**Abhängigkeiten:** keine

**Labels:** `501`, `enhancement`

---

### 501-I03: Spielformat „Best of 7" und „Best of 9" anbieten

**Kurzbeschreibung:** Die 501 bietet bisher Single Leg, Best of 3 und Best of 5. Die
Anforderung verlangt zusätzlich Best of 7 und Best of 9.

**Warum:** Die Anforderung nennt fünf Formate. Der Motor unterstützt jedes „Best of N"
bereits (`LegSetManager`), es fehlt nur die Auswahl.

**Umsetzung:**

1. In `src/components/x01/X01MatchView.tsx` die Konstante `MATCH_FORMATS` um
   `{ id: "bo7", label: "Best of 7 legs", legs: 7 }` und
   `{ id: "bo9", label: "Best of 9 legs", legs: 9 }` erweitern.
2. Prüfen, dass `LegSetManager` die Größen korrekt verarbeitet — `winsNeeded(7)` ergibt 4,
   `winsNeeded(9)` ergibt 5.
3. Sicherstellen, dass die Anzeige „Leg x/N" die neue Größe mitführt; sie liest die
   Größe bereits aus der Konfiguration.
4. Einen Unit-Test für die Zählung bei 7 und 9 ergänzen.

**Akzeptanzkriterien:**

- In der 501-Konfiguration stehen Single Leg, Best of 3, 5, 7 und 9 zur Auswahl.
- Eine Partie mit Best of 7 endet, sobald ein Spieler 4 Legs gewonnen hat.
- Eine Partie mit Best of 9 endet, sobald ein Spieler 5 Legs gewonnen hat.
- Die Anzeige nennt die passende Gesamtzahl der Legs.

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/game-engine/rules/LegSetManager.ts`,
`tests/unit/game-engine/rules/LegSetManager.test.ts`

**Abhängigkeiten:** keine

**Labels:** `501`, `enhancement`

---

### 501-I04: Reihenfolge der Spieler vor dem Start ändern können

**Kurzbeschreibung:** Die Reihenfolge der Aufnahmen folgt heute der Reihenfolge der
Namensfelder. Die Anforderung verlangt eine festlegbare Spielerreihenfolge.

**Warum:** Die Reihenfolge der Aufnahmen ist bei einer Partie mit mehreren Beteiligten
eine echte Entscheidung, keine Nebenbeiigkeit.

**Umsetzung:**

1. In der Sitzverwaltung aus 501-I02 eine Reihenfolgebedienung ergänzen: eine
   Schaltfläche „nach oben" / „nach unten" je Platz, oder eine Ziehliste.
2. Die Reihenfolge als Teil des Sitz-Objekts führen und beim Start an
   `GameEngine.startMatch({ playerIds })` in dieser Reihenfolge übergeben.
3. Die Bedienung muss per Tastatur erreichbar sein und einen Namen tragen, der
   screenreadbar ist (etwa „Spielerin Alice nach oben").
4. Keine Reihenfolgeänderung **während** der Partie anbieten — die Aufnahmenfolge eines
   laufenden Spiels ist nicht verhandelbar.

**Akzeptanzkriterien:**

- Vor dem Start lässt sich jeder Platz nach oben und nach unten verschieben.
- Die verschobene Reihenfolge bestimmt die Reihenfolge der Aufnahmen.
- Die Bedienung ist per Tastatur bedienbar und announces ihre Wirkung.
- Während der Partie gibt es keine Reihenfolgebedienung.

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/components/game/PlayerSetup.tsx`, `src/components/game/types.ts`

**Abhängigkeiten:** 501-I02

**Labels:** `501`, `enhancement`, `accessibility`

---

### 501-I05: In der 501 nur Straight Out und Double Out anbieten

**Kurzbeschreibung:** Die Out-Regel-Auswahl bietet aktuell Double Out, Master Out und
Straight Out. Die Anforderung nennt für die 501 nur Straight Out und Double Out.

**Warum:** Die Auswahl soll genau die Regeln zeigen, die die 501 anbietet. Der Motor
behält Master Out — die Fähigkeit geht nicht verloren, nur das Angebot wird eingegrenzt.

**Umsetzung:**

1. Die Auswahl der Out-Regeln aus dem Motor (`OUT_RULE_CHOICES` in
   `src/game-engine/modes/registry.ts`) in eine frei wählbare Teilmenge zerlegen, statt
   sie global zu filtern — sonst verliert auch der Game Center die Master-Out-Zeile.
2. `PlayerSetup` eine Requisite geben, über die die angebotenen Regeln eingegrenzt
   werden; die Voreinstellung bleibt der heutige Umfang, damit die anderen Modi
   unverändert bleiben.
3. In `X01MatchView` für die 501 nur `straight` und `double` übergeben.
4. Prüfen, dass die Spielertext-Zuordnung in `src/components/game/playerErrors.ts` für
   beide Regeln greift.

**Akzeptanzkriterien:**

- Die 501-Konfiguration bietet genau Straight Out und Double Out.
- Der Game Center zeigt weiterhin alle Regeln, die der Motor kennt.
- Die 301 und die anderen Modi bieten unverändert alle drei Regeln.
- Die gewählte Regel gilt für die ganze Partie.

**Relevante Dateien:** `src/components/game/PlayerSetup.tsx`,
`src/components/game/types.ts`, `src/components/x01/X01MatchView.tsx`,
`src/game-engine/modes/registry.ts`

**Abhängigkeiten:** keine

**Bezug:** E-3 (Master Out ist ausdrücklich nicht im Funktionsumfang der 501).

**Labels:** `501`, `enhancement`

---

## M2: Spieloberflaeche und Scoreboard

### 501-I06: Wurfhistorie über die gesamte Partie anzeigen

**Kurzbeschreibung:** Die Wurfhistorie zeigt heute nur den laufenden Zug. Die
Anforderung verlangt eine Historie der Partie.

**Warum:** Die Historie ist die Grundlage für zwei geforderte Funktionen: die Korrektur
eines Wurfes aus einer vergangenen Aufnahme (501-I14) und das Nachvollziehen der
Partie. Beides ist ohne Historie nicht bedienbar.

**Umsetzung:**

1. Eine Auflistung aller Aufnahmen der Partie ergänzen. Der Motor liefert sie bereits:
   `engine.getVisits()` gruppiert das Wurfprotokoll in Aufnahmen
   (`src/game-engine/throwLedger.ts`, `groupVisits`).
2. Die Aufnahmen umschaltbar machen (aktuelle Aufnahme, alle Aufnahmen), damit die
   Partie auf dem Smartphone nicht unlesbar wird.
3. Jeder Wurf einer Aufnahme bleibt anklickbar und meldet seinen Index im Wurfprotokoll
   an — dieser Index ist die Eingabe für `correctThrow`.
4. Die bestehende Darstellung der Wurfchips (`VisitChip`, `visitBadge`) wiederverwenden,
   damit Bust und Segment einheitlich aussehen.
5. Bei einer Korrektur eines Wurfes aus einer abgeschlossenen Aufnahme die vorhandene
   Bestätigungslogik aus `useMatchHistory` beibehalten.

**Akzeptanzkriterien:**

- Die Oberfläche zeigt die Aufnahmen der gesamten Partie.
- Jeder Wurf einer vergangenen Aufnahme lässt sich wählen.
- Die Anzeige unterscheidet gezählte Würfe und Bustaende wie bisher.
- Auf dem Smartphone bleibt die Oberfläche bedienbar.
- Die Historie stimmt mit dem Wurfprotokoll des Motors überein.

**Relevante Dateien:** `src/components/game/ThrowHistoryControls.tsx`,
`src/components/game/useMatchHistory.ts`, `src/components/game/VisitChips.tsx`,
`src/game-engine/throwLedger.ts`

**Abhängigkeiten:** 501-I01

**Labels:** `501`, `enhancement`

---

### 501-I07: Spielstand, aktiven Spieler und Restpunkte durchgehend sichtbar machen

**Kurzbeschreibung:** Die Anforderung verlangt, dass Restpunktzahl und aktiver Spieler
jederzeit erkennbar sind und es eine Übersicht über alle Spieler gibt.

**Warum:** Der vorhandene Aufbau erfüllt das heute bereits weitgehend. Das Issue stellt
das sicher und schließt die Lücke, die zwischen dem Spielerüberblick und dem Scoreblatt
besteht: es gibt zwei Flächen mit denselben Zahlen und keine klare Rollenverteilung.

**Umsetzung:**

1. Prüfen, welche der beiden Flächen die führende ist. Empfehlung: `PlayerScoreboard`
   (Überblick, mit `data-active-player` und `data-remaining`) führt, `ScoreDisplay` zeigt
   die Details der letzten Aufnahme.
2. Die aktive Zuordnung des Spielers prüfen: sie entsteht in `PlayerScoreboard` über
   `data-active-player` und den Text „AM ZUG". Sie darf nicht nur über Farbe laufen.
3. Prüfen, dass die Restpunktzahl des aktiven Spielers auf 390 px ohne Scrollen sichtbar
   ist — die Anordnung in `MatchLayout` liest die Reihenfolge
   Überblick → Turn → Eingabe → Board-Vorschau.
4. Keine Layoutänderung vornehmen, die die vier anderen Modi mitreißt; `MatchLayout` ist
   gemeinsam. Änderungen an der Reihenfolge wirken auf alle Modi und brauchen eine
   visuelle Kontrolle bei allen fünf.

**Akzeptanzkriterien:**

- Die Restpunktzahl des aktiven Spielers ist ohne Scrollen sichtbar.
- Der aktive Spieler ist durch Markierung **und** Text erkennbar.
- Alle Spieler stehen mit Name und Restpunktzahl in einer Übersicht.
- Es gibt an einer Stelle nur eine führende Zahl je Spieler.

**Relevante Dateien:** `src/components/game/PlayerScoreboard.tsx`,
`src/components/game/ScoreDisplay.tsx`, `src/components/game/MatchLayout.tsx`,
`src/components/game/useIsCompact.ts`

**Abhängigkeiten:** 501-I01

**Labels:** `501`, `enhancement`

---

## M3: Wurfeingabe und Dartboard-Integration

### 501-I08: Direkte Punktzahleingabe im Dart-Pad

**Kurzbeschreibung:** Das Pad wählt heute zuerst ein Band und dann einen Sektor. Die
Anforderung verlangt zusätzlich die direkte Eingabe von Punkten.

**Warum:** Nach einem Gewinn kann der Spieler die Zahl nicht mehr am Board ablesen, und
das Band-zuerst-Schema kostet zwei BedienSchritte je Wurf. Die direkte Eingabe ist der
schnellere Weg, besonders auf dem Smartphone.

**Umsetzung:**

1. In `src/components/game/ThrowInputPad.tsx` ein Zahlenfeld ergänzen, das einen Wert
   von 0 bis 60 annimmt.
2. Die Gültigkeit über `isValidSegmentScore` aus `src/game-engine/rules/OutRules.ts`
   prüfen lassen. Wichtig: Ohne Segmentangabe kann ein Wert unter Double Out keinen
   Finish darstellen — das ist eine gültige Eingabe, aber kein Checkout. Die Eingabe
   braucht daher eine zweite Angabe: das Segment (Single/Double/Triple/Bull).
3. Die Prüfung an der Motor-Seite lassen (`GameEngine.validateThrowInput` prüft bereits
   Punkte 0–60 und die Segment-/Punkte-Kombination) und im Pad nur die Eingabeform
   abdecken; die Meldung bei einem ungültigen Wert muss den Spielzustand unangetastet
   lassen.
4. Das bestehende Band-/Sektor-Raster **beibehalten** — es ist die zugängliche Route,
   die auch die Board-Segmentwahl spiegelt.
5. Beide Wege müssen dieselben Werte erzeugen: ein über das Zahlenfeld eingetragener
   „D16" und ein über das Raster gewählter Double 16 müssen identisch im Protokoll
   stehen.

**Akzeptanzkriterien:**

- Das Pad nimmt eine Punktzahl von 0 bis 60 direkt entgegen.
- Ein Wert außerhalb des gültigen Bereichs wird abgelehnt, ohne den Spielzustand zu
  verändern.
- Die Kombination aus Punktzahl und Segment wird geprüft (etwa „Single 25" wird
  abgelehnt).
- Ein über den Zahlenweg eingetragener Wurf ist im Protokoll nicht von einem über das
  Raster eingetragenen zu unterscheiden.
- Das Band-Raster bleibt bedienbar.

**Relevante Dateien:** `src/components/game/ThrowInputPad.tsx`,
`src/components/game/SegmentControl.tsx`,
`src/game-engine/rules/OutRules.ts`, `src/game-engine/GameEngine.ts`

**Abhängigkeiten:** keine

**Labels:** `501`, `enhancement`

---

### 501-I09: Dart-Treffer der laufenden Aufnahme auf dem Board anzeigen

**Kurzbeschreibung:** `DartBoard` besitzt eine `markers`-Requisite, die bisher niemand
belegt. Das Board soll die Treffer der laufenden Aufnahme anzeigen.

**Warum:** Der Spieler sieht nach einem Wurf nicht, wo der Dart eigentlich gelandet
ist. Gerade bei der Board-Eingabe ist das die Rückmeldung, die die Eingabe bestätigt.

**Umsetzung:**

1. Die `markers`-Requisite in `src/components/board/DartBoard.tsx` belegen. Sie erwartet
   `{ xMm, yMm, label }` je Wurf.
2. Die Koordinaten aus dem Treffer holen. `resolveBoardHit` aus
   `src/board/boardGeometry.ts` liefert Segment, Punkte, Sektor und Label — die
   Millimeterkoordinaten des Treffers müssen aus dem Klickereignis mitgeführt werden
   (die Umrechnung `toBoardMm` existiert bereits).
3. Nur die Wurf der laufenden Aufnahme markieren, nicht die ganze Partie.
4. Beim Umschalten zwischen Board und Pad muss die Markierung erhalten bleiben.

**Akzeptanzkriterien:**

- Die Würfe der laufenden Aufnahme erscheinen als Marker auf dem Board.
- Der Marker benennt den Wurf (etwa „T20").
- Beim Wechsel des Eingabemodus bleiben die Marker sichtbar.
- Das Board wird nicht gestalterisch verändert.

**Relevante Dateien:** `src/components/board/DartBoard.tsx`,
`src/board/boardGeometry.ts`, `src/components/game/MatchLayout.tsx`

**Abhängigkeiten:** 501-I06

**Labels:** `501`, `enhancement`

---

## M4: Spielregeln und Punkteberechnung

### 501-I10: Checkout-Regeln der 501 gegen den Motor prüfen und absichern

**Kurzbeschreibung:** Die Checkout-Erkennung wird geprüft und durch Tests abgesichert:
Double Out, Straight Out, der auf 1 gelandete Spieler und der Miss ohne Segment.

**Warum:** Der Checkout entscheidet über den Sieg. Die Regeln sind im Motor vorhanden
(`OutRules.ts`), aber eine Lücke fällt in einer Partie sofort auf.

**Umsetzung:**

1. Die Fälle durchspielen und je Fall einen Unit-Test schreiben:
   - Double Out: ein Double schließt ab, ein Single, Triple und Bull nicht.
   - Straight Out: jeder Finish schließt ab.
   - Auf 1 gelandet: unter Double Out ein Bust, unter Straight Out kein Bust. Der Test
     liegt auf der Ebene des Motors und deckt dort auch Master Out ab — die Regel
     existiert im Motor weiter, wird der 501 aber nicht angeboten (E-3).
   - Über null hinaus: ein Bust.
   - Ein Miss trägt kein Segment; ein Miss mit Segment ist ein Validierungsfehler.
2. Prüfen, dass die Ansicht den Bust **vorher** berechnet (siehe
   `isBustThrow` in `src/components/x01/X01MatchView.tsx`) und nie aus dem
   Fehlertext ableitet.
3. Die Fehlertexte in `src/components/game/playerErrors.ts` prüfen: sie entstehen aus dem
   Code, nie aus der englischen Meldung.
4. Die Auflösung der Bust-Aufnahme nicht doppelt belegen: Die Erkennung, ob ein Wurf
   bustet, und die Auflösung der Aufnahme gehören in dieselbe Regel (E-1, umgesetzt in
   501-I11). Dieser Issue prüft die Erkennung, jener die Auflösung.

**Akzeptanzkriterien:**

- Für jeden genannten Fall existiert ein Unit-Test.
- Die Tests laufen gegen den Motor, nicht gegen eine Nachbildung der Regel.
- Der Bust-Pfad der Oberfläche nennt „Bust. N verbleibend." und keinen englischen
  Entwicklertext.
- Die Erkennung eines Busts und seine Auflösung sind nicht an zwei Stellen
  implementiert.
- Die bestehenden Tests in `tests/unit/game-engine/modes/StandardMode.test.ts` bleiben
  grün.

**Relevante Dateien:** `src/game-engine/rules/OutRules.ts`,
`src/game-engine/modes/StandardMode.ts`, `src/components/x01/X01MatchView.tsx`,
`src/components/game/playerErrors.ts`

**Abhängigkeiten:** keine

**Labels:** `501`, `enhancement`

---

### 501-I11: Ein Bust beendet die Aufnahme, setzt ihre Punkte zurück und wartet auf Bestätigung

**Kurzbeschreibung:** Der Ist-Stand weicht an drei Stellen von der 501-Regel ab: Ein Bust
beendet die Aufnahme nicht (der Spieler wirft weiter), die Punkte der Aufnahme werden
nicht zurückgesetzt, und es gibt keinen Spielerwechsel nach dem Bust. Geprüft am
laufenden Motor mit `StandardMode` und 100 Startpunkten: nach T20 und Bust steht der
Spieler weiterhin bei 40 statt wieder bei 100, und `currentPlayerId` bleibt auf dem
büstenden Spieler.

Nach E-1 muss ein Bust die Aufnahme sofort beenden, die Aufnahmepunkte vollständig
zurücksetzen und auf eine ausdrückliche Bestätigung warten, bevor der nächste Spieler
an der Reihe ist.

**Warum:** Die Anforderung verlangt die korrekte Behandlung von Bust. Ohne
Bestätigungsschritt wäre die Regel „Bust beendet die Aufnahme" nicht von der heutigen
Regel „Bust zählt nichts, der Spieler wirft weiter" zu unterscheiden — die Punkte der
Aufnahme müssten dann zwar zurückgesetzt werden, der Spieler dürfte aber trotzdem noch
in derselben Aufnahme weiterwerfen. Die Bestätigung trennt die beiden Fälle sauber:
nach dem Bust ist die Aufnahme zu Ende, und erst das „Weiter" schließt sie ab.

**Umsetzung — Teil 1: Motor**

1. Das Protokollmodell erweitern, sodass ein Bust die Aufnahme beendet. Heute endet eine
   Aufnahme, wenn der Zug wechselt oder ein Wurf bustet
   (`deriveVisitIndexes` in `src/game-engine/throwLedger.ts`) — das Bust-Ende wird dort
   bereits abgebildet, aber der Zug läuft weiter.
2. Den Aufnahmestand ableitbar machen (Entscheidung D-12): Der Motor muss den
   Punktestand **zu Beginn der Aufnahme** kennen, um die Aufnahmepunkte zurücksetzen zu
   können. Der Startwert wird aus dem Protokoll abgeleitet, nicht gespeichert (Grundlage:
   T-1).
3. Den Bust-Ablauf im Motor als Zustandsphase führen, in der auf die Bestätigung gewartet
   wird (Entscheidung D-11). In dieser Phase:
   - nimmt der Motor keine weiteren Würfe entgegen und liefert dafür einen stabilen
     Fehlercode,
   - bleibt der Spieler in der aktuellen Spielansicht,
   - kann der Spielerwechsel über einen neuen Engine-Aufruf vollzogen werden.
4. Den Spielerwechsel **nicht** automatisch auslösen. Die Umlagerung von „Zugwechsel
   nach dem dritten Wurf" und „Zugwechsel nach einem Bust" darf nicht vermischt werden:
   Der Bust-Wartezustand ist ein eigener Zustand, kein Zählerstand.
5. Die abgeleiteten Größen prüfen: `deriveVisitIndexes`, `deriveTurnThrows`,
   `deriveTurnIndexes` und die Statistik „Best Leg" (Wurfzahl je Leg). Zu beachten: ein
   Bust verbraucht **keinen** Wurfplatz (`deriveTurnThrows` zählt ihn als Wurf des Zugs,
   der keinen Platz belegt) — diese Regel und die Rücksetzung der Aufnahmepunkte dürfen
   sich nicht widersprechen.
6. Die Korrekturregeln prüfen: `assertTurnRotationUnchanged` vergleicht die Zugehörigkeit
   der Würfe zu ihren Zügen. Ein geänderter Bust-Ablauf verändert diese Zugehörigkeit und
   damit, welche Korrekturen der Motor annimmt. Der bestehende Refusal
   `TURN_ROTATION_CHANGED` bleibt gültig — es ist aber zu prüfen, ob die in
   `design-system/darthub/pages/match.md` §6 dokumentierte Reise durch die Refusal-Codes
   weiterhin gilt oder neu vermessen werden muss.
7. Die Regressionsfälle in `tests/unit/game-engine/` nachziehen.

**Umsetzung — Teil 2: Oberfläche**

8. Die Bust-Rückmeldung an der Eingabefläche ausgeben: Sie benennt den Bust, nennt den
   zurückgesetzten Punktestand und fordert zum Fortfahren auf. Der Text entsteht aus dem
   Motorzustand, nicht aus einem lokalen Merkmal der Ansicht (Entscheidung D-1: nur eine
   Wahrheit im Motor).
9. Eine Schaltfläche „Weiter" anbieten, die den Spielerwechsel auslöst. Sie liegt in der
   Nähe der Eingabefläche und ist auf dem Smartphone mit einer Hand bedienbar.
10. Die Eingabe sperren, solange der Motor auf die Bestätigung wartet. Pad und Board
    dürfen dann keinen Wurf entgegennehmen.
11. Prüfen, dass Undo und Korrektur im Wartezustand den Zustand nicht verfälschen: Beide
    laufen durch denselben Replay wie sonst. Nimmt der Undo den bustenden Wurf zurück,
    endet die Wartephase, weil es nichts mehr zu bestätigen gibt; korrigiert wird der
    Bust, gilt der Ablauf erneut.

**Akzeptanzkriterien:**

- Nach einem Bust endet die Aufnahme; der Spieler kann keinen weiteren Wurf dieser
  Aufnahme eingeben.
- Der Punktestand des büstenden Spielers steht wieder auf dem Wert, den er zu Beginn
  der Aufnahme hatte (nach T20 und Bust auf 100, nicht auf 40).
- Der Spieler bleibt in der aktuellen Spielansicht; es gibt keinen Wechsel in einen
  Ergebnis- oder Endbildschirm.
- Es erscheint eine verständliche Bust-Rückmeldung, die den Bust benennt, den
  zurückgesetzten Punktestand nennt und zum Fortfahren auffordert.
- Der Spielerwechsel erfolgt **erst** nach dem Druck auf „Weiter" und **nie** automatisch.
- Während der Wartephase nimmt der Motor keinen weiteren Wurf entgegen und liefert
  dafür einen stabilen Fehlercode.
- Der Bust zählt in der Wurfzahl der Leg als Wurf, belegt aber keinen der drei
  Wurfplätze.
- Die abgeleiteten Aufnahme- und Zuggrenzen bleiben konsistent.
- Die Korrekturregeln verhalten sich wie dokumentiert.
- Die 301 verhält sich entsprechend derselben Entscheidung (die Entscheidung gilt für
  den x01-Modus) oder wird ausdrücklich ausgenommen.

**Relevante Dateien:** `src/game-engine/GameEngine.ts`,
`src/game-engine/throwLedger.ts`, `src/game-engine/modes/StandardMode.ts`,
`src/game-engine/types.ts`, `src/components/x01/X01MatchView.tsx`,
`src/components/game/playerErrors.ts`,
`tests/unit/game-engine/turnThrows.test.ts`,
`tests/unit/game-engine/turnIndexes.test.ts`

**Abhängigkeiten:** keine (E-1 ist entschieden). Grundlage: T-1 sowie D-11 und D-12 in
`501-technical-decisions.md`

**Labels:** `501`, `enhancement`, `bug`

---

### 501-I12: Restpunktzahl und Spielerwechsel nach jedem Wurf korrekt halten

**Kurzbeschreibung:** Die Neuberechnung von Restpunktzahl, Zählern und Spielerwechsel
nach jedem Wurf wird geprüft und abgesichert.

**Warum:** Das Protokoll ist die einzige Wahrheit. Jede Abweichung zwischen Protokoll
und Anzeige ist sichtbar und zerstört das Vertrauen in die ganze Partie.

**Umsetzung:**

1. Prüfen, dass `GameEngine.applyToDraft` nach dem dritten Wurf den Zug wechselt
   (`DARTS_PER_TURN`) und die Restpunktzahl des aktiven Spielers verringert.
2. Prüfen, dass ein abgelehnter Wurf den Zustand **nicht** verändert
   (`GameEngine.recordThrow` wirft vor jeder Zustandsänderung).
3. Prüfen, dass die Anzeige dieselbe Quelle liest wie die Berechnung: die Ansicht liest
   `matchState.players[].totalPoints`, nicht eine eigene Buchführung.
4. Den Bust-Fall mitprüfen: Nach einem Bust wird die Restpunktzahl der Aufnahme
   zurückgesetzt, und die Summe der gezählten Würfe stimmt erst wieder, wenn der Aufnahme
   der Status „abgeschlossen" zugeordnet ist (E-1, umgesetzt in 501-I11).
5. Tests über eine vollständige Partie schreiben: drei Spieler, mehrere Aufnahmen,
   mindestens ein Bust und mindestens ein Checkout.

**Akzeptanzkriterien:**

- Die Restpunktzahl entspricht nach jedem Wurf der Summe aller gezählten Würfe.
- Der Spielerwechsel erfolgt nach dem dritten Wurf der Aufnahme.
- Nach einem Bust entspricht die Restpunktzahl wieder dem Stand vor der Aufnahme
  (E-1).
- Ein abgelehnter Wurf verändert weder Punktestand noch Zähler noch Protokoll.
- Ein vollständiger Partieablauf ist durch einen Test abgedeckt.

**Relevante Dateien:** `src/game-engine/GameEngine.ts`,
`src/game-engine/modes/StandardMode.ts`,
`tests/unit/game-engine/GameEngine.test.ts`

**Abhängigkeiten:** 501-I10, 501-I11

**Labels:** `501`, `enhancement`

---

### 501-I13: Startreihenfolge der Folge-Leg festlegen

**Kurzbeschreibung:** Nach einer gewonnenen Leg beginnt die nächste Leg heute mit dem
Sieger der vorherigen. Nach E-2 wechselt der Starter nach jedem Leg gemäß den üblichen
Dartregeln: der Spieler, der die Leg nicht gewonnen hat, beginnt die nächste.

**Warum:** Die Aufnahmeordnung gehört zur Regel. E-2 verlangt eine nachvollziehbare und
zuverlässige Umsetzung — das gelingt nur, wenn die Regel an genau einer Stelle
entschieden wird und für jede Spielerzahl eindeutig ist (Entscheidung D-13).

**Umsetzung:**

1. Die Regel als eine benannte Funktion im Motor umsetzen (Entscheidung D-13): Der
   Starter der Folge-Leg ist der Spieler, der die gerade beendete Leg **nicht** gewonnen
   hat; bei mehr als zwei Spielern folgt er in der Sitzreihenfolge auf den Sieger. Die
   Regel ist damit unabhängig davon, wer gewonnen hat, und für 2, 3 und 4 Spieler
   eindeutig.
2. Die Regel in `StandardMode.handleLegCompleted` anwenden: die Leg wird gewonnen, die
   Punktzahlen werden zurückgesetzt, und der Spieler am Zug wird nach der Regel
   gesetzt.
3. Prüfen, dass die Zählung in `LegSetManager` unberührt bleibt — sie zählt Legs, sie
   bestimmt nicht die Reihenfolge.
4. Prüfen, dass `resultSignature` den neuen Zustand abbildet, damit eine Korrektur, die
   den Sieger ändert, weiterhin erkannt wird.
5. Tests je Spielerzahl (2, 3 und 4 Spieler) schreiben, damit die Reihenfolge nicht von
   der jeweiligen Partie abhängt.

**Akzeptanzkriterien:**

- Nach einer gewonnenen Leg beginnt der Spieler, der die Leg nicht gewonnen hat, die
  nächste Leg.
- Bei zwei Spielern startet damit der Verlierer der Leg.
- Bei drei und vier Spielern ist die Reihenfolge eindeutig und folgt der Sitzreihenfolge.
- Die Leg-Zählung bleibt unverändert korrekt.
- Ein Test deckt den Ablauf über zwei Legs ab, ein weiterer je zusätzlicher
  Spielerzahl.

**Relevante Dateien:** `src/game-engine/modes/StandardMode.ts`,
`src/game-engine/rules/LegSetManager.ts`,
`tests/unit/game-engine/modes/StandardMode.test.ts`

**Abhängigkeiten:** keine (E-2 ist entschieden). Grundlage: D-13 in
`501-technical-decisions.md`

**Labels:** `501`, `enhancement`, `bug`

---

## M5: Undo und Wurfkorrekturen

### 501-I14: Wurfkorrektur für Würfe aus vergangenen Aufnahmen ermöglichen

**Kurzbeschreibung:** `GameEngine.correctThrow` kann jeden Wurf im Protokoll korrigieren,
auch aus einer vergangenen Aufnahme. Die Oberfläche bietet die Auswahl aber nur für den
laufenden Zug.

**Warum:** Die Anforderung verlangt ausdrücklich, dass auch Würfe aus vergangenen
Aufnahmen korrigierbar sind, und dass danach alle abhängigen Zustände neu berechnet
werden. Der Motor kann das bereits; die Oberfläche ist die Lücke.

**Umsetzung:**

1. Die Historie aus 501-I06 nutzen: jeder Wurf einer jeden Aufnahme ist wählbar.
2. Den Wurfindex im Protokoll an `useMatchHistory.selectThrow` übergeben. Der Index ist
   die Position im Wurfprotokoll, nicht die Position in der Liste — die
   `turnOffset`-Logik in `useMatchHistory` zeigt, wie die beiden auseinanderlaufen.
3. Die Bestätigungslogik beibehalten: `useMatchHistory.selectThrow` fragt bei einem Wurf
   aus einer abgeschlossenen Aufnahme nach, weil die Korrektur dann eine
   abgeschlossene Aufnahme verändert.
4. Prüfen, dass die Ableitungen nach der Korrektur stimmen:
   `matchState.players[].totalPoints`, die Aufnahme- und Zuggrenzen, der Leg-Fortschritt
   in `modeData.legSet` und der Spielstatus.
5. Den Bust-Kontext prüfen (E-1): Eine Korrektur **in** eine ungültige Aufnahme hinein
   oder **aus** ihr heraus muss den Zustand wiederherstellen, den die Aufnahme ohne
   Bust gehabt hätte — also den Aufnahmestand als Punktestand, die Aufnahme als
   laufende Aufnahme und den Zug beim büstenden Spieler. Geprüft am Ist-Stand: Heute wird
   die Korrektur eines Busts zu einem zählenden Wurf angenommen; nach E-1 muss das den
   Zustand korrekt neu ableiten, nicht nur den einen Wurfwert ersetzen.
6. Prüfen, dass eine vom Motor abgelehnte Korrektur **nichts** verändert — auch nicht den
   Protokoll und auch nicht die Anzeige.
7. Prüfen, dass der Text der Ablehnung einen Ausweg nennt, der wirklich existiert. Der
   Sonderfall `TURN_ROTATION_CHANGED` verlangt den Ausweg „zurücknehmen und neu
   werfen" — kein weiterer Wert wird angenommen.

**Akzeptanzkriterien:**

- Ein Wurf aus der ersten Aufnahme einer Partie lässt sich korrigieren.
- Nach der Korrektur stimmen Restpunktzahlen, Bustzustände, Spielerwechsel und
  Leg-/Spielergebnis.
- Eine Korrektur in eine ungültige Aufnahme hinein oder aus ihr heraus stellt genau den
  Zustand wieder her, den die Aufnahme ohne Bust gehabt hätte (E-1).
- Der Korrekturzielzustand ist im Bildschirm sichtbar, und der ausstehende Wurf ersetzt
  den gewählten.
- Eine abgelehnte Korrektur lässt den Zustand unverändert und nennt einen existierenden
  Ausweg.
- Der Wurf bleibt in seiner ursprünglichen Aufnahme; er wird nicht in eine andere
  verschoben.

**Relevante Dateien:** `src/components/game/useMatchHistory.ts`,
`src/components/game/ThrowHistoryControls.tsx`,
`src/game-engine/GameEngine.ts`, `src/game-engine/throwLedger.ts`,
`src/components/game/playerErrors.ts`

**Abhängigkeiten:** 501-I06, 501-I10, 501-I11

**Labels:** `501`, `enhancement`

---

### 501-I15: Undo nach dem Spielende anbieten

**Kurzbeschreibung:** `GameEngine.undoLastThrow` ist auch nach dem Spielende erlaubt, und
`GameResultBanner` kennt eine `onUndo`-Requisite — die 501-Ansicht reicht sie aber
nicht durch.

**Warum:** Der Wurf, der die Partie entscheidet, ist genau der Wurf, der am ehesten
verdreht wurde. Ohne diesen Weg bleibt der Spieler bei einer Partie, die er für
verloren hält, obwohl er nur falsch getippt hat.

**Umsetzung:**

1. In `src/components/x01/X01MatchView.tsx` die `onUndo`-Requisite des
   `GameResultBanner` belegen und an `handleUndo` binden.
2. `handleUndo` muss den Spielzustand nach dem Undo wieder auf „läuft" setzen — der
   Ergebnisfallschirm ist dann verlassen.
3. Prüfen, dass die Ansage den Vorgang benennt (etwa „Letzter Wurf entfernt.").

**Akzeptanzkriterien:**

- Im Ergebnisfallschirm gibt es einen Weg, den letzten Wurf zurückzunehmen.
- Nach dem Undo läuft die Partie weiter, mit den korrigerten Punktzahlen.
- Der Ergebnisfallschirm wird verlassen und kehrt nicht selbstständig zurück.
- Der Undo-Button an der Eingabefläche bleibt vorhanden und eindeutig benannt (genau ein
  Undo im Bildschirm — die vorhandene End-to-End-Suite sucht nach dem Namen „Undo").

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/components/game/GameResultBanner.tsx`, `src/game-engine/GameEngine.ts`

**Abhängigkeiten:** 501-I06

**Labels:** `501`, `enhancement`

---

## M6: Legs und Spielabschluss

### 501-I16: Leg- und Spielabschluss sauber unterscheiden und anzeigen

**Kurzbeschreibung:** Der Motor unterscheidet Leg-Ende und Spiel-Ende korrekt. Die
Oberfläche macht den Unterschied nicht deutlich: nach einer gewonnenen Leg springen die
Punktzahlen ohne Erklärung zurück auf 501.

**Warum:** Der Sprung von einem Punktestand auf den nächsten ist ohne Ansage
unverständlich. Der Spieler muss erkennen, dass eine Leg gewonnen wurde und warum die
Zahl zurückgesetzt ist.

**Umsetzung:**

1. Den Leg-Abschluss in der Ansicht erkennen. Der Motor liefert ihn über den
   Fortschritt in `modeData.legSet` (`LegSetProgress.legsWon`) und über den Wechsel der
   Punktestände; `X01MatchView` liest beides bereits für die Anzeige „Leg x/N".
2. Eine Ansage ausgeben, die den Leg-Sieger und die neue Runde nennt.
3. Den Fall unterscheiden: Leg-Ende (Partie läuft weiter) und Spiel-Ende (Ergebnis
   erscheint). Der Motor unterscheidet über `matchState.status` und
   `LegSetProgress.matchWinnerId`.
4. Die Ansage in der Statuszeile (`MatchStatus`) ausgeben, damit sie an der Stelle
   erscheint, an der auch Fehlermeldungen stehen.
5. Den Starter der Folge-Leg mitnennen (E-2): Die Ansage sagt, wer die nächste Leg
   beginnt. Der Motor entscheidet das nach der Regel aus 501-I13; die Ansicht liest es
   nur.

**Akzeptanzkriterien:**

- Nach dem Gewinn einer Leg erscheint eine Ansage mit dem Namen des Siegers.
- Die Punktzahlen stehen nach der Ansage wieder auf 501.
- Die Leg-Anzeige zählt um eins weiter.
- Die Ansage nennt den Starter der Folge-Leg (E-2).
- Beim Spielende erscheint das Ergebnis, nicht die Leg-Ansage.
- Die 301 verhält sich unverändert.

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/components/game/MatchStatus.tsx`,
`src/game-engine/rules/LegSetManager.ts`

**Abhängigkeiten:** 501-I12, 501-I13

**Labels:** `501`, `enhancement`

---

### 501-I17: Ergebnis der Partie um Legs und Endstand erweitern

**Kurzbeschreibung:** Das Ergebnisbanner nennt den Sieger und den Endstand, aber nicht,
welche Legs gewonnen wurden und wie der Leg-Verhältnis lautet.

**Warum:** Bei einer Partie über mehrere Legs ist das Leg-Verhältnis die eigentliche
Ergebnisangabe.

**Umsetzung:**

1. `GameResultBanner` die Requisiten für Leg und Set geben (sie existieren bereits:
   `leg?: { current, total }`, `set?: { current, total }`).
2. In `src/components/x01/X01MatchView.tsx` den Fortschritt aus `modeData.legSet`
   lesen und weiterreichen. `legsWon` und `setsWon` liegen dort bereits vor.
3. Das Leg-Verhältnis je Spieler ausweisen (etwa „2:1 Legs").
4. Die Anzeige darf die Farbe nicht allein tragen — das Muster der Zeilen gilt.

**Akzeptanzkriterien:**

- Das Ergebnis nennt das Leg-Verhältnis.
- Das Ergebnis nennt, welcher Spieler die Partie gewonnen hat.
- Die Anzeige ist auch ohne Farbe lesbar.
- Das Banner bleibt auf dem Smartphone bedienbar.

**Relevante Dateien:** `src/components/game/GameResultBanner.tsx`,
`src/components/x01/X01MatchView.tsx`,
`src/game-engine/rules/LegSetManager.ts`

**Abhängigkeiten:** 501-I16

**Labels:** `501`, `enhancement`

---

## M7: KI-Gegner mit Average-Modell

### 501-I18: Spielstärke der KI über ein 3-Dart-Average einstellen

**Kurzbeschreibung:** Der KI-Motor kennt vier feste Stufen mit festen Streuungswerten.
Die Anforderung verlangt eine Einstellung über ein 3-Dart-Average (25, 40, 55, 70, 85).

**Warum:** Der Average ist die verständliche Kennzahl für die Stärke eines Spielers und
die einzige, die ein Spieler einschätzen kann. Er darf kein fester Punktestand je
Aufnahme sein, sondern muss als langfristige Leistung aufgehen.

**Umsetzung:**

1. Den Average als Parameter in den KI-Motor aufnehmen. `StatisticalAiEngine` bekommt
   eine Average-Angabe; daraus werden Streuung (Sigma je Trefferring) und Zielgewichte
   abgeleitet.
2. Die Stufen 25/40/55/70/85 als vorkalibrierte Profile unter `src/ai/config/` ablegen,
   validiert über das vorhandene Schema (`validateDifficultyConfig`).
3. Die Kalibrierung so wählen, dass der Motor über viele Aufnahmen den eingestellten
   Average trifft. Die Vorlage liefert `tests/unit/ai/difficultyMeans.test.ts`: dort
   werden 2000 Aufnahmen je Seed simuliert und der Mittelwert gegen einen Sollwert
   geprüft.
4. Die Zielgewichte je Stufe so skalieren, dass nicht nur der Mittelwert stimmt, sondern
   auch die Verteilung passt: ein 25er-Average darf keine 180er werfen, ein 85er-Average
   soll sie regelmäßig werfen.
5. Den Personalities-Mechanismus (`src/ai/config/personalities.json`) erhalten: die
   Persönlichkeit verschiebt Zielgewichte, nicht den Average.
6. Die bisherigen Stufen (easy/medium/hard/expert) entweder auf die Average-Werte
   abbilden oder als eigene Achse weiterführen — die bestehenden Tests in
   `tests/unit/ai/difficultyMeans.test.ts` und `tests/unit/ai/difficultyConfig.test.ts`
   müssen gültig bleiben.

**Akzeptanzkriterien:**

- Die Spielstärke lässt sich über ein 3-Dart-Average einstellen; die Stufen 25, 40, 55,
  70 und 85 sind wählbar.
- Über viele Aufnahmen erreicht die KI ihren Average innerhalb einer definierten
  Toleranz.
- Ein 25er-Average wirft selten 180er, ein 85er-Average regelmäßig.
- Die bestehenden KI-Tests bleiben grün, oder sie werden bewusst und dokumentiert
  angepasst.
- Der Average ist ein Parameter des Motors, keine Konstante je Aufnahme.

**Relevante Dateien:** `src/ai/engine.ts`, `src/ai/types.ts`,
`src/ai/difficultyConfig.ts`, `src/ai/config/*.json`,
`tests/unit/ai/difficultyMeans.test.ts`, `tests/unit/ai/engine.test.ts`

**Abhängigkeiten:** Grundlage: T-2 in `501-technical-decisions.md`

**Labels:** `501`, `enhancement`

---

### 501-I19: Checkout-Strategie der KI vervollständigen

**Kurzbeschreibung:** `selectCheckoutAim` in `src/ai/engine.ts` beherrscht den direkten
Abschluss und eine sichere Einstellung, aber keine mehrdartigen Routen.

**Warum:** Die Anforderung verlangt, dass die KI Checkout-Wege erkennt und berechnet und
Doppel gezielt anspielt. Eine 170 ist nur mit T20, T20, Bull zu schaffen — die heutige
Logik stellt dort eine einzelne 20 ein und erreicht den Abschluss nicht.

**Umsetzung:**

1. Die Checkout-Berechnung aus `src/ai/engine.ts` in eine eigene Einheit unter `src/ai/`
   verschieben (Entscheidung D-4). Scoring, Wurfmodell und Checkout-Strategie bleiben
   getrennt.
2. Die Standardrouten für die Zahlen von 1 bis 170 hinterlegen. Bewährte Quellen:
   die üblichen Checkout-Tabellen; die Tabelle ist statisch und liegt im Code.
3. Zwischen gleichwertigen Routen wählen (etwa T20 D16 Bull und T19 T19 Bull für 170),
   dabei den Zufall des Motors nutzen — der Wurf soll nicht immer derselbe sein.
4. Die Ziele so wählen, dass der Abschluss wahrscheinlich ist: unter Double Out das
   Double bevorzugen, das die Restzahl trifft.
5. Fehler zulassen: die Streuung des Wurfmodells muss auch im Checkout wirken, damit die
   KI gelegentlich danebenliegt. Der `checkoutSuccessRate` je Stufe ist der Sollwert, an
   dem das gemessen wird.
6. Die Auswahl der Einstellung verbessern: heute wird die größte Single gewählt, die eine
   Endlage hinterlässt. Besser ist die Route, die den Abschluss in zwei oder drei Würfen
   erreicht.

**Akzeptanzkriterien:**

- Die KI plant aus einer Lage wie 170 eine Route, die den Abschluss erreicht.
- Die Checkout-Routen sind eine eigene, getrennte Einheit.
- Die gemessene Checkout-Quote entspricht dem `checkoutSuccessRate` der Stufe (Toleranz
  wie im bestehenden Test).
- Die Quote steigt monoton mit dem Average.
- Die KI macht auch im Checkout Fehler.

**Relevante Dateien:** `src/ai/engine.ts`, `src/ai/dartboard.ts`, `src/ai/types.ts`,
`tests/unit/ai/engine.test.ts`, `tests/unit/ai/difficultyMeans.test.ts`

**Abhängigkeiten:** 501-I18. Grundlage: T-3 in `501-technical-decisions.md`

**Labels:** `501`, `enhancement`

---

### 501-I20: Aufnahmen der KI unterscheiden sich und schwanken gelegentlich

**Kurzbeschreibung:** Die KI wirft heute jeden Wurf unabhängig. Die Anforderung verlangt
unterschiedliche Aufnahmeleistungen sowie gelegentliche schwache und starke Aufnahmen.

**Warum:** Drei unabhängige Würfe erzeugen eine gleichmäßige Verteilung. Ein Mensch
liegt innerhalb einer Aufnahme mal besser und mal schlechter. Ohne diese Streuung wirkt
die KI mechanisch — und der Average allein beschreibt die Verteilung nicht.

**Umsetzung:**

1. Einen Aufnahme-Faktor einführen: vor der Aufnahme wird ein Multiplikator gezogen, der
   die Ziele der drei Würfe gemeinsam verschiebt.
2. Den Faktor so wählen, dass er die Streuung zwischen den Aufnahmen erhöht, ohne die
   mittlere Leistung zu verschieben (der Average muss unverändert der eingestellte
   bleiben).
3. Schwache Aufnahmen dürfen das Ziel eher aufs Miss oder auf ein kleines Feld legen,
   starke Aufnahmen auf die großen Treffer.
4. Den Zufall aus dem vorhandenen, seedbaren Generator nutzen (`mulberry32` in
   `src/ai/rng.ts`), damit die Messungen reproduzierbar bleiben.
5. In `tests/unit/ai/` einen Test ergänzen, der die Streuung **zwischen** den Aufnahmen
   misst und nicht nur den Mittelwert.

**Akzeptanzkriterien:**

- Die Streuung zwischen den Aufnahmen ist größer als die Streuung innerhalb einer
  Aufnahme.
- Der gemessene Average bleibt der eingestellte.
- Der Test über 2000 Aufnahmen je Seed ist reproduzierbar.
- Schwache und starke Aufnahmen kommen messbar vor.

**Relevante Dateien:** `src/ai/engine.ts`, `src/ai/rng.ts`, `src/ai/types.ts`,
`tests/unit/ai/difficultyMeans.test.ts`

**Abhängigkeiten:** 501-I18

**Labels:** `501`, `enhancement`

---

### 501-I21: KI-Platz in der lokalen 501-Partie verdrahten

**Kurzbeschreibung:** Der KI-Motor wird heute nur im Realtime-Pfad verwendet
(`src/realtime/socketServer.ts`). Die lokale 501-Ansicht kennt keinen KI-Platz.

**Warum:** Die Anforderung verlangt die Spielvariante „Einzelspieler gegen KI" und
gemischte Runden. Ohne einen KI-Platz in der lokalen Partie sind beide Varianten nicht
erreichbar.

**Umsetzung:**

1. Die Sitzverwaltung aus 501-I02 in der Ansicht anwenden: ein KI-Platz gehört zur
   Spielerliste, sitzt in der Aufnahmenfolge und wird in der Übersicht wie ein
   Mensch geführt (Kennzeichnung „KI", damit der Spieler weiß, wer automatisch wirft).
2. Die KIwürfe an den Motor geben. Der Motor ist der einzige Weg, auf dem ein Wurf in
   die Partie gelangt — auch ein KI-Wurf. Damit gelten für KI-Würfe dieselben Regeln
   (Bust, Checkout, Korrektur).
3. Den KI-Wurf an den Wurfprotokoll-Index binden, damit er später wie jeder andere
   Wurf korrigiert werden kann.
4. Die Reihenfolge der Auslösung festlegen: der KI-Wurf erfolgt, sobald der KI-Slot am
   Zug ist. Die Ansicht muss den Zugwechsel von der Engine bekommen, nicht selbst
   steuern.
5. Den Bust der KI nach E-1 behandeln (offene Frage T-8): Bustet die KI, endet die
   Aufnahme, die Punkte werden zurückgesetzt, und der Motor wartet auf die Bestätigung —
   genau wie bei einem Menschen. Die Bestätigung erfolgt am Gerät durch den Menschen
   („Weiter"); die KI bestätigt nicht selbst.
6. Prüfen, dass der KI-Wurf in der Aufnahmehistorie erscheint und die Statistik des
   KI-Sitzes zählt.
7. Den bestehenden Provider-Nahtpunkt (`AIProvider` in `src/realtime/types.ts`) als
   Vorbild nehmen, aber die lokale Ausführung im Browser belassen (Entscheidungen D-2
   und E-5).

**Akzeptanzkriterien:**

- Die 501 kann gegen einen KI-Gegner gespielt werden.
- Die KI wechselt den Zug von sich aus und wirft ihre drei Würfe.
- Die KI kann eine Leg und die Partie gewinnen.
- Die KI-Würfe erscheinen in der Historie und in der Statistik.
- Der KI-Wurf läuft durch den Motor und unterliegt denselben Regeln.
- Bustet die KI, gilt derselbe Ablauf wie bei einem Menschen: Aufnahme beendet, Punkte
  zurückgesetzt, Bestätigung am Gerät durch den Menschen (E-1).
- Die Übersicht kennzeichnet den KI-Platz.

**Relevante Dateien:** `src/components/x01/X01MatchView.tsx`,
`src/ai/engine.ts`, `src/game-engine/GameEngine.ts`,
`src/realtime/types.ts`, `src/realtime/socketServer.ts`

**Abhängigkeiten:** 501-I02, 501-I11, 501-I16

**Labels:** `501`, `enhancement`

---

## M8: Statistiken und Spielauswertung

### 501-I22: Leg-Grenzen aus dem Wurfprotokoll ableitbar machen

**Kurzbeschreibung:** Das Wurfprotokoll kennt keine Leg-Grenze. „First 9" und „Best
Leg" brauchen aber die Zuordnung eines Wurfes zu seiner Leg.

**Warum:** Die Statistiken müssen aus dem Protokoll abgeleitet werden, damit sie nach
Undo und Korrektur stimmen. Ohne Leg-Grenze lassen sich diese beiden Kennzahlen nicht
berechnen.

**Umsetzung:**

1. Festlegen, wie eine Leg-Grenze entsteht: Der Motor weiß, wann eine Leg endet
   (`StandardMode.handleLegCompleted`). Diese Information muss in das Protokoll
   wandern, damit sie nach einem Replay wieder da ist.
2. Das Protokoll so erweitern, dass jede Aufnahme ihre Leg kennt — entweder als Zähler
   je Wurf oder als abgeleitete Markierung, die die Replay-Ableitung mitführt.
3. Die Ableitung in `src/game-engine/throwLedger.ts` ergänzen, damit die Grenze wie die
   übrigen Grenzen nie gespeichert, sondern immer neu abgeleitet wird. Grundlage:
   Entscheidung D-6.
4. Prüfen, dass Undo und Korrektur die Leg-Zuordnung korrekt neu ableiten.
5. Berücksichtigen, dass die Bust-Regel (501-I11) die Zug- und damit die
   Aufnahmengliederung beeinflusst: Eine ungültige Aufnahme beendet die Aufnahme
   (E-1), und der Zug wechselt erst nach der Bestätigung. Die Aufnahme- und Leg-Grenzen
   müssen mit dieser Wartephase zusammenpassen.
6. Prüfen, dass dieselbe Ableitung auch den Aufnahmestand liefert, den die Bust-Regel
   zur Rücksetzung der Aufnahmepunkte braucht (Entscheidung D-12). Beide Grenzen gehören
   in dieselbe Ableitung, damit sie nicht auseinanderlaufen können.

**Akzeptanzkriterien:**

- Jeder Wurf des Protokolls lässt sich seiner Leg zuordnen.
- Die Zuordnung ist nach Undo und Korrektur korrekt.
- Die Zuordnung folgt derselben Regel wie die Anzeige „Leg x/N".
- Die Ableitung liefert auch den Aufnahmestand für die Rücksetzung nach E-1.
- Ein Unit-Test prüft die Zuordnung über eine Partie mit mehreren Legs.

**Relevante Dateien:** `src/game-engine/throwLedger.ts`,
`src/game-engine/types.ts`, `src/game-engine/modes/StandardMode.ts`,
`src/game-engine/GameEngine.ts`

**Abhängigkeiten:** 501-I11, 501-I16. Grundlage: T-1 sowie D-12 in
`501-technical-decisions.md`

**Labels:** `501`, `enhancement`

---

### 501-I23: Spielstatistiken je Spieler berechnen

**Kurzbeschreibung:** Es existiert keine 501-Statistik. Gefordert sind 3-Dart-Average,
First-9-Average, Highest Checkout, Checkout-Quote, 180er, 140er+, 100er+, Best Leg sowie
gespielte und gewonnene Legs.

**Warum:** Die Anforderung verlangt diese Kennzahlen je Spieler und je Partie. Heute
gibt es nur `averageTurnScore` und `checkoutPct` in `src/rating/performanceService.ts` —
und die speisen sich aus Spieltabellen der Datenbank, nicht aus dem Wurfprotokoll.

**Umsetzung:**

1. Eine reine, zustandslose Ableitung bauen, die aus dem Wurfprotokoll und dem
   Spielerüberblick je Spieler die Kennzahlen berechnet. Sie gehört ins
   Spielmodul-Umfeld, nicht in die Rating-Schicht: die Rating-Schicht liest
   Datenbankzeilen. Die Ableitung kommt ohne Browser-Zugriff aus (Entscheidung E-5).
2. Je Kennzahl die Definition festhalten und im Code benennen:
   - **3-Dart-Average**: Summe der erzielten Punkte je drei geworfenen Würfe.
   - **First-9-Average**: Average der ersten neun Würfe einer Leg (nicht drei volle
     Aufnahmen; eine vorzeitig beendete Aufnahme verkürzt die Spanne nicht).
   - **Highest Checkout**: höchster Checkout-Punktestand einer Leg.
   - **Checkout-Quote**: gelungene Checkouts geteilt durch Checkout-Versuche.
   - **180er / 140er+ / 100er+**: Anzahl der Aufnahmen über der jeweiligen Grenze.
   - **Best Leg**: Leg mit den wenigsten geworfenen Würfen.
   - **Legs gespielt / gewonnen**: Anzahl je Spieler.
3. Die Definition des „Checkout-Versuchs" festlegen: ein Versuch ist eine Lage, in der
   ein Abschluss möglich war (etwa eine Restzahl bis 170, für die eine Route existiert).
   Das braucht die Routentabelle aus 501-I19 — oder eine vereinfachte Schwelle, wenn
   die vollständige Route zu aufwendig ist. Die Entscheidung gehört ins Issue.
4. Eine ungültige Aufnahme (mit Bust) nach E-1 behandeln: Sie zählt mit **0 Punkten**,
   ihre geworfenen Würfe zählen aber als geworfen. Sie ist damit weder ein 100er+ noch
   ein 140er+ noch ein 180er. Diese Regel folgt aus derselben Ableitung wie die
   Aufnahmestände (Entscheidungen D-6 und D-12) und braucht keine eigene Sonderlogik.
5. Die Kennzahlen aus dem Protokoll ableiten, nicht aus Zählern mitführen (Entscheidung
   D-6). Nach Undo und Korrektur müssen sie stimmen.
6. Tests mit Handrechnung: ein vorgegebenes Protokoll mit bekannten Werten, das
   3-Dart-Average, einen 180er, einen Checkout und eine ungültige Aufnahme enthält.

**Akzeptanzkriterien:**

- Alle neun Kennzahlen werden je Spieler berechnet.
- Die Werte stimmen mit der Handrechnung an einem vorgegebenen Protokoll überein.
- Nach Undo und Korrektur stimmen die Werte wieder.
- Eine ungültige Aufnahme zählt mit 0 Punkten, ihre Würfe aber als geworfen (E-1).
- Der First-9-Average bezieht sich auf neun Würfe, nicht auf drei volle Aufnahmen.
- Die Ableitung ist zustandslos und für dieselbe Eingabe immer gleich.
- Die Ableitung greift nicht auf den Browser zu (E-5).

**Relevante Dateien:** `src/game-engine/throwLedger.ts`, `src/game-engine/types.ts`,
`src/rating/performanceService.ts`, `tests/unit/game-engine/`

**Abhängigkeiten:** 501-I22, 501-I19 (Checkout-Versuch-Definition), 501-I11 (Bust- und
Aufnahmestände)

**Labels:** `501`, `enhancement`

---

### 501-I24: Spielauswertung je Spieler in der Partie anzeigen

**Kurzbeschreibung:** Die Kennzahlen aus 501-I23 werden am Ende der Partie je Spieler
angezeigt.

**Warum:** Eine Kennzahl, die niemand sieht, ist nicht ausgewertet. Die Anforderung
verlangt die Nachvollziehbarkeit je Spieler.

**Umsetzung:**

1. Eine Auswertungsfläche bauen, die je Spieler die Kennzahlen aus 501-I23 nennt. Sie
   gehört in `src/components/x01/` (Entscheidung D-8), damit die 301 unberührt bleibt.
2. Die Fläche an den Ergebnisfallschirm anbinden, nach der Partie.
3. Im Layout des Design-Systems bleiben: keine Karten je Spieler, sondern Zeilen, kein
   Emoji, Zahlen in tabellarischen Ziffern.
4. Die Anzeige muss auf dem Smartphone lesbar sein — die Tabelle braucht eine
   kompakte Darstellung.

**Akzeptanzkriterien:**

- Nach der Partie steht je Spieler eine Zeile mit den Kennzahlen.
- Die Anzeige folgt dem Layout des Design-Systems (Zeilen, keine Karten).
- Die Anzeige ist auf 390 px lesbar.
- Der Ergebnisfallschirm bleibt erreichbar und bietet weiterhin „Neu starten".

**Relevante Dateien:** `src/components/game/GameResultBanner.tsx`,
`src/components/x01/X01MatchView.tsx`, `design-system/darthub/pages/match.md`

**Abhängigkeiten:** 501-I23, 501-I17

**Labels:** `501`, `enhancement`

---

### 501-I25: Spielstatistiken über Partien hinweg lokal speichern

**Kurzbeschreibung:** Die Partiestatistiken bleiben in der Partie. Die Anforderung
verlangt sie nachvollziehbar **je Spieler** — also auch über Partien hinweg. Nach E-4
erfolgt diese Speicherung zunächst **lokal**; für den ersten 501-MVP wird keine
Datenbank- oder Cloud-Architektur eingeführt.

**Warum:** „First-9-Average" oder „Checkout-Quote" eines Spielers sind über eine
Partie hinaus interessant; in einer einzelnen Partie sind sie eine Momentaufnahme.
Gleichzeitig soll der MVP schlank bleiben: eine serverseitige Speicherung ist eine
spätere Betrachtung, und der erste 501-MVP braucht dafür keine Datenbank.

**Umsetzung:**

1. Eine schmale Ablage-Schnittstelle definieren, die die Statistiken je Spieler und Modus
   lesen und schreiben kann (Entscheidung D-14). Die Schnittstelle wird so schmal
   gewählt, dass eine spätere serverseitige Implementierung sie ersetzen kann, ohne die
   Spiellogik oder die Berechnung anzufassen (E-5).
2. Die erste Implementierung schreibt in den Local Storage des Browsers. Das Repository
   hat dafür bereits eine Konvention: `darthub:input-mode` in
   `src/components/game/useInputMode.ts`. Der Schlüssel für die Statistiken folgt
   demselben Muster (`darthub:501-stats` oder ähnlich).
3. Einen stabilen Schlüssel je Spieler verwenden. Für den lokalen MVP genügt der
   konfigurierte Name; die Schnittstelle darf die Identität aber nicht fest auf den
   Namen verdrahten, damit später eine echte Spieleridentität genügt.
4. Die Zählweise festlegen: Durchschnitte als gleitendes Mittel über die letzten N
   Partien, Zähler als Summe. Die Fenstergröße wird dokumentiert.
5. Die Speicherung an den Abschluss der Partie hängen, nicht an jedes Wurf-Update.
6. Prüfen, dass die Ablage einen defekten oder leeren Speicher toleriert: Ein Browser,
   der Local Storage nicht anbietet, verliert die Historie, ohne die Partie zu stören
   (das Muster aus `useInputMode`).
7. Prüfen, dass die Statistikberechnung (501-I23) von der Ablage getrennt bleibt: Die
   Berechnung ist eine reine Funktion ohne Browser-Zugriff, die Ablage ist eine
   Implementierung der Schnittstelle.

**Akzeptanzkriterien:**

- Die Spielstatistiken liegen je Spieler und Modus über Partien hinweg vor.
- Die Ablage erfolgt lokal im Browser; es gibt im MVP keine Datenbank- oder
  Cloud-Änderung (E-4).
- Die Zählweise (Fenstergröße, Summen oder Mittel) ist dokumentiert.
- Die Speicherung passiert beim Partieabschluss.
- Die Berechnung der Kennzahlen bleibt frei von Browser-Zugriff, die Ablage ist hinter
  einer schmalen Schnittstelle austauschbar (E-5).
- Ein Browser ohne Local Storage verliert die Historie, ohne die Partie zu stören.
- Es entsteht **keine** Prisma-Migration und keine Änderung am Datenbankschema.

**Relevante Dateien:** `src/components/game/useInputMode.ts` (Vorbild für die
Local-Storage-Konvention), `src/game-engine/`, neue Ablage-Schnittstelle unter
`src/game-engine/` oder `src/components/x01/`

**Abhängigkeiten:** 501-I23. Entscheidung E-4 (verbindlich); Grundlage: D-14, die
offene Frage T-4 ist damit beantwortet.

**Labels:** `501`, `enhancement`

---

## M9: Qualitaetssicherung und Optimierung

### 501-I26: Regressionstests der 501-Spiellogik ergänzen

**Kurzbeschreibung:** Die zentrale Spiellogik der 501 wird gegen Regression geschützt,
ohne die Testsuite aufzublähen.

**Warum:** Die Engine leitet den gesamten Zustand aus dem Protokoll ab. Jeder Eingriff
in die Regeln (Bust, Leg-Grenze, Korrektur) betrifft diese Ableitung. Ohne gezielte
Tests ist nicht erkennbar, ob eine Änderung das Spiel korrekt lässt.

**Umsetzung:**

1. Die Testabdeckung je Milestone festlegen:
   - **M1**: Konfiguration — jede Auswahlkombination ergibt eine gültige Partie
     (Start, Teilnehmerzahl, Format, Regeln).
   - **M2**: Historie und Anzeige — die Historie stimmt mit dem Protokoll überein.
   - **M3**: Eingabe — ein Wurf über das Board und derselbe Wurf über das Pad erzeugen
     identische Protokolleinträge; ungültige Eingaben verändern den Zustand nicht.
   - **M4**: Regeln — je Regel ein Test (Bust, Checkout, Straight/Double, auf 1 gelandet,
     Über-null, Miss ohne Segment, Leg- und Spielabschluss, Folge-Leg-Reihenfolge).
     Zum Bust gehören eigene Fälle (E-1): die Aufnahme endet, die Aufnahmepunkte werden
     zurückgesetzt, der Motor wartet auf die Bestätigung, nimmt in dieser Phase keinen
     Wurf entgegen, und der Spielerwechsel erfolgt erst nach der Bestätigung.
   - **M5**: Korrektur — je Refusal-Code ein Test; eine Korrektur in einer vergangenen
     Aufnahme; Korrektur nach dem Spielende; eine Korrektur in eine ungültige Aufnahme
     hinein und aus ihr heraus.
   - **M6**: Leg-Zählung über eine vollständige Partie; die Folge-Leg beginnt mit dem
     Spieler, der die Leg nicht gewonnen hat (je Spielerzahl 2, 3 und 4).
   - **M7**: Average je Stufe (nach dem Muster von `tests/unit/ai/difficultyMeans.test.ts`),
     Checkout-Quote je Stufe, Streuung zwischen den Aufnahmen, KI-Partie.
   - **M8**: Kennzahlen gegen Handrechnung; Kennzahlen nach Undo und Korrektur; eine
     ungültige Aufnahme zählt mit 0 Punkten; die lokale Ablage über einen Neustart
     hinweg.
2. Die Tests so schreiben, dass sie **einzeln** laufen können
   (`npx vitest run tests/unit/...`), damit die Entwicklung schnell bleibt.
3. Keine Vollständigkeitssuite pro Änderung: die End-to-End-Suite läuft einmal je
   Milestone, nicht je Issue.
4. Die vorhandenen Tests der vier anderen Spielmodi unverändert lassen — die Modus-Tests
   (`CricketMultiplayer`, `ShanghaiMode`, `AroundTheClockMode`, `UndoCorrectModes`) sind
   die Regression der geteilten Engine.
5. Die visuelle Kontrolle der 501 bei 1440 px und 390 px (es existiert bereits eine
   Visual-QC-Suite: `e2e/visual-qc.spec.ts`). Die Bust-Rückmeldung mit der
   Schaltfläche „Weiter" gehört in diese Kontrolle.
6. Einen End-to-End-Test für den Bust-Ablauf ergänzen: Ein Wurf bustet, die Punkte
   springen zurück, die Meldung erscheint, die Eingabe ist gesperrt, und erst nach
   „Weiter" wirft der nächste Spieler.

**Akzeptanzkriterien:**

- Für jedes Verhalten aus M1 bis M8 existiert ein Test.
- Für den Bust-Ablauf aus E-1 existiert je ein Test auf Motor- und auf
  Oberflächenebene sowie ein End-to-End-Test.
- Die Tests laufen einzeln und mit der Gesamtsuite.
- `npm run test`, `npm run typecheck`, `npm run lint` und `npm run format:check` sind
  fehlerfrei.
- Die Tests der anderen vier Spielmodi bleiben unverändert grün.
- Die 501 ist bei 1440 px und 390 px visuell geprüft.

**Relevante Dateien:** `tests/unit/game-engine/`, `tests/unit/game/`, `tests/unit/ai/`,
`e2e/score-entry.spec.ts`, `e2e/game-center.spec.ts`, `e2e/visual-qc.spec.ts`

**Abhängigkeiten:** alle vorherigen Milestones

**Labels:** `501`, `enhancement`

---

## Auslieferung an GitHub

### Status

Die Issues wurden **nicht** auf GitHub angelegt. Im Arbeitsverzeichnis ist keine
GitHub-Authentifizierung verfügbar:

- `gh auth status` meldet: _"You are not logged into any GitHub hosts."_
- `GITHUB_TOKEN` ist in der Umgebung nicht gesetzt.
- Ein Schreibversuch gegen `POST /repos/DuzziWu/darthub/milestones` antwortet mit
  HTTP `401`.

Ein lesender Zugriff auf die GitHub-API funktioniert; das Repository ist öffentlich
lesbar. Es wurden **18 bestehende Issues** und **0 Milestones** geprüft: Die vorhandenen
Issues betreffen andere Themen (Security, Mobile-Scoring-UX, Undo-Verdrahtung), es gibt
keine Dublette zum 501-Vorhaben.

### Anleitung zur Anlage

Nach der Freigabe:

```bash
# 1. Label und Milestones anlegen
gh label create 501 --description "Spielmodus 501" --color "1D6F42"
gh api -X POST repos/DuzziWu/darthub/milestones \
  -f title="501 — M1: Spielvorbereitung und Konfiguration" \
  -f description="Teilnehmerzahl, Mensch-/KI-Plätze, Spielformat, Spielerreihenfolge, Out-Regel-Auswahl."

# 2. Issues anlegen (Beispiel für das erste Issue)
gh issue create \
  --repo DuzziWu/darthub \
  --title "501-I01: Teilnehmerzahl der 501 auf 2 bis 4 begrenzen" \
  --body-file body-501-I01.md \
  --label 501 --label enhancement \
  --milestone "501 — M1: Spielvorbereitung und Konfiguration"
```

Für jedes Issue wird der Abschnitt dieses Dokuments als Body verwendet: Titel,
Kurzbeschreibung, Warum, Umsetzung, Akzeptanzkriterien, relevante Dateien,
Abhängigkeiten, Labels.

### Zuordnung der Issues zu den Milestones

| Milestone                                  | Issues                      |
| ------------------------------------------ | --------------------------- |
| M1 — Spielvorbereitung und Konfiguration   | 501-I01, I02, I03, I04, I05 |
| M2 — Spieloberfläche und Scoreboard        | 501-I06, I07                |
| M3 — Wurfeingabe und Dartboard-Integration | 501-I08, I09                |
| M4 — Spielregeln und Punkteberechnung      | 501-I10, I11, I12, I13      |
| M5 — Undo und Wurfkorrekturen              | 501-I14, I15                |
| M6 — Legs und Spielabschluss               | 501-I16, I17                |
| M7 — KI-Gegner mit Average-Modell          | 501-I18, I19, I20, I21      |
| M8 — Statistiken und Spielauswertung       | 501-I22, I23, I24, I25      |
| M9 — Qualitätssicherung und Optimierung    | 501-I26                     |

### Wirkung der Entscheidungen auf die Issues

Die 26 Issues bleiben bestehen; keine Aufgabe entfällt durch E-1 bis E-5. Elf Issues
wurden inhaltlich angepasst:

| Issue   | Anpassung durch die Entscheidungen                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 501-I05 | E-3 bestätigt den Umfang: nur Straight Out und Double Out in der 501.                                                                                                     |
| 501-I11 | E-1 macht das Issue zum zentralen Regelblock: Aufnahme beenden, Punkte zurücksetzen, Bestätigung abwarten, Schaltfläche „Weiter". Der Titel wurde entsprechend erweitert. |
| 501-I12 | Der Bust-Fall ist als Akzeptanzkriterium aufgenommen (Punkte stehen wieder auf dem Aufnahmestand).                                                                        |
| 501-I13 | E-2 konkretisiert: die Starterregel wird als benannte Funktion umgesetzt und je Spielerzahl getestet (D-13).                                                              |
| 501-I14 | Der Bust-Kontext ist als Akzeptanzkriterium aufgenommen: eine Korrektur in oder aus einer ungültigen Aufnahme stellt den Zustand ohne Bust wieder her.                    |
| 501-I16 | Die Ansage nennt jetzt auch den Starter der Folge-Leg (E-2).                                                                                                              |
| 501-I21 | Der Bust der KI folgt demselben Ablauf wie beim Menschen, die Bestätigung erfolgt am Gerät (E-1, T-8).                                                                    |
| 501-I22 | Die Ableitung liefert neben der Leg-Grenze auch den Aufnahmestand für E-1 (D-12).                                                                                         |
| 501-I23 | Die Zählregel für ungültige Aufnahmen ist festgelegt (0 Punkte, Würfe zählen als geworfen); der First-9-Average bezieht sich auf neun Würfe.                              |
| 501-I25 | E-4 dreht die Ablage um: lokal im Local Storage statt über eine Prisma-Migration; die Schnittstelle bleibt austauschbar (D-14). Es entsteht **keine** Datenbankänderung.  |
| 501-I26 | Die Testmatrix enthält eigene Fälle für den Bust-Ablauf (Motor, Oberfläche, End-to-End) und für die Starterregel je Spielerzahl.                                          |

Der Issue-Umfang bleibt damit bei 26 Issues in 9 Milestones.
