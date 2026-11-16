# Plan: OpenCode Agent Team Integration

## Created

2026-11-15

## Status

done

## Objective

Make the new OpenCode agent team in `/home/administrator/projects/darthub` statically verifiable and durably traceable: prove against the code that the seven project agents, the six project skills, the four commands and the project configuration are what they claim to be, and record that proof in a plan ledger, in the decision log and in the roadmap status.

Scope of the work: verification, documentation and the ledger. No application code, no commits, no pushes, no branch operations.

## Related Issues

none

## Discovery Notes

**The team lives in `.opencode/`, and `.opencode/` is not on `origin/main`.** When the verification started, the working tree carried `.opencode/` as an untracked directory on branch `integration/opencode-team` (tip `b07665a`, identical to `origin/main`); the same tree was committed on the _local_ `main` branch as `96f51cd chore: add OpenCode autonomous development team`, which is **not** an ancestor of `origin/main` (the two histories share only `8afc260`, `git merge-base main origin/main`). While the verification ran, the user committed the tree as `d73c37f chore(tooling): add the OpenCode agent team and fix the lint gate` and pushed it to `origin/integration/opencode-team` (2026-11-15 21:29:22). The content is unchanged — `git diff HEAD -- .opencode/` is empty — but the **location** is still not `origin/main`: `origin/main` remains at `b07665a`. So "the team is committed on a branch" and "the team is on `origin/main`" are two different statements, and only the first is true today. The verification ran against the working tree, which is the state the user actually works in, and the content it verified is byte-identical to the committed tree.

**`opencode debug agents` is the resolver, not a hand-written list.** The JSON pasted into the task order was produced in a directory without `.opencode/`, which is why it listed only the seven built-in agents. Running the same command in the project directory resolves fourteen agents: the seven project agents plus the seven built-ins (`build`, `compaction`, `explore`, `general`, `plan`, `summary`, `title`). The resolved output also carries the **merged** permission list — base policy, then the project-wide rules from `opencode.jsonc`, then the agent-specific rules — which is the list the runtime actually enforces.

**Permission semantics come from the official documentation, not from a guess.** `https://opencode.ai/docs/permissions/` states that the rules are combined in order and the **last matching rule wins**, that agent rules are appended after global rules, that a shell pattern ending in ` *` also matches the command _without_ arguments, and that an operation checking several resources is denied if any resource is denied. The spot checks in package 001 implement exactly these rules against the merged list that OpenCode itself produced.

**Seven of the seven project agents are declared with the expected mode.** `orchestrator` declares `mode: all`; the other six declare `mode: subagent`. The resolved output agrees with the declarations — no drift between the `.md` files and the runtime.

**The orchestrator's subagent allow-list is wider than its own comment.** `.opencode/agents/orchestrator.md` says "Only the DartHub team may be launched from here", but the rule list also allows the two built-in agents `explore` and `general`. The deny-all rule (`subagent` / `*` / `deny`) is the last rule that matches any other agent id, so `build`, `plan`, `title`, `summary`, `compaction` and `orchestrator` itself are all denied. The gap is therefore narrow and harmless, but the comment overstates what the rules do.

**The ROADMAP status table had drifted away from the repository.** `docs/ROADMAP.md` still listed tasks 002, 007, 012, 018, 020 and 026 as "in progress" and everything else as "pending", while `.claude/plans/darthub-full-product-planning/_plan.md` marks all 48 tasks completed. Checking the repository rather than the plan resolved it: all 48 tasks have their headline artefacts present in the working tree (package 003 records the method). The table was therefore stale, not the plan.

**Seven Playwright journeys are still `test.skip` placeholders.** `e2e/career.spec.ts` (3), `e2e/login.spec.ts` (2) and `e2e/matchmaking.spec.ts` (2) are skipped by design, for flows that are not built. This does not make task 025 "unfinished" — the spec files exist and run — but it is the one caveat in the delivery status and is recorded as an open point in package 001.

## Scope

### In Scope

- Static verification of the seven project agents, their declared modes and their effective permissions.
- Validation of the six project skills and of the four project commands.
- Validation of `.opencode/opencode.jsonc` as JSONC and of its effect on the resolved configuration.
- A plan ledger under `.opencode/plans/opencode-team-integration/` that survives a session loss, including a re-runnable verification script so the verdict can be reproduced instead of taken on trust.
- One new row in the decision log and one corrected delivery-status table in the roadmap.

### Out of Scope

