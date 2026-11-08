import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import * as engine from "@/game-engine";

const README_PATH = resolve(import.meta.dirname, "../../../../src/game-engine/README.md");

function readReadme(): string {
  return readFileSync(README_PATH, "utf8");
}

describe("game-engine README documentation", () => {
  it("includes TypeScript signatures for all public methods", () => {
    const readme = readReadme();

    // Documented signatures must match the real source signatures.
    expect(readme).toContain("constructor(mode?: DartGameMode)");
    expect(readme).toContain("startMatch(config: MatchConfig): MatchState");
    expect(readme).toContain("recordThrow(input: ThrowInput): MatchState");
    expect(readme).toContain("getState(): MatchState");

    // Every documented public name exists on the actual barrel export.
    expect(typeof engine.GameEngine).toBe("function");
    expect(typeof engine.NeutralScoreMode).toBe("function");
    expect(engine.DARTS_PER_TURN).toBe(3);
    expect(typeof engine.GameEngineStateError).toBe("function");
    expect(typeof engine.GameEngineValidationError).toBe("function");
  });

  it("provides example code snippets for both client-side and server-side usage", () => {
    const readme = readReadme();

    expect(readme).toMatch(/^#{2,3}\s+Client-side usage/im);
    expect(readme).toMatch(/^#{2,3}\s+Server-side usage/im);

    const fencedBlocks = readme.match(/```ts[\s\S]*?```/g) ?? [];
    expect(fencedBlocks.length).toBeGreaterThanOrEqual(4);

    // Both examples go through the documented public entry point.
    expect(readme).toContain('import { GameEngine } from "@/game-engine"');
  });

  it("mentions the engine is UI-agnostic and can be used in isolation", () => {
    const readme = readReadme();

    expect(readme).toMatch(/UI-agnostic/i);
    expect(readme).toMatch(/in isolation/i);
  });
});
