import { describe, it, expect } from "vitest";
import { runCommand } from "../support/run-command";

describe("formatting", () => {
  it("formats code without differences using prettier", { timeout: 180_000 }, () => {
    const { exitCode, output } = runCommand("npm run format:check");

    expect(exitCode, `prettier --check exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/\[warn\]/);
  });
});
