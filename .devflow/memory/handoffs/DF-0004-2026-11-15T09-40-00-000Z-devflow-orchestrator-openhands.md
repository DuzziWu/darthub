# Handoff: DF-0004 — Mobile Scoring-UX: Board/Manual trennen, Spielerübersicht und Turn-Tracker für 390×844

- Date: 2026-11-15
- Task: DF-0004
- Agent: devflow-orchestrator-openhands
- Recorded by: project-memory-steward
- Status: completed

## Outcome

Die mobile Spielansicht aller fünf Modi ist auf 390×844 umgebaut. Vorher waren Board
und Manual nicht getrennt (im Board-Modus renderten Pad **und** Board), die
Spielerübersicht lag bei y=987 — unterhalb der Falz — und der Undo saß rund 900 px
vom Pad entfernt im sticky Strip.

Nachher gilt bei 390×844:

- **Genau eine Eingabefläche.** Im manuellen Modus ist das Pad die Eingabe und das
  Board bleibt eine read-only Vorschau (`aria-hidden="true"`, 0 Buttons). Im
  Board-Modus ist das Board die Eingabe und das Pad ist **nicht im DOM**.
- **Die Spielerübersicht steht oben.** Sie beginnt bei y=123, ohne Scrollen sichtbar,
  mit dem aktiven Spieler als hervorgehobener Zeile (2 px Messing-Rail + „AM ZUG").
- **Der Restpunktestand** steht als feste Ziffernspalte (`min-w-[3ch]`, `tabular-nums`).
- **Der Undo sitzt im Eingabebereich**, direkt über der Eingabefläche, und heißt exakt
  „Undo". Es gibt genau einen davon im Screen.
- **Die Wurfübersicht setzt nach dem Spielerwechsel zurück.** Sie zeigt die leere
  Aufnahme des neuen Spielers, nicht die Würfe des vorherigen.

Gemessen (390×844, Live-Preview):

| Element              | vorher                     | nachher              |
| -------------------- | -------------------------- | -------------------- |
| `MATCH_STRIP`        | h=111 (drei Zeilen)        | h=59 (einzeilig)     |
| Spielerübersicht     | y=987                      | y=123                |
| Wurfübersicht + Undo | im Strip, ~900 px entfernt | y=353                |
| Pad-Oberkante        | 199                        | 406                  |
| Miss-Key-Unterkante  | 575                        | 761                  |
| Board-Oberkante      | 591                        | 476 (im Board-Modus) |

Die GameEngine-Semantik ist unverändert: `recordThrow`, `undoLastThrow` und
`correctThrow` bleiben die einzigen Schreibpfade, die Regeln und die fünf Modi bleiben,
was sie waren.

## Changed files

- `src/game-engine/throwLedger.ts` — `deriveTurnThrows`
- `src/game-engine/GameEngine.ts` — `getCurrentTurn()`
- `src/game-engine/index.ts`, `src/game-engine/types.ts`, `src/game-engine/README.md`
- `src/components/game/PlayerScoreboard.tsx` (neu)
- `src/components/game/VisitTracker.tsx` (neu)
- `src/components/game/MatchLayout.tsx`
- `src/components/game/ThrowInputPad.tsx`
- `src/components/game/ThrowHistoryControls.tsx`
- `src/components/game/useMatchHistory.ts`
- `src/components/game/classes.ts`, `src/components/game/types.ts`
- `src/components/board/DartBoard.tsx`
- `src/components/x01/X01MatchView.tsx`
- `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`,
  `app/game/shanghai/page.tsx`
- `AGENTS.md`
- `tests/unit/game-engine/turnThrows.test.ts` (neu)
- `tests/unit/game/playerScoreboard.test.tsx` (neu)
- `tests/unit/game/visitTracker.test.tsx` (neu)
- `tests/unit/game-engine/docs/publicApi.test.ts`
- `tests/unit/game/ThrowHistoryControls.test.tsx`, `tests/unit/game/useMatchHistory.test.ts`,
  `tests/unit/game/x01MatchView.test.tsx`

## Verification

- `npm run typecheck` — grün
- `npm run lint` — grün
- `npm run format:check` — grün
- `npm run test` — **105 Dateien / 526 Tests** grün (Basislinie vor dieser Arbeit:
  102 Dateien / 494 Tests)
- `npm run build` und `npm run build:prefixed` — grün
- `npx playwright test` — **70 passed, 7 skipped** (die 7 sind `test.skip`-Platzhalter)
- Unabhängig gemessen (Playwright, alle fünf Modi × beide Eingabemodi bei 390×844):
  genau eine `Current visit`-Liste, genau ein `Undo`, genau ein `3× Treble`-Radio,
  kein horizontaler Überlauf, Miss-Unterkante 629 px, Board-Oberkante 344 px,
  Übersicht ab y=123 sichtbar, `data-remaining`/`data-active-player` vorhanden.
- Verhalten geprüft: nach drei Würfen wechselt der Spieler, die Wurfübersicht ist
  leer, `Undo` stellt Alice samt 261 Punkten wieder her.

## Open issues

- Die Sub-Issues #12 bis #16 sind noch nicht auf GitHub geschlossen — sie warten auf
  die Freigabe des Commits.
- Offene Frage aus dem Plan: soll die Spielerübersicht zusätzlich sticky sein? Der
  Plan sagt nein (ein zweites sticky Band würde den Falz zu einem Drittel fressen).

## Documentation impact

- Impact: yes
- Documentation status: updated
- Documentation files: `AGENTS.md`, `src/game-engine/README.md`,
  `.devflow/memory/CURRENT_STATE.md`, `.devflow/memory/ARCHITECTURE.md`,
  `.devflow/memory/PROJECT.md`, `.claude/plans/mobile-scoring-ux/_plan.md`

## Next step

Den Commit mit der Engine- und der Frontend-Arbeit als eine Einheit freigeben und
danach die GitHub-Issues #6 und #11–#16 schließen.
