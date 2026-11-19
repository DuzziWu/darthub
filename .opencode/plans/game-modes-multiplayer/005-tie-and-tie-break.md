# 005 — M5: A tie is a tie, and the tie-break rule is on screen

**Owning agent:** `game-engine`
**Plan:** `docs/superpowers/plans/2026-11-12-game-modes.md` → Task M5
**Binding rulings:** A4, A5, B3/C1, B10, C1, C2, C5, C4
**Pre-flight:** `docs/superpowers/plans/2026-11-12-game-modes-preflight.md`

## Scope

Report a level Shanghai match as a **tie**, state the tie-break rule on screen, and do it
**without** inventing a second result mechanism next to the one the engine already has.

**In scope**

- A structured, JSON-safe `MatchResult` on the **mode**, exposed through the existing
  `DartGameMode` result seam.
- `ShanghaiMode` reports the winner or a tie, plus the tie-break rule.
- The result banner announces a tie instead of "No winner".
- The shanghai view passes the derived result to the banner.
- The engine README's `MatchState` block is updated, because the shape changes.

**Out of scope**

- The undo wiring (M6).
- The realtime path (`src/realtime/`) — the structured result is not carried over the wire in
  this plan; the socket path runs `NeutralScoreMode`.
- `app/api/`.

## Files

**Owned by `game-engine` (this package edits these):**

| File                                                | What changes                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-engine/types.ts`                          | The `MatchResult` interface and the new optional `DartGameMode.result?(state): MatchResult` member, **next to** the existing `resultSignature` (`:213`). |
| `src/game-engine/GameEngine.ts`                     | The derived result, the public `getResult()`, and `resultKey` kept consistent with it.                                                                   |
| `src/game-engine/modes/ShanghaiMode.ts`             | The `result(state)` accessor **and** the dedicated `shanghaiWinnerId` flag. **After M3** — a different region from M3's data-shape work.                 |
| `src/game-engine/index.ts`                          | Exports `MatchResult` if it becomes part of the public surface. It exports **no** `MatchResult` today (`:11-34`).                                        |
| `src/game-engine/README.md`                         | The `MatchState` code block at `:195-207`.                                                                                                               |
| `tests/unit/game-engine/modes/ShanghaiMode.test.ts` | The tie test. **After M3** — a different region from M3's tests.                                                                                         |

**Coordinated — `frontend` agent's area, executed by that agent, sequenced AFTER the engine half:**

| File                                                              | What changes                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/game/GameResultBanner.tsx`                        | `tied` / `tieBreak` props; the headline names the tie; the tie-break rule goes in the sub-line.    |
| `src/components/game/types.ts` **§ `GameResultBannerProps` only** | `readonly tied?: boolean;` and `readonly tieBreak?: string;`. **After M4's `PlayerSetup*` block.** |
| `app/game/shanghai/page.tsx`                                      | Passes the derived result to the banner. **After M3** — a different region from M3's rewrite.      |
| `tests/unit/game/gameResultBanner.test.tsx`                       | The tie test. **After M3, before M6.**                                                             |

**No other file may be touched by this package.**

## File-conflict resolution

- `src/game-engine/modes/ShanghaiMode.ts` and
  `tests/unit/game-engine/modes/ShanghaiMode.test.ts` — **after M3** (M3 → M5). M3 owns the
  data shape and `applyThrow`; M5 owns the `result()` accessor and the `shanghaiWinnerId` flag.
- `app/game/shanghai/page.tsx` — **after M3, before M6** (M3 → M5 → M6). M3 owns the
  two-player rewrite; M5 owns the result wiring; M6 owns the `onUndo` wiring.
- `src/components/game/types.ts` — **after M1, M2, M3 and M4** (M1 → M2 → M3 → M4 → M5). Only
  `GameResultBannerProps` changes here.
- `src/components/game/GameResultBanner.tsx` — **M5 owns it alone in this plan.** M6 does
  **not** change the banner component: the `onUndo` prop and its button already exist
  (`src/components/game/types.ts:151-155`, `src/components/game/GameResultBanner.tsx:102-110`).
  M6 only wires and tests them.
- `tests/unit/game/gameResultBanner.test.tsx` — M5 owns the tie test; M6 owns the
  undo-render test. **M5 → M6.**

## The B10 deviation — what this package must NOT do

