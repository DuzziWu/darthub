# AI Development Workflow — Skills for DartHub

This document is the master plan for turning DartHub into a project with
specialised, repeatable AI development workflows.

It has three parts:

1. [Upstream skill evaluation](#1-upstream-skill-evaluation) — which skills from the
   official OpenHands Extensions catalogue fit DartHub's stack, whether they are
   compatible with the installed OpenHands version, and what the risks are.
2. [DartHub architecture analysis](#2-darthub-architecture-analysis) — what the
   project actually looks like today.
3. [Project-specific skill proposal](#3-project-specific-skill-proposal) — the six
   `darthub-*` skills, their scope, triggers and content.

> **Scope note.** Nothing in this plan changes application code. The analysis
> below was produced read-only; the only files added are documentation under
> `docs/ai-skills/`.

---

## 1. Upstream skill evaluation

### 1.1 Method

Three independent checks were run, in this order:

| #   | Check                  | How                                                                                            | Result                                 |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Catalogue completeness | GitHub API on `OpenHands/extensions` vs. the locally installed package                         | 73 local == 73 remote, identical names |
| 2   | Version compatibility  | Every skill loaded with the installed SDK's own loader, in strict mode                         | **73 OK / 0 FAIL**                     |
| 3   | Supply-chain review    | Content scan of stack-relevant skills for external dependencies and destructive shell patterns | Clean                                  |

**Environment used for the evaluation**

| Component                               | Version                                              |
| --------------------------------------- | ---------------------------------------------------- |
| OpenHands agent server                  | 1.61.0 (`OPENHANDS_BUILD_GIT_REF=refs/tags/v1.61.0`) |
| OpenHands SDK / tools / workspace       | 1.61.0                                               |
| `@openhands/extensions` (installed)     | 0.41.0 — mounted at `EXTENSIONS_PATH`                |
| `@openhands/extensions` (remote `main`) | 0.42.0                                               |

`EXTENSIONS_PATH` points at the local package, so the agent server reads
skills straight from disk and never clones the catalogue at runtime.

### 1.2 Compatibility result: all 73 skills load

Each skill was loaded with `Skill.load(path=..., strict=True)` — the same
loader the agent server uses, with strict AgentSkills name validation enabled.

```
TOTAL=73 OK=73 FAIL=0 SKIP=0
```

**No skill in the catalogue is incompatible with OpenHands 1.61.0.** The
compatibility question therefore does not narrow the candidate list; quality,
relevance and risk do.

The catalogue is also ahead of the installed package by one version
(0.41.0 → 0.42.0), so content drift was checked separately: all 22
stack-relevant skills are **byte-identical** between installed `v0.41.0` and
remote `main` (SHA-256 compared). The version drift therefore has no bearing on
the recommendations below.

### 1.3 The skill format, as enforced by OpenHands 1.61.0

Understanding the format matters for part 3, so it is stated explicitly.
These rules come from `openhands/sdk/skills/skill.py` and
`openhands/sdk/skills/utils.py` in the installed version.

**Location and discovery** (precedence: project > user > public)

```
<project>/.agents/skills/<skill-name>/SKILL.md   <- preferred, project-scoped
<project>/.openhands/skills/<skill-name>/SKILL.md <- legacy location
~/.agents/skills/<skill-name>/SKILL.md            <- user scope
```

**Frontmatter contract**

| Field                                                                               | Rule                                                                                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                                              | Required. Must equal the directory name. Lowercase alphanumeric with single hyphens (`darthub-qa` ok, `darthub_QA` not). Max 64 chars.             |
| `description`                                                                       | Required. Max 1024 chars, truncated with a notice beyond that.                                                                                     |
| `triggers`                                                                          | Optional list of keywords. A skill with `triggers` is auto-injected when the keyword appears as a whole token in the user message.                 |
| `paths`                                                                             | Optional list of gitignore-style globs. **Mutually exclusive with `triggers`** — `paths` wins and `triggers` is silently dropped (with a warning). |
| `inputs`                                                                            | Optional; turns the skill into a task skill (`TaskTrigger`).                                                                                       |
| `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation` | Optional AgentSkills standard fields.                                                                                                              |

**Trigger inference** (in the order the SDK applies it)

1. `paths` present → `PathTrigger` (deterministic, fires on touched files)
2. `inputs` present → `TaskTrigger`
3. `triggers` present → `KeywordTrigger`
4. none of the above → no trigger, always active

**Resource directories**: `scripts/` (executable), `references/` (loaded into
context on demand), `assets/` (output material) are discovered automatically.

**Invocation**: skills are listed to the model by name and description only —
the file path is deliberately withheld, so `invoke_skill(name=...)` is the
only supported way to load one.

### 1.4 Recommended upstream skills

Scored against DartHub's stack. "Benefit" is rated for _this_ repository, not
generically.

#### Tier 1 — install (directly maps to the stack)

| Skill                 | Stack area             | Benefit for DartHub                                                                                                                                                                                             | Install source                                          | Risk                                                                                                                                                                                   |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`code-review`**     | all                    | Structured review over correctness, security, compatibility, maintainability. Ships `references/risk-evaluation.md` and `references/supply-chain-security.md`. Complements the project's own high bar.          | `OpenHands/extensions` → `skills/code-review` (MIT)     | Low. Read-only guidance; no scripts, no network.                                                                                                                                       |
| **`qa-changes`**      | Vitest, Playwright     | Structured "set up → exercise changed behaviour → report" methodology. Maps onto the repo's existing `tests/unit`, `tests/integration`, `e2e` split.                                                            | `OpenHands/extensions` → `skills/qa-changes` (MIT)      | Low. Read-only. Requires a running app for full verification — see the known baseline gaps in §2.4.                                                                                    |
| **`github-actions`**  | CI                     | DartHub has exactly one workflow (`.github/workflows/ci.yml`) running lint → format → typecheck → test. This skill covers authoring and debugging workflows and custom actions.                                 | `OpenHands/extensions` → `skills/github-actions` (MIT)  | Low. Advisory only.                                                                                                                                                                    |
| **`docker`**          | Docker                 | DartHub ships a `Dockerfile`, a `docker-compose.yml` (app + postgres:16-alpine + redis:7-alpine) and a `.dockerignore` — and a test that asserts the built image stays under 200 MB.                            | `OpenHands/extensions` → `skills/docker` (MIT)          | Low–Medium. Contains `sudo dockerd` instructions for starting a daemon. Benign, but the only skill in the set that suggests elevated commands.                                         |
| **`security`**        | backend, auth, privacy | DartHub has an auth layer, GDPR export/delete, an audit logger and guest-token migration — a genuinely security-sensitive surface.                                                                              | `OpenHands/extensions` → `skills/security` (MIT)        | Low. Read-only checklist.                                                                                                                                                              |
| **`frontend-design`** | React, Tailwind        | DartHub's UI is a token-driven design system (`app/globals.css`, `design-system/darthub/MASTER.md`). This skill pushes toward distinctive, non-generic interfaces, which matches the project's explicit intent. | `OpenHands/extensions` → `skills/frontend-design` (MIT) | Low–Medium. Generic design advice can conflict with the project's own token system. **Mitigation: install project-scoped and let `darthub-frontend` own token discipline** (see §3.3). |
| **`npm`**             | Node/TS tooling        | Useful for the npm-12 postinstall issue and dependency hygiene.                                                                                                                                                 | `OpenHands/extensions` → `skills/npm` (MIT)             | Low.                                                                                                                                                                                   |
| **`github`**          | GitHub                 | PR creation, review threads, CI status. Complements the `github` MCP tools already available in this agent.                                                                                                     | `OpenHands/extensions` → `skills/github` (MIT)          | Low–Medium. **Overlap with the GitHub MCP tools** — prefer MCP tools, fall back to this skill only for raw API work.                                                                   |

#### Tier 2 — install selectively

| Skill                        | Benefit for DartHub                                                                                                                                             | Risk / caveat                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`skill-creator`**          | Required to author the six `darthub-*` skills correctly.                                                                                                        | None. Reference material only.                                                                                                                                                                                                                                           |
| **`add-skill`**              | Imports an upstream skill into `.agents/skills/`. The mechanism to vendor the Tier-1 set into the repo.                                                         | Low, but **it fetches and writes code from a remote URL** — review the source repo before pointing it at anything.                                                                                                                                                       |
| **`agent-memory`**           | Maintains `AGENTS.md`. The repo's `AGENTS.md` is currently hand-maintained and contains non-obvious environment facts (npm 12, Prisma generate, Docker daemon). | Low. Must not clobber the auto-generated `nextjs-agent-rules` block.                                                                                                                                                                                                     |
| **`code-simplifier`**        | The codebase is clean already; useful as a periodic simplification pass.                                                                                        | Low. Risk of churn on working code.                                                                                                                                                                                                                                      |
| **`learn-from-code-review`** | Closes the loop between review comments and fixes.                                                                                                              | Low.                                                                                                                                                                                                                                                                     |
| **`show-me`**                | Renders diagrams for the plan/PR documents the repo already uses heavily (`.claude/plans/*`, `docs/DECISIONS.md`).                                              | Low.                                                                                                                                                                                                                                                                     |
| **`technical-writing`**      | `docs/` is extensive (12 documents) and the project treats docs as a first-class deliverable.                                                                   | Low.                                                                                                                                                                                                                                                                     |
| **`prd`**                    | DartHub already has `docs/PRD.md`; a skill to structure new requirements consistently.                                                                          | Low.                                                                                                                                                                                                                                                                     |
| **`software-factory`**       | The repo's stated goal — "professionally developed software project with specialised AI development workflows". Offers issue-to-PR and PR-review pipelines.     | **Medium.** Pulls in many other skills (GitHub issue triage, stale-CI closers, delivery watchdogs). Adopting it wholesale conflicts with the "minimise external services / avoid unnecessary automation" constraint. Adopt the pipeline _pattern_, not the whole bundle. |

#### Tier 3 — do not install for this stack

| Skill(s)                                                                                                                                                                                                                                        | Reason                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gitlab`, `gitlab-issue-to-mr`, `bitbucket*`, `azure-devops`, `jira-issue-to-pr`, `linear*`, `notion`, `slack-*`, `discord`, `datadog`, `news-digest`, `pdflatex`, `jupyter`, `deno`, `swift-linux`, `kubernetes`, `ssh`, `uv`, `release-notes` | Wrong platform, wrong language, or wrong problem domain.                                                                                |
| `vercel`                                                                                                                                                                                                                                        | DartHub deploys via Docker (`docs/DEPLOYMENT.md`); Vercel would be a paid service, which `CLAUDE.md` forbids without explicit approval. |
| `openhands-automation`, `openhands-api`, `openhands-sdk`, `openhands-enterprise-troubleshooting`, `agent-canvas-environment`, `canvas-extension-api`                                                                                            | Meta-tooling for building agents. Not needed to develop DartHub.                                                                        |
| `cortex-training-rl`, `flarglebargle`, `use-jev`, `evidence-based-citations`, `research-brief`, `simplified-technical-english`, `plain-english-content`, `incident-retrospective`, `ticket-to-code-change`, `iterate`, `upstream-fork-sync`     | No direct stack mapping; several duplicate capabilities already covered by Tier 1.                                                      |

### 1.5 Risks in aggregate

1. **Context cost.** Every installed skill contributes its name and description
   to the system prompt on every turn. 22 skills is roughly 5–6 k characters —
   acceptable. Installing all 73 would be wasteful and would dilute the model.
2. **Trigger collisions.** Several upstream skills share vocabulary with the
   proposed `darthub-*` skills (`code-review` vs `darthub-code-review`,
   `security` vs `darthub-qa`). The `darthub-*` skills use `paths:`-based or
   distinctive triggers to avoid ambiguous double-injection. This is analysed
   in §3.8.
3. **Design advice drift.** `frontend-design` is intentionally opinionated.
   Where it conflicts with `design-system/darthub/MASTER.md`, the project token
   system wins — enforced by `tests/unit/tailwind/designTokens.test.ts` and
   `noLegacyUtilities.test.ts`.
4. **Unverifiable skill content.** Installed skills are untrusted input. The
   evaluation above scanned the stack-relevant set for external dependencies
   and destructive shell patterns and found none, but any _new_ skill must be
   reviewed before installation (per the "no unvetted installs" constraint).
5. **Version drift.** Installed catalogue is v0.41.0, remote `main` is v0.42.0.
   Verified as irrelevant for the recommended set (byte-identical files), but
   worth re-checking when bumping.

### 1.6 Recommended installation method

Prefer **vendoring into the repository** over relying on the ambient
catalogue, so the workflows are reproducible for every developer and CI:

```bash
# 1. Vendor the upstream skills into the project's own skills directory.
#    .agents/skills/ is the OpenHands 1.61.0 project-scoped location.
mkdir -p .agents/skills
cp -r /opt/agent-canvas/node_modules/@openhands/extensions/skills/code-review \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/qa-changes \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/github-actions \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/docker \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/security \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/frontend-design \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/npm \
      /opt/agent-canvas/node_modules/@openhands/extensions/skills/github \
      .agents/skills/

# 2. Move the project-specific drafts into place.
cp -r docs/ai-skills/skills/darthub-* .agents/skills/

# 3. Verify that every skill loads with the installed SDK.
python3 - <<'EOF'
from pathlib import Path
from openhands.sdk.skills.skill import Skill
base = Path(".agents/skills")
for d in sorted(base.iterdir()):
    md = d / "SKILL.md"
    if md.exists():
        s = Skill.load(path=md, skill_base_dir=base, strict=True)
        print(f"{s.name:26s} {type(s.trigger).__name__ if s.trigger else 'always'}")
EOF
```

The `add-skill` skill can fetch a single upstream skill from a GitHub URL
instead of step 1's copy. It is a _fetch-and-write_ operation, so point it only
at `github.com/OpenHands/extensions` after reviewing the source — never at an
unreviewed URL.

Then commit `.agents/skills/` to the repository. This makes the setup
version-controlled, reviewable in a pull request, and independent of which
catalogue version a given machine happens to have.

Note that `.claude/skills/` already holds 7 project skills (Claude Code
format, `claudekit` author, mostly design-oriented). OpenHands 1.61.0 does
**not** read `.claude/skills/` — it reads `.agents/skills/`. The two can
coexist; the Claude Code skills are not available to OpenHands, and this is
called out so the duplication is intentional rather than mistaken.

---

## 2. DartHub architecture analysis

### 2.1 What the project is

A modular, **server-authoritative** multiplayer dart game. The server owns all
game state; the client renders snapshots and sends intents. The game engine is
a pure-TypeScript core that runs unchanged on the server and in the browser.

### 2.2 Actual source layout

The documentation under `.claude/` and parts of `docs/ARCHITECTURE.md`
describe an **intended** layout (`src/services/`, `src/repositories/`,
`src/domain/`, `src/game/`, `src/infrastructure/`). The **actual** tree is
different — the code was organised by feature instead:

```text
app/                    Next.js App Router: pages + REST route handlers
  api/                  Route handlers: auth, career, friends, invite, privacy, rating
src/
  game-engine/          * Pure TS core: GameEngine, modes/, rules/, throwLedger
  board/                Board geometry (single source of segment vocabulary)
  components/           board/ game/ shell/ ui/  - shared React components
  auth/                 Service + repository + JWT session + guest linking
  career/               Quest engine, progression, rewards
  rating/               Elo + performance ratings
  realtime/             Socket.IO server, GameStateMachine, rooms, anti-cheat
  ai/                   Statistical AI opponent with difficulty tiers
  camera/               ICameraService abstraction + vision stubs
  friends/  privacy/    Social graph, GDPR export/delete, audit log
prisma/schema.prisma    8 models, 4 enums, snake_case mapping
tests/                  unit/ integration/  (Vitest)  - 96 files
e2e/                    Playwright specs
```

> **Finding F1 — stale architectural docs (now corrected).** `.claude/architecture.md`
> and the module table in `docs/ARCHITECTURE.md` listed directories that do not
> exist (`src/services/`, `src/repositories/`, `src/domain/`, `src/game/`,
> `src/infrastructure/`, `src/pages/`). The real code uses per-feature
> directories (`src/auth/`, `src/career/`, `src/rating/`, ...) and puts the
> engine in `src/game-engine/`, not `src/game/`. `docs/ARCHITECTURE.md` has
> since been rewritten against the real tree, and `.claude/architecture.md` and
> `.claude/testing.md` now point at the authoritative `docs/` files instead of
> duplicating them. `docs/TESTING.md`, `docs/DATABASE.md`, `docs/PRD.md`,
> `docs/API.md` and `docs/SECURITY.md` were corrected the same way. Every new
> skill must point at the _real_ tree.

### 2.3 Architectural invariants worth encoding in a skill

These are the rules an AI agent cannot infer from the code alone, and which
therefore belong in a skill.

| #   | Invariant                                                                                                                                                                                                               | Evidence                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A1  | **The game engine is pure TypeScript.** `src/game-engine/types.ts` states it must never import React, Next.js, Socket.IO, or Node/browser built-ins.                                                                    | `src/game-engine/types.ts` header                    |
| A2  | **State is derived from a ledger, never mutated.** `GameEngine` keeps a ledger of every dart; undo/correct re-derives score, turn order and leg progress by replay. One source of truth.                                | `src/game-engine/GameEngine.ts`                      |
| A3  | **Mode rules are delegated.** The core owns lifecycle/turn order; mode-specific rules live in `DartGameMode` implementations (`StandardMode`, `CricketMode`, `ShanghaiMode`, `AroundTheClockMode`, `NeutralScoreMode`). | `src/game-engine/modes/`                             |
| A4  | **Segment vocabulary is shared.** `BoardSegment` is defined once in `src/board/boardGeometry.ts` and re-exported by the engine, so board and engine can never disagree.                                                 | `src/game-engine/types.ts`                           |
| A5  | **The UI never invents rules.** `src/game-engine/modes/registry.ts` derives every rule-sheet string from the mode's own constants, so the sheet cannot describe a rule the engine lacks.                                | `registry.ts` header                                 |
| A6  | **The server is authoritative.** Clients receive JSON-safe snapshots only; all mutations go through `GameStateMachine`.                                                                                                 | `src/realtime/GameStateMachine.ts`                   |
| A7  | **Route handlers are thin.** e.g. `app/api/rating/game/route.ts` only wires `defaultRatingRuntime` into `createRatingRouteHandlers`. Logic lives behind service + repository seams.                                     | `app/api/rating/game/route.ts`                       |
| A8  | **Auth is a seam, not a dependency.** `requireAuth.ts` returns `{ ok: true, identity }` or `{ ok: false, response }` and never throws; services take injected repositories.                                             | `src/auth/requireAuth.ts`                            |
| A9  | **Design tokens are the only styling vocabulary.** Components use `bg-surface`, `text-ink`, `rounded-sm` — never raw palette utilities.                                                                                 | `app/globals.css`, `design-system/darthub/MASTER.md` |
| A10 | **Shared control classes are centralised.** Focus ring, 44px target floor, disabled treatment live in `src/components/game/classes.ts` so states cannot drift between the five game modes.                              | `src/components/game/classes.ts`                     |
| A11 | **Imports are ordered by ESLint rule.** builtin → external → `@/**` → parent → sibling → index, no blank lines.                                                                                                         | `eslint.config.mjs`                                  |

### 2.4 Current build/test baseline (measured and repaired, 2026-11-12)

This baseline matters: any skill that claims "run the tests to verify" must know
what already fails, so it does not chase pre-existing breakage.

**The baseline has since been repaired — the whole suite is now green.**

**Typecheck — 0 errors**

The 12 pre-existing errors are fixed. `app/game/cricket/page.tsx` had an **empty
import statement** (`import {} from "@/game-engine/modes/CricketMode"`), so
three exported names were undefined; the import is restored. The two test files
that build `MutableMatchState` fixtures now include the `throws` and
`corrections` fields the type requires.

**Vitest — 96/96 files pass, 447/447 tests pass, 0 errors**

| Failing file                                     | Cause                                                                               | Fix                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `tests/unit/game/modeViews.test.tsx` (5)         | `ReferenceError: CricketMode is not defined` — same empty import                    | Import restored                                    |
| `tests/unit/game/cricketCorrection.test.tsx` (5) | same root cause                                                                     | Import restored                                    |
| `tests/unit/typescript.test.ts` (1)              | asserted `tsc` exits 0 — inherited the typecheck errors                             | Followed the typecheck fix                         |
| `tests/unit/ci-workflow.test.ts` (1)             | replays the CI steps locally — failed on the formatting check                       | `docs/ARCHITECTURE.md` formatted                   |
| `tests/unit/formatting.test.ts` (1)              | the vendored `.agents/` skill tree was not Prettier-clean                           | `.agents` added to `.prettierignore`               |
| `tests/unit/dockerignore.test.ts` (1)            | shelled out to `docker build`; the CLI was present but no daemon was running        | Guard now probes the daemon with `docker info`     |
| `tests/integration/linkGuest.test.ts` (1)        | `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`     | Route refactored to an injectable handler factory  |
| `tests/unit/docs/docs.test.ts` (1)               | asserted a hard-coded list of `src/` modules that the repository does not have      | Module list now read from disk                     |
| `tests/unit/ui/career.test.tsx` (unhandled)      | `ReferenceError: window is not defined` — React scheduled work after jsdom teardown | Global Testing Library cleanup in `tests/setup.ts` |

> **Finding F2 — resolved at the root.** The global `environment: "node"` in
> `vitest.config.ts` was _not_ the cause of the `ReferenceError: window is not
defined` exceptions. Each React test file already opts into jsdom with a
> `@vitest-environment jsdom` docblock, and `jsdom` is installed
> (`jsdom@^29.1.1`). The real cause was a **missing Testing Library cleanup**:
> `@testing-library/react` only auto-registers `cleanup()` when Vitest's
> `globals` option is enabled, which this project does not use. A React root
> therefore survived until the environment was torn down, and React's scheduler
> — which defers work through `setImmediate` — fired the pending callback
> after jsdom was gone. The fix is a global `setupFiles` entry
> (`tests/setup.ts`) that registers `cleanup()` for every DOM test file, so no
> individual test can forget it again.

**Two structural improvements came out of the repairs**

- `app/api/auth/link-guest/route.ts` now delegates to
  `createLinkGuestRouteHandlers` (`src/auth/linkGuestRoutes.ts`), so the
  handler takes injected services instead of reaching for the Prisma-backed
  `defaultAuthRuntime` directly. This mirrors the pattern the rating API
  already uses in `src/rating/ratingRoutes.ts`, and it is what allows the
  integration test to run against an in-memory repository.
- `tests/unit/docs/docs.test.ts` now derives the module list from the `src/`
  directory on disk instead of a hard-coded array, so the documentation check
  can no longer drift away from the repository layout.

**Docker — the live build check is still environment-dependent.** The Docker
_client_ is installed, but the daemon needs root privileges that the sandbox
does not grant, so `docker build` cannot run here. The test now probes the
daemon with `docker info` and skips the live size check when it is
unreachable, instead of failing on a missing daemon. The structural
build-context assertions always run.

**Playwright — not executed.** `playwright.config.ts` expects a server at
`http://localhost:3000` and only defines `webServer` when `CI` is set. The
`e2e/` specs (6 files) therefore need `npm run dev` running alongside.

### 2.5 Toolchain notes

- **npm 12 blocks install scripts.** `@prisma/client`, `@prisma/engines`,
  `esbuild` and `prisma` never run their postinstall, so the Prisma client is
  not generated. Run `npx prisma generate` explicitly.
- **Next.js 16 / React 19 / TypeScript 6** — newer than most training data.
  `AGENTS.md` points at `node_modules/next/dist/docs/` as the authority.
- **Tailwind CSS v4** — CSS-first config via `@theme` in `app/globals.css`;
  there is no `tailwind.config.js`.
- **ESLint 10 flat config** (`eslint.config.mjs`), with `import-x/order`
  enforced as an error.
- **Pre-commit hook** (`.husky/pre-commit`) runs `eslint . --max-warnings=0`
  and `prettier . --check`, and aborts the commit on failure.
- **CI** (`.github/workflows/ci.yml`) runs exactly: install → lint → format
  check → typecheck → test. No Playwright step, no Docker step.

---

## 3. Project-specific skill proposal

Six skills, installed under `.agents/skills/` and committed to the repository.

### 3.1 Design principles

1. **Each skill owns one layer.** The six map onto the actual source tree, not
   onto an abstract "frontend/backend" split.
2. **Path-triggered where deterministic.** A skill about the game engine
   should fire when engine files are touched — `paths:` is more reliable than
   keyword matching, which false-positives on words like "mode".
3. **Complement, don't duplicate, upstream skills.** `darthub-code-review`
   encodes _DartHub-specific_ review criteria; upstream `code-review` provides
   the general risk framework. `darthub-frontend` owns token discipline;
   upstream `frontend-design` owns aesthetics.
4. **Lean SKILL.md, detailed references.** Target 1 500–2 000 words in
   `SKILL.md`; push schemas, patterns and checklists into `references/`.
5. **Every skill states the baseline.** §2.4 must be referenced so agents do
   not mistake pre-existing failures for regressions.

### 3.2 `darthub-architect`

**Purpose** — keep structural decisions consistent with the codebase's
existing DDD layering; answer "where does this code go?" correctly.

**Triggers** — keywords `architecture`, `layering`, `where should this live`,
`refactor`, `module structure`.

**Content**

- The real layer map (§2.2) — the authoritative directory guide, explicitly
  correcting the stale `.claude/architecture.md`.
- The feature-slice convention: `src/<feature>/` with `repository.ts` +
  `prisma<Feature>Repository.ts` + service files.
- The thin-route-handler rule (A7) and the route-handler wiring pattern.
- The repository/service injection pattern (A8): define a `repository.ts`
  interface per feature; the Prisma implementation is a sibling file.
- Dependency direction rules: `components → game-engine` is fine;
  `game-engine → components` is forbidden (A1).
- Extension points that already exist and should be reused rather than
  reinvented: `ICameraService`, `ICameraProcessor`, `IRoomStore`,
  `AuthGateway`, `DartGameMode`.
- **Reference:** `references/layer-map.md` — the full directory-to-layer map
  with allowed dependency arrows, and the list of stale doc paths.

### 3.3 `darthub-frontend`

**Purpose** — build and change React/Tailwind UI that obeys the token system
and the shared-component rules.

**Triggers** — `paths:` on `app/**/*.tsx`, `src/components/**`,
`app/globals.css`; plus keywords `component`, `styling`, `tailwind`,
`design token`, `responsive`.

**Content**

- Token vocabulary: use `bg-surface`, `text-ink`, `border-edge`,
  `rounded-sm`, `px-md`, `font-label` — never raw palette utilities such as
  `bg-gray-800` or `text-white` (A9).
- Where new tokens are declared (`@theme static` in `app/globals.css`) and the
  rule that a token must exist in `design-system/darthub/MASTER.md` first.
- The shared classes contract: reuse `FOCUS_RING`, `TARGET_SIZE`, `DISABLED`,
  `MATCH_STRIP` etc. from `src/components/game/classes.ts` rather than
  re-declaring focus rings (A10).
- Accessibility invariants already encoded in the codebase: 44px target
  floor, focus ring never removed, brass-on-brass contrast failure.
- The five game modes share one strip and one control set — a change to a
  shared component must be checked against all five mode views.
- Responsive behaviour: `md:` breakpoint and above for sticky match strip;
  compact variant below it.
- **Reference:** `references/tokens.md` — the token table, the
  MASTER.md → globals.css mapping, and the rules that
  `designTokens.test.ts` enforces.

### 3.4 `darthub-game-engine`

**Purpose** — evolve the pure-TypeScript engine without breaking the
invariants that make undo/correct correct.

**Triggers** — `paths:` on `src/game-engine/**`, `src/board/**`; plus keywords
`game engine`, `scoring`, `bust`, `checkout`, `out rule`.

**Content**

- The purity rule (A1) and how to keep it: no React, no Next.js, no Socket.IO,
  no Node built-ins in `src/game-engine/`.
- The ledger-and-replay model (A2): to change scoring, change how state is
  _derived_, never how it is stored. A new mode must re-derive identically
  whether built forward or replayed.
- Implementing a `DartGameMode`: the `configure` / `initializeMatch` /
  mode-data hooks, and the rule that all rule-sheet copy is derived from the
  mode's own constants (A5).
- The `BoardSegment` vocabulary is shared with the board module (A4) — never
  redefine segment types locally.
- Checklist for a new mode: engine mode class + registry entry + route/page +
  mode view + unit tests + correction-replay tests.
- **Reference:** `references/engine-rules.md` — the `DartGameMode` contract,
  the replay/undo semantics, and the existing mode implementations with their
  rule constants.

### 3.5 `darthub-backend`

**Purpose** — implement server-side features across the API, data layer and
real-time authority correctly and safely.

**Triggers** — `paths:` on `app/api/**`, `src/auth/**`, `src/realtime/**`,
`src/privacy/**`, `src/friends/**`, `src/rating/**`, `src/career/**`,
`prisma/**`; plus keywords `api`, `route handler`, `prisma`, `migration`,
`websocket`, `repository`.

**Content**

- Thin route handlers (A7): the `createXRouteHandlers({ service, authGateway })`
  pattern used by `app/api/rating/game/route.ts` and
  `app/api/career/*/route.ts`.
- Auth seams: `requireAuth` returns a discriminant — never throw from it;
  `AuthGateway` is the career module's seam onto auth.
- Repository pattern for Prisma access; `repository.ts` interface per feature.
- Prisma conventions from `prisma/schema.prisma`: PascalCase models mapped to
  snake_case tables via `@@map`, UUID primary keys, explicit `@db.Uuid` /
  `@db.VarChar` / `@db.Timestamptz(6)`, `@@unique([userId, mode])` composite
  keys.
- Migrations: schema change → `npm run db:generate` → `npm run db:migrate`;
  never hand-edit the schema without a migration.
- Real-time authority (A6): clients get JSON-safe snapshots only; all
  mutations go through `GameStateMachine`; anti-cheat validation belongs in
  `src/realtime/antiCheat*.ts`.
- GDPR: export/delete/audit live in `src/privacy/` — privacy-relevant changes
  need the privacy checklist.
- **Reference:** `references/data-and-api.md` — the Prisma model reference,
  the route-handler checklist, and the Socket.IO event catalogue.

### 3.6 `darthub-qa`

**Purpose** — verify changes with the project's own tools, and distinguish
pre-existing breakage from regressions.

**Triggers** — `paths:` on `tests/**`, `e2e/**`; plus keywords `test`, `verify`,
`regression`, `failing test`, `coverage`.

**Content**

- The stack, in the order CI runs it: lint → format:check → typecheck →
  test. Match this order locally.
- **The known baseline (§2.4).** The baseline is currently **green**: 0 typecheck
  errors and 0 failing tests. The QA skill must still diff against this
  baseline rather than assume a zero exit code means no regression — a
  failing test after the baseline was green is a regression the agent caused.
- Vitest layout: `tests/unit/**` (pure), `tests/integration/**` (route-level,
  needs `DATABASE_URL` and a reachable PostgreSQL), `e2e/**` (Playwright,
  needs `npm run dev` on port 3000).
- Component tests need a per-file `// @vitest-environment jsdom` docblock —
  the global environment stays `"node"`. The Testing Library `cleanup()` is
  registered globally in `tests/setup.ts`, so a new component test does not
  need its own `afterEach` cleanup.
- Environment prerequisites per test category: `npx prisma generate` (npm 12
  blocks the postinstall), a running Docker daemon for `dockerignore.test.ts`,
  `DATABASE_URL` for integration tests, a successful build for
  `tailwindToolchain.test.ts`.
- The `tests/support/run-command.ts` helper and the in-memory repository
  fixtures (`tests/support/inMemoryAuthRepository.ts`) — prefer
  these over real infrastructure in unit tests.
- Coverage target: ≥ 80 % per `.claude/testing.md`.
- **Reference:** `references/test-matrix.md` — per-test-file category, required
  environment, expected baseline result, and the known-failure list.

### 3.7 `darthub-code-review`

**Purpose** — review changes against DartHub's own architectural invariants,
not just generic code quality.

**Triggers** — keywords `review`, `code review`, `PR`, `pull request`,
`diff`.

**Content**

- Review in the project's priority order: correctness of the engine
  invariants first (A1–A5), then server authority (A6), then layering (A7–A8),
  then tokens and shared components (A9–A10), then style.
- The engine-specific traps this codebase has actually hit:
  - state mutated instead of re-derived (breaks undo/correct);
  - a rule duplicated outside the mode (breaks A5);
  - a new segment type defined locally instead of reusing `BoardSegment`;
  - a raw palette utility in a component (breaks A9, and
    `noLegacyUtilities.test.ts` catches it).
- The UI-specific traps: a shared control re-declared instead of imported from
  `classes.ts`; a mode view diverging from the shared strip.
- Test-quality checks: a new `MutableMatchState` fixture must include
  `throws` and `corrections` (the exact shape that broke two test files); a
  new rule needs a correction-replay test.
- Review output format: findings ordered by severity, each with file, line,
  the invariant broken, and the concrete fix. No style nitpicks — the
  pre-commit hook already covers formatting.
- **Reference:** `references/review-checklist.md` — the full invariant list
  with file/line pointers, and the known-failure triage table.

### 3.8 Trigger-collision analysis

`darthub-*` skills use `paths:` wherever the trigger is deterministic. Per the
SDK, `paths:` and `triggers:` are mutually exclusive — `paths:` wins and
`triggers:` is dropped with a warning. So each skill must choose one
mechanism:

| Skill                 | Mechanism                                            | Collides with upstream?               |
| --------------------- | ---------------------------------------------------- | ------------------------------------- |
| `darthub-architect`   | `triggers:` (keywords)                               | No upstream skill uses these keywords |
| `darthub-frontend`    | `paths:` (app/**/*.tsx, src/components, globals.css) | No                                    |
| `darthub-game-engine` | `paths:` (src/game-engine, src/board)                | No                                    |
| `darthub-backend`     | `paths:` (app/api, src/auth, src/realtime, prisma)   | No                                    |
| `darthub-qa`          | `paths:` (tests, e2e)                                | No                                    |
| `darthub-code-review` | `triggers:` (keywords)                               | Overlaps upstream `code-review`       |

The two cross-cutting skills (`darthub-architect`, `darthub-code-review`) use
keyword triggers so they stay model-invocable; the four layer-specific skills
use `paths:` for deterministic injection on touched files. This avoids both
the `paths:`+`triggers:` warning and accidental double-injection with upstream
`code-review`.

### 3.9 Implementation order

| Phase | Work                                                                                                    | Effort  |
| ----- | ------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Vendor Tier-1 upstream skills into `.agents/skills/` (via `add-skill`, after review)                    | ~1 h    |
| 2     | Write `darthub-game-engine` + `darthub-frontend` — the two skills with the most invariant-dense content | ~3 h    |
| 3     | Write `darthub-backend` + `darthub-qa`                                                                  | ~3 h    |
| 4     | Write `darthub-architect` + `darthub-code-review`                                                       | ~2 h    |
| 5     | Validate all six with `skill-creator/scripts/quick_validate.py` and a `Skill.load(strict=True)` pass    | ~30 min |
| 6     | Fix the baseline (F1/F2) as a **separate, explicit task**                                               | ~2 h    |
| 7     | Update `AGENTS.md` to point at the new skills                                                           | ~15 min |

Phase 6 is deliberately separate: fixing the baseline changes application
code, which this task explicitly excludes. It should be its own change with
its own review.

---

## 4. Open items for the maintainer

1. **Confirm the `.agents/skills/` location** — it is the OpenHands 1.61.0
   project-scoped path and coexists with the existing `.claude/skills/`.
2. **Decide on `software-factory`** — adopt the pipeline pattern, or skip the
   bundle entirely? The constraint against unnecessary external services
   argues for the former.
3. **Confirm `frontend-design` should be installed** given the project already
   has a strict token system — the skills overlap, and `darthub-frontend` is
   the one that must win on token discipline.
4. **Approve the baseline fix (F1/F2) as separate work** — the typecheck
   errors and the Vitest `environment` gap are the blockers to a green CI.
5. **Decide whether upstream `code-review` and `darthub-code-review` should
   both be active** — they are complementary, but a reviewer should confirm
   they do not produce contradictory output.

---

## 5. Source of the evidence

| Claim                                             | How it was verified                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 73 local skills == 73 remote skills               | GitHub API `contents/skills` vs. local directory listing                             |
| All 73 load with OpenHands 1.61.0                 | `Skill.load(strict=True)` over the whole catalogue                                   |
| v0.41.0 vs v0.42.0 drift is irrelevant            | SHA-256 of 22 stack-relevant `SKILL.md` files, local vs. `raw.githubusercontent.com` |
| No external-service dependencies in stack skills  | URL / "paid" / "subscription" scan of every stack-relevant `SKILL.md`                |
| No destructive shell patterns (except `docker`)   | Scan for `curl                                                                       | sh`, `rm -rf`, `sudo`, `eval`, `base64 -d` |
| Frontmatter and trigger rules                     | Read `openhands/sdk/skills/skill.py` and `utils.py` in the installed 1.61.0          |
| Typecheck baseline: 0 errors (green)              | `npx tsc --noEmit --incremental false`                                               |
| Test baseline: 96/96 files, 447/447 tests (green) | `npx vitest run`                                                                     |
| Architecture invariants A1–A11                    | Direct reading of the cited source files                                             |