- Any change to the agent, skill or command definitions themselves — the team configuration is verified, not rewritten. The one deviation found (the `explore`/`general` allow-list) is reported, not fixed.
- Any application code, test or build change.
- Commits, pushes, tags, branch operations. The repository's pre-existing uncommitted work (`.dockerignore`, `.prettierignore`, `AGENTS.md`, `eslint.config.mjs`) and the then-untracked `.opencode/` and `.ai/` trees are left exactly as they are; the user committed them during this session as `d73c37f`, which this task neither triggered nor interfered with.
- The phases, milestones and risk sections of `docs/ROADMAP.md`, and every existing row of the decision register.

## Success Criteria

- [x] The seven project agents resolve with the declared modes: `orchestrator` = `all`, the other six = `subagent`.
- [x] All six skills under `.opencode/skills/` have a `SKILL.md` with a valid YAML frontmatter carrying `name` and `description`.
- [x] `.opencode/opencode.jsonc` is valid JSONC and is actually loaded by the runtime.
- [x] The effective permissions of `architect` and `code-reviewer` deny every write, and the `orchestrator` may not start an agent outside its allow-list.
- [x] The plan ledger exists with an honest task table, and the first entry that is not `done` is the resume point.
- [x] The decision log gains one row; no existing row is rewritten or removed.
- [x] The roadmap's delivery-status table matches the repository state.
- [x] `npx prettier . --check`, `npx eslint .` and `npx vitest run` are green.

## Task Overview

| Task | Description                              | Owner        | Files                                                                                                                                                                                     | Depends On | Status |
| ---- | ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| 001  | Static verification of the agent team    | orchestrator | `.opencode/agents/*.md`, `.opencode/skills/*/SKILL.md`, `.opencode/commands/*.md`, `.opencode/opencode.jsonc` (read), `.opencode/plans/opencode-team-integration/verify-team.mjs` (added) | -          | done   |
| 002  | Plan ledger for the integration          | architect    | `.opencode/plans/opencode-team-integration/_plan.md`, `.opencode/plans/opencode-team-integration/001-agent-team-verifikation.md`                                                          | 001        | done   |
| 003  | Decision log and roadmap delivery status | architect    | `docs/DECISIONS.md`, `docs/ROADMAP.md`                                                                                                                                                    | 001        | done   |
| 004  | Quality gates: prettier, eslint, vitest  | orchestrator | — (read-only gates)                                                                                                                                                                       | 002, 003   | done   |

Owner names the team member whose file ownership the package falls under; every package was executed in a single session, so no two packages ever edited the same file.

**Resume point:** every entry is `done`, so there is no open package to resume. The first entry that is not marked `done` is where a new session continues.

## API Contract

The interfaces this plan verifies. They are the contract between the OpenCode runtime, the DartHub team and the project documentation.

### Agent interface — `.opencode/agents/<id>.md`

A Markdown file with a YAML frontmatter and a Markdown body. The frontmatter carries `description`, `mode`, `color` and `permissions`; the body is the agent's system prompt.

```yaml
---
description: <one paragraph: what the agent owns>
mode: all | primary | subagent   # "all" = primary + subagent
color: "#RRGGBB"
permissions:
  - action: <tool action>
    resource: <glob or literal>
    effect: allow | deny | ask
---
```

- The file name is the agent id: `orchestrator.md` → agent `orchestrator`.
- `mode: all` makes the agent usable as a primary agent _and_ as a subagent; `mode: subagent` makes it launchable only through the `subagent` tool.
- The **effective** rule list is the base policy, then the project-wide `permissions` from `opencode.jsonc`, then the agent's own rules. The last matching rule wins.
- An agent with `edit` denied for `*` and `shell` denied for `*` is read-only, including against shell redirections.

### Skill interface — `.opencode/skills/<name>/SKILL.md`

A directory per skill, containing `SKILL.md` with a YAML frontmatter carrying at least `name` and `description`. The `name` is human-readable, the directory name is the id the `skill` tool takes. The body is the instruction text the skill loads on demand.

### Command interface — `.opencode/commands/<name>.md`

A Markdown file with a YAML frontmatter carrying `description` and `agent`. The `agent` field binds the command to a member of the team; all four project commands bind to `orchestrator`.

### Project configuration — `.opencode/opencode.jsonc`

JSONC: comments and a trailing comma are allowed. `default_agent` names the agent OpenCode starts with; `permissions` holds the project-wide rules that every agent inherits before its own rules are appended.

### Plan interface — `.opencode/plans/<slug>/`

`_plan.md` (objective, discovery, scope, success criteria, task table, API contract, risks, progress log), `NNN-<task>.md` (scope, acceptance criteria, verification command, `## Result` with the real output) and `NNN-review.md` (independent review findings and their disposition). The task table's `Status` column is the recovery mechanism; it is only useful while it is honest.

## Risks & Mitigations

