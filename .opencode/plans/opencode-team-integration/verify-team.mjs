#!/usr/bin/env node
/**
 * Static verification of the DartHub OpenCode agent team.
 *
 * Every claim this script prints is derived from two sources:
 *   1. the files under `.opencode/` (agents, skills, commands, configuration)
 *   2. `opencode debug agents` / `opencode debug config` — the output the
 *      OpenCode runtime itself produces in this project directory, including
 *      the MERGED permission list it enforces.
 *
 * The permission resolution implements the documented semantics of
 * https://opencode.ai/docs/permissions/ :
 *   - rules are combined in order and the LAST matching rule wins
 *   - agent rules are appended after the project-wide rules
 *   - a shell pattern ending in " *" also matches the command without arguments
 *   - an operation checking several resources is denied if any of them is denied
 *   - no matching rule at all means "ask"
 *
 * Usage:  node .opencode/plans/opencode-team-integration/verify-team.mjs
 * Exit code 0 = every check passed, 1 = at least one check failed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const OPENCODE_BIN = process.env.OPENCODE_BIN ?? "/home/administrator/.opencode/bin/opencode";

/** The seven project agents, with the mode each `.md` file declares. */
const EXPECTED_AGENTS = {
  orchestrator: "all",
  architect: "subagent",
  backend: "subagent",
  frontend: "subagent",
  "game-engine": "subagent",
  "qa-engineer": "subagent",
  "code-reviewer": "subagent",
};

/** The six project skills. */
const EXPECTED_SKILLS = [
  "project-planning",
  "dart-game-engine",
  "frontend-development",
  "backend-development",
  "testing",
  "code-review",
];

const failures = [];

function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

function read(file) {
  return readFileSync(join(ROOT, file), "utf8");
}

/** Parse a Markdown file's YAML frontmatter. Returns null when there is none. */
function frontmatter(file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(read(file));
  if (!match) return null;
  try {
    return YAML.parse(match[1]);
  } catch {
    return undefined; // present but unparseable
  }
}

/** Strip JSONC comments and trailing commas so the text can be parsed as JSON. */
function toJson(text) {
  let out = "";
  let inString = false;
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += text[i + 1] ?? "";
        i++;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      out += char;
      continue;
    }
    if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (char === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += char;
  }
  // Remove the trailing commas JSONC allows but JSON does not.
  let cleaned = "";
  inString = false;
  quote = "";
  for (let i = 0; i < out.length; i++) {
    const char = out[i];
    if (inString) {
      cleaned += char;
      if (char === "\\") {
        cleaned += out[i + 1] ?? "";
        i++;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      cleaned += char;
      continue;
    }
    if (char === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === "}" || out[j] === "]") continue;
    }
    cleaned += char;
  }
  return cleaned;
}

/** Wildcard match on the whole value, as OpenCode documents it. */
function matches(pattern, value) {
  const build = (text) =>
    new RegExp(
      "^" +
        text
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".") +
        "$",
      "i",
    );
  if (build(pattern).test(value)) return true;
  // A shell pattern ending in " *" also matches the command without arguments.
  if (pattern.endsWith(" *")) return build(pattern.slice(0, -2)).test(value);
  return false;
}

/** The effective decision for one action/resource pair. */
function decide(rules, action, resource) {
  let effect = "ask";
  let decisive = null;
  for (const rule of rules) {
    if (rule.action !== action && rule.action !== "*") continue;
    if (!matches(rule.resource, resource)) continue;
    effect = rule.effect;
    decisive = rule;
  }
  return { effect, decisive };
}

