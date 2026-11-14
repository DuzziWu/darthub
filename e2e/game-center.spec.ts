import { test, expect } from "@playwright/test";

test.describe("Game Center Hub", () => {
  test("game center hub shows all game modes", async ({ page }) => {
    await page.goto("/game-center");
    await expect(page.getByRole("heading", { name: "Game Center" })).toBeVisible();

    // The rule sheet: one row per mode.
    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toContainText("501");
    await expect(rows.nth(1)).toContainText("301");
    await expect(rows.nth(2)).toContainText("Cricket");
    await expect(rows.nth(3)).toContainText("Around The Clock");
    await expect(rows.nth(4)).toContainText("Shanghai");
  });

  test("hub links navigate to correct pages", async ({ page }) => {
    await page.goto("/game-center");
    // The mode name is the row's only link, and it names its destination.
    await page.getByRole("link", { name: "Play Cricket" }).click();
    await expect(page).toHaveURL("/game/cricket");
  });

  test("it renders the rule sheet without a horizontal scrollbar at 390 pixels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/game-center");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe("501 Game", () => {
  test("full match journey - start and throw", async ({ page }) => {
    await page.goto("/game");

    // Start screen — PlayerSetup uses "Player 1 name" placeholder and "Start Match" button
    await expect(page.getByLabel("Player 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Match" })).toBeVisible();

    // Enter name and start
    await page.getByLabel("Player 1").fill("Alice");
    await page.getByRole("button", { name: "Start Match" }).click();

    // Verify game started — the score of the first player is on the sheet
    await expect(page.locator("[data-score]").first()).toContainText("501");

    // Play a throw - click the 20 button
    const btns = page.locator("button.font-mono");
    await btns.filter({ hasText: "20" }).first().click();

    // The visit along the top names the dart by the segment it landed on
    const visit = page.getByRole("list", { name: "Current visit" });
    await expect(visit).toContainText("S20");

    // Continue playing a few more throws
    await btns.filter({ hasText: "20" }).first().click();
    await btns.filter({ hasText: "20" }).first().click();

    // Score should have decreased
    await expect(page.locator("[data-score]").first()).not.toContainText("501");
  });

  test("new game button returns to start screen", async ({ page }) => {
    await page.goto("/game");
    await page.getByLabel("Player 1").fill("Bob");
    await page.getByRole("button", { name: "Start Match" }).click();
    await expect(page.locator("[data-score]").first()).toBeVisible();
    // The 501 page has "New Game" that returns to setup phase
    await page.getByRole("button", { name: "New Game" }).click();
    await expect(page.getByLabel("Player 1")).toBeVisible();
  });
});

test.describe("Cricket Game", () => {
  test("cricket game starts and shows targets", async ({ page }) => {
    await page.goto("/game/cricket");

    // Start screen
    await page.getByLabel("Player 1").fill("Carol");
    await page.getByRole("button", { name: "Start match" }).click();

    // Every cricket target is on the sheet, with the marks it holds.
    await expect(page.getByLabel("20, 0 of 3 marks")).toBeVisible();
    await expect(page.getByLabel("15, 0 of 3 marks")).toBeVisible();
    await expect(page.getByLabel("BULL, 0 of 3 marks")).toBeVisible();
  });

  test("throw updates marks", async ({ page }) => {
    await page.goto("/game/cricket");
    await page.getByLabel("Player 1").fill("Carol");
    await page.getByRole("button", { name: "Start match" }).click();

    // All targets start on 0 of 3 marks.
    await expect(page.getByLabel("20, 0 of 3 marks")).toBeVisible();

    // Throw a treble 20 — 60 points, which is three marks on the 20.
    const pad = page.getByRole("region", { name: "Dart pad" });
    await pad.getByRole("radio", { name: "3× Treble" }).click();
    await pad.getByRole("button", { name: "Treble 20, 60 points" }).click();

    await expect(page.getByLabel(/^20, 3 of 3 marks/)).toBeVisible();
  });

  test("the inner bull counts as two marks and the outer bull as one", async ({ page }) => {
    await page.goto("/game/cricket");
    await page.getByLabel("Player 1").fill("Carol");
    await page.getByRole("button", { name: "Start match" }).click();

    const pad = page.getByRole("region", { name: "Dart pad" });
    await pad.getByRole("button", { name: "Outer bull, 25 points" }).click();
    await expect(page.getByLabel("BULL, 1 of 3 marks")).toBeVisible();

    await pad.getByRole("button", { name: "Inner bull, 50 points" }).click();
    await expect(page.getByLabel(/^BULL, 3 of 3 marks/)).toBeVisible();
  });
});

test.describe("Around the Clock Game", () => {
  test("around the clock shows current target", async ({ page }) => {
    await page.goto("/game/around-the-clock");

    await page.getByLabel("Player 1").fill("Dave");
    await page.getByRole("button", { name: "Start match" }).click();

    // The target in play is a single figure, and the progress is counted.
    await expect(page.getByText("Current target")).toBeVisible();
    await expect(page.locator("[data-current-target]")).toContainText("1");
    await expect(page.getByText("Progress 0 / 21")).toBeVisible();
  });

  test("hit advances target", async ({ page }) => {
    await page.goto("/game/around-the-clock");
    await page.getByLabel("Player 1").fill("Dave");
    await page.getByRole("button", { name: "Start match" }).click();

    // Throw a single 1 — it hits the target in play.
    const pad = page.getByRole("region", { name: "Dart pad" });
    await pad.getByRole("button", { name: "Single 1, 1 points" }).click();

    // Progress should advance
    await expect(page.getByText("Progress 1 / 21")).toBeVisible();
  });
});

test.describe("Shanghai Game", () => {
  test("shanghai shows round info", async ({ page }) => {
    await page.goto("/game/shanghai");

    await page.getByLabel("Player 1").fill("Eve");
    await page.getByRole("button", { name: "Start match" }).click();

    // Shows round 1 / 7 and its target
    await expect(page.getByText("Round 1 / 7")).toBeVisible();
    await expect(page.getByText("Target 1")).toBeVisible();
    await expect(page.getByLabel("Round 1, target 1, 0 marks")).toBeVisible();
  });

  test("throw records in history", async ({ page }) => {
    await page.goto("/game/shanghai");
    await page.getByLabel("Player 1").fill("Eve");
    await page.getByRole("button", { name: "Start match" }).click();

    // Round 1 target is 1 — a single 1 is one mark.
    const pad = page.getByRole("region", { name: "Dart pad" });
    await pad.getByRole("button", { name: "Single 1, 1 points" }).click();

    await expect(page.getByLabel("Round 1, target 1, 1 marks")).toBeVisible();
  });
});

test.describe("Game Center Styling", () => {
  test("it carries a stylesheet in the game center document", async ({ page }) => {
    await page.goto("/game-center");

    const { stylesheetCount, styleRuleCount } = await page.evaluate(() => {
      // Next always injects a font-face <style>, so a bare element count proves
      // nothing — count the rules the stylesheets actually apply to elements.
      const collect = (rules: CSSRuleList, out: number[]) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            out.push(1);
          } else if ("cssRules" in rule && rule.cssRules) {
            collect(rule.cssRules as CSSRuleList, out);
          }
        }
        return out;
      };

      const matched: number[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          collect(sheet.cssRules, matched);
        } catch {
          // cross-origin sheet — not inspectable, ignore
        }
      }

      return {
        stylesheetCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
        styleRuleCount: matched.length,
      };
    });

    expect(stylesheetCount).toBeGreaterThan(0);
    expect(styleRuleCount).toBeGreaterThan(0);
  });

  test("it applies the board-token page background to the body", async ({ page }) => {
    await page.goto("/game-center");

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // The browser default is transparent — only the --color-board token produces a paint
    expect(bodyBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bodyBg).toBe("rgb(12, 12, 14)");
  });

  test("it renders the game center heading with the display design token font stack", async ({
    page,
  }) => {
    await page.goto("/game-center");

    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();

    const { fontFamily, fontSize, fontWeight } = await heading.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    });

    // UA default for h1 is the serif "Times New Roman" — only the display token
    // (Barlow Condensed) can override it.
    expect(fontFamily).toContain("Barlow");
    expect(fontFamily).not.toContain("Times New Roman");
    // The display token is 2rem; the UA default h1 is a bold 32px Times
    expect(fontSize).toBe("32px");
    expect(fontWeight).toBe("700");
  });

  test("it rules the game mode rows with a separator instead of a gradient card", async ({
    page,
  }) => {
    await page.goto("/game-center");

    const row = page.locator("main table tbody tr").first();
    await expect(row).toBeVisible();

    // The gradient card is gone: a row is a ruled sheet line, never a filled box.
    const backgroundImage = await row.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(backgroundImage).not.toContain("linear-gradient");

    const borderBottom = await row.evaluate((el) => getComputedStyle(el).borderBottomWidth);
    expect(borderBottom).toBe("1px");
  });

  test("it keeps all five game mode rows visible and linked on the game center page", async ({
    page,
  }) => {
    await page.goto("/game-center");

    const links = page.locator("main table a");
    await expect(links).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const link = links.nth(i);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /^\/game/);
      // The mode name is the row's only link — it is a name, not a card.
      await expect(link).toHaveCSS("display", "inline-flex");
    }
  });

  test("it fails when the global stylesheet is removed from the root layout", async ({ page }) => {
    // The page as actually served by app/layout.tsx must be styled — this is the
    // assertion that breaks if the root layout stops importing "./globals.css".
    await page.goto("/game-center");
    const served = await page.evaluate(() => ({
      bodyBg: getComputedStyle(document.body).backgroundColor,
      h1FontFamily: getComputedStyle(document.querySelector("h1")!).fontFamily,
      rowBorderBottom: getComputedStyle(document.querySelector("main table tbody tr")!)
        .borderBottomWidth,
    }));
    expect(served.bodyBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(served.h1FontFamily).not.toContain("Times New Roman");
    expect(served.rowBorderBottom).toBe("1px");

    // Proof the assertions above have teeth: block every stylesheet request so the
    // page falls back to the unstyled UA defaults.
    await page.route("**/*.css", (route) => route.abort());
    await page.goto("/game-center");
    const unstyled = await page.evaluate(() => ({
      bodyBg: getComputedStyle(document.body).backgroundColor,
      h1FontFamily: getComputedStyle(document.querySelector("h1")!).fontFamily,
      h1FontSize: getComputedStyle(document.querySelector("h1")!).fontSize,
      rowBorderBottom: getComputedStyle(document.querySelector("main table tbody tr")!)
        .borderBottomWidth,
    }));
    expect(unstyled.bodyBg).toBe("rgba(0, 0, 0, 0)");
    expect(unstyled.h1FontFamily).toContain("Times New Roman");
    expect(unstyled.h1FontSize).toBe("32px");
    expect(unstyled.rowBorderBottom).toBe("0px");
  });
});
