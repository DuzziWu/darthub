import { describe, it, expect } from "vitest";
import { runGateCommand } from "../support/gate-commands";

describe("typescript", () => {
  it("compiles Typescript with no type errors", { timeout: 900_000 }, async () => {
    const { exitCode, output } = await runGateCommand("npm run typecheck");

    expect(exitCode, `tsc --noEmit exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error TS\d+/);
  });
});
