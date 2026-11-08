# Task 043: Create first playable Career Mode content (quests, NPCs, training lessons)

**Status**: pending
**Depends on**: 042
**Retry count**: 0

## Description
Populate the JSON quest files and related assets for the initial Career Mode release:
- Implement the first story chapter with an introductory NPC trainer.
- Add three training lessons (basic aiming, checkout practice, double‑out mastery).
- Define corresponding rewards (XP, a new avatar item).
- Ensure the UI can render these quests via the loader API.

## Context
- Files: `src/career/quests/intro.json`, `src/career/quests/training/aim.json`, etc.
- Update `src/career/questLoader.ts` to include these files.

## Requirements (Test Descriptions)
- [ ] `it loads the intro quest and returns correct dialog data`
- [ ] `it loads each training lesson and validates against the schema`
- [ ] `it awards the expected XP and unlocks after completion`
- [ ] `it integrates with the progression service (Task 042)`

## Acceptance Criteria
- Playable content is accessible in a local dev build.
- End‑to‑end tests (Task 025) cover a user completing the first training lesson.
