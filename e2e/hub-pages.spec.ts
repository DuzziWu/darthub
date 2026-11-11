import { test, expect } from "@playwright/test";

/**
 * The four hub pages, measured in a real browser.
 *
 * The unit tests assert the contract; these assert what the browser
 * actually lays out — in particular that nothing overflows sideways on a
 * 390 px screen.
 */

const ROUTES = [
  { path: "/", heading: "DartHub" },
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/lobby", heading: "Lobby" },
  { path: "/career", heading: "Career Mode" },
];

test.describe("hub pages", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders its heading inside the shell`, async ({ page }) => {
      await page.goto(route.path);

      // The shell owns the landmarks: one main, one header, one footer.
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("header")).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(1);

      // The page's heading is inside the shell's main.
      await expect(page.locator("main#main h1")).toHaveText(route.heading);
    });

    test(`it renders ${route.path} without a horizontal scrollbar at 390 pixels`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }

  test("the dashboard shows its empty state rather than placeholder statistics", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("No completed matches yet.")).toBeVisible();
    await expect(
      page.getByText("Finish a leg to see your rating, average and checkout rate here."),
    ).toBeVisible();
    await expect(page.locator("main#main")).not.toContainText("--");
  });

  test("the lobby shows its empty room state rather than invented rooms", async ({ page }) => {
    await page.goto("/lobby");

    await expect(page.getByText("No public rooms right now.")).toBeVisible();
    await expect(page.locator("main#main table")).toHaveCount(0);
  });

  test("the career page lists the quests the loader returns", async ({ page }) => {
    await page.goto("/career");

    await expect(page.getByText("No active quest.")).toBeVisible();
    await expect(page.getByText("First Flight", { exact: true })).toBeVisible();
    await expect(page.getByText("Checkout Practice", { exact: true })).toBeVisible();
  });
});
