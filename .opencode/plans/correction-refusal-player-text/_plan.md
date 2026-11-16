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

| #   | Work package                                     | Owner                                          | Files                                                                                                                                                                                                                                                        | Status | Verification                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Stable error codes in the engine                 | `game-engine`                                  | `src/game-engine/types.ts`, `src/game-engine/GameEngine.ts`, `src/game-engine/index.ts`, `src/game-engine/README.md`, `tests/unit/game-engine/errorCodes.test.ts`                                                                                            | done   | `npx vitest run tests/unit/game-engine` → **16 files / 131 tests passed** (orchestrator-verified)                                                                                                                                                                                                                                                                                           |
| B   | Code → player text, wired into the four views    | `frontend`                                     | `src/components/game/playerErrors.ts`, `src/components/x01/X01MatchView.tsx`, `app/game/cricket/page.tsx`, `app/game/around-the-clock/page.tsx`, `app/game/shanghai/page.tsx`, `tests/unit/game/playerErrors.test.ts`                                        | done   | `npx vitest run tests/unit/game-engine tests/unit/game` → **34 files / 274 tests passed** (orchestrator-verified)                                                                                                                                                                                                                                                                           |
| C   | Independent review                               | `code-reviewer` + cezar review task `b0d5f727` | read-only                                                                                                                                                                                                                                                    | done   | verdict **REQUEST_CHANGES** — 1 HIGH, 2 MEDIUM, 3 LOW, 3 NIT; findings and dispositions in `003-review.md`                                                                                                                                                                                                                                                                                  |
| A2  | Engine follow-up: README guard + test quality    | `game-engine`                                  | `src/game-engine/README.md`, `tests/unit/game-engine/docs/publicApi.test.ts`, `tests/unit/game-engine/errorCodes.test.ts`                                                                                                                                    | done   | `npx vitest run tests/unit/game-engine` → **16 files / 132 tests passed**                                                                                                                                                                                                                                                                                                                   |
| B2  | Frontend follow-up: truthful text + wiring       | `frontend`                                     | `src/components/game/playerErrors.ts`, `src/components/game/useMatchHistory.ts`, `src/components/x01/X01MatchView.tsx`, `tests/unit/game/playerErrors.test.ts`, `tests/unit/game/x01CorrectionRefusal.test.tsx`, `tests/unit/game/playerErrorWiring.test.ts` | done   | `npx vitest run tests/unit/game-engine tests/unit/game` → **36 files / 281 tests passed** (orchestrator-verified)                                                                                                                                                                                                                                                                           |
| C2  | Design-system documentation                      | `architect`                                    | `design-system/darthub/pages/match.md`, `design-system/darthub/MASTER.md`                                                                                                                                                                                    | done   | `npm run format:check` exit 0                                                                                                                                                                                                                                                                                                                                                               |
| A3  | Engine: the JSDoc list inside the guard          | `game-engine`                                  | `tests/unit/game-engine/docs/publicApi.test.ts`                                                                                                                                                                                                              | done   | `npx vitest run tests/unit/game-engine` → **16 files / 133 tests passed**; the guard fails on a stale JSDoc (failing-then-passing proven)                                                                                                                                                                                                                                                   |
| B3  | Frontend: the bust announcement guarded          | `frontend`                                     | `src/components/game/playerErrors.ts`, `tests/unit/game/playerErrors.test.ts`, `tests/unit/game/x01MatchView.test.tsx`                                                                                                                                       | done   | `npx vitest run tests/unit/game-engine tests/unit/game` → **36 files / 284 tests passed** (orchestrator-verified)                                                                                                                                                                                                                                                                           |
| C3  | Design system: rule 6 + `board.md` realigned     | `architect`                                    | `design-system/darthub/pages/match.md`, `design-system/darthub/MASTER.md`, `design-system/darthub/board.md`                                                                                                                                                  | done   | `npm run format:check` exit 0; the probe figures re-run against the engine (61 values, 0 accepted)                                                                                                                                                                                                                                                                                          |
| D   | Full verification                                | `orchestrator`                                 | —                                                                                                                                                                                                                                                            | done   | `npm run typecheck` exit 0 · `npm run lint` exit 0 · `npm run format:check` exit 0 · `npx vitest run tests/unit/game-engine tests/unit/game` **36 files / 284 tests passed** · full `npx vitest run` on `81e2573`: 112 files passed / 1 failed (`tests/unit/typescript.test.ts` — the nested `npm run typecheck` hit its 180 s budget under CPU contention; the file passes alone in 153 s) |
| E   | Handover of the open points to the `qa-engineer` | `orchestrator`                                 | `.opencode/plans/correction-refusal-player-text/_plan.md` (section "Handover to the `qa-engineer`")                                                                                                                                                          | done   | five open points (H-1 full suite on the end commit · H-2 Playwright e2e · H-3 German texts in an English UI · H-4 status line at 390 px · H-5 missing e2e spec), each with the command, the preconditions and the acceptance criterion                                                                                                                                                      |

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
- 2026-11-16 — Re-review of `81e2573`: **APPROVE**, no CRITICAL and no HIGH; the guards were
  proven to fail under mutation. Two LOW and two NIT remained and were answered in round 3:
  **A3** engine (the JSDoc list is now inside the guard, both directions), **B3** frontend (the
  positive half of the bust gate is asserted; the principle is narrowed to what is exactly
  true; the probe figures live only in the design document), **C3** architect (`match.md` §6
  rule 6 + `board.md` §6.8.1 realigned with `MASTER.md` §10.2.1).
