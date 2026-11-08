import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

describe("lint", () => {
  it("lints code without errors using eslint", { timeout: 180_000 }, () => {
    const { exitCode, output } = runCommand("npm run lint");

    expect(exitCode, `eslint exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error\b/i);
  });
});
