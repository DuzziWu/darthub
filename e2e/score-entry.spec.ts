import { test, expect, type Page } from "@playwright/test";

/**
 * The scoring controls a player touches when a dart goes in wrong.
 *
 * A mistyped dart cannot be edited in place in a dart game — the score is
 * the sum of the darts — so the product has to offer the two ways out:
 * undo the dart, or correct it to the value it should have been. Both go
 * through the engine, and the input mode may be switched at any time
 * without touching the match state.
 */

const MODES = [
  { name: "501", path: "/game" },
  { name: "301", path: "/game/301" },
  { name: "Cricket", path: "/game/cricket" },
  { name: "Around the Clock", path: "/game/around-the-clock" },
  { name: "Shanghai", path: "/game/shanghai" },
] as const;

/** Fills the setup form and starts the match. */
const startMatch = async (page: Page, name: string): Promise<void> => {
  await page.getByLabel("Player 1").fill(name);
  await page.getByRole("button", { name: /start match/i }).click();
  await expect(page.getByRole("region", { name: "Dart pad" })).toBeVisible();
};

/** The visit strip, which names the darts of the turn in progress. */
const visit = (page: Page) => page.getByRole("list", { name: "Current visit" });

for (const mode of MODES) {
  test.describe(`${mode.name} mode`, () => {
    test("it undoes a dart and takes it off the sheet", async ({ page }) => {
      await page.goto(mode.path);
      await startMatch(page, "Alice");

      const pad = page.getByRole("region", { name: "Dart pad" });
      await pad.getByRole("button", { name: "Single 1, 1 points" }).click();
      await expect(visit(page)).toContainText("S1");

      await page.getByRole("button", { name: /^undo$/i }).click();

      // The dart is off the sheet again.
      await expect(visit(page)).not.toContainText("S1");
    });

    test("it corrects a wrongly entered dart instead of adding a second one", async ({ page }) => {
      await page.goto(mode.path);
      await startMatch(page, "Alice");

      const pad = page.getByRole("region", { name: "Dart pad" });
      await pad.getByRole("button", { name: "Single 20, 20 points" }).click();
      await expect(visit(page)).toContainText("S20");

      // Arm the dart that was just thrown and enter its right value.
      await page.getByRole("button", { name: /^Dart 1: S20$/ }).click();
      await pad.getByRole("button", { name: "Single 1, 1 points" }).click();

      // The dart was replaced, not appended: the sheet still holds one dart.
      await expect(visit(page)).toContainText("S1");
      await expect(visit(page)).not.toContainText("S20");
      await expect(visit(page).getByRole("listitem")).toHaveCount(1);
    });

    test("it switches the input mode without changing the match", async ({ page }) => {
      await page.goto(mode.path);
      await startMatch(page, "Alice");

      const pad = page.getByRole("region", { name: "Dart pad" });
      await pad.getByRole("button", { name: "Single 20, 20 points" }).click();
      await expect(visit(page)).toContainText("S20");

      // The match state before the switch. Not every mode shows a score:
      // cricket has marks, around the clock a target, shanghai a round.
      const score = page.locator("[data-score]").first();
      const hasScore = (await score.count()) > 0;
      const scoreBefore = hasScore ? await score.textContent() : null;

      await page.locator("#input-mode-board").click();

      // The dart is still on the sheet and the score is unchanged.
      await expect(visit(page)).toContainText("S20");
      if (scoreBefore !== null) {
        await expect(score).toHaveText(scoreBefore);
      }

      // The board is the input now, and it takes the tap. The numeral is
      // the tap target: it scores the armed band of its sector.
      await page
        .getByRole("group", { name: "Dartboard" })
        .locator('text[data-numeral="19"]')
        .click();
      await expect(visit(page)).toContainText("S19");
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the miss is reachable and the board needs no scrolling", async ({ page }) => {
    await page.goto("/game/301");
    await startMatch(page, "Alice");

    // No horizontal overflow: the layout is one column wide.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The miss sits above the tab bar, so it can be tapped without scrolling.
    const miss = page.getByRole("region", { name: "Dart pad" }).getByRole("button", {
      name: "Miss, 0 points",
    });
    const missBox = await miss.boundingBox();
    expect(missBox).not.toBeNull();
    expect((missBox?.y ?? 0) + (missBox?.height ?? 0)).toBeLessThanOrEqual(779);

    // The board mode puts the board under the strip, in the first screen.
    await page.locator("#input-mode-board").click();
    const board = await page.getByRole("group", { name: "Dartboard" }).boundingBox();
    expect(board).not.toBeNull();
    expect(board?.y ?? 0).toBeLessThan(844);

    // The band the board scores is chosen above it.
    await expect(page.getByRole("radio", { name: "3× Treble" })).toBeVisible();
  });
});
