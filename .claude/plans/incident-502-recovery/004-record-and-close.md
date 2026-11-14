# Task 004: Record the incident and close the issue

**Status**: in_progress
**Depends on**: 003
**Retry count**: 0

## Description
Record what happened in the places that will be read when this happens again — the DevFlow ledger, the runbook that was followed wrongly, and the GitHub issue — and close the issue only because the service is verifiably back.

## Context
- The DevFlow ledger is `.devflow/tasks/tasks.json`; handoffs live in `.devflow/memory/handoffs/` and follow `.devflow/memory/handoffs/TEMPLATE.md`.
- The task ledger's README states the workflow: create a task, register each specialist with `task assign`, create a handoff per result with `handoff create`, keep the documentation status `pending` until a documentation-specialist handoff records `documentation-status updated`, and run the handoff check before closure.
- The plan agent names in this repo are `backend-developer`, `frontend-developer`, `test-engineer`, `code-reviewer`, `documentation-specialist` and `devflow-orchestrator` (see `DF-0001`/`DF-0002` in the ledger).
- `AGENTS.md` §"Serving the live preview" already documents the correct startup. It was followed wrongly because the **`HOSTNAME` distinction between the E2E convention and the live-preview requirement is not stated where the decision is made.**

## Requirements (Check Descriptions)
- [ ] `it registers the incident task with its acceptance criteria`
- [ ] `it registers every specialist that took part, with bounded ownership`
- [ ] `it records a handoff per specialist, with the evidence each one gathered`
- [ ] `it records the documentation handoff and resolves the documentation status`
- [ ] `it documents the HOSTNAME distinction at the point of decision`
- [ ] `it closes the GitHub issue with the root cause, the fix and the verification`

## Acceptance Criteria
- The task ledger holds the incident task with its acceptance criteria and a registered assignment per specialist.
- Every specialist has a handoff file under `.devflow/memory/handoffs/` with the template's sections, including the exact commands run and their results.
- The documentation status is `updated`, with the documentation files named.
- The runbook states **why** the live preview needs `HOSTNAME=0.0.0.0` and **why** the E2E server uses `HOSTNAME=127.0.0.1`, so the two are not confused again — and states that port 3000 serves the **prefix** build for the published mount.
- The GitHub issue #10 is closed with a comment carrying the root cause, the fix and the verification evidence.
- The issue is closed **only** after task 003 passed. If any acceptance criterion is unmet, the issue stays open.

## Implementation Notes

The documentation gap is the durable part of this incident. The runbook already had the right command; what it lacked was the contrast that makes the wrong choice visible. Record it as a decision, not as a log entry: the live preview binds `0.0.0.0` because the proxy runs on the host and reaches the container on `172.18.0.2`, and the E2E server binds `127.0.0.1` because it must not be reachable from the host.

Also record that a rebuild invalidates the working directory of a running standalone server — the zombie on port 3121 was exactly that — so the restart procedure must terminate the old process by PID before starting the new one.

Do not commit anything without explicit user consent; the repository's plan commit policy requires it.

## Next step
None — the plan ends with the issue closed and the incident recorded.
