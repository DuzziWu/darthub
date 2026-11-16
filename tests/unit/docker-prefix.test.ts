import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { runCommand } from "../support/run-command";

/**
 * The directory the deployment files are read from.
 *
 * `DARTHUB_ROOT` points the assertions at another directory. That is how the
 * test is replayed against the state before the fix: the old files are copied
 * into a temporary directory, that directory becomes the root, and the very
 * same assertions have to fail. The default is the repository itself.
 */
const REPO_ROOT = resolve(process.env["DARTHUB_ROOT"] ?? resolve(import.meta.dirname, "../.."));

/** One Dockerfile instruction. */
type Instruction = {
  keyword: string;
  value: string;
};

/** One stage of a Dockerfile. */
type Stage = {
  name: string;
  instructions: Instruction[];
};

type ComposeService = {
  build?: {
    context?: string;
    dockerfile?: string;
    target?: string;
    args?: Record<string, string>;
  };
};

type ComposeFile = {
  services?: Record<string, ComposeService>;
};

/**
 * The logical lines of a Dockerfile: comments and blank lines removed,
 * continuation lines joined.
 */
const logicalLines = (source: string): string[] => {
  const lines: string[] = [];
  let pending = "";
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    pending = pending ? `${pending} ${line}`.trim() : line;
    if (pending.endsWith("\\")) {
      pending = pending.slice(0, -1).trim();
      continue;
    }
    lines.push(pending);
    pending = "";
  }
  if (pending) lines.push(pending);
  return lines.filter((line) => line.length > 0 && !line.startsWith("#"));
};

/** Splits a Dockerfile into its stages and their instructions. */
const parseDockerfile = (source: string): Stage[] => {
  const stages: Stage[] = [];
  let current: Stage | undefined;

  for (const line of logicalLines(source)) {
    const match = /^([A-Za-z]+)\s+(.*)$/.exec(line);
    if (!match) continue;

    const keyword = (match[1] ?? "").toUpperCase();
    const value = (match[2] ?? "").trim();

    if (keyword === "FROM") {
      current = { name: /\bAS\s+(\S+)$/i.exec(value)?.[1] ?? "", instructions: [] };
      stages.push(current);
      continue;
    }

    current?.instructions.push({ keyword, value });
  }

  return stages;
};

/** The stage that compiles the application. */
const builderStage = (stages: Stage[]): Stage => {
  const stage = stages.find((candidate) =>
    candidate.instructions.some(
      (instruction) => instruction.keyword === "RUN" && instruction.value.includes("npm run build"),
    ),
  );
  if (!stage) throw new Error("the Dockerfile has no stage that runs `npm run build`");
  return stage;
};

/**
 * The value an environment variable has at a given point of a stage.
 *
 * Only `ENV` assignments count: an `ARG` declares a build argument, which is
 * not an environment variable until something exports it. The last assignment
 * before the instruction wins, which is how Docker resolves it.
 */
