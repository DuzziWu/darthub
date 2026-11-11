# Task Ledger

`.devflow/tasks/tasks.json` stores stable task IDs, acceptance criteria, specialist assignments, handoff references and lifecycle state. It is a compact work ledger, not a transcript or replacement for Claude Code plan mode.

## Workflow

1. Create a stable task ID with `task create`.
2. Register each specialist before dispatch with `task assign`, including bounded file ownership and acceptance criteria.
3. After each result, create a handoff with `handoff create`.
4. If documentation impact is `yes`, keep documentation status `pending` until `documentation-specialist` updates the canonical docs and records a completed documentation handoff with `documentation-status updated` and `documentation-files`.
5. Run `handoff check --task DF-0001` before closure. Medium/Large tasks cannot be marked `done` without a completed orchestrator handoff, completed registered assignments and a resolved documentation status.

## Examples

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs" task create --title "Implement match history" --size L --criteria "API contract,UI integration,regression tests"
node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs" task assign DF-0001 --agent backend-developer --scope "Match history API" --owns "src/server/matches/**" --criteria "API validates access,Persistence is covered"
node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs" handoff list --task DF-0001
node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs" handoff check --task DF-0001
```

Do not store prompts, secrets or full transcripts. Preserve task IDs and handoff paths across sessions.
