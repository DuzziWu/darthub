# Task 002: Implement the shared board-geometry module

**Status**: completed
**Depends on**: none

**Files this task owns:** `src/board/**` — `boardGeometry.ts`, `boardSource.ts` and `index.ts`. **Files this task does not touch:** `src/game-engine/rules/**` (the rules are untouched — `isValidSegmentScore` stays where it is), `src/game-engine/modes/**`, `src/components/**`.
**Retry count**: 0

## Description
Create the one place that knows dartboard geometry. It resolves a point on the board to a scored throw, and it is shared by the virtual board today and by the camera pipeline later. Pure TypeScript, no DOM.

## Context
### Read first
- `design-system/darthub/board.md` — §4 (geometry), §5 (module API, units, camera compatibility), §5.3 (the segment on the camera path), §5.4 (the one true segment type).

### Location — note the deviation from the design document
`board.md` §5 proposes `src/domain/board/`. **This plan uses `src/board/`** instead. The repo's actual convention is flat feature folders under `src/` (`ai, auth, camera, career, components, friends, game-engine, privacy, rating, realtime`); there is **no** `src/domain/` and no `src/game/` — `.claude/architecture.md` lists both aspirationally and is stale. Creating a new `domain/` layer would be an architectural change the user has ruled out. `src/board/` sits alongside the other feature folders and matches how the code is actually organised.

Layout: `src/board/boardGeometry.ts` (the geometry module), `src/board/boardSource.ts` (the board-source vocabulary) and `src/board/index.ts` (the barrel), matching the one-class-per-file convention in `src/game-engine/`. **Task 002 owns all three files** — later tasks consume the barrel and must not edit it.

### The board-source vocabulary lives here too
`board.md` §9.1 defines the three board sources and their contract. It belongs to the board module, so it is created here rather than in a UI task:

```ts
export type BoardSourceId = "virtual" | "camera" | "smart";

export interface BoardSource {
  readonly id: BoardSourceId;
  readonly label: string;          // "Virtual Board", "Camera Board", "Smart Dart"
  readonly available: boolean;
  readonly note?: string;          // why it is unavailable, shown to the user
}
```

plus the three source definitions (`virtual` available; `camera` and `smart` unavailable, each with its reason). Task 006 builds the radio group over them.

### The API — implement exactly this
```ts
export const BOARD_DIAMETER_MM = 451;

export const BOARD_RADII_MM: Readonly<{
  innerBull: 6.35;
  outerBull: 15.9;
  innerSingleOuter: 99;
  trebleOuter: 107;
  outerSingleOuter: 162;
  doubleOuter: 170;
  numberRingOuter: 225.5;
}>;

export const BOARD_SEGMENT_ORDER: readonly number[]; // 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5

export type BoardSegment = "single" | "double" | "triple" | "bull";

export interface BoardHit {
  readonly segment: BoardSegment;
  readonly points: number;       // 0..60, or 25 / 50 for the bulls
  readonly sector: number | null; // 1..20 for a sector, null for a bull
  readonly label: string;        // "T20", "D16", "S7", "BULL 50", "BULL 25", "MISS"
}

export type BoardResolution =
  | { readonly hit: false; readonly points: 0; readonly label: "MISS" }
  | { readonly hit: true } & BoardHit;

export function resolveBoardHit(xMm: number, yMm: number): BoardResolution;
export function toBoardMm(dxPx: number, dyPx: number, pxPerMm: number): { xMm: number; yMm: number };
```

