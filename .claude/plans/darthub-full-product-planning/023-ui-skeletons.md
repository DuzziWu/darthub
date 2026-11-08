# Task 023: Create UI skeletons (dashboard, game lobby, career screen)

**Status**: pending
**Depends on**: 001, 006, 014, 003, 043
**Retry count**: 0

## Description
Develop basic React components and pages for the main dashboard, multiplayer lobby, and career mode screen using shadcn/ui & Tailwind. The UI will consume data from rating (Task 006), friend (Task 014) and auth (Task 003) services.

## Context
- Files: `src/pages/dashboard.tsx`, `src/pages/lobby.tsx`, `src/pages/career.tsx`.
- Follow UI guidelines from `code-standards.md`.

## Requirements (Test Descriptions)
- [ ] `it renders the dashboard with user stats placeholder`
- [ ] `it renders the lobby with list of available rooms`
- [ ] `it renders the career screen with current quest`
- [ ] `it uses responsive design (mobile + desktop)`
- [ ] `it compiles without TypeScript errors`

## Acceptance Criteria
- Components display correctly in storybook (optional) and pass snapshot tests.
- No broken imports.
