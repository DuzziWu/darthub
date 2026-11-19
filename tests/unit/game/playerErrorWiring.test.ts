import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The wiring guard: a view may never read an error's message.
 *
 * The engine's error **message** is English developer text — it names the
 * ledger, the turn rotation and the dart index, and it changes whenever the
 * engine is refactored. The **code** is the contract, and
 * `playerErrorText` is the one place where a code becomes a sentence the
 * player can read.
 *
 * So a view that goes back to `error.message` puts developer text on the
 * screen, and nothing else in the suite would notice: the engine still
 * throws the same error and the view still renders. This test is that
 * notice. It reads the sources, the way
 * `tests/unit/game-engine/docs/publicApi.test.ts` reads the engine's
 * README.
 */

/**
 * The four view components of the five match screens.
 *
 * 501 and 301 share the x01 view; cricket, around the clock and shanghai
 * have a page each.
 */
const VIEWS: readonly string[] = [
  "app/game/cricket/page.tsx",
  "app/game/around-the-clock/page.tsx",
  "app/game/shanghai/page.tsx",
  "src/components/x01/X01MatchView.tsx",
];

/** Reads one view from the repository root. */
function readView(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "../../../", relativePath), "utf8");
}

describe("the match views and the engine's error messages", () => {
  it("maps every refusal through the one player-text module", () => {
    for (const view of VIEWS) {
      const source = readView(view);
      expect(source, view).toContain('from "@/components/game/playerErrors"');
      expect(source, view).toContain("playerErrorText(");
    }
  });

  it("never reads the message of an error", () => {
    for (const view of VIEWS) {
      const source = readView(view);
      expect(source, view).not.toMatch(/\.message\b/);
    }
  });
});
