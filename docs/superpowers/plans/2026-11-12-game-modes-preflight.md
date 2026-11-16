# Pre-flight rulings — Game Modes (Multiplayer, Match Format, Live Play)

**Provenance.** The rulings below were made on **2026-11-12** against commit `4014b44` in the
`feature/game-modes` worktree (`/home/administrator/projects/darthub-worktrees/game-modes`) and
**re-verified on 2026-11-15 against commit `d73c37f`** (base `origin/main` `b07665a`) in this
worktree (`/home/administrator/projects/darthub/.ai/cezar/worktrees/e988a487-2bce-494b-8c62-e3ed9049bc6e`).

Every ruling below carries a `file:line` proof read in **today's** tree — not copied from the
2026-11-12 scan. Where a ruling no longer holds, the line says so and says why. Where the
original reference has moved, the proof names the **current** location, so a reader can check it
without the original branch.

**Binding companion of** `docs/superpowers/plans/2026-11-12-game-modes.md`. The plan references
this file at its header and at M1, M2, M3, M4, M5, M6 and M7. Where this file and the plan
disagree, **this file wins**.

---

## A. Task pairs that share a file or an interface

**Ruling A1:** gilt weiterhin — M1 and M3 both reshape a `*ScoreSheetProps` in the same file;
neither carries the `players` convention yet, so M1 establishes it and M3 copies it. M3 reuses
M1's `players: ReadonlyArray<{ id, name, … }>` convention verbatim. Both packages edit
`src/components/game/types.ts`, so they are **sequenced, M1 first**. — Beleg:
`src/components/game/types.ts:263-272` (`CricketScoreSheetProps`, today `marks` + `playerName`),
`src/components/game/types.ts:281-292` (`ShanghaiScoreSheetProps`, today
`marksByRound: Record<string, number>`)

**Ruling A2:** gilt weiterhin — M1 and M2 are the same-shape work; neither sheet takes `players`
or `currentPlayerId` today. M2 mirrors M1's prop/aria conventions exactly — one
`<section aria-label={`${player.name} around the clock`}>` per player, same class vocabulary. —
Beleg: `src/components/game/CricketScoreSheet.tsx:18-23`,
`src/components/game/AroundTheClockScoreSheet.tsx:12`

**Ruling A3:** gilt weiterhin — no conflict. M4 changes the setup **component**
(`src/components/game/PlayerSetup.tsx`); M1 changes only the **caller's** `maxPlayers` prop. The
two share no file. — Beleg: `src/components/game/PlayerSetup.tsx:24-36`,
`src/components/game/types.ts:170-190` (`PlayerSetupProps`, no `matchFormat` today),
`app/game/cricket/page.tsx:153` (`maxPlayers={1}`)

**Ruling A4:** gilt weiterhin — M5's winner rule must not assume a shared ATC
`currentTargetIndex`: the field is one number for the whole match today, and M2 replaces it with
a per-player map. M5's rule reads the cricket/standard data, or a mode-specific accessor, never
the shared index. — Beleg: `src/game-engine/modes/AroundTheClockMode.ts:10` (the declaration),
`src/game-engine/modes/AroundTheClockMode.ts:64` (the comparison in `isMatchComplete`),
`src/game-engine/modes/AroundTheClockMode.ts:58` (the increment)

**Ruling A5:** gilt weiterhin (load-bearing) — M5's Shanghai winner check must read the
_ledger-derived_ segment flags or the mode's own dedicated flag, **never** `roundRecords`:
`roundRecords` is cleared when the round advances, so a completed round's flags no longer exist
there. Cost if wrong: the "Shanghai!" win is never detected in M5's UI. — Beleg:
`src/game-engine/modes/ShanghaiMode.ts:96` (the clearing), `src/game-engine/modes/ShanghaiMode.ts:107-109`
(`isMatchComplete` reads the flags out of `Object.values(data.roundRecords)`)

