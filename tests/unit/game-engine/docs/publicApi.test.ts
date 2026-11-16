import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import * as engine from "@/game-engine";
import type { GameEngineErrorCode } from "@/game-engine";

const README_PATH = resolve(import.meta.dirname, "../../../../src/game-engine/README.md");
const TYPES_PATH = resolve(import.meta.dirname, "../../../../src/game-engine/types.ts");

function readReadme(): string {
  return readFileSync(README_PATH, "utf8");
}

/**
 * Every code of the `GameEngineErrorCode` union, as a compile-time check.
 *
 * A code that is added to or removed from the union breaks this record,
 * and `npm run typecheck` fails with it.
 */
const UNION_CODES: Readonly<Record<GameEngineErrorCode, true>> = {
  INVALID_STATE: true,
  MATCH_COMPLETED: true,
  NOT_YOUR_TURN: true,
  NO_MATCH: true,
  NOTHING_TO_UNDO: true,
  NO_DART_AT_INDEX: true,
  BUST: true,
  CORRECTION_WOULD_BUST: true,
  LATER_DART_WOULD_BUST: true,
  TURN_ROTATION_CHANGED: true,
};

/**
 * The codes the union declares, read from the source of truth.
 *
 * The union is a type, so only its declaration can tell which codes
 * exist — a test that lists them itself would only prove that the list
 * agrees with itself.
 */
function readUnionCodes(): readonly string[] {
  const source = readFileSync(TYPES_PATH, "utf8");
  const declaration = source.match(/export type GameEngineErrorCode\s*=\s*([\s\S]*?);/);
  if (declaration === null || declaration[1] === undefined) {
    throw new Error("src/game-engine/types.ts declares no GameEngineErrorCode union");
  }
  return [...declaration[1].matchAll(/"([A-Z_]+)"/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/**
 * The codes the JSDoc above the union lists.
 *
 * The doc block is the one that documents the declaration, so it is read
 * as the block that ends right before it. Only the bullets that name a
 * code are read — the prose around them and the line break inside a
 * description do not matter, so the block can be reworded and rewrapped
 * without breaking the guard.
 */
function readJsDocCodes(): readonly string[] {
  const source = readFileSync(TYPES_PATH, "utf8");
  const declaration = source.match(/export type GameEngineErrorCode\s*=/);
  if (declaration === null || declaration.index === undefined) {
    throw new Error("src/game-engine/types.ts declares no GameEngineErrorCode union");
  }
  const docBlock = source.slice(0, declaration.index).match(/\/\*\*[\s\S]*\*\/\s*$/);
  if (docBlock === null || docBlock[0] === undefined) {
    throw new Error("the GameEngineErrorCode union carries no JSDoc block");
  }
  return [...docBlock[0].matchAll(/^[ \t]*\*[ \t]*-[ \t]*`?"([A-Z_]+)"`?/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/** The codes the README's error code table lists. */
function readmeTableCodes(readme: string): readonly string[] {
  return [...readme.matchAll(/^\|\s*`"([A-Z_]+)"`\s*\|/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/** The codes the README's own copy of the union lists. */
function readmeUnionCodes(readme: string): readonly string[] {
  const declaration = readme.match(/type GameEngineErrorCode\s*=\s*([\s\S]*?);/);
  if (declaration === null || declaration[1] === undefined) {
    throw new Error("the README documents no GameEngineErrorCode union");
  }
  return [...declaration[1].matchAll(/"([A-Z_]+)"/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
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

    // Every documented public name exists on the actual barrel export.
    expect(typeof engine.GameEngine).toBe("function");
    expect(typeof engine.NeutralScoreMode).toBe("function");
    expect(engine.DARTS_PER_TURN).toBe(3);
    expect(typeof engine.GameEngineStateError).toBe("function");
    expect(typeof engine.GameEngineValidationError).toBe("function");
    expect(typeof engine.deriveTurnThrows).toBe("function");
    expect(typeof engine.deriveVisitIndexes).toBe("function");
    expect(typeof engine.groupVisits).toBe("function");
  });

  it("documents the ledger helpers with the arity of the real functions", () => {
    // The README is a contract: a signature that drifts from the code
    // must fail here, not in a consumer's editor.
    expect(engine.deriveTurnThrows).toHaveLength(3);
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

  it("documents every error code of the union in the code table", () => {
    const readme = readReadme();
    const unionCodes = readUnionCodes();
    const tableCodes = readmeTableCodes(readme);

    // The source of truth and the compile-time list agree — the list is
    // the exhaustiveness check, the source is what the engine ships.
    expect([...unionCodes].sort()).toEqual(Object.keys(UNION_CODES).sort());

    // Every code of the union is documented in the code table.
    for (const code of unionCodes) {
      expect(tableCodes).toContain(code);
    }

    // The table documents no code the union does not know: a code that was
    // renamed in the code must not linger in the documentation.
    for (const code of tableCodes) {
      expect(unionCodes).toContain(code);
    }

    // The README's own copy of the union lists the same codes.
    expect([...readmeUnionCodes(readme)].sort()).toEqual([...unionCodes].sort());
  });

  it("documents every error code of the union in the JSDoc above it", () => {
    const unionCodes = readUnionCodes();
    const jsDocCodes = readJsDocCodes();

    // Every code of the union is documented where the union is declared:
    // the reader of types.ts sees the same list the README carries.
    for (const code of unionCodes) {
      expect(jsDocCodes).toContain(code);
    }

    // The doc block names no code the union does not know: a code that was
    // renamed in the declaration must not linger in the doc block.
    for (const code of jsDocCodes) {
      expect(unionCodes).toContain(code);
    }
  });
});