function opencode(args) {
  return execFileSync(OPENCODE_BIN, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * The agent registry, read from the runtime.
 *
 * The OpenCode background service reloads its configuration when the project
 * changes. During a reload it can answer with the built-in agents only, while
 * `opencode debug config` already reports the project configuration. That is a
 * transient of the runtime, not a defect of the team, so the read is retried
 * before it is believed.
 */
function readAgents() {
  const expected = new Set(Object.keys(EXPECTED_AGENTS));
  let last = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = JSON.parse(opencode(["debug", "agents"]));
    const ids = new Set(last.map((agent) => agent.id));
    if ([...expected].every((id) => ids.has(id))) return last;
    if (attempt < 3) {
      console.log(
        `  … the runtime returned ${last.length} agents without the project team (attempt ${attempt}/3); retrying`,
      );
      execFileSync("sleep", ["2"]);
    }
  }
  return last;
}

console.log(`DartHub OpenCode team verification`);
console.log(`repository : ${ROOT}`);
console.log(`opencode   : ${OPENCODE_BIN}`);
console.log("");

if (!existsSync(OPENCODE_BIN)) {
  console.error(`opencode binary not found at ${OPENCODE_BIN}; set OPENCODE_BIN`);
  process.exit(1);
}

// ---------------------------------------------------------------- 1. agents
console.log("1. Agent registry (source: `opencode debug agents`)");
const agents = readAgents();
const byId = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

for (const [id, mode] of Object.entries(EXPECTED_AGENTS)) {
  const agent = byId[id];
  check(
    `agent "${id}" exists with mode "${mode}"`,
    agent?.mode === mode,
    agent ? `-> resolved mode "${agent.mode}"` : "-> NOT RESOLVED",
  );
}
const resolvedProjectAgents = agents
  .map((agent) => agent.id)
  .filter(
    (id) => !["build", "compaction", "explore", "general", "plan", "summary", "title"].includes(id),
  );
check(
  "exactly seven project agents are registered",
  resolvedProjectAgents.length === 7,
  `-> ${resolvedProjectAgents.sort().join(", ")}`,
);

// ------------------------------------------------- 2. declared vs resolved
console.log("");
console.log("2. Declared mode in `.opencode/agents/*.md` vs. the resolved mode");
for (const id of Object.keys(EXPECTED_AGENTS).sort()) {
  const declared = frontmatter(`.opencode/agents/${id}.md`);
  const resolved = byId[id]?.mode;
  check(
    `${id}: declared "${declared?.mode}" === resolved "${resolved}"`,
    declared?.mode === resolved,
  );
}

// ---------------------------------------------------------------- 3. skills
console.log("");
console.log("3. Skills (`.opencode/skills/<id>/SKILL.md`)");
for (const id of EXPECTED_SKILLS) {
  const file = `.opencode/skills/${id}/SKILL.md`;
  if (!existsSync(join(ROOT, file))) {
    check(`skill "${id}" has a SKILL.md`, false, `-> MISSING ${file}`);
    continue;
  }
  const meta = frontmatter(file);
  if (meta === undefined) {
    check(`skill "${id}" has valid YAML frontmatter`, false, "-> INVALID YAML");
    continue;
  }
  const ok =
    meta !== null &&
    typeof meta.name === "string" &&
    meta.name.length > 0 &&
    typeof meta.description === "string" &&
    meta.description.length > 0;
  check(
    `skill "${id}" has valid YAML frontmatter (name + description)`,
    ok,
    `-> name="${meta?.name}"`,
  );
}

// -------------------------------------------------------------- 4. commands
console.log("");
console.log("4. Commands (`.opencode/commands/*.md`)");
for (const id of ["start-feature", "execute-plan", "review", "release-check"]) {
  const file = `.opencode/commands/${id}.md`;
  if (!existsSync(join(ROOT, file))) {
    check(`command "${id}" exists`, false, `-> MISSING ${file}`);
    continue;
  }
  const meta = frontmatter(file);
  check(
    `command "${id}" has frontmatter with description + agent`,
    !!meta && typeof meta.description === "string" && typeof meta.agent === "string",
    `-> agent="${meta?.agent}"`,
  );
}

// ------------------------------------------------------- 5. configuration
console.log("");
console.log("5. Configuration (`.opencode/opencode.jsonc`)");
let config = null;
try {
  config = JSON.parse(toJson(read(".opencode/opencode.jsonc")));
  check("opencode.jsonc is valid JSONC", true, `-> ${Object.keys(config).join(", ")}`);
} catch (error) {
  check("opencode.jsonc is valid JSONC", false, `-> ${error.message}`);
}
check(
  'opencode.jsonc declares default_agent "orchestrator"',
  config?.default_agent === "orchestrator",
  `-> ${JSON.stringify(config?.default_agent)}`,
);
const runtimeConfig = JSON.parse(opencode(["debug", "config"])).find((entry) =>
  entry.path?.endsWith(".opencode/opencode.jsonc"),
);
check(
  "the runtime loaded the project configuration",
  !!runtimeConfig && runtimeConfig.info?.default_agent === "orchestrator",
  `-> ${runtimeConfig?.path ?? "NOT LOADED"}`,
);

// ------------------------------------------------------- 6. permissions
console.log("");
console.log("6. Effective permissions (last matching rule wins)");

const architect = byId["architect"]?.permissions ?? [];
check('architect: edit "*" is denied', decide(architect, "edit", "src/x.ts").effect === "deny");
check(
  'architect: edit "docs/*" is allowed',
  decide(architect, "edit", "docs/DECISIONS.md").effect === "allow",
);
check(
  'architect: edit ".opencode/plans/*" is allowed',
  decide(architect, "edit", ".opencode/plans/x/_plan.md").effect === "allow",
);
check(
  'architect: the project-wide "edit *.env.example" allow is overridden by the later deny',
  decide(architect, "edit", ".env.example").effect === "deny",
);
check('architect: shell "*" is denied', decide(architect, "shell", "rm -rf src").effect === "deny");
check(
  "architect: shell redirection is denied",
  decide(architect, "shell", "echo x > src/foo.ts").effect === "deny",
);

const reviewer = byId["code-reviewer"]?.permissions ?? [];
check('code-reviewer: edit "*" is denied', decide(reviewer, "edit", "src/x.ts").effect === "deny");
// The project-wide rule allows `edit *.env.example`, but the agent's own
// `edit *` deny is appended later and therefore wins — so no write is allowed.
const reviewerEditAllows = reviewer.filter(
  (rule) => rule.action === "edit" && rule.effect === "allow",
);
check(
  'code-reviewer: the only edit allow in the merged list is "*.env.example"',
  reviewerEditAllows.every((rule) => rule.resource === "*.env.example"),
  `-> ${reviewerEditAllows.map((rule) => rule.resource).join(", ") || "(none)"}`,
);
check(
  'code-reviewer: every write is denied, ".env.example" included',
  [".env.example", "docs/DECISIONS.md", "src/x.ts"].every(
    (path) => decide(reviewer, "edit", path).effect === "deny",
  ),
);
check(
  'code-reviewer: shell "*" is denied',
  decide(reviewer, "shell", "rm -rf src").effect === "deny",
);
check(
  "code-reviewer: shell redirection is denied",
  decide(reviewer, "shell", "echo x > src/foo.ts").effect === "deny",
);
check(
  'code-reviewer: read ".env.example" stays allowed',
  decide(reviewer, "read", ".env.example").effect === "allow",
);
check(
  'code-reviewer: read ".env" asks for consent',
  decide(reviewer, "read", ".env").effect === "ask",
);

const orchestrator = byId["orchestrator"]?.permissions ?? [];
const team = Object.keys(EXPECTED_AGENTS).filter((id) => id !== "orchestrator");
for (const id of team) {
  check(
    `orchestrator: may launch "${id}"`,
    decide(orchestrator, "subagent", id).effect === "allow",
  );
}
for (const id of ["build", "plan", "title", "summary", "compaction", "orchestrator"]) {
  check(
    `orchestrator: may NOT launch "${id}"`,
    decide(orchestrator, "subagent", id).effect === "deny",
  );
}
const extra = orchestrator
  .filter((rule) => rule.action === "subagent" && rule.effect === "allow")
  .map((rule) => rule.resource)
  .filter((id) => !team.includes(id));
console.log(
  `  NOTE  orchestrator may additionally launch: ${extra.length ? extra.join(", ") : "(none)"}`,
);
for (const command of [
  "git reset --hard HEAD",
  "git clean -fd",
  "git restore .",
  "git checkout -- .",
]) {
  check(
    `orchestrator: "${command}" is denied`,
    decide(orchestrator, "shell", command).effect === "deny",
  );
}
check(
  'orchestrator: "git push origin main" asks for consent',
  decide(orchestrator, "shell", "git push origin main").effect === "ask",
);

// ------------------------------------------------------------- 7. outcome
console.log("");
console.log(`checks failed: ${failures.length}`);
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("RESULT: the DartHub agent team is configured as declared.");
