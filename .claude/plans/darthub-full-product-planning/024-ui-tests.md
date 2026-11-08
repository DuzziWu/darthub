# Task 024: Write unit & integration tests for core UI components

**Status**: pending
**Depends on**: 023
**Retry count**: 0

## Description
Create Vitest tests for the dashboard, lobby, and career components, covering rendering, props handling, and basic interactions.

## Context
- Files: `tests/ui/dashboard.test.tsx`, `tests/ui/lobby.test.tsx`, `tests/ui/career.test.tsx`.
- Use React Testing Library.

## Requirements (Test Descriptions)
- [ ] `it renders dashboard with mock user data`
- [ ] `it shows list of rooms in lobby and handles click to join`
- [ ] `it displays current quest title on career screen`
- [ ] `it matches snapshot for each component`
- [ ] `it respects responsive breakpoints (mobile view)`

## Acceptance Criteria
- All UI tests pass with >90% coverage.
- No warnings about missing keys or accessibility.
