import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { GameEngine } from "@/game-engine/GameEngine";
import { NeutralScoreMode } from "@/game-engine/NeutralScoreMode";
import * as engineIndex from "@/game-engine/index";

const SRC_DIR = resolve(import.meta.dirname, "../../../src/game-engine");

/**
 * Imports or globals that would make the engine unusable in one of its
 * two target environments (Node multiplayer server / browser client)
 * or tie it to a specific framework.
 */
const FORBIDDEN_PATTERNS: readonly { name: string; regex: RegExp }[] = [
  { name: "react", regex: /from\s+["'][./]*react(?:\/|\?|["'])/ },
  { name: "next", regex: /from\s+["'][./]*next(?:\/|["'])/ },
  { name: "socket.io", regex: /["']socket\.io/ },
  {
    name: "node built-in imports",
    regex:
      /from\s+["'](?:node:)?(?:fs|path|os|crypto|http|https|net|events|child_process|process)["']|from\s+["']node:/,
  },
  { name: "node-only globals", regex: /\b(?:process|Buffer)\b|\brequire\(/ },
  {
    name: "browser-only globals",
    regex: /\b(?:window|document|navigator|localStorage|sessionStorage)\b/,
  },
];

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("GameEngine framework-agnosticism", () => {
  it("is framework-agnostic and can be imported in Node or browser environments", () => {
    // Public API is importable purely through the barrel module.
    expect(typeof engineIndex.GameEngine).toBe("function");
    expect(typeof engineIndex.NeutralScoreMode).toBe("function");

    // A source scan must show no framework, networking, or
    // environment-specific dependencies anywhere in src/game-engine.
    const files = listSourceFiles(SRC_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const { name, regex } of FORBIDDEN_PATTERNS) {
        if (regex.test(contents)) {
          offenders.push(`${name}: ${file}`);
        }
      }
    }
    expect(offenders).toEqual([]);

    // Runs in the plain Node environment (no jsdom) using only APIs
    // that exist in every modern browser as well.
    const engine = new GameEngine(new NeutralScoreMode());
    engine.startMatch({ playerIds: ["a", "b"] });
    engine.recordThrow({ playerId: "a", points: 60 });

    const snapshot = engine.getState();
    // Wire-friendly: survives JSON round trips.
    const revived = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(revived).toEqual(snapshot);
  });
});