- **A verification that only reads the `.md` files proves nothing about the runtime.** Mitigation: every claim in package 001 is derived from `opencode debug agents`, the output the runtime itself produces in the project directory.
- **Permission semantics are easy to get wrong.** Mitigation: the resolution rules were taken from the official OpenCode documentation and implemented in a separate script; the first run reported two false mismatches, which is exactly what identified the documented "a pattern ending in ` *` also matches the bare command" rule.
- **The team is committed on a branch, but not on `origin/main`.** Mitigation: the ledger records the exact commits that hold it (`d73c37f` on `origin/integration/opencode-team`, `96f51cd` on the local `main`) and the fact that `origin/main` is still at `b07665a`. Merging the branch into `main` is a decision for the user, not for this plan.
- **The ROADMAP status table could be "corrected" on the strength of the plan's own claim.** Mitigation: the table was reconciled against the repository — 48 of 48 tasks have their headline artefacts present — and the one caveat (seven skipped Playwright journeys) is recorded as an open point rather than smoothed over.
- **A verdict that cannot be re-run is a claim, not a fact.** Mitigation: the verification script lives in the repository next to this plan (`verify-team.mjs`), so the verdict is reproducible without the session that produced it. The throwaway scripts used while the method was developed stayed in the session's temporary directory and are not part of the repository.
- **A gate that fails for an environmental reason must not be reported as green.** Mitigation: the two gate failures in this plan were traced to their cause instead of being re-run until they passed — one was a prettier alignment in this plan's own file, the other an ESLint `ENOENT` from a concurrent session's temporary probe file plus a `no space left on device` from a full root filesystem. The disk was reclaimed with `docker image prune -f` (dangling build leftovers only, no running container touched) and the failing test file then passed on its own.

## Progress Log

- **2026-11-15** — Read the handoff, the repository state and `AGENTS.md`. Established that the working tree of `/home/administrator/projects/darthub` (branch `integration/opencode-team`, tip `b07665a` = `origin/main`) is the directory the order names, and that the session's own worktree does not contain `.opencode/` at all.
- **2026-11-15** — Package 001: resolved the team with `opencode debug agents` (opencode v2.3.0) — 14 agents, the 7 project agents with the expected modes. Validated the six `SKILL.md` frontmatters with a YAML parser, validated `opencode.jsonc` as JSONC, and resolved the effective permissions of `architect`, `code-reviewer` and `orchestrator` against the documented "last matching rule wins" semantics. One deviation found: the orchestrator may also launch the built-in `explore` and `general`.
- **2026-11-15** — Package 002: wrote this ledger and `001-agent-team-verifikation.md` with the real command output.
- **2026-11-15** — Package 003: added the decision-log row and reconciled the roadmap delivery-status table against the repository (48 of 48 task artefacts present; seven skipped Playwright journeys noted).
- **2026-11-15 21:29** — The user committed and pushed the team tree as `d73c37f chore(tooling): add the OpenCode agent team and fix the lint gate` to `origin/integration/opencode-team`, while this session was running. The verified content is byte-identical to that commit; the plan and package 001 were corrected to state the new location.
- **2026-11-15 21:47** — Package 004, first attempt: three gate tests failed. Two causes, one of them mine — the table I edited in `_plan.md` was no longer prettier-aligned. The other was not mine: ESLint aborted with `ENOENT … tests/unit/game-engine/UndoCorrectModes.probe.test.ts`, a temporary probe file that a **concurrent session** created and deleted inside the same working tree while the suite was running. The probe file is gone; `npx eslint .` exits 0 afterwards.
- **2026-11-15 22:08** — Package 004, second attempt: 104 of 105 test files green. The one remaining failure was `tests/unit/dockerignore.test.ts`, which timed out at its 600 s limit while its `docker build` ran. The cause is environmental, not repository-side: the root filesystem stood at 99 % (1.4 GB free) and the build died with `failed to export image … no space left on device`, because repeated builds by two concurrent sessions had left ~20 dangling 1.7 GB images behind. `docker image prune -f` reclaimed 15.31 GB (root filesystem now 41 % free) and the test file then passed 3/3 on its own.
- **2026-11-15 23:18** — Package 004, final run: `npx vitest run` → **105 test files passed, 526 tests passed, 0 failed** (1009 s). `npx prettier . --check` and `npx eslint .` are green in the same tree state. The plan is complete.
- **2026-11-15 23:20** — The verification script briefly reported a false failure: the OpenCode background service was reloading and answered `debug agents` with the built-in agents only, while `debug config` already saw the project configuration. The script now retries the registry read up to three times before it believes it; three consecutive runs afterwards reported 58/58.
- **2026-11-15 23:37** — Package 004, definitive run in the final tree state: `npx vitest run` → **105 test files passed, 526 tests passed, 0 failed** (911 s), `npx prettier . --check` → green, `npx eslint .` → exit 0. The plan is complete.
