# Task 001: Static verification of the OpenCode agent team

## Scope

Verify, against the code and against the runtime that resolves it, that the new OpenCode agent team in `/home/administrator/projects/darthub` is what it declares itself to be:

- the seven project agents `orchestrator`, `architect`, `backend`, `frontend`, `game-engine`, `qa-engineer` and `code-reviewer` exist and resolve with the modes declared in `.opencode/agents/*.md` (`orchestrator`: `all`, the other six: `subagent`);
- the six project skills under `.opencode/skills/` (`project-planning`, `dart-game-engine`, `frontend-development`, `backend-development`, `testing`, `code-review`) each have a `SKILL.md` with a valid YAML frontmatter;
- the four project commands under `.opencode/commands/` carry a valid frontmatter with `description` and `agent`;
- `.opencode/opencode.jsonc` is valid JSONC and is actually loaded by the runtime;
- the effective permissions behave as intended: `architect` and `code-reviewer` may not write anything, and `orchestrator` may not start an agent outside its allow-list.

Out of scope: changing any agent, skill, command or configuration file. The verification reports; it does not repair.

## Files

Read-only, plus one added file:

- `.opencode/agents/*.md` (7 files) — read
- `.opencode/skills/*/SKILL.md` (6 files) — read
- `.opencode/commands/*.md` (4 files) — read
- `.opencode/opencode.jsonc` — read
- `.opencode/plans/opencode-team-integration/verify-team.mjs` — **added**, the re-runnable verification script

## Acceptance Criteria

1. `opencode debug agents` in the project directory resolves exactly the seven project agents with the declared modes, and the declared mode equals the resolved mode for every one of them.
2. Every one of the six skills has a `SKILL.md` whose YAML frontmatter parses and carries a non-empty `name` and `description`. Missing, misnamed or unparseable entries are named exactly.
3. `.opencode/opencode.jsonc` parses as JSONC, declares `default_agent: "orchestrator"`, and is listed by `opencode debug config` as a loaded source.
4. For `architect`: `edit` is denied for every path except `docs/*`, `README.md` and `.opencode/plans/*`; `shell` is denied apart from the inspection and test commands; a shell redirection is denied.
5. For `code-reviewer`: every write is denied — including `.env.example`, because the agent's own `edit *` deny is appended after the project-wide allow — and the shell is limited to inspection and test commands.
6. For `orchestrator`: all six team members are launchable; `build`, `plan`, `title`, `summary`, `compaction` and `orchestrator` itself are denied; `git reset --hard`, `git clean`, `git restore` and `git checkout --` are denied; `git push` asks for consent.
7. The verification is reproducible: the script in this package can be run again and reaches the same verdict.

## Verification command

```bash
cd /home/administrator/projects/darthub
node .opencode/plans/opencode-team-integration/verify-team.mjs
```

The script is the single source of the evidence below. It reads `.opencode/` and runs `opencode debug agents` and `opencode debug config`, then resolves the effective permissions with the documented semantics of `https://opencode.ai/docs/permissions/`: the rules are combined in order, the **last matching rule wins**, agent rules are appended after the project-wide rules, and a shell pattern ending in ` *` also matches the command without arguments.

## Open points

- **The orchestrator may launch two agents outside the DartHub team.** `.opencode/agents/orchestrator.md` carries the comment "Only the DartHub team may be launched from here", but the rule list also allows the built-in agents `explore` and `general`. Every other agent id is denied by the trailing `subagent` / `*` / `deny` rule, so the gap is narrow, but the comment overstates the rules. Reported, not changed — the team configuration was out of scope.
- **The project-wide `edit *.env.example` allow is overridden for every project agent.** The agent rules are appended after the project-wide rules, and each agent's `edit *` deny wins, so `.env.example` is not writable by `architect` or `code-reviewer` even though the project configuration allows it. The `read *.env.example` allow is unaffected, because no agent carries a `read` rule.
- **The team is committed on a branch, but not on `origin/main`.** While this verification ran, the user committed the tree as `d73c37f chore(tooling): add the OpenCode agent team and fix the lint gate` and pushed it to `origin/integration/opencode-team` (2026-11-15 21:29:22). The verified content is byte-identical to that commit (`git diff HEAD -- .opencode/` is empty). `origin/main` is still at `b07665a` and does not contain the team — merging the branch into `main` is the user's decision, not this task's.
- **The OpenCode background service can answer mid-reload.** Once, `opencode debug agents` returned only the seven built-in agents while `opencode debug config` already listed the project configuration — the runtime reloading its configuration, not a defect of the team. The verification script now retries the registry read up to three times before it believes it, so a transient cannot be mistaken for a broken team. Three consecutive runs after the change reported 58/58.

## Result