### The rules
- **Units:** millimetres, board plane, origin at the board centre, **x positive = right, y positive = above centre**. This is exactly the frame `src/camera/CameraDTO.ts` and `src/camera/vision/Perspective.ts` already use — no adapter, no new convention.
- **Segment order:** clockwise from 20 at 12 o'clock. 18° per segment, each wedge centred on its number.
- **Bands**, by radius: inner bull 0–6.35 (50), outer bull 6.35–15.9 (25), inner single 15.9–99 (1×), treble 99–107 (3×), outer single 107–162 (1×), double 162–170 (2×), beyond 170 is a **miss**.
- **Band boundaries are inclusive of the inner band** (`board.md` §2.2): `r ≤ 6.35` is the inner bull, `r ≤ 15.9` the outer bull, `r ≤ 99` the inner single, and so on. The single/double rings share a radius with the treble band — a hit at exactly `r = 99` is a **single**, at `r = 107` a **treble**, at `r = 162` an **outer single**, at `r = 170` a **double**. Getting this backwards moves points across a whole band and the tests below will not catch it unless they probe the boundaries.
- **Sector boundaries are inclusive of the lower-numbered wedge**: a point exactly on a wedge edge belongs to the sector whose angular range *starts* there, walking clockwise from 20.
- **Labels:** `S{n}` for a single, `T{n}` for a treble, `D{n}` for a double, `BULL 50` / `BULL 25` for the bulls, `MISS` outside the playing surface.
- **`toBoardMm` negates y**, because SVG's y grows downward while the board frame's y grows upward.
- **Pure:** no DOM, no React, no Node built-ins, no filesystem. It must import unchanged into the browser, the game server and the CV pipeline.

### One true segment type
`src/game-engine/types.ts` currently declares `export type ThrowSegment = "single" | "double" | "triple" | "bull"`. The board module owns the definition and the engine **re-exports** it, so every existing usage keeps compiling:
```ts
export type { BoardSegment as ThrowSegment } from "@/board/boardGeometry";
```
Note the engine's barrel `src/game-engine/index.ts` re-exports `ThrowSegment` from `@/game-engine/types` — that path keeps working unchanged.

**Direction matters.** The dependency runs **board → nothing**, and **engine → board** (for the type only). The board module must not import from `src/game-engine/`, or the two form a cycle.

### `isValidSegmentScore` — decide, do not "consider"
The plan previously said "consider moving it to the board module". That is not actionable, and the two options are not equivalent:

- **Keep it in `src/game-engine/rules/OutRules.ts`.** It is *rule* knowledge (which segment/score pairs are legal), it is already imported by `src/game-engine/GameEngine.ts:2` for `validateThrowInput`, and moving it would mean the board module imports engine types — exactly the cycle above.
- **Move it to the board module.** Then `OutRules.ts` re-exports it, and the board module owns both the segment type and its validation.

**Decision: keep it where it is.** `src/game-engine/rules/OutRules.ts` is unchanged, and `isValidSegmentScore` keeps working at its existing import path. The board module owns `BoardSegment` — the *vocabulary* — not the *validation*.

The board module must still be able to say what a legal hit is, so it exposes the band boundaries and the `points` it derives; the engine's validator then checks the pair it receives. The resolver's output and `isValidSegmentScore` must agree — a bull is `25`/`50`, a single is `1..20`, a double is even `2..40`, a triple is a multiple of 3 in `3..60`. The resolver's `points` values are all inside those ranges by construction, which is why the board path never trips the engine's validator.

### The camera path
`src/camera/CameraDTO.ts` carries only `score`. Add `segment?: BoardSegment` — optional, so the existing stub producers keep compiling. A score alone is ambiguous (24 is D12 *or* T8; 30 is D15 *or* T10), so without the segment a camera could never win a Double Out. `src/camera/vision/HitDetector.ts` stays a stub, but its documented intent may now point at `resolveBoardHit` instead of describing the algorithm in prose.

### Traps the design prototype actually hit — the tests must cover these
- The prototype's resolver had its **bearing 180° out** (`atan2(x, -y)` instead of `atan2(x, y)`), scoring T10 for T13.
- A `var` closure bug made every dart-pad key score the last number.
- 360° ring paths degenerated, so the outer bull and the armed-band outline did not render at all.

