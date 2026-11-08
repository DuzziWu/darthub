import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

const workflowPath = resolve(process.cwd(), ".github/workflows/ci.yml");

type Workflow = {
  name?: string;
  on?: Record<string, unknown>;
  jobs?: Record<string, { steps?: Array<{ name?: string; run?: string }> }>;
};

const loadWorkflow = (): Workflow => {
  const raw = readFileSync(workflowPath, "utf-8");
  return parse(raw) as Workflow;
};

describe("ci", () => {
  it("defines a workflow that triggers on push", () => {
    const workflow = loadWorkflow();

    expect(workflow.on).toBeDefined();
    expect(workflow.on?.push).toBeDefined();
  });

  it("runs the CI workflow successfully on push", { timeout: 600_000 }, () => {
    const workflow = loadWorkflow();
    const steps = Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
    const npmSteps = steps.filter(
      (step) => step.run?.startsWith("npm run") && step.run !== "npm run test",
    );

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
