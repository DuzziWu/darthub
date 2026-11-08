import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

describe("typescript", () => {
  it("compiles Typescript with no type errors", { timeout: 180_000 }, () => {
    const { exitCode, output } = runCommand("npm run typecheck");

    expect(exitCode, `tsc --noEmit exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error TS\d+/);
  });
});
