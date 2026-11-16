import { describe, it, expect } from "vitest";
import { runGateCommand } from "../support/gate-commands";

describe("formatting", () => {
  it("formats code without differences using prettier", { timeout: 900_000 }, async () => {
    const { exitCode, output } = await runGateCommand("npm run format:check");

    expect(exitCode, `prettier --check exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/\[warn\]/);
  });
});
