# Plan — Korrektur-Verweigerung: stabiler Fehlercode statt Textvergleich

**Feature slug:** `correction-refusal-player-text`
**Created:** 2026-11-16
**Branch:** `cez/566b4df8` · base `2bcfa25`
**Source task:** Restpunkt 4 aus „Ledger: Turn-Rotation des Wurf-Ledgers"

---

## Objective

The refusal `GameEngine.correctThrow` throws when a correction would change the turn
rotation of the ledger reaches the player as raw English developer text
("The correction would change the turn order: dart N would no longer belong to the same
turn"). The refusal is also recognisable **only** by its message — the text is not a
contract.

Two things change, and nothing else:

1. The engine's refusals get a **stable code** (`TURN_ROTATION_CHANGED` and its
   siblings). The message stays English developer text; the code is the contract.
2. The four match views translate the **code** into a short German player text.
   No string matching on the message, anywhere.

The refusal logic, the turn-rotation invariant and the audit rules stay untouched.

---

## The contract (decided here, so both packages agree)

### Error API — before / after

**Before**

```ts
class GameEngineStateError extends Error {
  constructor(message: string);
}
```

**After**

```ts
export type GameEngineErrorCode =
  | "INVALID_STATE"
  | "MATCH_COMPLETED"
  | "NOT_YOUR_TURN"
  | "NO_MATCH"
  | "NOTHING_TO_UNDO"
  | "NO_DART_AT_INDEX"
  | "BUST"
  | "CORRECTION_WOULD_BUST"
  | "LATER_DART_WOULD_BUST"
  | "TURN_ROTATION_CHANGED";

class GameEngineStateError extends Error {
  readonly code: GameEngineErrorCode;
  constructor(message: string, code?: GameEngineErrorCode); // default "INVALID_STATE"
}

class GameEngineBustError extends GameEngineStateError {
  constructor(message: string); // code "BUST"
}
```

`instanceof GameEngineStateError` keeps working everywhere — `src/realtime/GameStateMachine.ts:41`
and `src/components/x01/X01MatchView.tsx:232` depend on it. The bust error stays a
subclass of the state error, so both callers are unaffected.

### Code table and the German player text

| Code                    | Raised when                                   | Player text (German)                                                                           |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `TURN_ROTATION_CHANGED` | the correction would change the turn rotation | `Diese Änderung würde die Reihenfolge der Würfe ändern. Bitte einen anderen Wert eingeben.`    |
| `CORRECTION_WOULD_BUST` | the corrected dart itself would bust          | `Mit diesem Wert wäre der Wurf ungültig. Bitte einen anderen Wert eingeben.`                   |
| `LATER_DART_WOULD_BUST` | a later recorded dart would bust              | `Diese Änderung würde einen späteren Wurf ungültig machen. Bitte einen anderen Wert eingeben.` |
| `BUST`                  | the dart busted                               | `Bust — der Wurf zählt nicht.`                                                                 |
| `MATCH_COMPLETED`       | the match is over                             | `Das Spiel ist bereits beendet.`                                                               |
| `NOT_YOUR_TURN`         | it is somebody else's turn                    | `Du bist gerade nicht am Zug.`                                                                 |
| `NO_MATCH`              | no match has been started                     | `Es läuft noch kein Spiel.`                                                                    |
| `NOTHING_TO_UNDO`       | the ledger is empty                           | `Es gibt nichts zurückzunehmen.`                                                               |
| `NO_DART_AT_INDEX`      | the corrected index does not exist            | `Diesen Wurf gibt es nicht.`                                                                   |
| `INVALID_STATE`         | generic fallback (default)                    | `Das hat nicht geklappt. Bitte versuche es noch einmal.`                                       |

Errors without a code (e.g. `GameEngineValidationError`) get the generic fallback
`Das hat nicht geklappt. Bitte versuche es noch einmal.`

Rules for the texts: short, plain German, **no** engine vocabulary (no ledger, rotation,
replay, index, turn id), **no** dart-index specification, no English leftovers.

### The mapping site

One module, shared by the four views:

`src/components/game/playerErrors.ts`

```ts
export const PLAYER_ERROR_TEXTS: Readonly<Record<GameEngineErrorCode, string>>;
export const FALLBACK_ERROR_TEXT: string;
export function playerErrorText(error: unknown): string;
```

`playerErrorText` reads `error.code` **only** when the error is a
`GameEngineStateError`; it never inspects the message.

---

## Task table