> **Do not add a `MatchState.result` field.** The tree already has a result seam:
> `src/game-engine/types.ts:213` — `resultSignature?(state: MatchState): string;` on
> `DartGameMode`. The only implementation is `src/game-engine/modes/StandardMode.ts:129`. The
> engine consumes it in `src/game-engine/GameEngine.ts:358-364` (`private resultKey(state)`),
> which falls back to `"complete" | "open"`.
>
> - A `MatchState.result` field would be a **second, parallel** result mechanism next to that
>   seam. Two places answering "how did the match end?" drift apart. **That duplication must be
>   avoided.**
> - **But the existing seam is not a ready-made replacement.** It is **optional**,
>   **string-valued**, **audit-only**, implemented by **one** mode, and its engine-side use is
>   **private**. `resultKey` has exactly **one** caller: `shouldAudit`
>   (`src/game-engine/GameEngine.ts:344-351`, line `350`), where it decides whether a
>   correction of a dart in the live turn enters the audit trail. It answers _"did the result
>   change?"_ — it does **not** answer _"who won, is it a tie, by what margin?"_, which is
>   exactly what this result screen needs.
> - **Therefore this package EXTENDS the existing seam rather than bypassing it.** The
>   structured result belongs on the **mode**
>   (`result?(state: MatchState): MatchResult`), and the engine derives and exposes it
>   (`GameEngine.getResult()`). The engine must hold **one** notion of "how the match ended":
>   `resultKey` and the structured result must come from the **same** mode-owned source.
> - **`MatchResult` must be JSON-safe** — plain objects, arrays, strings, numbers, booleans and
>   `null` only (`src/game-engine/types.ts:120-125`;
>   `tests/unit/game-engine/frameworkAgnostic.test.ts:70-73`). _(ruling C5)_

## Other binding rulings

- **A5 (load-bearing) — the Shanghai winner check must never read `roundRecords`.**
  `roundRecords` is cleared at the round advance
  (`src/game-engine/modes/ShanghaiMode.ts:96`), so a completed round's flags are gone. The
  check reads the **dedicated mode flag** (`shanghaiWinnerId`) that this package adds.
- **A4 — the winner rule must not assume a shared ATC `currentTargetIndex`.**
  `src/game-engine/modes/AroundTheClockMode.ts:10,64` — the shared index becomes a per-player
  map in M2. This package's rule reads the Shanghai data only.
- **B3 / C1 — no `@testing-library/jest-dom`.** `expect(...).toBeTruthy()`.
- **C4 — no commit.**

## Acceptance Criteria

1. `MatchResult` is `{ readonly winnerId?: string; readonly tied: boolean; readonly tieBreak?: string }`
   and is **JSON-safe**.
2. `DartGameMode` gains `result?(state: MatchState): MatchResult` — **one** new member, next to
   the existing `resultSignature`. **No `MatchState.result` field is added.**
3. `GameEngine` exposes the derived result through a public accessor
   (`getResult(): MatchResult | undefined`), and `resultKey` stays consistent with it.
4. `ShanghaiMode` reports the Shanghai winner outright (a "Shanghai!" beats the totals) and
   otherwise reports a tie when the leaders are level — with the tie-break rule text.
5. The Shanghai winner check reads the **dedicated flag**, never `roundRecords`. _(A5)_
6. `src/game-engine/index.ts` exports `MatchResult` if it is part of the public surface.
7. `src/game-engine/README.md:195-207` — the `MatchState` code block reflects the new shape.
8. `src/components/game/GameResultBanner.tsx` — the headline reads "Tie" (not "No winner") and
   the tie-break rule appears in the sub-line. The `Trophy` icon stays and stays
   `aria-hidden`.
9. `src/components/game/types.ts` — `GameResultBannerProps` gains `tied?` and `tieBreak?`, and
   **keeps** M4's `leg` / `set` props. _(ruling A7)_
10. `app/game/shanghai/page.tsx` passes the engine's derived result — the view never computes one.
11. A level Shanghai match ends with `status === "completed"` and `getResult()?.tied === true`.
12. `npm run typecheck`, `npm run lint`, `npm run format:check` are clean.
13. `tests/unit/game-engine/frameworkAgnostic.test.ts` stays green — the snapshot still survives
    a JSON round-trip.

## Verification command

```bash
npx vitest run tests/unit/game-engine/modes/ShanghaiMode.test.ts tests/unit/game/gameResultBanner.test.tsx tests/unit/game-engine/frameworkAgnostic.test.ts && npm run typecheck && npm run lint && npm run format:check
```

## Result

<!-- Filled in when the package is executed. -->
