import { describe, it, expect } from "vitest";
import { runGateCommand } from "../support/gate-commands";

describe("lint", () => {
  it("lints code without errors using eslint", { timeout: 900_000 }, async () => {
    const { exitCode, output } = await runGateCommand("npm run lint");

    expect(exitCode, `eslint exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error\b/i);
  });
});