```
DartHub OpenCode team verification
repository : /home/administrator/projects/darthub
opencode   : /home/administrator/.opencode/bin/opencode

1. Agent registry (source: `opencode debug agents`)
  PASS  agent "orchestrator" exists with mode "all"  -> resolved mode "all"
  PASS  agent "architect" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  agent "backend" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  agent "frontend" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  agent "game-engine" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  agent "qa-engineer" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  agent "code-reviewer" exists with mode "subagent"  -> resolved mode "subagent"
  PASS  exactly seven project agents are registered  -> architect, backend, code-reviewer, frontend, game-engine, orchestrator, qa-engineer

2. Declared mode in `.opencode/agents/*.md` vs. the resolved mode
  PASS  architect: declared "subagent" === resolved "subagent"
  PASS  backend: declared "subagent" === resolved "subagent"
  PASS  code-reviewer: declared "subagent" === resolved "subagent"
  PASS  frontend: declared "subagent" === resolved "subagent"
  PASS  game-engine: declared "subagent" === resolved "subagent"
  PASS  orchestrator: declared "all" === resolved "all"
  PASS  qa-engineer: declared "subagent" === resolved "subagent"

3. Skills (`.opencode/skills/<id>/SKILL.md`)
  PASS  skill "project-planning" has valid YAML frontmatter (name + description)  -> name="Project Planning"
  PASS  skill "dart-game-engine" has valid YAML frontmatter (name + description)  -> name="Dart Game Engine"
  PASS  skill "frontend-development" has valid YAML frontmatter (name + description)  -> name="Frontend Development"
  PASS  skill "backend-development" has valid YAML frontmatter (name + description)  -> name="Backend Development"
  PASS  skill "testing" has valid YAML frontmatter (name + description)  -> name="Testing"
  PASS  skill "code-review" has valid YAML frontmatter (name + description)  -> name="Code Review"

4. Commands (`.opencode/commands/*.md`)
  PASS  command "start-feature" has frontmatter with description + agent  -> agent="orchestrator"
  PASS  command "execute-plan" has frontmatter with description + agent  -> agent="orchestrator"
  PASS  command "review" has frontmatter with description + agent  -> agent="orchestrator"
  PASS  command "release-check" has frontmatter with description + agent  -> agent="orchestrator"

5. Configuration (`.opencode/opencode.jsonc`)
  PASS  opencode.jsonc is valid JSONC  -> $schema, default_agent, permissions
  PASS  opencode.jsonc declares default_agent "orchestrator"  -> "orchestrator"
  PASS  the runtime loaded the project configuration  -> /home/administrator/projects/darthub/.opencode/opencode.jsonc

6. Effective permissions (last matching rule wins)
  PASS  architect: edit "*" is denied
  PASS  architect: edit "docs/*" is allowed
  PASS  architect: edit ".opencode/plans/*" is allowed
  PASS  architect: the project-wide "edit *.env.example" allow is overridden by the later deny
  PASS  architect: shell "*" is denied
  PASS  architect: shell redirection is denied
  PASS  code-reviewer: edit "*" is denied
  PASS  code-reviewer: the only edit allow in the merged list is "*.env.example"  -> *.env.example
  PASS  code-reviewer: every write is denied, ".env.example" included
  PASS  code-reviewer: shell "*" is denied
  PASS  code-reviewer: shell redirection is denied
  PASS  code-reviewer: read ".env.example" stays allowed
  PASS  code-reviewer: read ".env" asks for consent
  PASS  orchestrator: may launch "architect"
  PASS  orchestrator: may launch "backend"
  PASS  orchestrator: may launch "frontend"
  PASS  orchestrator: may launch "game-engine"
  PASS  orchestrator: may launch "qa-engineer"
  PASS  orchestrator: may launch "code-reviewer"
  PASS  orchestrator: may NOT launch "build"
  PASS  orchestrator: may NOT launch "plan"
  PASS  orchestrator: may NOT launch "title"
  PASS  orchestrator: may NOT launch "summary"
  PASS  orchestrator: may NOT launch "compaction"
  PASS  orchestrator: may NOT launch "orchestrator"
  NOTE  orchestrator may additionally launch: explore, general
  PASS  orchestrator: "git reset --hard HEAD" is denied
  PASS  orchestrator: "git clean -fd" is denied
  PASS  orchestrator: "git restore ." is denied
  PASS  orchestrator: "git checkout -- ." is denied
  PASS  orchestrator: "git push origin main" asks for consent

checks failed: 0
RESULT: the DartHub agent team is configured as declared.

```

Verdict: **the team is configured as declared.** All 58 checks passed and 0 failed; the script exits 0.

The only deviations from the wording of the original expectation are the two allow-list entries `explore` and `general` in the orchestrator's `subagent` rules, listed above as open points.

### Side finding, recorded for package 003

The delivery-status table in `docs/ROADMAP.md` was stale: it listed tasks 002, 007, 012, 018, 020 and 026 as "in progress" and everything else as "pending", while the repository already carries the artefacts of all 48 plan tasks. Seven Playwright journeys remain `test.skip` placeholders — `e2e/career.spec.ts` (3), `e2e/login.spec.ts` (2) and `e2e/matchmaking.spec.ts` (2) — for the login, matchmaking and career flows that are not built. Package 003 therefore marks the table complete and records the skipped journeys here as the one caveat.
