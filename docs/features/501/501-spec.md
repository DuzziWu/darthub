# 501-Spielmodus — Spezifikation

Fachliche Spezifikation des Spielmodus 501 in DartHub. Grundlage sind die gemeinsam
abgestimmten Anforderungen, die am 2026-11-18 getroffenen fachlichen Entscheidungen
(E-1 bis E-5) und der geprüfte Ist-Stand des Repositories (`fix/security-auth-hardening`,
Commit `f2ff92f`).

Begleitdokumente:

- [Milestones und Reihenfolge](./501-milestones.md)
- [Technische Entscheidungen und Ist-Stand](./501-technical-decisions.md)
- [Vorbereitete GitHub-Issues](./501-issues.md)

## Inhalt

- [Zweck und Scope](#zweck-und-scope)
- [Spielvarianten](#spielvarianten)
- [Spielkonfiguration](#spielkonfiguration)
- [Spielablauf und Regeln](#spielablauf-und-regeln)
- [Wurfeingabe](#wurfeingabe)
- [Undo und Wurfkorrektur](#undo-und-wurfkorrektur)
- [KI-Gegner](#ki-gegner)
- [Statistiken](#statistiken)
- [Plattformen und Bedienbarkeit](#plattformen-und-bedienbarkeit)
- [Getroffene fachliche Entscheidungen](#getroffene-fachliche-entscheidungen)

## Zweck und Scope

501 ist der Leitmodus von DartHub: die Standardrunde, in der ein Spieler von 501
herunterzählt und mit einem Checkout die Begegnung gewinnt.

Im Scope dieser Spezifikation (der erste 501-MVP):

- die lokale Partie (alle Teilnehmer am selben Gerät) mit Menschen und/oder KI,
- die vollständige Spielkonfiguration vor dem ersten Wurf,
- die beiden Wurfeingaben (manuell und interaktives Dartboard),
- Undo und Wurfkorrektur über die gesamte Partie,
- der KI-Gegner mit einstellbarer Spielstärke,
- die Spielstatistiken je Partie und je Spieler, lokal gespeichert.

Nicht im Scope dieses MVP:

- **Multiplayer und Realtime-501** (siehe [E-5](#e-5-realtime-501-und-multiplayer)).
  Der Realtime-Pfad (`src/realtime/`) spielt heute `NeutralScoreMode`, nicht 501, und
  besitzt eine eigene Zustandsmaschine.
- die Kamera- und Smart-Dart-Boardquellen (`src/camera/`). Die 501 nutzt die
  vorhandene virtuelle Boardquelle; die anderen Quellen bleiben unverändert.
- die anderen Spielmodi (301, Cricket, Around The Clock, Shanghai). Änderungen an
  geteilten Komponenten dürfen diese Modi nicht beeinträchtigen.

Die Architektur darf eine spätere Erweiterung um Realtime-501 **nicht unnötig
erschweren**: die Spiellogik bleibt framework-unabhängig und im Motor gekapselt, die
Berechnung der Statistiken bleibt eine reine Funktion ohne Browser-Zugriff, und die
Ablage der Statistiken liegt hinter einer schmalen Schnittstelle, die später eine
serverseitige Ablage erhalten kann.

## Spielvarianten

Drei Varianten sind möglich und kombinierbar:

| Variante                | Beschreibung                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| Lokal, mehrere Menschen | Zwei bis vier Personen an einem Gerät, jede wirft selbst ein.           |
| Einzelspieler gegen KI  | Ein Mensch, ein bis drei KI-Gegner.                                     |
| Gemischte Runde         | Menschen und KI beliebig kombiniert, die Aufnahmen wechseln wie üblich. |

Regeln:

- Zwei bis vier Teilnehmer insgesamt.
- Mindestens ein Teilnehmer ist ein Mensch. Eine reine KI-Partie ist nicht zulässig.
- Die Reihenfolge der Sitze ist frei wählbar (siehe
  [Spielkonfiguration](#spielkonfiguration)) und bestimmt die Reihenfolge der Aufnahmen.

## Spielkonfiguration

Vor dem ersten Wurf legt die Partie fest:

| Einstellung        | Werte                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Teilnehmer         | 2 bis 4, je Slot Mensch oder KI                                       |
| Name               | je Slot ein Name (KI-Slots tragen einen automatisch vergebenen Namen) |
| KI-Spielstärke     | je KI-Slot ein 3-Dart-Average (siehe [KI-Gegner](#ki-gegner))         |
| Startpunktzahl     | 501                                                                   |
| Out-Regel          | Straight Out oder Double Out                                          |
| Spielformat        | Single Leg, Best of 3, Best of 5, Best of 7, Best of 9                |
| Spielerreihenfolge | frei wählbar                                                          |

Regeln:

- Die Startpunktzahl ist 501. Andere Werte sind für diesen Modus nicht vorgesehen.
- Double Out zählt nur ein Board-Double als Finish. Straight Out zählt jeden Finish.
- **Master Out gehört nicht zum Funktionsumfang der 501** (siehe
  [E-3](#e-3-master-out)). Der Motor behält seine Master-Out-Fähigkeit; die anderen
  Spielmodi, die sie heute anbieten, bieten sie weiterhin an.
- „Best of N" bedeutet: die Partie endet, sobald ein Spieler mehr als die Hälfte der
  N Legs gewonnen hat (Best of 3 = erster gewinnt 2 Legs).
- Die Konfiguration bleibt für die ganze Partie stehen und überlebt ein „Neu
  starten" am Ende.

## Spielablauf und Regeln

- Drei Würfe pro Aufnahme. Der Spielerwechsel erfolgt automatisch nach dem dritten
  Wurf der Aufnahme.
- Die Restpunktzahl wird nach jedem Wurf neu berechnet und angezeigt.
- Der aktive Spieler ist jederzeit eindeutig erkennbar (Zeilenmarkierung im
  Spielerüberblick plus Kennzeichnung auf dem Scoreboard).
- Übersicht über alle Spieler mit Name, Restpunktzahl und Status.
- Wurfhistorie: alle Aufnahmen der Partie sind einsehbar.
- Checkout: wer die Restpunktzahl auf genau 0 bringt, gewinnt die Leg.
- Leg-Abschluss: nach jeder gewonnenen Leg beginnt eine neue Leg mit zurückgesetzten
  Punkteständen. Wer die Folge-Leg beginnt, regelt
  [E-2](#e-2-starterwechsel-zwischen-legs).
- Spielabschluss: nach der letzten Leg endet die Partie; das Ergebnis nennt den
  Sieger, die Legs und den Endstand.

### Bust

Ein Bust ist ein Wurf, der unter der Out-Regel ungültig ist (siehe
[Checkout-Regeln](#checkout-regeln)). Das Verhalten ist durch
[E-1](#e-1-bust-verhalten) verbindlich festgelegt:

1. **Ein Bust beendet die aktuelle Aufnahme sofort.** Es folgen keine weiteren Würfe
   dieser Aufnahme.
2. **Die während dieser Aufnahme erzielten Punkte werden vollständig zurückgesetzt.**
   Der Spieler steht danach wieder auf dem Punktestand, den er zu Beginn der Aufnahme
   hatte.
3. **Der Spieler bleibt zunächst in der aktuellen Spielansicht.** Es gibt keinen
   Wechsel in ein Ergebnis- oder Endbildschirm.
4. **Es erscheint eine verständliche Bust-Rückmeldung**, die den Bust benennt, den
   zurückgesetzten Punktestand nennt und zum Fortfahren auffordert.
5. **Der Spieler muss ausdrücklich auf „Weiter" drücken.** Erst danach wird zum
   nächsten Spieler gewechselt.
6. **Es gibt keinen automatischen Spielerwechsel nach einem Bust.** Der Wechsel
   geschieht ausschließlich über die Bestätigung.

Weil der Wechsel erst nach der Bestätigung erfolgt, wartet der Motor nach einem Bust
auf die Bestätigung, bevor der nächste Spieler an der Reihe ist. Der Bestätigungs-
schritt ist immer eine Handlung des Menschen am Gerät — auch dann, wenn eine KI gebustet
hat.

Während der Wartezeit nimmt der Motor keine weiteren Würfe entgegen; die Eingabe ist
gesperrt, bis bestätigt wurde.

### Checkout-Regeln

| Regel        | Finish               | Besonderheit                |
| ------------ | -------------------- | --------------------------- |
| Straight Out | jeder Finish         | kein Segment erforderlich   |
| Double Out   | nur ein Board-Double | auf 1 gelandet ist ein Bust |

Ein Wurf, der die Restpunktzahl unter null bringt, ist ein Bust. Ein Miss (0 Punkte)
trägt kein Segment. Die Gültigkeit der Kombination aus Punkten und Segment wird gegen
die Boardphysik geprüft.

### Abweichungen des Ist-Standes

Der Ist-Stand weicht an zwei Stellen von den oben festgelegten Regeln ab. Beide
Abweichungen sind mit den Issues 501-I11 und 501-I13 adressiert:

1. **Bust:** Heute beendet ein Bust die Aufnahme nicht — der Spieler wirft weiter —
   und der Punktestand der Aufnahme wird **nicht** zurückgesetzt. Geprüft am laufenden
   Motor: nach einem T20 und einem Bust steht der Spieler weiterhin bei 40 statt wieder
   bei 100.
2. **Starter der Folge-Leg:** Heute beginnt die nächste Leg mit dem Sieger der
   vorherigen Leg.

## Wurfeingabe

Beide Eingabeweg stehen jederzeit zur Verfügung und sind auch mitten in der Partie
umschaltbar. Der Wechsel ändert den Spielzustand nicht.

### Manuelle Eingabe

- Einzelne Würfe erfassen, Punkte direkt eingeben.
- Die Eingabe wird gegen die Boardphysik geprüft: Punkte 0 bis 60, Segment und Punkte
  müssen zusammenpassen (Single 1–20, Double 2–40 gerade, Triple 3–60 durch 3
  teilbar, Bull 25 oder 50), ein Miss trägt kein Segment.
- Unzulässige Werte werden abgelehnt, ohne den Spielzustand zu verändern.

### Interaktives Dartboard

- Das vorhandene realistische Dartboard wird weiterverwendet (Single-, Double- und
  Triple-Felder, Outer Bull 25, Bullseye 50).
- Die Punkteberechnung erfolgt aus der Boardgeometrie; der Wurf nennt sein Segment.
- Ein Dart, der außerhalb des Doublerings trifft, ist ein Miss.
- Das Board wird nicht grundlegend neu gestaltet.

## Undo und Wurfkorrektur

Zwei getrennte Funktionen mit getrennter Bedienung:

### Undo

- Nimmt den letzten Wurf der Partie zurück.
- Wirkt auch nach dem Spielende: der matchentscheidende Wurf lässt sich so
  zurücknehmen, und die Partie läuft weiter.
- Der Klick sitzt unmittelbar an der Eingabefläche, nicht im Kopf der Seite.

### Wurfkorrektur

- Bereits erfasste Würfe einzeln bearbeiten, auch Würfe aus vergangenen Aufnahmen.
- Der zu korrigierende Wurf wird gezielt gewählt; die Korrektur ersetzt den Wurf
  (kein zusätzlicher Wurf).
- Alle abhängigen Zustände werden aus dem Wurfprotokoll neu berechnet: Restpunktzahlen,
  Bustzustände, Checkout-Erkennung, Spielerwechsel, Leg- und Spielergebnis,
  Aufnahmegrenzen.
- Eine Korrektur, die das Ergebnis einer Partie ändert, wird protokolliert.

Nach E-1 ist zu beachten, dass eine ungültige Aufnahme (ein Bust) ihre Punkte
zurückgesetzt hat. Eine Korrektur in eine solche Aufnahme hinein oder aus ihr heraus
muss deshalb genau den Zustand wiederherstellen, den die Aufnahme ohne Bust gehabt
hätte — der Wurfprotokoll-Replay ist die einzige Wahrheit.

## KI-Gegner

Die Spielstärke eines KI-Gegners wird über ein einstellbares 3-Dart-Average
definiert. Vorgesehene Stufen: 25, 40, 55, 70, 85.

Der Average ist eine langfristige Leistungskennzahl und **kein** fester Punktestand je
Aufnahme. Die KI muss ihren Average über viele Aufnahmen hinweg erreichen, nicht
aufnahmeweise.

Erwartetes Verhalten:

- Realistische Streuung der Würfe.
- Unterschiedliche Aufnahmeleistungen: eine Aufnahme ist nicht die nächste.
- Gelegentliche schwache und gelegentliche starke Aufnahmen.
- Strategisches Scoring: hohe Ziele werden bevorzugt, Risiko wird vermieden, wenn der
  Checkout in Reichweite ist.
- Checkout-Wege werden erkannt und berechnet (auch mehrdartige Routen).
- Doppel werden gezielt angespielt, wenn sie den Abschluss sichern.
- Fehler kommen auch in Checkout-Situationen vor.
- Das Verhalten passt sich dem eingestellten Average an: ein 25er-Average und ein
  85er-Average unterscheiden sich in Streuung, Zielwahl und Checkout-Verlässlichkeit.

Architektur: Scoring-Modell, Wurfmodell und Checkout-Strategie bleiben getrennte
Einheiten. Es wird kein komplexeres KI-Framework eingeführt. Bustet eine KI, greift
dieselbe Regel wie bei einem Menschen: die Aufnahme endet, die Punkte werden
zurückgesetzt, und die Bestätigung „Weiter" erfolgt am Gerät durch den Menschen.

## Statistiken

Je Spieler und je Partie werden erfasst:

| Statistik                | Definition                                          |
| ------------------------ | --------------------------------------------------- |
| 3-Dart-Average           | Summe der erzielten Punkte je drei geworfenen Darts |
| First-9-Average          | Average der ersten neun Würfe einer Leg             |
| Highest Checkout         | höchster Checkout-Punktestand einer Leg             |
| Checkout-Quote           | gelungene Checkouts geteilt durch Checkout-Versuche |
| 180er                    | Anzahl Aufnahmen mit 180 Punkten                    |
| 140er+                   | Anzahl Aufnahmen mit 140 oder mehr Punkten          |
| 100er+                   | Anzahl Aufnahmen mit 100 oder mehr Punkten          |
| Best Leg                 | Leg mit den wenigsten geworfenen Würfen             |
| Legs gespielt / gewonnen | Anzahl gespielter und gewonnener Legs je Spieler    |

Regeln der Zählung:

- **Eine ungültige Aufnahme (mit Bust) zählt mit 0 Punkten**, ihre geworfenen Würfe
  zählen aber als geworfen. Sie ist damit weder ein 100er+ noch ein 140er+ noch ein
  180er.
- Der **First-9-Average** bezieht sich auf die ersten neun Würfe der Leg, nicht auf
  drei volle Aufnahmen; eine vorzeitig beendete Aufnahme verkürzt die Spanne nicht.
- **Best Leg** zählt alle geworfenen Würfe der Leg, auch die einer ungültigen
  Aufnahme.
- Ein **Checkout-Versuch** ist eine Lage, in der ein Abschluss möglich war; die
  Definition folgt den Checkout-Routen der KI.

Alle Werte sind je Spieler nachvollziehbar: in der Partie (Auswertung am Ende) und
über Partien hinweg. Die Speicherung erfolgt **lokal** (siehe
[E-4](#e-4-speicherung-der-statistiken)); eine serverseitige Speicherung ist nicht
Teil dieses MVP.

## Plattformen und Bedienbarkeit

- Desktop und Smartphone.
- Responsive Spieloberfläche: das Board ist auf schmalen Fenstern eine Vorschau, auf
  breiten Fenstern die Eingabe.
- Gute Touch-Bedienung: Zielgrößen mindestens 44 px, keine Bedienung, die eine
  Präzision verlangt, die das Ziel nicht hergibt.
- Restpunktzahl und aktiver Spieler sind jederzeit sichtbar.
- Schnelle Wurfeingabe: ein Tastendruck oder ein Tipp pro Wurf.
- Verständliche Fehler- und Statusmeldungen: Meldungen nennen den Fehlercode des
  Motors in eigener Sprache, nie den englischen Entwicklertext.
- Die Bust-Rückmeldung mit der Schaltfläche „Weiter" ist auf dem Smartphone mit einer
  Hand bedienbar und liegt in der Nähe der Eingabefläche.

## Getroffene fachliche Entscheidungen

Die folgenden fünf Entscheidungen sind verbindlich. Der Ist-Stand des Motors hält
noch nicht alle von ihnen ein; die Abweichungen sind in den Issues 501-I11 (E-1),
501-I13 (E-2), 501-I05 (E-3) und 501-I25 (E-4) adressiert.

### E-1: Bust-Verhalten

- Ein Bust beendet die aktuelle Aufnahme sofort.
- Die während dieser Aufnahme erzielten Punkte werden vollständig zurückgesetzt.
- Der Spieler bleibt zunächst in der aktuellen Spielansicht.
- Es erscheint eine verständliche Bust-Rückmeldung.
- Der Spieler muss ausdrücklich auf „Weiter" drücken.
- Erst danach wird zum nächsten Spieler gewechselt.
- Kein automatischer Spielerwechsel nach einem Bust.

Umsetzung: 501-I11 (Motor und Oberfläche), 501-I12 (Punktestand), 501-I14 (Korrektur
im Bust-Kontext), 501-I21 (Bust der KI), 501-I22 (Aufnahme- und Leg-Grenze),
501-I23 (Zählregel der Statistiken), 501-I26 (Regressionstests).

### E-2: Starterwechsel zwischen Legs

- Der Starter wechselt nach jedem Leg gemäß den üblichen Dartregeln.
- Die Reihenfolge muss nachvollziehbar und zuverlässig umgesetzt werden.

Umsetzung: 501-I13 (Regel im Motor), 501-I16 (Ansage des Starters), 501-I26
(Regressionstests je Spielerzahl).

### E-3: Master Out

- Master Out wird ausdrücklich nicht in den aktuellen Funktionsumfang aufgenommen.
- Unterstützt werden zunächst Straight Out und Double Out.

Umsetzung: 501-I05.

### E-4: Speicherung der Statistiken

- Statistiken werden zunächst lokal gespeichert.
- Eine spätere serverseitige Speicherung kann separat betrachtet werden.
- Keine unnötige Datenbank- oder Cloud-Architektur für den ersten 501-MVP einführen.

Umsetzung: 501-I23, 501-I25.

### E-5: Realtime-501 und Multiplayer

- Realtime-501 und Multiplayer sind nicht Bestandteil des aktuellen lokalen 501-MVP.
- Die Architektur soll spätere Erweiterungen nicht unnötig erschweren.
- Die lokale Partie mit mehreren menschlichen Spielern sowie KI-Gegnern bleibt
  Bestandteil des 501-MVP.

Umsetzung: Die Trennung ist eine bestehende Entscheidung (D-2 in
[501-technical-decisions.md](./501-technical-decisions.md)); sie wird durch 501-I21
(KI im lokalen Spiel) und 501-I23 und 501-I25 (reine Statistikberechnung hinter einer
schmalen Ablage-Schnittstelle) eingehalten.
