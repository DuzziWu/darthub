# Task 042: Implement Career Mode progression, rewards and unlock system

**Status**: completed
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
- [x] `it records quest completion and updates XP` — via `awardXp()` in progressionService
- [x] `it unlocks new content when XP thresholds are crossed` — via `getUnlockablesForLevel()` and level-up logic
- [x] `it returns the current story chapter and available training lessons` — via `GET /api/career/progress` route
- [x] `it prevents duplicate reward claims` — via `RewardService` with in-memory store
- [x] `it respects authentication (Task 003)` — all routes use `AuthGateway` seam

## Implementation Notes
- `progressionService.ts`: pure functions for XP/level calculations and award logic
- `rewardService.ts`: in-memory store with `RewardStore` interface for later Prisma swap
- `progressRoutes.ts` + `GET /api/career/progress`: returns playerLevel, cumulativeXp, nextLevelXp, unlockables
- Formula: XP for level N = floor(100 * N * 1.5) cumulative

## Acceptance Criteria
- Integration tests cover progression flow from start to first unlock.
- API returns correct data structures for the UI.
