# Task 004: Specify the realistic dartboard, the segment-aware throw input, and the three board source modes

**Status**: completed
**Depends on**: 003
**Retry count**: 0

## Description
The design system is in place, but its board is a simplified ring of numbered squares. DartHub needs a **realistic steel dartboard** as the central game element: authentic geometry, correct scoring bands, real materials, and clickable hit areas that feed the game engine. The UI must also be able to distinguish three board sources so a camera feed can replace the virtual board later.

## Context
### The requirement
A realistic, high-quality dartboard must be the central element of the match view, in the spirit of how live darts is presented on a platform like Autodarts — **as visual inspiration only. Do not copy protected Autodarts assets, branding, or any third-party board artwork.** DartHub must have its own independent rendering, or properly licensed image resources.

Authentic geometry and rendering:
- Standard segment order, clockwise from 20 at 12 o'clock: **20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5**
- Correct single, double and triple bands
- Red and green double/triple segments
- Alternating black and light single segments
- Correct inner bull and outer bull
- A visible outer number ring
- High-quality textures and realistic proportions
- **Not** a simplified target disc, and **not** a generic SVG circle graphic

Interaction:
- Hit areas clickable
- Single, double and triple correctly distinguished
- Bull and outer bull work
- Hits visually highlighted
- Input wired directly into the existing game engine

### Board geometry — the numbers to build against
Standard Winmau/PDC board, 451 mm overall diameter (radius 225.5 mm), playing surface 340 mm diameter:

| Feature | Radius (mm) |
|---|---|
| Inner bull (50) | 0 – 6.35 |
| Outer bull (25) | 6.35 – 15.9 |
| Inner single (1×) | 15.9 – 99 |
| Treble band (3×) | 99 – 107 |
| Outer single (1×) | 107 – 162 |
| Double band (2×) | 162 – 170 |
| Number ring | 170 – 225.5 |

Each segment spans 18°, centred on its number, with 20 at 12 o'clock. Alternation is **positional**, not by number parity: odd positions in the order above get a **black** single and **red** double/triple; even positions get a **light** single and **green** double/triple. Inner bull green, outer bull cream, number ring black with cream numerals.

### Coordinate semantics — must match the existing camera module
The repo already has a future camera pipeline, and the board must line up with it so the same resolver serves both. From `src/camera/vision/`:
- `BoardPoint` / `CameraDTO`: millimetres relative to board centre, **x positive = right, y positive = above centre**.
- `Perspective` normalises using `boardReferenceDiameterMm` (`src/camera/ICameraProcessor.ts`).
- `HitDetector`'s documented intent already states: *"Derive the awarded score from the standard dart-board segment geometry: radius rings (double/triple/small-bull/bull) and the 20 angular wedges (20 at the top, clockwise 1, 18, 4, …)"*.

So the specification must define **one** shared board-geometry module in the domain layer (pure TypeScript, no UI imports) that resolves a board-plane point to a throw, and state that the future camera path will call the same resolver. Specify the module's location, its public API, and its units. Note that the current `CameraDTO` carries only `score` — the spec must say whether the segment is added to the throw path so double-out also works from a camera.

### Verified functional finding — this is not cosmetic
The engine supports Double Out, but **the UI makes it unwinnable**:
- `DoubleOutRule.isCheckout` (`src/game-engine/rules/OutRules.ts:61`) requires `segment === "double"`.
- `ThrowInput` and `ThrowRecord` (`src/game-engine/types.ts:31,92`) carry an optional `segment`, but **the UI never sends it** — `app/game/page.tsx` calls `engine.recordThrow({ playerId, points })` with points only.
- `app/game/page.tsx:29` builds `new StandardMode({ startScore: START_SCORE })` and `app/game/page.tsx:31` calls `eng.startMatch({ playerIds: ids })` — **no `outRule` anywhere**, so the mode falls back to `"straight"`.
- The Game Center copy nevertheless advertises *"finish on a double"* for 501 and 301. That copy is currently false.

A board that resolves a click to `{ segment, points }` fixes this at the source. The specification must therefore treat segment-aware throwing as a **functional requirement** of the board, not a stylistic one, and must settle what the checkout rule should be (and whether the player chooses it at match start).

### Three board source modes
The UI must be able to distinguish, and swap between:
1. **Virtual Board** — the realistic virtual dartboard. Implemented now.
2. **Camera Board** — a real camera feed as the image source. **Not implemented now** — but the UI must already model it.
3. **Smart Dart** — later camera recognition and tracking. **Not implemented now**.

Specify the abstraction that makes these swappable (what a "board source" is, what the viewport component receives, how the two unimplemented modes appear — clearly labelled as unavailable, never as a broken or empty board), and how the mode is chosen.

### Accessibility — a real tension you must resolve, not paper over
A dartboard wedge in the double band is roughly 60 px wide by 9 px tall on a 512 px board. That does not meet a 44 × 44 px target. The rules also bind you to no invented affordances and to keyboard operability. State plainly:
- which WCAG criterion and level applies to target size, and what the practical floor is for a precision board,
- the keyboard path that gives the same capability without a pointer (the numeric/segment input already exists as `ThrowInputPad` — specify how the board and that input relate),
- what a screen-reader user gets from the board,
- the honest trade-off, as a documented decision with its rationale. Do not silently break the rule, and do not weaken it without saying so.

### The match layout
The board becomes the central element of the match view, with the score sheet beside it rather than above it, following the reference layout's division of attention (board on one side, player score card on the other, throw strip along the top). Specify the layout for 1440, 1024 and 390, and say what the 390 layout does with a board that cannot shrink without breaking the target floors.

## Requirements (Test Descriptions)
- [ ] `it specifies the board geometry, bands and segment order with millimetre radii`
- [ ] `it specifies the board colour system including band alternation, bull and number ring`
- [ ] `it specifies the material and texture treatment and the lighting model`
- [ ] `it specifies the shared domain board-geometry module and its API and units`
- [ ] `it specifies the click-to-throw interaction, hit highlighting and the engine wiring`
- [ ] `it specifies the keyboard and screen-reader path for the board and its relation to the numeric input`
- [ ] `it resolves the target-size accessibility trade-off as a documented decision`
- [ ] `it specifies the three board source modes and how unimplemented modes are presented`
- [ ] `it specifies the match layout at 1440, 1024 and 390`
- [ ] `it specifies the checkout-rule decision and the corrected Game Center copy`

## Acceptance Criteria
- `DESIGN.md` and `design-system/darthub/MASTER.md` are updated with the board, the interaction spec, the source modes and the layout.
- The geometry is stated in numbers an implementer can code against — no "roughly a treble band".
- The shared board module's location, API and units are specified, and its compatibility with the existing camera coordinate semantics is explicit.
- The accessibility decision names the criterion, the practical floor, the keyboard alternative and the trade-off.
- The two unimplemented source modes are specified as *unavailable*, with the UI treatment for that state stated.
- The checkout-rule decision is made explicitly and the Game Center copy consequence is written down.
- The prototype in `reports/design/prototype.html` is updated to show the realistic board, and the result is checked at 1440, 1024 and 390 with the critique recorded in `reports/design/03-visual-qc.md`.
- No source file outside `DESIGN.md`, `design-system/` and `reports/design/` is modified.

## Implementation Notes
(Left blank - filled in by programmer during implementation)
