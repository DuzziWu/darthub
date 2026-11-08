# Task 024: Write unit & integration tests for core UI components

**Status**: completed
**Depends on**: 023
**Retry count**: 0

## Description
Create Vitest tests for the dashboard, lobby, and career components, covering rendering, props handling, and basic interactions.

## Context
- Files: `tests/unit/ui/dashboard.test.tsx`, `tests/unit/ui/lobby.test.tsx`, `tests/unit/ui/career.test.tsx`.
- Use React Testing Library + Vitest.

## Requirements (Test Descriptions)
- [x] `it renders dashboard with mock user data`
- [x] `it shows list of rooms in lobby and handles click to join`
- [x] `it displays current quest title on career screen`
- [x] `it matches snapshot for each component`
- [x] `it respects responsive breakpoints (mobile view)`

## Acceptance Criteria
- All UI tests pass with >90% coverage.
- No warnings about missing keys or accessibility.

## Implementation Notes
- Created 3 unit test files in `tests/unit/ui/`: `dashboard.test.tsx`, `lobby.test.tsx`, `career.test.tsx`
- Installed `@testing-library/react` and `@testing-library/dom` dev dependencies
- All 15 unit tests pass
- 5 existing integration tests in `tests/integration/ui-skeletons.test.tsx` also pass
- Snapshot files generated for each component
- Test approach: using `renderToString` from react-dom/server for SSR-compatible rendering