const envValueAt = (stage: Stage, index: number, name: string): string | undefined => {
  let value: string | undefined;
  for (const instruction of stage.instructions.slice(0, index)) {
    if (instruction.keyword !== "ENV") continue;
    const match = new RegExp(`^${name}\\s*=\\s*(.*)$`).exec(instruction.value);
    if (match) value = (match[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
  }
  return value;
};

/** The index of the `ARG` that declares a build argument, or -1. */
const argIndex = (stage: Stage, name: string): number =>
  stage.instructions.findIndex(
    (instruction) =>
      instruction.keyword === "ARG" &&
      (instruction.value === name ||
        instruction.value.startsWith(`${name}=`) ||
        instruction.value.startsWith(`${name} `)),
  );

/** The default an `ARG` declares, `null` for none, `undefined` for undeclared. */
const argDefault = (stage: Stage, name: string): string | null | undefined => {
  for (const instruction of stage.instructions) {
    if (instruction.keyword !== "ARG") continue;
    if (instruction.value.startsWith(`${name}=`)) {
      return instruction.value
        .slice(name.length + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
    }
    if (instruction.value === name || instruction.value.startsWith(`${name} `)) return null;
  }
  return undefined;
};

const dockerfileSource = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf-8");
const stages = parseDockerfile(dockerfileSource);
const builder = builderStage(stages);

const buildIndex = builder.instructions.findIndex(
  (instruction) => instruction.keyword === "RUN" && instruction.value.includes("npm run build"),
);
const gateIndex = builder.instructions.findIndex(
  (instruction) =>
    instruction.keyword === "RUN" && instruction.value.includes("scripts/check-asset-prefix.mjs"),
);

/**
 * The published app answers with Next.js' error page for every user when the
 * image is built without the path prefix it is published under: the asset URLs
 * carry no prefix, the proxy strips the prefix from the path it forwards, the
 * asset requests find no mount and answer 404, and the page arrives unstyled
 * and unhydrated.
 *
 * The prefix is read when `next.config.ts` loads, so it has to be in the
 * environment of the build — and the gate that catches a build without the
 * prefix reads the same variable. Both were broken: the build never got the
 * prefix and the gate ran without it, which made it check against `/_next/`
 * and pass unconditionally. A disarmed guard is worse than no guard.
 *
 * These assertions are about the files, not about a built image: the defect
 * was in the deployment configuration, and the configuration is what has to
 * hold.
 */
describe("the Docker build carries the path prefix", () => {
  it("declares BASE_PATH as a build argument in the builder stage", () => {
    expect(
      argIndex(builder, "BASE_PATH"),
      "the builder stage must declare BASE_PATH as an ARG — otherwise the prefix cannot be passed in at all",
    ).toBeGreaterThanOrEqual(0);

    // The default is empty: without a prefix the image is built for the root,
    // which is what the existing deployments expect.
    expect(
      argDefault(builder, "BASE_PATH"),
      "BASE_PATH must default to an empty prefix, so an unset build argument stays a root build",
    ).toBe("");
  });

  it("exports the prefix to the build, not only declares it", () => {
    const declared = argIndex(builder, "BASE_PATH");
    const exported = builder.instructions.findIndex(
      (instruction) => instruction.keyword === "ENV" && /^BASE_PATH\s*=/.test(instruction.value),
    );

    expect(
      exported,
      "the builder stage must export BASE_PATH as an ENV — an ARG alone is invisible to `next build`",
    ).toBeGreaterThanOrEqual(0);
    expect(exported, "the ENV has to come after the ARG it exports").toBeGreaterThan(declared);
    expect(
      exported,
      "the ENV has to come before `npm run build`, because next.config.ts reads it when it loads",
    ).toBeLessThan(buildIndex);

    // The exported value has to be the build argument, not a literal: a
    // literal would ignore the prefix the caller passed in.
    expect(
      envValueAt(builder, buildIndex, "BASE_PATH"),
      "the build must see the build argument's value",
    ).toBe("${BASE_PATH}");
  });

  it("runs the prefix gate with the same prefix the build used", () => {
    expect(
      gateIndex,
      "the builder stage must run scripts/check-asset-prefix.mjs as a build gate",
    ).toBeGreaterThanOrEqual(0);
    expect(gateIndex, "the gate has to run after the build it checks").toBeGreaterThan(buildIndex);

    const atBuild = envValueAt(builder, buildIndex, "BASE_PATH");
    const atGate = envValueAt(builder, gateIndex, "BASE_PATH");

    expect(
      atGate,
      "the gate must inherit BASE_PATH from the build stage — the script reads it from process.env.BASE_PATH",
    ).toBeDefined();
    expect(
      atGate,
      "the gate must inherit the prefix the build used — the script reads it from process.env.BASE_PATH",
    ).toBe(atBuild);
    expect(
      atGate,
      "a gate that runs without a prefix checks against /_next/ and can never fail: that is a disarmed guard",
    ).not.toBe("");
  });

  it("passes the prefix through in docker-compose.yml", () => {
    const compose = parse(
      readFileSync(join(REPO_ROOT, "docker-compose.yml"), "utf-8"),
    ) as ComposeFile;
    const app = compose.services?.["app"];
    const args = app?.build?.args;

    expect(app?.build, "the app service must build from the repository Dockerfile").toMatchObject({
      context: ".",
      dockerfile: "Dockerfile",
    });
    expect(args, "the app service must pass BASE_PATH as a build argument").toBeDefined();

    const raw = String(args?.["BASE_PATH"]);
    expect(raw, "the build argument must carry the prefix from the environment").toMatch(
      /^\$\{BASE_PATH(?::-([^}]*))?\}$/,
    );

    // The default stays the root build: existing deployments keep working
    // unchanged, and the prefixed build is an explicit switch.
    const fallback = /^\$\{BASE_PATH:-([^}]*)\}$/.exec(raw)?.[1];
    expect(
      fallback ?? "",
      "the default build argument must be an empty prefix — the root build is the default",
    ).toBe("");
  });
});

/**
 * The gate itself: it is the thing that has to fail the build, so it is worth
 * proving that it fails when the prefix is missing from the build and passes
 * when it is not asked about a prefix.
 */
describe("the asset-prefix gate", () => {
  it("fails a prefixed build whose asset URLs lost the prefix", () => {
    const fixture = mkdtempSync(join(tmpdir(), "darthub-prefix-gate-"));
    try {
      mkdirSync(join(fixture, "server"), { recursive: true });
      writeFileSync(
        join(fixture, "server", "game.html"),
        "<!doctype html><html><head>" +
          '<link href="/_next/static/chunks/app.css" rel="stylesheet" />' +
          "</head></html>",
      );

      const script = join(REPO_ROOT, "scripts/check-asset-prefix.mjs");
      const armed = runCommand(`node "${script}"`, {
        NODE_ENV: "test" as const,
        BASE_PATH: "/darthub",
        NEXT_DIST_DIR: fixture,
      });
      expect(
        armed.exitCode,
        `the gate must fail a prefixed build without the prefix:\n${armed.output}`,
      ).toBe(1);

      // The same build passes when the gate is not told about a prefix — that
      // is exactly why the Dockerfile has to hand the value to the gate.
      const disarmed = runCommand(`node "${script}"`, {
        NODE_ENV: "test" as const,
        BASE_PATH: "",
        NEXT_DIST_DIR: fixture,
      });
      expect(
        disarmed.exitCode,
        `the gate without a prefix checks against /_next/ and passes:\n${disarmed.output}`,
      ).toBe(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
