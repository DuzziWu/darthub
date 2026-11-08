# Task 042: Implement Career Mode progression, rewards and unlock system

**Status**: pending
**Depends on**: 041
**Retry count**: 0

## Description
Build the backend services that manage the player's Career Mode state:
- Track completed quests, training lessons, and NPC interactions.
- Calculate XP, level, and unlockable items (e.g., avatar cosmetics, new game modes).
- Expose API endpoints for the UI to fetch current progress, claim rewards, and advance the story.

## Context
- Files: `src/career/progressionService.ts`, API routes `GET /api/career/progress`, `POST /api/career/reward`.
- Uses Prisma model `CareerProgress` (to be added to schema).

## Requirements (Test Descriptions)
- [ ] `it records quest completion and updates XP`
- [ ] `it unlocks new content when XP thresholds are crossed`
- [ ] `it returns the current story chapter and available training lessons`
- [ ] `it prevents duplicate reward claims`
- [ ] `it respects authentication (Task 003)`

## Acceptance Criteria
- Integration tests cover progression flow from start to first unlock.
- API returns correct data structures for the UI.
