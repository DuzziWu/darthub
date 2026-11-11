# Handoffs

Every M/L specialist assignment must have a concise, task-linked handoff. Records are created through the DevFlow CLI and stored here as Markdown; `.devflow/tasks/tasks.json` stores the corresponding index/status metadata.

Use:

- `handoff create` to register a specialist report.
- `handoff list --task DF-0001` to review a task's handoffs.
- `handoff check --task DF-0001` to verify completion readiness.
- `handoff resume` to find unfinished work and its last recorded next step.
- `handoff validate <path>` to validate a record's required sections.

A handoff is evidence of reported work, not proof by itself that tests passed. Include exact commands/results or explicitly say why verification was not run. Never store prompts, transcripts, credentials, secrets or personal data.

See `TEMPLATE.md` for the canonical structure. Automatic session-end recovery can be enabled explicitly with `.devflow/config.json` → `recovery.autoHandoffOnSessionEnd`; it is off by default and stores no prompts or transcripts.