- 2026-11-16 — Commit `60ebdb3` (A3 + B3 + C3). Orchestrator verification: `npm run typecheck`
  exit 0 · `npm run lint` exit 0 · `npm run format:check` exit 0 · `npx vitest run
tests/unit/game-engine tests/unit/game` → **36 files / 284 tests passed**. The full suite on
  `81e2573`: 112 files passed, 1 failed (`tests/unit/typescript.test.ts` — the nested
  `npm run typecheck` hit its 180 s budget under CPU contention; the file passes alone in
  153 s). The full suite on `60ebdb3` was stopped by the orchestrator on instruction, so the
  last complete full-suite run is the one on `81e2573`.
- 2026-11-16 — Round closed on instruction: the review continues as its own task
  (`173432b4`); the cezar review child of this task (`b0d5f727`) was cancelled by the cockpit
  without a report. The independent review coverage of this branch is the two `code-reviewer`
  rounds (REQUEST_CHANGES → APPROVE).

---

## Handover to the `qa-engineer` — the open points of the closing report

The scope of this task was the **player text only**. The five points below are the
verification and documentation work that was deliberately **not** executed here; they are the
handover to the `qa-engineer`, who owns `tests/`, `e2e/`, `vitest.config.ts`,
`playwright.config.ts` and `docs/TESTING.md`.

The branch under handover is `cez/566b4df8`. The code state is the end commit `0fd93d0`
("docs(plan): Abschlussstand der Korrektur-Verweigerung"); the commit that carries this
section sits on top of it and changes documentation only.

### H-1 — The full suite on the end commit

**Open.** The last complete full-suite run is the one on `81e2573`: **112 files passed, 1
failed** — `tests/unit/typescript.test.ts`, whose **nested** `npm run typecheck` hit its
180 s budget under CPU contention (the file passes alone in 153 s). The runs on `60ebdb3`
and on the end commit were stopped on instruction.

**Command**

```bash
npx vitest run
```

**Preconditions.** Run it in a **quiet tree**: the nested typecheck of
`tests/unit/typescript.test.ts` has a 180 s budget, and two concurrent runs on a two-core
host are enough to push it over. `tests/unit/tailwind/tailwindToolchain.test.ts` needs a
production build (`npm run build`) in `.next/`; it skips without one.

**Acceptance.** A full-suite run on the end commit with a green result, or a documented
explanation for every red file. Record the numbers in `docs/TESTING.md`.

### H-2 — The Playwright end-to-end suite

**Open.** `npm run test:e2e` was never run in this task.

**Command**

```bash
npx playwright install chromium   # once, before the first run
npm run test:e2e
```

**Notes.** The suite builds the production bundle itself and serves the standalone server on
`127.0.0.1` (ports 3100 / 3111) — never on port 3000, that one belongs to the live
preview. Seven specs are `test.skip` placeholders (career, login, matchmaking) by design.
Watch the fixed tab bar (64 px, `z-40`): a block whose **centre** lands in the bottom 64 px
of the phone viewport is not reachable with a viewport-coordinate click.

**Acceptance.** A green Playwright run on the end commit, or a documented list of the
failures with their cause.

### H-3 — The German refusal texts in an English player UI

**Open.** `app/layout.tsx:49` declares `<html lang="en">`, and the whole player UI is
English ("Start match", "Dart pad"). The refusal texts are German only — they are the only
German in the running application. The order of this task demanded the German player text,
so the inconsistency is deliberate and recorded (`003-review.md`, MEDIUM, "Accepted as a
deliberate decision"), but it is unresolved.

**What the qa-engineer can do.** Document the mismatch in `docs/TESTING.md`, name the
affected screens (501, 301, cricket, around the clock, shanghai — five screens built from
four view components) and record the decision that is still open: keep German only and set
`lang="de"` on the status line, add an English text table, or introduce a locale layer.
There is **no i18n layer** in the repository today — `grep -rn "i18n\|locale" src app` finds
only the `lang="en"` attribute.

**Acceptance.** A written decision (owner: product/architect), documented in
`docs/TESTING.md`. The German texts themselves are not to be translated in this task.

### H-4 — The status line at 390 px

**Open.** The refusal appears in the match status line
(`src/components/game/MatchStatus.tsx`: `role="status" aria-live="polite"`,
`font-caption text-caption text-ink-muted`). The longest text is „Diese Änderung würde einen
späteren Wurf ungültig machen. Bitte einen anderen Wert eingeben." (95 characters) — at
390 px that is a multi-line caption under the score. The change was checked by hand in the
browser (no clipping, no scrollbar, no console errors) at 1440 px, 1024 px and 390 px, but
there is **no automated check** for it.

**What the qa-engineer can do.** A viewport check at 390 px that drives a refused
correction and asserts that the status line is fully visible, does not overlap the fixed
tab bar (64 px, `z-40`) and does not push the scoreboard out of the viewport. The longest of
the ten texts is the worst case.

**Acceptance.** A check that fails when the status line is clipped or covered.

### H-5 — The missing e2e spec for the refusal

**Open.** The refusal is covered by unit tests only:
`tests/unit/game/x01CorrectionRefusal.test.tsx` (the behaviour of the x01 view),
`tests/unit/game/playerErrors.test.ts` (the code → text table) and
`tests/unit/game/playerErrorWiring.test.ts` (a static guard over the four view files).
**There is no Playwright spec**, and the three mode pages — cricket, around the clock,
shanghai — have **no behavioural test at all** of the refusal: only the static wiring guard
covers them.

**What the qa-engineer can do.** A spec that starts a match, busts, arms the bust as the
correction target, corrects it and asserts that the German text appears, that the English
engine message does **not** appear and that no bust is announced. One run over the four view
components is enough — the mapping is shared.

**Acceptance.** A red-first spec that fails when a view goes back to `error.message`.
