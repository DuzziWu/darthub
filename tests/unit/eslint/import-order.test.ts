import { resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, it, expect } from "vitest";
import { runCommand } from "../../support/run-command";

const projectRoot = process.cwd();

const misOrderedFixture = [
  'import { expect } from "vitest";',
  'import { readFileSync } from "node:fs";',
  'import { sibling } from "./sibling";',
  'import { helper } from "@/lib/helper";',
  "",
  "export const useFixture = (): void => {",
  "  void expect;",
  "  void readFileSync;",
  "  void helper;",
  "  void sibling;",
  "};",
  "",
].join("\n");

const correctlyOrderedFixture = [
  'import { readFileSync } from "node:fs";',
  'import { expect } from "vitest";',
  'import { helper } from "@/lib/helper";',
  'import { sibling } from "./sibling";',
  "",
  "export const useFixture = (): void => {",
  "  void expect;",
  "  void readFileSync;",
  "  void helper;",
  "  void sibling;",
  "};",
  "",
].join("\n");

/**
 * Lints fixture content in memory against the project's real flat ESLint
 * config. No fixture file is ever written to disk so the parallel whole-tree
 * `npm run lint` run can never observe a deliberately broken fixture.
 */
const lintFixtureCode = async (code: string) => {
  const eslint = new ESLint({ cwd: projectRoot });
  const results = await eslint.lintText(code, {
    filePath: resolve(projectRoot, "src/darthub-import-order-fixture.ts"),
  });
  expect(results).toHaveLength(1);
  const result = results[0];
  if (!result) throw new Error("expected an eslint result");
  return result;
};

describe("import order", () => {
  // Scoped to the files committed by task 001 (app/, tests/, eslint config).
  // Whole-tree compliance is enforced by the orchestrator's end-of-run lint
  // gate, since other workers are creating files under src/ concurrently.
  it(
    "runs eslint and reports no import order violations for the codebase",
    { timeout: 180_000 },
    () => {
      const { exitCode, output } = runCommand(
        "npx eslint app tests/support tests/unit/linting.test.ts tests/unit/formatting.test.ts tests/unit/typescript.test.ts tests/unit/ci-workflow.test.ts tests/unit/eslint/import-order.test.ts eslint.config.mjs",
      );

      expect(exitCode, `eslint exited with ${exitCode}:\n${output}`).toBe(0);
      expect(output).not.toMatch(/import-x\/order/);
    },
  );

  it("fails a build if a new file violates the order", { timeout: 60_000 }, async () => {
    const result = await lintFixtureCode(misOrderedFixture);
    const orderMessages = result.messages.filter((message) => message.ruleId === "import-x/order");

    expect(orderMessages.length, `messages: ${JSON.stringify(result.messages)}`).toBeGreaterThan(0);
    expect(orderMessages.every((message) => message.severity === 2)).toBe(true);
  });

  it(
    "accepts a fixture whose imports follow the configured order",
    { timeout: 60_000 },
    async () => {
      const result = await lintFixtureCode(correctlyOrderedFixture);
      const orderMessages = result.messages.filter(
        (message) => message.ruleId === "import-x/order",
      );

      expect(orderMessages, `messages: ${JSON.stringify(result.messages)}`).toHaveLength(0);
    },
  );
});
