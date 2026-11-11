# Task 002: Migrate the legacy gradient utility to its canonical v4 name

**Status**: in_progress
**Depends on**: 001
**Retry count**: 0

## Description
Tailwind v4 renamed the gradient direction utilities: `bg-gradient-to-br` → `bg-linear-to-br`. **Measured against the compiled CSS of Tailwind 4.3.5, v4 still emits `.bg-gradient-to-br` as a legacy alias alongside the canonical `.bg-linear-to-br`, so the current code works and this is a canonicalisation, not a bug fix.** Rename the single occurrence so the source uses the name Tailwind documents, and prove no other legacy utility name survives anywhere in the tree.

## Context
- Related files:
  - `app/game-center/page.tsx:55` — `className={\`block bg-gradient-to-br ${game.color} rounded-xl p-6 hover:scale-[1.02] transition-transform\`}`
  - The `color` values in the same file (`from-green-600 to-green-800`, etc.) are the gradient stops. `from-*` / `to-*` are **unchanged** in v4 and must not be touched.
- **Do not claim in the report that this rename fixed a visual bug.** It did not — the card gradient rendered correctly with the legacy alias as soon as task 001 installed the Tailwind pipeline. The honest framing is: "moved from the legacy alias to the canonical v4 utility name".
- Audit the whole tree for other legacy names that v4 dropped or renamed. Known v3→v4 renames to grep for: `bg-gradient-to-*`, `flex-grow-*`, `flex-shrink-*`, `overflow-ellipsis`, `decoration-slice`. (All are absent except the one above, but verify rather than assume — a genuinely dropped name compiles to nothing and fails silently.)
- Do **not** touch `src/game-engine/`, the game pages' logic, or any score/scoreboard behaviour. This task changes class names only.
- Task 001 must be complete first, otherwise there is no Tailwind pipeline to compile against.
- Scope note: browser-level assertions about the rendered card live in **task 003**. This task owns the class-name migration and the static audit only.

## Requirements (Test Descriptions)
- [x] `it contains no legacy Tailwind utility names in app/ and src/`
- [x] `it renames the game center card gradient utility to its canonical v4 name`
- [x] `it keeps the card gradient stops unchanged`

## Acceptance Criteria
- `bg-gradient-to-br` no longer appears anywhere in `app/` or `src/`.
- The audit is reproducible: implement it as a static check over `app/` and `src/` — either a small Vitest test (e.g. `tests/unit/tailwind/noLegacyUtilities.test.ts`) or a documented `grep` whose output is pasted into the task 004 report. State which of the two was used in the report.
- The `from-*` / `to-*` gradient stops in `app/game-center/page.tsx` are byte-for-byte unchanged.
- All five cards (501, 301, Cricket, Around the Clock, Shanghai) still render with their descriptions and links (verified by task 003's Playwright run).
- No game logic, domain file or shared component behaviour is modified.
- `npm run lint` and `npm run typecheck` stay **green** (both exit 0 today — measured baseline in task 004). `npm run format:check` still fails today, but only because of the generated Playwright artifacts and two unrelated unformatted files — task 004 fixes that; this task must not make it worse.
- Format only the files this task touches: `npx prettier --write app/game-center/page.tsx`.

## Implementation Notes

**Audit implemented as a Vitest test** (not a grep): `tests/unit/tailwind/noLegacyUtilities.test.ts`. It recursively scans every `.ts`/`.tsx` file under `app/` and `src/` line-by-line and fails with a `file:line` list if any of the known v3→v4 legacy names is present: `bg-gradient-to-*`, `flex-grow-*`, `flex-shrink-*`, `overflow-ellipsis`, `decoration-slice`. The file also asserts `app/game-center/page.tsx` contains `bg-linear-to-br` (and not `bg-gradient-to-br`) and that the five gradient-stop strings (`from-green-600 to-green-800`, `from-blue-600 to-blue-800`, `from-red-600 to-red-800`, `from-purple-600 to-purple-800`, `from-amber-600 to-amber-800`) still appear verbatim as `color: "<stops>"` entries.

**RED/GREEN record:**
- RED (before the rename): `npx vitest run tests/unit/tailwind/noLegacyUtilities.test.ts` → 2 failed, 1 passed. Failures were the legacy-name audit (`app/game-center/page.tsx:55 uses legacy utility bg-gradient-to-*`) and the canonical-name assertion (file did not contain `bg-linear-to-br`). The stops test passed already, as expected.
- GREEN (after the rename): same command → 3 passed.

**Change made** — one line, class names only:
`app/game-center/page.tsx:55`
`className={`block bg-linear-to-br ${game.color} rounded-xl p-6 hover:scale-[1.02] transition-transform`}`

**This is a canonicalisation, not a bug fix.** Tailwind 4.3.5 emits `.bg-gradient-to-br` as a legacy alias alongside the canonical `.bg-linear-to-br`, so the card gradient already rendered correctly once task 001 installed the Tailwind pipeline. The source now uses the name Tailwind documents.

**Audit result over `app/` and `src/`:** the only legacy name present in the tree was the single `bg-gradient-to-br` occurrence on `app/game-center/page.tsx:55`. After the rename the scan finds **zero** legacy utility names. (An independent whole-repo `grep -rn "bg-gradient-to"` also confirms the string now survives only inside the audit test itself, as the pattern it looks for.)

**Compiled-CSS verification** (`npm run build`, then `grep` over `.next/static/css` + `.next/static/chunks`): `.bg-linear-to-br` → 3 rules emitted, `.bg-gradient-to-br` → 1 rule (the framework's own legacy alias, still emitted by Tailwind itself). Gradient stops `.from-green-600`, `.to-green-800`, `.from-amber-600`, `.to-amber-800` all present. Built HTML `/.next/server/app/game-center.html` contains `bg-linear-to-br` for all five cards and **zero** occurrences of `bg-gradient-to-br`.

**No game logic, domain file, or shared component behaviour touched.** Only `app/game-center/page.tsx` (one class-name token) and the new test file.

**Green gates:** `npm run lint` → exit 0. `npm run typecheck` → exit 0. `npx prettier --write app/game-center/page.tsx tests/unit/tailwind/noLegacyUtilities.test.ts` → both already formatted ("unchanged"). `npm run format:check` still reports the same 8 pre-existing unformatted files (Playwright artifacts, `docs/LOCAL_SETUP.md`, `tests/unit/game-engine/modes/ShanghaiMode.test.ts`) — unchanged by this task, and fixed by task 004.

**Full suite:** `npm run test` → 3 failed / 287 passed, matching the measured baseline failure set (`linkGuest`, `ci-workflow` "Check formatting" step, `formatting`) plus the 3 new passing audit tests. The failures are pre-existing and caused by the same unformatted Playwright/`ShanghaiMode` files that task 004 addresses; none relate to this change.
