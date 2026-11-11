# Task 007: Documentation — engine README and DevFlow project memory

**Status**: pending
**Depends on**: [004]
**Retry count**: 0

## Description
Document the new engine capability and update the project's durable memory so a later session knows the engine now owns a throw ledger and how to undo and correct a dart.

## Context
- Related files: `src/game-engine/README.md`, `.devflow/memory/ARCHITECTURE.md`, `.devflow/memory/CURRENT_STATE.md`, `.devflow/memory/PROJECT.md`, `.devflow/memory/DOCUMENTATION-INDEX.md`
- Patterns to follow: the voice and structure of `src/game-engine/README.md` — it is the engine's public API document. The four `.devflow/memory/` files are the verified project memory; their entries must be verifiable against the repository, never aspirational.
- `.devflow/memory/ARCHITECTURE.md` — records the real boundaries and data flows. The engine's new ownership of the throw ledger belongs there.
- `.devflow/memory/CURRENT_STATE.md` — records what is implemented today. The undo/correct capability belongs in the working-functionality list.
- `.devflow/memory/PROJECT.md` — records purpose, constraints and the source contradictions.
- `.devflow/memory/DOCUMENTATION-INDEX.md` — indexes the canonical documents; `src/game-engine/README.md` is already listed at line 73, so update its verification note rather than adding a row.

## Requirements (Test Descriptions)
Write requirements as exact test names. These become the test method names.

- [ ] `it documents the throw ledger in the engine README`
- [ ] `it documents the undo operation in the engine README`
- [ ] `it documents the correct operation in the engine README`
- [ ] `it documents the replay rule in the engine README`
- [ ] `it records the throw ledger in the project architecture memory`
- [ ] `it records the undo and correct capability in the current state memory`
- [ ] `it marks the engine README as verified in the documentation index`

## Acceptance Criteria
- All requirements have passing tests.
- The engine README shows the new public API the way it shows the existing one — with the same care about *why*.
- Every claim added to the project memory is verifiable against the repository as it stands after this change. No aspirational statements.
- The memory files name the same paths and line anchors as the code.

## Implementation Notes

Design decisions already settled (do not re-open):

- The README documents the *contract*, not the implementation. What a caller can rely on: the ledger is in the state, undo removes the last dart, correct replaces one dart and keeps its player, both re-derive the state by replaying, and a refused correction changes nothing.
- Mention the replay rule explicitly, because it is the reason no mode-specific correction code exists — that is the fact a future contributor most needs.
- The project memory records this change as *implemented*, with the same precision as the existing entries.

Leave blank for the implementer.
