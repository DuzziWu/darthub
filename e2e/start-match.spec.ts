import { test, expect, type Page } from "@playwright/test";

/**
 * Every mode must start a match and accept a dart.
 *
 * "Start match" is the first control a player touches, so a failure here
 * blocks the whole product. The mode list covers all five routes: a mode
 * that starts but does not throw is still a broken game.
 */

/** The modes, and the route and score each one starts from. */
const MODES = [
  // The 501 needs two players; the other modes accept one.
  { name: "501", path: "/game", startScore: "501", players: 2 },
  { name: "301", path: "/game/301", startScore: "301", players: 1 },
  { name: "Cricket", path: "/game/cricket", startScore: null, players: 1 },
  { name: "Around the Clock", path: "/game/around-the-clock", startScore: null, players: 1 },
  { name: "Shanghai", path: "/game/shanghai", startScore: null, players: 1 },
] as const;

/** Fills the setup form and starts the match. */
const startMatch = async (page: Page, name: string, players = 1): Promise<void> => {
  await page.getByLabel("Player 1").fill(name);
  if (players > 1) {
    await page.getByLabel("Player 2").fill("Bo");
  }
  await page.getByRole("button", { name: /start match/i }).click();
  await expect(page.getByRole("region", { name: "Dart pad" })).toBeVisible();
};

for (const mode of MODES) {
  test.describe(`${mode.name} mode`, () => {
    test("it starts a match and accepts a dart", async ({ page }) => {
      await page.goto(mode.path);

      await startMatch(page, "Alice", mode.players);

      // The dart pad is the in-play surface; a mode that never reaches it
      // has not started the match.
      const pad = page.getByRole("region", { name: "Dart pad" });

      // A single 1 is the lowest common throw: every mode scores it.
      await pad.getByRole("button", { name: "Single 1, 1 points" }).click();

      // The visit strip records the dart, so the throw reached the engine.
      await expect(page.getByRole("list", { name: "Current visit" })).toContainText("S1");
    });

    // Only the scored modes open on a score; the others open on their own
    // target, which has no starting number to show.
    if (mode.startScore !== null) {
      test("it renders the start score of the mode", async ({ page }) => {
        await page.goto(mode.path);
        await startMatch(page, "Alice", mode.players);

        await expect(page.locator("[data-score]").first()).toContainText(mode.startScore as string);
      });
    }
  });
}

test.describe("start match", () => {
  test("it refuses a match with no players and says why", async ({ page }) => {
    await page.goto("/game");

    await page.getByRole("button", { name: /start match/i }).click();

    // The setup screen stays put and the reason is on screen.
    await expect(page.getByLabel("Player 1")).toBeVisible();
    // The route announcer is also an alert, so the message is picked by text.
    // The 501 needs two players, so the setup says so.
    await expect(page.getByText(/at least 2 players required/i)).toBeVisible();
  });

  test("the page is interactive, not just rendered", async ({ page }) => {
    await page.goto("/game");

    // A page that fails to hydrate renders the same markup but takes no
    // input: React attaches no handler to the button.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const button = [...document.querySelectorAll("button")].find((candidate) =>
              /start match/i.test(candidate.textContent ?? ""),
            );
            return button ? Object.keys(button).some((key) => key.startsWith("__react")) : false;
          }),
        { message: "the page must hydrate so the controls respond" },
      )
      .toBe(true);
  });
});
