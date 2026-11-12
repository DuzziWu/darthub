# DartHub Review Checklist

The full invariant list with file/line pointers, and the known-failure triage
table.

## Invariants

| #   | Invariant                                                                                   | Where it is enforced                                                    | How to check                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The game engine is pure TypeScript — no React, Next.js, Socket.IO or Node/browser built-ins | `src/game-engine/types.ts` (header)                                     | `tests/unit/game-engine/frameworkAgnostic.test.ts`; grep for `from "react"`, `from "next`, `socket.io`, `node:` under `src/game-engine/` |
| A2  | State is derived from a ledger, never mutated                                               | `src/game-engine/GameEngine.ts`                                         | look for direct assignment to a match-state field outside `applyThrow`                                                                   |
| A3  | Mode rules are delegated to a `DartGameMode`                                                | `src/game-engine/modes/`                                                | a rule implemented in the core engine instead of a mode                                                                                  |
| A4  | The segment vocabulary is shared with the board module                                      | `src/board/boardGeometry.ts`, re-exported by `src/game-engine/types.ts` | grep for a locally declared segment type                                                                                                 |
| A5  | The UI never invents rules — the rule sheet is derived from the mode's constants            | `src/game-engine/modes/registry.ts`                                     | rule text hard-coded in a component or in the registry                                                                                   |
| A6  | The server is authoritative; clients get JSON-safe snapshots only                           | `src/realtime/GameStateMachine.ts`                                      | a socket handler mutating room state directly                                                                                            |
| A7  | Route handlers are thin                                                                     | `app/api/**/route.ts`                                                   | business logic inside a route file                                                                                                       |
| A8  | Auth is a seam; `requireAuth` returns a discriminant and never throws                       | `src/auth/requireAuth.ts`                                               | a `throw` inside `requireAuth`; a handler reading the token itself                                                                       |
| A9  | Design tokens are the only styling vocabulary                                               | `app/globals.css`, `design-system/darthub/MASTER.md`                    | `tests/unit/tailwind/noLegacyUtilities.test.ts`                                                                                          |
| A10 | Shared control classes are centralised                                                      | `src/components/game/classes.ts`                                        | a focus ring or target size re-declared inline                                                                                           |
| A11 | Imports follow the ESLint order rule                                                        | `eslint.config.mjs`                                                     | `npm run lint`                                                                                                                           |

## Engine traps — detailed

### State mutated instead of re-derived

**Symptom:** a field on the match state is assigned directly; a player's
`totalPoints` is incremented in place; a score is cached separately from the
ledger.

**Why it matters:** undo and correction re-derive the state by replaying the
ledger. A mutated field is either lost or double-counted. The symptom
appears only after an undo, which is exactly the path a player notices.

**Look for:** assignments to `totalPoints`, `throwCount`,
`throwsInCurrentTurn`, `currentPlayerId` outside `DartGameMode.applyThrow`
and `GameEngine.startMatch`.

### A rule duplicated outside the mode

**Symptom:** a target list, a "marks to close" number or a checkout
description written into `registry.ts` or into a React component.

**Why it matters:** the rule sheet can then describe a rule the engine does
not implement — the UI promises something the engine will not do.

**Look for:** literal target arrays in `src/components/` or in
`src/game-engine/modes/registry.ts`; a rule string that is not derived from
a mode's exported constant.

### A local segment type

**Symptom:** `type Segment = "single" | "double" | ...` declared next to the
code that uses it.

**Why it matters:** board geometry and engine can then disagree about the
segment vocabulary, and a segment the board can produce becomes
unrepresentable in the engine.

**Look for:** `BoardSegment` imported from `@/board/boardGeometry` instead of
re-declared.

### A framework import in the engine

**Symptom:** `import { useState } from "react"` or `import { io } from
"socket.io"` under `src/game-engine/`.

**Why it matters:** the engine must run unchanged on the multiplayer server
and in the single-player browser client.

**Look for:** any import in `src/game-engine/` that is not a relative import
or `@/board/...`.

### Stored visit boundaries

**Symptom:** a visit index written into the match state.

**Why it matters:** a correction changes the visit boundaries, so a stored
boundary goes stale and the UI shows chips grouped wrongly.

**Look for:** visit grouping done in the mode instead of derived via
`deriveVisitIndexes` / `groupVisits`.

## Server-authority traps

| Symptom                                                                                    | Consequence                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| a socket handler writes to the room state instead of calling `GameStateMachine`            | clients and server disagree; the client sees a state the server never had |
| a client-supplied value reaches the engine without `antiCheat` validation                  | a client can claim an arbitrary score                                     |
| a snapshot contains a non-JSON-safe value (a `Map`, a `Set`, a class instance, a `BigInt`) | `JSON.stringify` fails or silently drops data at the socket boundary      |

## Layering traps

| Symptom                                                             | Consequence                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| business logic in `app/api/**/route.ts`                             | the logic cannot be unit-tested without a request; it also duplicates the service |
| a service imports `@prisma/client` directly                         | the service cannot be tested without a database                                   |
| a feature imports another feature's `prisma<Feature>Repository.ts`  | the two features are now coupled through their adapters                           |
| `requireAuth` throws instead of returning `{ ok: false, response }` | every caller must catch; the realtime error mapping breaks                        |

## UI traps

| Symptom                                                               | Consequence                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| a raw palette utility (`bg-gray-800`, `text-white`)                   | fails `noLegacyUtilities.test.ts`; drifts from the design system |
| a focus ring re-declared inline                                       | a second focus ring that can drift from `FOCUS_RING`             |
| a target smaller than 44px                                            | breaks the house floor                                           |
| `brass` used for text on a `brass` background                         | 1.0:1 contrast — invisible                                       |
| a shared component changed without checking all five mode views       | one game mode breaks                                             |
| a new token used but not added to the `@source inline(...)` whitelist | the utility is never emitted; the class silently does not exist  |
| a token used but not declared in `@theme`                             | the class does not exist                                         |

## Test-quality traps

| Symptom                                                         | Consequence                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| a `MutableMatchState` fixture missing `throws` or `corrections` | a type error — this exact shape broke `gameCenterPage.test.tsx` and `modeRegistry.test.ts` |
| a new engine rule without a correction-replay case              | undo/correct can be wrong and nothing catches it                                           |
| a test asserting on implementation detail                       | the test breaks on every refactor                                                          |
| a test needing a real database where a double would do          | slow and flaky — use `tests/support/inMemoryAuthRepository.ts`                             |

## Known-failure triage

Do not report these as regressions. Report only the **delta**.

### The baseline is green

| Suite     | Result                                           |
| --------- | ------------------------------------------------ |
| Typecheck | 0 errors                                         |
| Vitest    | 96/96 files pass · 447/447 tests pass · 0 errors |
| ESLint    | passes                                           |
| Prettier  | passes                                           |

Two checks skip rather than fail when the environment lacks the tooling:

| Test                                            | Skipped when                                                 |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `tests/unit/dockerignore.test.ts`               | no Docker **daemon** reachable (the CLI alone is not enough) |
| `tests/unit/tailwind/tailwindToolchain.test.ts` | no successful `npm run build` output present                 |

Any failure beyond these is a regression the change under review introduced.

## Severity definitions

| Severity     | Meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| **critical** | corrupts game state, breaks server authority, or loses data   |
| **major**    | violates a layering or invariant rule with a real consequence |
| **minor**    | a real but low-impact deviation                               |

Do not report style issues — the pre-commit hook runs ESLint with
`--max-warnings=0` and Prettier, so style cannot reach a review.
