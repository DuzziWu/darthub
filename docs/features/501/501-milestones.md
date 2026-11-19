# 501 — Milestones und Reihenfolge

Umsetzungsplan für den Spielmodus 501. Grundlage:
[501-spec.md](./501-spec.md) und
[501-technical-decisions.md](./501-technical-decisions.md).

Die fachlichen Entscheidungen E-1 bis E-5 sind getroffen und in
[501-spec.md](./501-spec.md) festgehalten; dieser Plan setzt sie um. Die Issues sind
vollständig in [501-issues.md](./501-issues.md) ausgearbeitet und für GitHub
vorbereitet.

## Inhalt

- [Uebersicht](#uebersicht)
- [Abhaengigkeiten](#abhaengigkeiten)
- [Milestones](#milestones)
- [Fortschritt](#fortschritt)

## Uebersicht

| #   | Milestone                             | Issues                 | Aufwand (Schätzung) | Abhängigkeiten |
| --- | ------------------------------------- | ---------------------- | ------------------- | -------------- |
| M1  | Spielvorbereitung und Konfiguration   | 501-I01 … I05          | mittel              | —              |
| M2  | Spieloberfläche und Scoreboard        | 501-I06, I07           | klein               | M1             |
| M3  | Wurfeingabe und Dartboard-Integration | 501-I08, I09           | klein               | M2             |
| M4  | Spielregeln und Punkteberechnung      | 501-I10, I11, I12, I13 | mittel              | M1             |
| M5  | Undo und Wurfkorrekturen              | 501-I14, I15           | mittel              | M3, M4         |
| M6  | Legs und Spielabschluss               | 501-I16, I17           | mittel              | M4             |
| M7  | KI-Gegner mit Average-Modell          | 501-I18 … I21          | groß                | M4, M6         |
| M8  | Statistiken und Spielauswertung       | 501-I22 … I25          | groß                | M4, M6, M7     |
| M9  | Qualitätssicherung und Optimierung    | 501-I26                | mittel              | alle           |

Gesamt: 26 Issues in 9 Milestones.

## Abhaengigkeiten

```text
M1 (Konfiguration)
 ├──► M2 (Oberfläche)  ──► M3 (Eingabe) ──► M5 (Korrektur)
 └──► M4 (Regeln) ──► M6 (Legs) ──► M7 (KI) ──► M8 (Statistiken)
                                  └────────────┘
                          M9 (QS) zieht über alle
```

- **M1 ist die Wurzel.** Wer die Sitzverwaltung mit KI-Plätzen nicht vorher baut,
  bekommt sie in M7 doppelt.
- **M4 ist die Regelbasis.** Bust-, Checkout- und Leg-Regeln müssen stehen, bevor
  Korrekturen (M5) und Statistiken (M8) daran andocken. Der Bust-Ablauf aus E-1 ist
  die aufwendigste Einzelregel: er braucht einen Wartezustand im Motor, die
  Rücksetzung der Aufnahmepunkte und eine Bestätigungsschaltfläche.
- **M3 und M4 können parallel** laufen: die Eingabe berührt die Regeln nicht.
- **M7 und M8 sind die beiden großen Blöcke** und brauchen die volle Aufmerksamkeit.
- **Die Statistiken brauchen die Leg-Grenze** aus 501-I22, und die Leg-Grenze braucht
  die Aufnahmegrenze aus E-1. Deshalb hängt M8 an M4, auch wenn die Statistiken selbst
  erst später kommen.

## Milestones

### M1 — Spielvorbereitung und Konfiguration

**Beschreibung:** Die Sitzverwaltung der 501: Teilnehmerzahl, menschliche und
KI-Plätze, Namen, Reihenfolge, Out-Regel und Spielformat.

**Ziel:** Der Spieler stellt vor dem ersten Wurf eine vollständige Partie ein.

**Issues:** 501-I01, 501-I02, 501-I03, 501-I04, 501-I05

**Akzeptanzkriterien:**

- Die Konfiguration akzeptiert 2 bis 4 Teilnehmer und lehnt weniger mit einer Meldung ab.
- Jeder Platz lässt sich als Mensch oder als KI kennzeichnen; mindestens ein Platz bleibt
  ein Mensch.
- Die Auswahl „Best of 7" und „Best of 9" steht zur Verfügung.
- Die Reihenfolge der Plätze lässt sich ändern, und die geänderte Reihenfolge bestimmt
  die Reihenfolge der Aufnahmen.
- In der 501-Konfiguration werden nur Straight Out und Double Out angeboten; der Motor
  behält seine Master-Out-Fähigkeit.
- Die gewählte Konfiguration überlebt einen Neustart der Partie.

**Abhängigkeiten:** keine.

**Definition of Done:** Alle fünf Issues umgesetzt, `npm run typecheck` und
`npm run lint` fehlerfrei, die neuen Bausteine durch Unit-Tests abgedeckt, die
Konfiguration über alle Auswahlkombinationen durchgeprüft.

**Umsetzungsstand (M1):** Alle fünf Issues sind umgesetzt. Die Konfiguration läuft
ausschließlich über Requisiten der gemeinsamen Ansichten, damit die 301, Cricket, Around
the Clock und Shanghai unverändert bleiben:

- `app/game/page.tsx` — die 501 übergibt `minPlayers={2}`, die Auswahl
  `outRuleChoices(["straight", "double"])`, die Sitz-Konfiguration und
  `DART_501_MATCH_FORMATS`.
- `src/components/x01/X01MatchView.tsx` — die neuen Requisiten `minPlayers`,
  `outRuleChoices`, `seatConfig` und `matchFormats`; die Sitzliste wird beim Start in der
  konfigurierten Reihenfolge an den Motor gegeben.
- `src/components/game/PlayerSeatSetup.tsx` — die Sitzliste mit Art, Name, KI-Average und
  Reihenfolge; die Schaltflächen benennen den Spieler, damit die Wirkung vorgelesen wird.
- `src/ai/averages.ts` — die Average-Stufen 25/40/55/70/85.
- `src/game-engine/modes/registry.ts` — `outRuleChoices()` liefert eine Teilmenge der
  gemeinsamen Liste, ohne sie global zu verändern.

**Offen für spätere Milestones:** Die durchschnittliche KI-Stärke wird konfiguriert und
über die Partie getragen, wirkt aber noch nicht — das ist 501-I18 (M7). Eine Änderung der
Reihenfolge ist nur vor dem Start möglich, wie in 501-I04 vorgesehen.

---

### M2 — Spieloberfläche und Scoreboard

**Beschreibung:** Die Spieloberfläche der 501 zeigt aktiven Spieler, Restpunktzahlen,
Übersicht, Wurfhistorie und den Leg-/Spielstand eindeutig an.

**Ziel:** Der Spieler erkennt jederzeit ohne Nachfragen, wer am Zug ist, wie viel jedem
noch bleibt und wie die Partie steht.

**Issues:** 501-I06, 501-I07

**Akzeptanzkriterien:**

- Die Restpunktzahl des aktiven Spielers ist jederzeit sichtbar, ohne Scrollen.
- Der aktive Spieler ist durch mehr als eine Eigenschaft erkennbar (Markierung und
  Text), nicht nur durch Farbe.
- Alle Spieler erscheinen mit Name und Restpunktzahl.
- Die Wurfhistorie zeigt die Aufnahmen der gesamten Partie, nicht nur des laufenden
  Zugs, und erlaubt, einen Wurf daraus zu wählen.
- Die Leg- und Spielanzeige nennt Leg und Set.

**Abhängigkeiten:** M1 (die Sitzverwaltung liefert die Teilnehmerliste).

**Definition of Done:** Issues umgesetzt, Unit-Tests für die Historie und die
Anzeigezustände, eine visuelle Kontrolle bei 1440 px und 390 px.

---

### M3 — Wurfeingabe und Dartboard-Integration

**Beschreibung:** Beide Eingabemethoden sind vollwertig: direkte Zahleneingabe im Pad
und das interaktive Dartboard.

**Ziel:** Der Spieler kann während der gesamten Partie frei zwischen beiden Wegen
wechseln und über beide gleichwertig punkten.

**Issues:** 501-I08, 501-I09

**Akzeptanzkriterien:**

- Das Pad erlaubt die direkte Eingabe einer Punktzahl; der Wert wird gegen die
  Boardphysik geprüft und ein ungültiger Wert wird ohne Zustandsänderung abgelehnt.
- Das Band-Raster des Pads bleibt erhalten.
- Das Board zeigt die Treffer der laufenden Aufnahme als Marker.
- Der Moduswechsel Board ↔ Pad ist jederzeit möglich und ändert den Spielzustand nicht.
- Auf dem Smartphone bleibt das Board eine Vorschau, solange es nicht als Eingabe
  gewählt ist.

**Abhängigkeiten:** M2.

**Definition of Done:** Issues umgesetzt, Unit-Tests für die Eingabevalidierung,
ein End-to-End-Test, der einen Wurf über das Board und denselben Wurf über das Pad
setzt.

---

### M4 — Spielregeln und Punkteberechnung

**Beschreibung:** Die Spielregeln der 501 stimmen: Bust, Checkout, Leg- und
Spielabschluss, Startpunktzahl.

**Ziel:** Eine Partie, die nach den üblichen 501-Regeln gespielt wird.

**Issues:** 501-I10, 501-I11, 501-I12, 501-I13

**Akzeptanzkriterien:**

- Ein Bust beendet die Aufnahme sofort, und die während der Aufnahme erzielten Punkte
  werden vollständig zurückgesetzt (E-1).
- Nach einem Bust wartet der Motor auf die Bestätigung; der Spielerwechsel erfolgt
  erst danach, nie automatisch (E-1).
- Die Oberfläche zeigt nach einem Bust eine verständliche Rückmeldung mit der
  Schaltfläche „Weiter"; die Eingabe ist bis zur Bestätigung gesperrt (E-1).
- Ein Checkout wird nur bei gültigem Finish anerkannt; unter Double Out zählt nur ein
  Board-Double, unter Straight Out jeder Finish.
- Der auf 1 gelandete Spieler ist bust und verliert die Aufnahme.
- Die Restpunktzahl wird nach jedem Wurf korrekt neu berechnet.
- Die Folge-Leg beginnt mit dem Spieler, der die Leg nicht gewonnen hat; die Regel ist
  für 2, 3 und 4 Spieler eindeutig und getestet (E-2).
- Leg- und Spielabschluss werden unterschieden: nach einer Leg geht die Partie weiter,
  nach der letzten Leg endet sie.

**Abhängigkeiten:** M1. Die Entscheidungen E-1 und E-2 sind getroffen und in
[501-spec.md](./501-spec.md) festgehalten; die daraus folgenden technischen Festlegungen
stehen in D-11 bis D-13.

**Definition of Done:** Issues umgesetzt, jede Regel mit mindestens einem Unit-Test
gegen den Motor belegt, die bestehenden Modus-Tests (`StandardMode.test.ts`,
`CorrectionReplay.test.ts`) weiterhin grün.

---

### M5 — Undo und Wurfkorrekturen

**Beschreibung:** Undo und Wurfkorrektur über die gesamte Partie, mit korrekter
Neuberechnung aller abhängigen Zustände.

**Ziel:** Jeder falsch erfasste Wurf lässt sich korrigieren — auch rückwirkend — ohne
dass ein Teil des Spiels inkonsistent wird.

**Issues:** 501-I14, 501-I15

**Akzeptanzkriterien:**

- Ein Wurf aus einer vergangenen Aufnahme lässt sich aus der Historie wählen und
  korrigieren.
- Nach der Korrektur stimmen Restpunktzahlen, Bustzustände, Checkout-Erkennung,
  Spielerwechsel und Leg-/Spielergebnis wieder überein.
- Eine Korrektur in eine ungültige Aufnahme hinein oder aus ihr heraus stellt genau den
  Zustand wieder her, den die Aufnahme ohne Bust gehabt hätte (E-1).
- Eine Korrektur, die das Partieergebnis ändert, wird protokolliert.
- Eine Korrektur, die der Motor ablehnt, lässt den Zustand unverändert und nennt einen
  Ausweg, der wirklich existiert.
- Undo funktioniert auch nach dem Spielende und nimmt den matchentscheidenden Wurf
  zurück.
- Undo und Korrektur bleiben zwei getrennte, klar unterscheidbare Bedienwege.

**Abhängigkeiten:** M3 (die Historie muss die Wurfwahl tragen), M4 (die Regeln müssen
stehen, damit die Neuberechnung stimmt).

**Definition of Done:** Issues umgesetzt, Unit-Tests je Refusal-Code, ein
End-to-End-Test, der einen Wurf aus der ersten Aufnahme in der letzten korrigiert und
das Ergebnis prüft.

---

### M6 — Legs und Spielabschluss

**Beschreibung:** Die Partie führt Legs und Spiel sauber: Zählung, Ansage, Endstand und
Neustart.

**Ziel:** Nach jeder Leg weiß der Spieler, was passiert ist; am Ende kennt er das
Ergebnis.

**Issues:** 501-I16, 501-I17

**Akzeptanzkriterien:**

- Der Gewinn einer Leg wird angekündigt, und es wird sichtbar, dass die Punktzahlen
  zurückgesetzt wurden.
- Die Leg-Zählung folgt dem gewählten „Best of N" (Best of 3 = erster gewinnt 2).
- Das Ergebnis nennt den Sieger, die Legs und den Endstand.
- Der Neustart übernimmt die Konfiguration der gerade gespielten Partie.

**Abhängigkeiten:** M4.

**Definition of Done:** Issues umgesetzt, Unit-Tests für die Zählung der Legs über
mehrere Runden, ein End-to-End-Test über eine vollständige Partie.

---

### M7 — KI-Gegner mit Average-Modell

**Beschreibung:** Die KI wird über ein 3-Dart-Average eingestellt und verhält sich
langfristig entsprechend: mit Streuung, unterschiedlichen Aufnahmen, Checkout-Strategie
und Fehlern.

**Ziel:** Ein eingestellter Average ist über viele Aufnahmen messbar — nicht als
Zufallswert, sondern als Zielwert.

**Issues:** 501-I18, 501-I19, 501-I20, 501-I21

**Akzeptanzkriterien:**

- Die KI-Stärke wird über ein 3-Dart-Average eingestellt (25, 40, 55, 70, 85).
- Über viele Aufnahmen erreicht die KI ihren eingestellten Average innerhalb einer
  definierten Toleranz.
- Die Streuung ist realistisch: eine Aufnahme ist nicht die nächste, gelegentliche
  schwache und starke Aufnahmen kommen vor.
- Die KI plant Checkout-Wege, spielt Doppel gezielt an und macht auch im Checkout Fehler.
- Scoring, Wurfmodell und Checkout-Strategie sind getrennte Einheiten.
- Die KI-Plätze funktionieren in der lokalen Partie und wechseln korrekt mit den
  menschlichen Plätzen den Zug.
- Bustet die KI, gilt dieselbe Regel wie bei einem Menschen: die Aufnahme endet, die
  Punkte werden zurückgesetzt, und die Bestätigung „Weiter" erfolgt am Gerät durch den
  Menschen (E-1).
- Eine KI kann in der lokalen Partie eine Leg und die Partie gewinnen.

**Abhängigkeiten:** M4 (Regeln, insbesondere der Bust-Ablauf), M6 (Leg- und
Spielabschluss, weil die KI dieselben Ergebnisse erzeugen muss).

**Definition of Done:** Issues umgesetzt, ein Average-Test über alle fünf Stufen
(nach dem Muster von `tests/unit/ai/difficultyMeans.test.ts`), ein
End-to-End-Test einer vollständigen Partie gegen die KI.

---

### M8 — Statistiken und Spielauswertung

**Beschreibung:** Die geforderten Kennzahlen werden aus dem Wurfprotokoll abgeleitet,
angezeigt und je Spieler über Partien hinweg gespeichert.

**Ziel:** Nach der Partie steht nachvollziehbar, wie jeder Spieler gespielt hat.

**Issues:** 501-I22, 501-I23, 501-I24, 501-I25

**Akzeptanzkriterien:**

- Je Spieler werden erfasst: 3-Dart-Average, First-9-Average, Highest Checkout,
  Checkout-Quote, 180er, 140er+, 100er+, Best Leg, gespielte und gewonnene Legs.
- Die Kennzahlen stehen je Partie zur Verfügung.
- Nach Undo und Korrektur stimmen die Kennzahlen wieder (sie werden neu berechnet, nicht
  nachgeführt).
- Eine ungültige Aufnahme (mit Bust) zählt mit 0 Punkten; ihre Würfe zählen als
  geworfen (E-1).
- Die Auswertung ist je Spieler nachvollziehbar und bleibt über einen Neustart
  hinweg erhalten.
- Die Spielstatistiken werden **lokal** gespeichert, hinter einer schmalen Schnittstelle
  (E-4, D-14). Für den MVP wird keine Datenbank- oder Cloud-Architektur eingeführt.
- Die Berechnung der Kennzahlen ist eine reine Funktion ohne Browser-Zugriff, damit eine
  spätere serverseitige Speicherung sie unverändert übernehmen kann (E-5).

**Abhängigkeiten:** M4, M6, M7. Die Entscheidungen E-4 und E-5 sind getroffen; die
technische Festlegung der Ablage steht in D-14, die offene Frage T-4 ist damit
beantwortet.

**Definition of Done:** Issues umgesetzt, Unit-Tests je Kennzahl mit bekannten
Wurfprotokollen (Handrechnung), ein End-to-End-Test, der eine Partie mit 180er und
Checkout auswertet, und ein Test, der die lokale Ablage über einen Neustart hinweg
prüft.

---

### M9 — Qualitätssicherung und Optimierung

**Beschreibung:** Die gezielte Prüfung, die die vorherigen Milestones absichert, ohne
unnötige Komplettdurchläufe.

**Ziel:** Die zentrale Spiellogik der 501 ist gegen Regression geschützt.

**Issues:** 501-I26

**Akzeptanzkriterien:**

- Für jedes Verhalten, das in M4 bis M8 neu entstanden ist, existiert ein Test, der
  ohne die Engine kaputtgeht.
- Die Tests laufen gezielt je Datei (`npx vitest run <pfad>`), nicht als Gesamtdurchlauf.
- Die vorhandenen Tests der anderen vier Spielmodi laufen unverändert grün.
- Die 501-Partie ist auf 390 px und 1440 px visuell geprüft.

**Abhängigkeiten:** M1 bis M8.

**Definition of Done:** Issue umgesetzt, `npm run test`, `npm run typecheck`,
`npm run lint` und `npm run format:check` fehlerfrei, der End-to-End-Test der 501
grün.

## Fortschritt

| Milestone                                  | Status | Fortschritt |
| ------------------------------------------ | ------ | ----------- |
| M1 — Spielvorbereitung und Konfiguration   | fertig | 5 / 5       |
| M2 — Spieloberfläche und Scoreboard        | offen  | 0 / 2       |
| M3 — Wurfeingabe und Dartboard-Integration | offen  | 0 / 2       |
| M4 — Spielregeln und Punkteberechnung      | offen  | 0 / 4       |
| M5 — Undo und Wurfkorrekturen              | offen  | 0 / 2       |
| M6 — Legs und Spielabschluss               | offen  | 0 / 2       |
| M7 — KI-Gegner mit Average-Modell          | offen  | 0 / 4       |
| M8 — Statistiken und Spielauswertung       | offen  | 0 / 4       |
| M9 — Qualitätssicherung und Optimierung    | offen  | 0 / 1       |

Der Status wird nach jedem abgeschlossenen Milestone hier nachgeführt.