**Ruling A6:** gilt weiterhin — sequential dependency, not a conflict: M6 runs **after** M3 and
uses M3's shape. — Beleg: `src/game-engine/modes/ShanghaiMode.ts:12-27` (the shape M3 changes)

**Ruling A7:** gilt weiterhin — M5 must not remove or rename M4's `leg` / `set` props; it adds
alongside. **Sequenced: M4 before M5** (both edit `src/components/game/types.ts` and
`src/components/game/GameResultBanner.tsx`). — Beleg:
`src/components/game/types.ts:156-159` (`leg` / `set` on `GameResultBannerProps`),
`src/components/game/types.ts:134-137` (the same on `ScoreDisplayProps`)

**Ruling A8:** gilt weiterhin, and the gap is bigger than on 2026-11-12 — the banner renders
"Undo last dart" only when it is given an `onUndo` prop, and in this tree exactly **one** view
passes one. M6 must therefore **wire** the three views that lack it and pin all four. M6 is no
longer test-only. — Beleg: `src/components/game/GameResultBanner.tsx:102-110` (the conditional
button), `app/game/cricket/page.tsx:239` (the only `onUndo`),
`app/game/around-the-clock/page.tsx:225-231`, `app/game/shanghai/page.tsx:272-278`,
`src/components/x01/X01MatchView.tsx:235-241` (the three banners without one)

**Ruling A9:** gilt weiterhin — M6's result-screen assertions depend on M5's structured result
reaching the view; `MatchState` carries no result today. **Sequenced: M5 before M6.** — Beleg:
`src/game-engine/types.ts:126-144` (no `result` field)

**Ruling A10:** gilt weiterhin — M2 and M3 must each update their own existing tests to the new
shape (see B6/C2). M2 changes `AroundTheClockModeData`, M3 changes `ShanghaiModeData`; both have
tests that read the old shapes. — Beleg: `src/game-engine/modes/AroundTheClockMode.ts:9-13`,
`src/game-engine/modes/ShanghaiMode.ts:12-27`,
`tests/unit/game-engine/modes/AroundTheClockMode.test.ts:18-19`,
`tests/unit/game-engine/modes/CorrectionReplay.test.ts:113`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:180`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:215`

**Ruling A11:** gilt weiterhin — views read the engine's data; **no view keeps a private dart
copy**. M3 replaces the ledger-derived `marksByRound` helper with a mode-derived one for exactly
this reason. — Beleg: `app/game/cricket/page.tsx:85`,
`app/game/cricket/page.tsx:93`, `app/game/around-the-clock/page.tsx:74`,
`app/game/around-the-clock/page.tsx:84`, `app/game/shanghai/page.tsx:192`

---

## B. Does each task agree with itself?

**Ruling B1:** gilt weiterhin (load-bearing) — the player name is rendered in its **own
element** (`<span>{player.name}</span>`), with " · ON TURN" as a **sibling**. Then
`getByText("Bob")` matches the name and `getByText("Bob · ON TURN")` still matches the heading.
The repo's own idiom is `expect(...).toBeTruthy()`. — Beleg:
`tests/unit/game/modeViews.test.tsx:107`,
`tests/unit/game/modeViews.test.tsx:98-99`,
`src/components/game/ShanghaiScoreSheet.tsx:36` (the heading that concatenates the round today)

**Ruling B2:** gilt weiterhin — with two players the label matches **two** elements, so
`getByLabelText` throws "found multiple". The existing assertion must become
`getAllByLabelText` or be scoped to a player's `<section>` — **updated, never deleted**
(B6/C2). The plan does not mention this breakage. — Beleg:
`src/components/game/CricketScoreSheet.tsx:48` (the label format),
`tests/unit/game/modeViews.test.tsx:107` (the assertion that breaks),
`tests/unit/game/cricketCorrection.test.tsx:45` (the same label, already asserted)

