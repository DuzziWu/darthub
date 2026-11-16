import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

const workflowPath = resolve(process.cwd(), ".github/workflows/ci.yml");

/** The environment of a job or a step, as the workflow declares it. */
type WorkflowEnv = Record<string, string | number | boolean>;

type WorkflowStep = {
  name?: string;
  run?: string;
  env?: WorkflowEnv;
};

type WorkflowJob = {
  env?: WorkflowEnv;
  steps?: WorkflowStep[];
};

type Workflow = {
  name?: string;
  on?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
};

const loadWorkflow = (): Workflow => {
  const raw = readFileSync(workflowPath, "utf-8");
  return parse(raw) as Workflow;
};

const allSteps = (workflow: Workflow): WorkflowStep[] =>
  Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);

/** Whether the step enables the live docker build, inline or through `env:`. */
const enablesLiveBuild = (step: WorkflowStep): boolean =>
  step.run?.includes("DART_DOCKER_BUILD=1") === true ||
  Object.entries(step.env ?? {}).some(
    ([key, value]) => key === "DART_DOCKER_BUILD" && String(value) === "1",
  );

/**
 * The workflow steps this meta test replays locally.
 *
 * The `npm run test` step is excluded to avoid re-running this very suite
 * from within itself, the e2e step because the Playwright browsers are not
 * installed in this environment, and the live docker build because a local
 * replay would start a real build of several minutes against the shared
 * daemon.
 *
 * The docker step is recognised by the flag it sets — inline in its run
 * string or through an `env:` block — and by the suite it runs. Both are
 * checked, so the exclusion survives a rewrite of the step: whether the step
 * sets the flag inline or through `env:`, and whether its run string starts
 * with "npm run" or not, it never reaches the replay.
 */
const replayedWorkflowSteps = (workflow: Workflow): WorkflowStep[] =>
  allSteps(workflow).filter(
    (step) =>
      step.run?.startsWith("npm run") &&
      step.run !== "npm run test" &&
      step.run !== "npm run test:e2e" &&
      !enablesLiveBuild(step) &&
      !step.run.includes("tests/unit/dockerignore.test.ts"),
  );

describe("ci", () => {
  it("defines a workflow that triggers on push", () => {
    const workflow = loadWorkflow();

    expect(workflow.on).toBeDefined();
    expect(workflow.on?.push).toBeDefined();
  });

  it("runs the end-to-end suite in its own job, with the browsers installed", () => {
    const workflow = loadWorkflow();
    const jobs = workflow.jobs ?? {};
    const e2eJob = Object.values(jobs).find((job) =>
      job.steps?.some((step) => step.run === "npm run test:e2e"),
    );

    expect(e2eJob, "no CI job runs the Playwright suite").toBeDefined();

    const steps = e2eJob?.steps ?? [];
    expect(
      steps.some((step) => step.run?.includes("playwright install")),
      "the e2e job must install the Playwright browsers",
    ).toBe(true);
  });

  it("builds the docker image in a dedicated step with the opt-in flag", () => {
    const workflow = loadWorkflow();
    const steps = allSteps(workflow);

    // The live build is opt-in, so the default suite run does not build the
    // image. Without a dedicated CI step the 200 MB size limit would be
    // verified nowhere. The flag may be set inline in the run string or
    // through an `env:` block of the step.
    const liveBuildSteps = steps.filter(
      (step) => enablesLiveBuild(step) && step.run?.includes("tests/unit/dockerignore.test.ts"),
    );

    expect(
      liveBuildSteps.length,
      "no CI step builds the docker image: a step must set DART_DOCKER_BUILD=1 — inline in its run or through an env: block — and run tests/unit/dockerignore.test.ts; without it the image size limit is verified nowhere",
    ).toBeGreaterThan(0);

    // The unit suite on a shared runner must stay free of the multi-minute
    // build: neither the run string of the plain suite step nor an `env:`
    // block of that step or of its job may set the flag. The dedicated
    // docker step above is exempt — it is the step that is allowed to build
    // the image.
    const unitSuiteSteps = steps.filter(
      (step) =>
        step.run?.trim().startsWith("npm run test") &&
        !step.run.includes("tests/unit/dockerignore.test.ts"),
    );
    expect(unitSuiteSteps.length, "the workflow does not run the unit suite").toBeGreaterThan(0);
    for (const step of unitSuiteSteps) {
      expect(step.run, "the plain unit suite step must not start the docker build").not.toContain(
        "DART_DOCKER_BUILD",
      );
      expect(
        Object.keys(step.env ?? {}),
        "the unit suite step must not set the docker build flag in an env block",
      ).not.toContain("DART_DOCKER_BUILD");
    }

    for (const job of Object.values(workflow.jobs ?? {})) {
      const runsPlainUnitSuite = (job.steps ?? []).some(
        (step) =>
          step.run?.trim().startsWith("npm run test") &&
          !step.run.includes("tests/unit/dockerignore.test.ts"),
      );
      if (!runsPlainUnitSuite) {
        continue;
      }
      expect(
        Object.keys(job.env ?? {}),
        "the job of the unit suite must not set the docker build flag in an env block",
      ).not.toContain("DART_DOCKER_BUILD");
    }
  });

  it("does not replay the docker image step locally", () => {
    const workflow = loadWorkflow();
    const replayed = replayedWorkflowSteps(workflow);

    expect(
      replayed.some((step) => step.run?.includes("DART_DOCKER_BUILD")),
      "the replay would start a real build of several minutes against the shared daemon",
    ).toBe(false);
    expect(
      replayed.some((step) => step.run?.includes("tests/unit/dockerignore.test.ts")),
      "the replay would run the live docker build",
    ).toBe(false);
  });

  it("runs the CI workflow successfully on push", { timeout: 600_000 }, () => {
    const workflow = loadWorkflow();
    const npmSteps = replayedWorkflowSteps(workflow);

    expect(npmSteps.length, "workflow must define npm script steps").toBeGreaterThan(0);

    // Replay the workflow's non-test `npm run` steps locally. The `npm run test`
    // step is excluded to avoid re-running this very suite from within itself;
    // every other step here (lint, format, typecheck) is the same command CI
    // would execute on push.
    for (const step of npmSteps) {
      const { exitCode, output } = runCommand(step.run as string);
      expect(
        exitCode,
        `workflow step "${step.name ?? step.run}" exited with ${exitCode}:\n${output}`,
      ).toBe(0);
    }
  });
});