## Requirements (Test Descriptions)
- [x] `it resolves a treble of 13 to segment triple with 39 points`
- [x] `it resolves a double of 16 to segment double with 32 points`
- [x] `it resolves a single of 7 to segment single with 7 points`
- [x] `it resolves the inner bull to 50 points and the outer bull to 25 points`
- [x] `it resolves a point outside the double ring to a miss`
- [x] `it resolves the twenty sectors in the standard clockwise order from 20 at the top`
- [x] `it resolves a band boundary to the inner band`
- [x] `it uses board-plane millimetres with x positive right and y positive above centre`
- [x] `it converts pixel offsets to board millimetres and negates the y axis`
- [x] `it keeps the existing ThrowSegment export working from the game engine`
- [x] `it produces only segment and score pairs the game engine accepts`

## Acceptance Criteria
- `src/board/boardGeometry.ts`, `src/board/boardSource.ts` and `src/board/index.ts` exist and are pure TypeScript.
- Every requirement is covered by a Vitest test under `tests/unit/board/`.
- The bearing is asserted with a **specific** sector (T13 resolves to T13, not T10), not merely "a treble".
- The twenty sectors are asserted as an ordered list, not as a set.
- **Band-boundary radii are asserted explicitly**: 6.35 → bull 50, 15.9 → bull 25, 99 → single, 107 → treble, 162 → outer single, 170 → double, 170.1 → miss.
- `ThrowSegment` is still importable from `@/game-engine/types` and every existing call site compiles unchanged.
- `isValidSegmentScore` stays in `src/game-engine/rules/OutRules.ts` and is **not** duplicated. There is exactly one definition and its existing import path still works.
- A test feeds **every** segment/score pair the resolver can produce into `isValidSegmentScore` and asserts each is accepted — the board and the engine can never disagree about what a legal dart is.
- `CameraDTO` gains `segment?: BoardSegment`, optional, and the repo still type-checks.
- No file under `src/game-engine/modes/` is modified — **the game rules and scoring behaviour do not change**. The only permitted engine edits are the `ThrowSegment` re-export in `src/game-engine/types.ts` and the `segment?: BoardSegment` field on `CameraDTO`.
- `npm run typecheck`, `npm run lint` and `npm run test` stay green (no new failures).

## Implementation Notes

### Files created
- `src/board/boardGeometry.ts` — constants, `resolveBoardHit`, `toBoardMm`, `BoardSegment`.
  Zero imports: no DOM, no React, no Node built-ins, no filesystem.
- `src/board/boardSource.ts` — `BoardSourceId`, `BoardSource`, and the three source
  definitions (`VIRTUAL_BOARD_SOURCE`, `CAMERA_BOARD_SOURCE`, `SMART_DART_SOURCE`)
  plus the ordered `BOARD_SOURCES` list.
- `src/board/index.ts` — the barrel (later tasks consume this and must not edit it).

### Files edited
- `src/game-engine/types.ts` — the **only** engine edit. `ThrowSegment` is now
  `export type { BoardSegment as ThrowSegment } from "@/board/boardGeometry";`.
  The two interfaces (`ThrowRecord`, `ThrowInput`) reference the imported
  `BoardSegment` directly so the local alias never has to be re-declared.
  `isValidSegmentScore` was **not** moved and **not** duplicated — it stays in
  `src/game-engine/rules/OutRules.ts` and keeps its existing import path.
- `src/camera/CameraDTO.ts` — gained `segment?: BoardSegment` (optional).
- `src/camera/vision/HitDetector.ts` — the doc comment now points at
  `resolveBoardHit` instead of restating the algorithm in prose. Still a stub.
- `tests/unit/camera/cameraDTO.test.ts` — the exact-key-set assertion now
  includes `segment`, and a second case proves the field is optional.

### Files created (tests)
- `tests/unit/board/boardGeometry.test.ts` — bands, sectors, order, boundaries.
- `tests/unit/board/boardCoordinates.test.ts` — the coordinate frame and `toBoardMm`.
- `tests/unit/board/boardEngineCompatibility.test.ts` — the `ThrowSegment`
  re-export and the resolver-vs-`isValidSegmentScore` agreement.
