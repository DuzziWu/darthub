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
    expect(readme).toContain("getVisits(): readonly MatchVisit[]");
    expect(readme).toContain("getCurrentTurn(): readonly RecordedThrow[]");
    expect(readme).toContain(
      "deriveTurnThrows(throws: readonly RecordedThrow[], currentPlayerId: string | null, dartsPerTurn: number): RecordedThrow[]",
    );
    expect(readme).toContain(
      "deriveTurnIndexes(throws: readonly RecordedThrow[], dartsPerTurn: number): number[]",
    );

    // Every documented public name exists on the actual barrel export.
    expect(typeof engine.GameEngine).toBe("function");
    expect(typeof engine.NeutralScoreMode).toBe("function");
    expect(engine.DARTS_PER_TURN).toBe(3);
    expect(typeof engine.GameEngineStateError).toBe("function");
    expect(typeof engine.GameEngineValidationError).toBe("function");
    expect(typeof engine.deriveTurnThrows).toBe("function");
    expect(typeof engine.deriveTurnIndexes).toBe("function");
    expect(typeof engine.deriveVisitIndexes).toBe("function");
    expect(typeof engine.groupVisits).toBe("function");
  });

  it("documents the ledger helpers with the arity of the real functions", () => {
    // The README is a contract: a signature that drifts from the code
    // must fail here, not in a consumer's editor.
    expect(engine.deriveTurnThrows).toHaveLength(3);
    expect(engine.deriveTurnIndexes).toHaveLength(2);
    expect(engine.deriveVisitIndexes).toHaveLength(2);
    expect(engine.groupVisits).toHaveLength(2);
    expect(typeof engine.GameEngine.prototype.getCurrentTurn).toBe("function");
    expect(typeof engine.GameEngine.prototype.getVisits).toBe("function");
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