| #   | Work package                                  | Owner                                          | Files                                                                                                                                                                                                                                                        | Status      | Verification                                                                                                                                                                                                      |
| --- | --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Stable error codes in the engine              | `game-engine`                                  | `src/game-engine/types.ts`, `src/game-engine/GameEngine.ts`, `src/game-engine/index.ts`, `src/game-engine/README.md`, `tests/unit/game-engine/errorCodes.test.ts`                                                                                            | done        | `npx vitest run tests/unit/game-engine` → **16 files / 131 tests passed** (orchestrator-verified)                                                                                                                 |
| B   | Code → player text, wired into the four views | `frontend`                                     | `src/components/game/playerErrors.ts`, `src/components/x01/X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, `tests/unit/game/playerErrors.test.ts`                                        | done        | `npx vitest run tests/unit/game-engine tests/unit/game` → **34 files / 274 tests passed** (orchestrator-verified)                                                                                                 |
| C   | Independent review                            | `code-reviewer` + cezar review task `b0d5f727` | read-only                                                                                                                                                                                                                                                    | done        | verdict **REQUEST_CHANGES** — 1 HIGH, 2 MEDIUM, 3 LOW, 3 NIT; findings and dispositions in `003-review.md`                                                                                                        |
| A2  | Engine follow-up: README guard + test quality | `game-engine`                                  | `src/game-engine/README.md`, `tests/unit/game-engine/docs/publicApi.test.ts`, `tests/unit/game-engine/errorCodes.test.ts`                                                                                                                                    | done        | `npx vitest run tests/unit/game-engine` → **16 files / 132 tests passed**                                                                                                                                         |
| B2  | Frontend follow-up: truthful text + wiring    | `frontend`                                     | `src/components/game/playerErrors.ts`, `src/components/game/useMatchHistory.ts`, `src/components/x01/X01MatchView.tsx`, `tests/unit/game/playerErrors.test.ts`, `tests/unit/game/x01CorrectionRefusal.test.tsx`, `tests/unit/game/playerErrorWiring.test.ts` | done        | `npx vitest run tests/unit/game-engine tests/unit/game` → **36 files / 281 tests passed** (orchestrator-verified)                                                                                                 |
| C2  | Design-system documentation                   | `architect`                                    | `design-system/darthub/pages/match.md`, `design-system/darthub/MASTER.md`                                                                                                                                                                                    | done        | `npm run format:check` exit 0                                                                                                                                                                                     |
| A3  | Engine: the JSDoc list inside the guard       | `game-engine`                                  | `tests/unit/game-engine/docs/publicApi.test.ts`                                                                                                                                                                                                              | done        | `npx vitest run tests/unit/game-engine` → **16 files / 133 tests passed**; the guard fails on a stale JSDoc (failing-then-passing proven)                                                                         |
| B3  | Frontend: the bust announcement guarded       | `frontend`                                     | `src/components/game/playerErrors.ts`, `tests/unit/game/playerErrors.test.ts`, `tests/unit/game/x01MatchView.test.tsx`                                                                                                                                       | done        | `npx vitest run tests/unit/game-engine tests/unit/game` → **36 files / 284 tests passed** (orchestrator-verified)                                                                                                 |
| C3  | Design system: rule 6 + `board.md` realigned  | `architect`                                    | `design-system/darthub/pages/match.md`, `design-system/darthub/MASTER.md`, `design-system/darthub/board.md`                                                                                                                                                  | done        | `npm run format:check` exit 0; the probe figures re-run against the engine (61 values, 0 accepted)                                                                                                                |
| D   | Full verification                             | `orchestrator`                                 | —                                                                                                                                                                                                                                                            | in_progress | `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npm run format:check` exit 0 · `npx vitest run tests/unit/game-engine tests/unit/game` **36 files / 284 tests passed** · full `npx vitest run` to be re-run |

A and B touch disjoint file sets, but B imports the code type of A — so they run in
sequence: A first, then B. The follow-up round A2/B2/C2 answers the review findings and
runs in parallel (disjoint files). C and D follow.

---

## Progress log

- 2026-11-16 — Plan written; contract (code union, code table, German texts, mapping site)
  fixed here so both packages implement the same API.
- 2026-11-16 — Package A done: `GameEngineErrorCode` (10 codes), `readonly code` on
  `GameEngineStateError` (default `INVALID_STATE`), `GameEngineBustError` → `"BUST"`,
  all nine throw sites coded, README documents the code table, new
  `tests/unit/game-engine/errorCodes.test.ts` (10 tests). Orchestrator verification:
  `npx vitest run tests/unit/game-engine` → 16 files / 131 tests passed. The `instanceof`
  contract of `src/realtime/GameStateMachine.ts:41` is untouched.
- 2026-11-16 — Package B dispatched to the `frontend` specialist.
- 2026-11-16 — Commit `1724b88` (A + B). Independent review → **REQUEST_CHANGES**: one HIGH
  (the turn-rotation text promised a value that is never accepted), two MEDIUM (the x01 bust
  branch swallowed the refusal; the call sites were untested), three LOW, three NIT. The
  orchestrator reproduced the HIGH independently: **61 values (0…60), 0 accepted**.
- 2026-11-16 — Fix round in three parallel packages (disjoint files): **A2** engine (README
  code table guarded in both directions by a test, the mode's deliberate `INVALID_STATE`
  fallback documented, the two test-quality findings fixed), **B2** frontend (truthful
  turn-rotation text „Diesen Wurf kannst du nicht mehr ändern. Bitte zurücknehmen und neu
  werfen.", the bust branch no longer applies to a correction, a behavioural jsdom test and
  a static wiring guard, the NITs), **C2** architect (the design system documents the
  code → player-text rule and the "never promise a remedy that does not exist" principle).
  Findings and dispositions: `003-review.md`.
- 2026-11-16 — Commit `81e2573` (A2 + B2 + C2). Orchestrator verification: `npm run
typecheck` exit 0 · `npm run lint` exit 0 · `npm run format:check` exit 0 ·
  `npx vitest run tests/unit/game-engine tests/unit/game` → **36 files / 281 tests passed**.
  A re-review of the fixes and a full `npx vitest run` are running.