**Ruling B3:** gilt weiterhin (load-bearing, global) — every `toBeInTheDocument()` becomes
`expect(...).toBeTruthy()`. `@testing-library/jest-dom` is **not** installed and the plan may
not add it (Global Constraint: "No new runtime dependencies"). Cost if wrong: 13 plan tests fail
with a confusing Chai error instead of passing. — Beleg: `package.json:47-48` (only
`@testing-library/dom` and `@testing-library/react`), and `grep -rn "toBeInTheDocument" tests/`
→ **no hits** in the whole suite

**Ruling B4:** gilt weiterhin (load-bearing) — M2's completion rule is **first player to clear
all 21 targets wins**: per-player progress, but the match ends when **one** player finishes. The
plan's "every player must finish" rule is **rejected** — it contradicts the mode's own class doc
and the registry's published win condition, and it makes a two-player match **un-endable**.
Cost if wrong: an ATC match with two players can never be won. — Beleg:
`src/game-engine/modes/AroundTheClockMode.ts:62-65` (`isMatchComplete` compares the **shared**
index), `src/game-engine/modes/AroundTheClockMode.ts:9-13` (`playerProgress` is already
per-player), `src/game-engine/modes/AroundTheClockMode.ts:20-22` (the class doc: "The player who
hits all 21 targets first wins the match"), `src/game-engine/modes/registry.ts:168` (the win
condition: "Hit every target in order")