- `tests/unit/board/boardSource.test.ts` — the board-source vocabulary.
- `tests/unit/board/helpers.ts` — `expectHit()` narrows a `BoardResolution` to
  its hit variant so the tests read `segment`/`sector` without casts.

### The bearing (the prototype's 180° bug)
Bearing is `Math.atan2(xMm, yMm)` — **not** `atan2(x, -y)`. With `x` positive
right and `y` positive up, `atan2(x, y)` measures the angle clockwise from
12 o'clock. Sector index is `floor((bearing + 9°) / 18°) mod 20`, so a point on
a wedge edge belongs to the sector whose range *starts* there.

Concrete coordinates asserted (radius, degrees clockwise from 12 o'clock):
- **T13** — sector 13 is index 4 of the order, i.e. 72°; at radius 100 (inside
  the treble band 99–107): `xMm = 95.1057`, `yMm = 30.9017` → triple, 39, T13.
- **D16** — sector 16 is index 13, i.e. 234°; at radius 166 (double band 162–170):
  `xMm = -134.2968`, `yMm = -97.5724` → double, 32, D16.
- **S7** — sector 7 is index 12, i.e. 216°; at radius 130 (outer single 107–162):
  `xMm = -76.4121`, `yMm = -105.1722` → single, 7, S7.

A 180°-wrong bearing would resolve T13 to T10, so the specific-sector
assertion catches the prototype's bug directly.

### Band boundaries
Band membership is tested at the exact radii, and just outside each:
6.35 → BULL 50, 15.9 → BULL 25, 99 → S6, 107 → T6, 162 → S6, 170 → D6,
170.1 → MISS; and 99.001 → treble, 107.001 → single, 162.001 → double,
170.001 → miss.

### Float robustness
`EDGE_EPSILON_RAD = 1e-9` is added to the bearing before the sector floor, so a
point that lands *exactly* on a wedge edge resolves to the starting sector
rather than to whichever side IEEE-754 rounding happens to produce. Without it,
`atan2` of a 27° point returned 26.999999999999993° and fell into the wrong
wedge.

### Engine agreement
`tests/unit/board/boardEngineCompatibility.test.ts` enumerates every sector at
six radii (120 points) plus both bulls (122 pairs) and feeds **each** resulting
`(segment, points)` into `isValidSegmentScore` from `@/game-engine/rules/OutRules`,
asserting every one is accepted. The board and the engine therefore cannot
disagree about what a legal dart is.

### Verification
- `npx tsc --noEmit --incremental false` → exit 0.
- `npx eslint` and `npx prettier --check` over every file this task touched → clean.
- `npx vitest run tests/unit/board` → 4 files, 13 tests, all pass.
- `npx vitest run tests/unit/board tests/unit/camera tests/unit/game-engine` → 21 files, 73 tests, all pass.
- Full `npm run test`: 300 passed, 4 failed — all four failures are pre-existing and
  outside this task's files (`tests/integration/linkGuest.test.ts` needs PostgreSQL;
  `linting`/`formatting`/`ci-workflow` fail on other agents' untracked files under
  `.claude/skills/` and `reports/design/board.js` and the `design-system/` markdown).
  No new failures were introduced by this task.

### Deliberately not done
- The board module does **not** import anything from `src/game-engine/` — the
  dependency runs board → nothing, engine → board (type only). No cycle.
- No file under `src/game-engine/modes/` was touched.
- `src/ai/dartboard.ts` already carries a near-identical geometry model for the AI
  aim simulation. It was left alone: it is out of this task's scope, it has a
  different API shape (`Aim`/`DartResult`, `noScore`/`offBoard` rings), and
  folding it into `src/board/` would be a separate refactor. Worth a follow-up task.
