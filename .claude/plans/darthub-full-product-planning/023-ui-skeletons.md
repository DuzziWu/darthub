# Task 023: Create UI skeletons (dashboard, game lobby, career screen)

**Status**: completed
**Depends on**: 001, 006, 014, 003, 043
**Retry count**: 0

## Description
Develop basic React components and pages for the main dashboard, multiplayer lobby, and career mode screen using shadcn/ui & Tailwind. The UI will consume data from rating (Task 006), friend (Task 014) and auth (Task 003) services.

## Context
- Files created: `app/dashboard/page.tsx`, `app/lobby/page.tsx`, `app/career/page.tsx`
- Follow UI guidelines from `code-standards.md`.

## Requirements (Test Descriptions)
- [x] `it renders the dashboard with user stats placeholder`
- [x] `it renders the lobby with list of available rooms`
- [x] `it renders the career screen with current quest`
- [x] `it uses responsive design (mobile + desktop)`
- [x] `it compiles without TypeScript errors`

## Acceptance Criteria
- Components display correctly and pass snapshot tests.
- No broken imports.

## Implementation Notes
- Created three Next.js pages in `app/` directory (Next.js App Router structure, not `src/pages/`)
- Dashboard: shows rating, level, XP, and friends stats in responsive grid
- Lobby: shows matchmaking section, public rooms list, and create private room button
- Career: shows current quest, progress bar, and training lessons sections
- All pages use Tailwind CSS utility classes with responsive breakpoints (sm, md, lg)
- Pages use dark theme (slate-900 background, slate-100 text) matching the game's visual style
- Created integration test file at `tests/integration/ui-skeletons.test.tsx`
- Note: shadcn/ui components were not installed (not in package.json), so using raw Tailwind + HTML elements
- Pre-existing TypeScript errors in other files (unrelated to this task)
