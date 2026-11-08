import { describe, it, expect } from "vitest";
import { runCommand } from "../../support/run-command";

describe("Camera abstraction compile-time contract", () => {
  it("compiles without implementation", { timeout: 180_000 }, () => {
    const { exitCode, output } = runCommand(
      "npx tsc --noEmit --project tests/unit/camera/tsconfig.json",
    );

    expect(exitCode, `scoped tsc exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error TS\d+/);
  });
});