**Ruling B5:** gilt weiterhin — the progress readout must be **scoped per player** (inside the
player's `<section>`), and the assertion must use `within(section)`. With two players an
unscoped `getByText("Progress 0 / 21")` throws "found multiple". — Beleg:
`src/components/game/AroundTheClockScoreSheet.tsx:26-28` (the readout),
`tests/unit/game/modeViews.test.tsx:132` (the existing unscoped assertion)

**Ruling B6:** gilt weiterhin (load-bearing, global) — existing tests are **updated to the new
shape**, never deleted, never weakened (C2). Cost if wrong: an implementer reads the failing
tests as a regression and reverts the feature. — Beleg:
`tests/unit/game-engine/modes/AroundTheClockMode.test.ts:18-19`,
`tests/unit/game-engine/modes/CorrectionReplay.test.ts:113`,
`tests/unit/game-engine/modes/CorrectionReplay.test.ts:119`,
`tests/unit/game-engine/modes/CorrectionReplay.test.ts:124`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:180`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:215`

**Ruling B7:** gilt weiterhin (load-bearing) — M3's Step 3 **must keep** the Shanghai
early return. The round-advance block runs **after** it, and the early-return path must also
**skip** the round advance (a Shanghai ends the match, not the round). Cost if wrong: the
"Shanghai!" win silently stops working and an existing test fails. — Beleg:
`src/game-engine/modes/ShanghaiMode.ts:86-89` (the early return),
`src/game-engine/modes/ShanghaiMode.ts:93` (the round advance that follows it),
`tests/unit/game-engine/modes/ShanghaiMode.test.ts:86-97` (the pin: `status === "completed"`,
`currentPlayerId === null`, 6 marks)

**Ruling B8:** gilt weiterhin, but the **reference has moved** — the 2026-11-12 ruling cited
`tests/unit/game/modeViews.test.tsx:290` as the assertion of the literal string "Target 1".
**That file is 233 lines in this tree — line 290 does not exist, and "Target 1" is asserted
nowhere in `tests/`.** The literal is asserted only by Playwright, and the unit assertions are
different. M2's ATC rewrite keeps the visible string **"Target 1"**; the obsolete
`modeViews.test.tsx:290` reference must not be re-created. — Beleg:
`e2e/game-center.spec.ts:162` (`await expect(page.getByText("Target 1")).toBeVisible();`),
`tests/unit/game/modeViews.test.tsx:131` (`data-current-target` reads "1"),
`tests/unit/game/modeViews.test.tsx:132` (`"Progress 0 / 21"`),
`app/game/around-the-clock/page.tsx:167` (the badge that produces the string)

**Ruling B9:** gilt weiterhin (load-bearing) — `StandardMode.initializeMatch` must **seed**
`LEG_SET_MODE_DATA_KEY` when a leg/set manager is active, with
`LegSetManager.initialProgress()`. **The seeded slice alone is not enough** — the leg/set
_sizes_ must also reach the view, or the header still cannot say "Leg 1/3" honestly. Cost if
wrong: M4's readout never appears in the product. — Beleg:
`src/game-engine/modes/StandardMode.ts:89-93` (`initializeMatch` sets only `totalPoints`),
`src/game-engine/modes/StandardMode.ts:149` (the slice is written **only** after a finished
leg), `src/game-engine/rules/LegSetManager.ts:118` (the key, value `"legSet"`),
`src/game-engine/rules/LegSetManager.ts:77-78` (`initialProgress`),
`src/components/x01/X01MatchView.tsx:69-80` (the view's reader, which returns `{}` on purpose
because the sizes are not in the state)

**Ruling B10:** gilt weiterhin (load-bearing), with a **precision correction** — the plan's
proposed `MatchState.result` field would be a **second, parallel** result mechanism next to the
existing `resultSignature` seam, and that duplication must be avoided. **But the existing seam is
not a ready-made replacement**: it is optional, string-valued, audit-only, implemented by one
mode, and its engine-side use is private. It answers _"did the result change?"_ — not _"who won,
is it a tie, by what margin?"_, which is exactly what M5's result screen needs. **M5 therefore
EXTENDS the existing seam** (a structured, JSON-safe `MatchResult` on the mode, converted by the
engine alongside `resultSignature`, keeping the audit comparison working) **instead of bolting
an unrelated `MatchState.result` field onto the state.** `MatchResult` must be JSON-safe (C5)
and must be exported from `src/game-engine/index.ts` if it becomes public. **M5 must also update
the `MatchState` code block in `src/game-engine/README.md`** — the shape changes, and M7's doc
scope does not cover the engine README. Cost if wrong: either a duplicate mechanism, or a tie
that is computed and thrown away. — Beleg:
`src/game-engine/types.ts:213` (`resultSignature?(state: MatchState): string;` — optional,
string-valued),
`src/game-engine/modes/StandardMode.ts:129` (the **only** implementation),
`src/game-engine/GameEngine.ts:358-364` (`private resultKey(state): string`, falling back to
`"complete" | "open"`),
`src/game-engine/GameEngine.ts:344-351` (`shouldAudit`, the **only** caller — line `350`:
`return this.resultKey(before) !== this.resultKey(after);`),
`src/game-engine/index.ts:11-34` (no `MatchResult` or equivalent is exported),
`src/game-engine/README.md:195-207` (the `MatchState` code block)

**Ruling B10 applies to M6 as well:** the plan's M6 premise ("all four views already pass a
`handleUndo`") does not hold in this tree — only the cricket view does — and the plan's cited
"existing pattern" `tests/unit/game/x01MatchView.test.tsx:246-270` does not exist. M6 must
**wire** the three views that lack it **and** pin the behaviour with tests; the obsolete
reference must not be re-created. The pattern to follow today is the per-mode undo suite. —
Beleg: `app/game/cricket/page.tsx:239` (the only `onUndo`),
`app/game/around-the-clock/page.tsx:225-231`, `app/game/shanghai/page.tsx:272-278`,
`src/components/x01/X01MatchView.tsx:235-241` (the three banners without one),
`src/components/game/types.ts:151-155` (the prop), `src/components/game/GameResultBanner.tsx:108`
(the only "Undo last dart" string in the repository),
`tests/unit/game/undoAcrossModes.test.tsx:63-80` (the pattern),
`tests/unit/game/x01MatchView.test.tsx` (188 lines — no undo assertion)

---

## C. Cross-cutting rulings (apply to every task)

**Ruling C1:** gilt weiterhin — no new dependencies. `@testing-library/jest-dom` is **not**
installed and the plan may not add it (Global Constraint: "No new runtime dependencies"). Every
`toBeInTheDocument()` becomes `expect(...).toBeTruthy()`. Cost if wrong: 13 plan tests fail
with a Chai error. — Beleg: `package.json:47-48`; `grep -rn "toBeInTheDocument" tests/` → no
hits

**Ruling C2:** gilt weiterhin — existing tests are updated, never removed or weakened. The
data-shape changes in M2 and M3 break `AroundTheClockMode.test.ts`,
`CorrectionReplay.test.ts`, `UndoCorrectModes.test.ts`, `ShanghaiMode.test.ts` and parts of
`modeViews.test.tsx`. Each must be **updated to the new shape/markup** so it still asserts the
same behaviour, with its assertions made stronger or equivalent — never dropped. Cost if wrong:
a silent hole where a behaviour is no longer pinned. — Beleg:
`tests/unit/game-engine/modes/AroundTheClockMode.test.ts:18-19`,
`tests/unit/game-engine/modes/CorrectionReplay.test.ts:113`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:180`,
`tests/unit/game-engine/UndoCorrectModes.test.ts:215`,
`tests/unit/game/modeViews.test.tsx:107`

**Ruling C3:** gilt weiterhin — the engine keeps **one** record of the darts. No view keeps a
private copy or a private counter. M3 replaces the ledger-derived `marksByRound` helper with a
mode-derived one for exactly this reason. Cost if wrong: an undo leaves the sheet showing stale
marks. — Beleg: `src/game-engine/types.ts:140-141` (the ledger lives in `MatchState.throws`),
`src/game-engine/GameEngine.ts:280-309` (the private replay re-derives every value from it),
`app/game/shanghai/page.tsx:192` (the view reads `matchState.throws`, not a private copy)

**Ruling C4:** gilt weiterhin — no commits without the user's explicit approval. Every task ends
with a verification step, not a commit. The implementer stages nothing and commits nothing; the
controller commits only after the user says so. Cost if wrong: unrequested commits on a branch.
— Beleg: `.claude/plans/darthub-design-implementation/_plan.md:139-140` ("## Commit Policy — The
user requires explicit consent before any commit.")

**Ruling C5:** gilt weiterhin — the framework-agnostic guard stays green, and any new result
type must be **JSON-safe** (plain objects, arrays, strings, numbers, booleans and `null` only).
Cost if wrong: the engine's portability guarantee is broken. — Beleg:
`tests/unit/game-engine/frameworkAgnostic.test.ts:15-29` (the forbidden patterns),
`tests/unit/game-engine/frameworkAgnostic.test.ts:52-62` (the scan of every `.ts` under
`src/game-engine`), `tests/unit/game-engine/frameworkAgnostic.test.ts:70-73` (the JSON
round-trip), `src/game-engine/types.ts:120-125` (the JSON-safety contract of `MatchState`)

**Ruling C6:** gilt weiterhin — exactly one `primary` per surface; reuse the token vocabulary
in `src/components/game/classes.ts` and introduce no second `primary` on any surface. — Beleg:
`design-system/darthub/MASTER.md:665` (the `primary` row),
`design-system/darthub/MASTER.md:672` ("**Exactly one `primary` button per surface**"),
`src/components/game/classes.ts:30` (`SECONDARY_BUTTON`), `src/components/game/classes.ts:107`
(`RADIO_CELL`), `src/components/game/classes.ts:110` (`RADIO_INPUT`),
`src/components/game/classes.ts:114` (`RADIO_MARK`)

**Ruling C7:** gilt weiterhin — the mode's documented rule wins over the plan's paraphrase.
Where the plan's snippet contradicts a mode's own class doc or the registry's description, the
mode's documented rule wins. This is the "spec is the binding authority" rule applied to the
in-repo mode documentation, which is the closest reachable spec for this plan. — Beleg:
`src/game-engine/modes/AroundTheClockMode.ts:18-22` (the class doc),
`src/game-engine/modes/registry.ts:168` (the published win condition)

---

## D. Findings from the scan that are NOT defects

- M1's engine work is already correct: `CricketMode.applyThrow` writes
  `data.marks[throwRecord.playerId]` and `awardPointsIfScoring` credits the thrower. M1's
  engine tests are a **pin**, not a driver — they pass against the current engine. — Beleg:
  `src/game-engine/modes/CricketMode.ts:85-92`,
  `src/game-engine/modes/CricketMode.ts:105-119`
- M4's radio group `name="match-format"` does not collide with the checkout or board-source
  radio names. — Beleg: `src/components/game/PlayerSetup.tsx:18-22` (the checkout choices),
  `src/components/game/BoardSourceSelector.tsx` (the board source is a separate component)
- `ShanghaiRoundRecord` does not exist yet — M3's implementer must create and export it. The
  record's shape is inlined today. — Beleg: `src/game-engine/modes/ShanghaiMode.ts:18-26`
- No test asserts the section `aria-label`s `"Cricket targets"` / `"Around the clock target"` /
  `"Shanghai rounds"`, so M1/M2's per-player labels break nothing. — Beleg:
  `src/components/game/CricketScoreSheet.tsx:25`,
  `src/components/game/AroundTheClockScoreSheet.tsx:19`,
  `src/components/game/ShanghaiScoreSheet.tsx:33`;
  `grep -rn "Cricket targets\|Around the clock target\|Shanghai rounds" tests/ e2e/` → no hits
- **Defect G did not reproduce** (as on 2026-11-12) and remains a _padding_ requirement, not a
  contradiction: the round table's per-round array must be **padded** to `totalRounds` entries,
  because a mode-derived array is `[...finished, current]` — the finished rounds plus one, not
  seven. The sheet renders a fixed seven-column grid. **Ruling: M3's sheet must pad each
  player's `marksByRound` to `totalRounds` with zeros.** — Beleg:
  `src/components/game/ShanghaiScoreSheet.tsx:44`

---

## Provisional-ruling note

No spec file is reachable for this plan — it argues from `docs/PRD.md` and the design system.
The rulings above were made against the plan text, the mode class docs, the registry
descriptions and the shipped behaviour, in that order of authority. If the user holds a written
spec for the game modes, **rulings B1, B4, B7, B9 and B10** are the ones to re-check against it.

### 2026-11-15 amendment — what changed in the re-verification

The substance of the rulings is unchanged; three changed their _status_ and one changed its
_proof_.

- **A8 / B10-adjacent — M6 is no longer test-only.** On 2026-11-12 all four views passed
  `onUndo`; in this tree only the cricket view does
  (`app/game/cricket/page.tsx:239`). M6 must wire the missing three **and** pin them.
- **B8 — the referenced assertion moved.** `tests/unit/game/modeViews.test.tsx:290` does not
  exist; the string "Target 1" is asserted in `e2e/game-center.spec.ts:162`.
- **B10 — the seam is narrower than first recorded.** `resultSignature` is a string-valued,
  audit-only hook with one implementation and one private consumer
  (`src/game-engine/GameEngine.ts:358-364`); M5 extends it rather than duplicating it.
- **B9 — confirmed, and stronger than recorded.** The seeded slice alone does not make the
  readout possible; the sizes must reach the view too.

The load-bearing rulings **B3, B4, B6, B7, B9** and the whole of section **C** are unchanged.

### One environment caveat on the recorded gate

The full suite is **106 test files / 540 tests**. The one file that can go red for reasons
outside the code is `tests/unit/dockerignore.test.ts:187-189`: it builds the real image under a
hard **600 s** timeout, and on this 2-CPU host it passes with only seconds of headroom
(**590 s** measured) while **timing out** if another `docker build` runs against the same daemon
in parallel. **A red `dockerignore` is contention, not a regression** — re-run that file alone
before treating it as one. It touches no ruling in this file.
