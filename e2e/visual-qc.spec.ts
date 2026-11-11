import { test, expect } from "@playwright/test";
import {
  SURFACES,
  VIEWPORTS,
  measureContrast,
  measureFocusRings,
  measureMotion,
  measureOverflow,
  measureTargets,
} from "./visual-qc-helpers";

/**
 * The visual quality-control suite.
 *
 * Every criterion here is about *rendered pixels*, so every assertion is
 * taken from the browser: the computed colours of the element that is
 * actually painted, the bounding box of the element that is actually
 * clickable, and the document's own scroll metrics.
 *
 * The measurements are the design system's acceptance thresholds
 * (`DESIGN.md` §11), not the design system's hopes.
 */

/** The five match views, each of which must apply the same compact rule. */
const MATCH_VIEWS = [
  { name: "501", path: "/game" },
  { name: "301", path: "/game/301" },
  { name: "Cricket", path: "/game/cricket" },
  { name: "Around The Clock", path: "/game/around-the-clock" },
  { name: "Shanghai", path: "/game/shanghai" },
];

test.describe("visual quality control", () => {
  // The suite walks every route at every viewport, so a cold development
  // server compiles each of them on demand.
  test.describe.configure({ timeout: 120_000 });

  test("it captures every surface at 1440, 1024 and 390", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const surface of SURFACES) {
        await page.goto(surface.path);
        if (surface.enter) await surface.enter(page);
        const shot = await page.screenshot({ fullPage: true });
        // A capture that produced nothing is a failed capture.
        expect(shot.byteLength, `${surface.name} @ ${viewport.width}`).toBeGreaterThan(1000);
      }
    }
  });

  test("it has no horizontal overflow at 390 pixels on any surface", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const surface of SURFACES) {
      await page.goto(surface.path);
      if (surface.enter) await surface.enter(page);

      const { scrollWidth, clientWidth, bodyScrollWidth, bodyClientWidth } =
        await measureOverflow(page);

      expect(
        scrollWidth,
        `${surface.name}: the document scrolls sideways (${scrollWidth} > ${clientWidth})`,
      ).toBeLessThanOrEqual(clientWidth);
      expect(
        bodyScrollWidth,
        `${surface.name}: the body scrolls sideways (${bodyScrollWidth} > ${bodyClientWidth})`,
      ).toBeLessThanOrEqual(bodyClientWidth);
    }
  });

  test("it has no interactive target below 44 pixels except the board's painted beds", async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const surface of SURFACES) {
        await page.goto(surface.path);
        if (surface.enter) await surface.enter(page);

        const undersized = await measureTargets(page);
        expect(
          undersized,
          `${surface.name} @ ${viewport.width}: ${JSON.stringify(undersized, null, 2)}`,
        ).toEqual([]);
      }
    }
  });

  test("it meets a 4.5 to 1 contrast ratio for body text on every surface", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const surface of SURFACES) {
        await page.goto(surface.path);
        if (surface.enter) await surface.enter(page);

        const low = await measureContrast(page);
        expect(low, `${surface.name} @ ${viewport.width}: ${JSON.stringify(low, null, 2)}`).toEqual(
          [],
        );
      }
    }
  });

  test("it shows a visible focus ring on every interactive element", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const surface of SURFACES) {
      await page.goto(surface.path);
      if (surface.enter) await surface.enter(page);

      // The page is walked with Tab, because :focus-visible only matches a
      // keyboard focus: a control that only rings on a mouse click is not
      // keyboard-visible, and this is the path a keyboard user takes.
      const unringed = await measureFocusRings(page);
      expect(unringed, `${surface.name}: ${JSON.stringify(unringed, null, 2)}`).toEqual([]);
    }
  });

  test("it collapses motion under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/game");
    await page.getByLabel("Player 1").fill("Alice");
    await page.getByRole("button", { name: "Start match" }).click();
    await page.getByRole("region", { name: "Dart pad" }).waitFor();

    const survivors = await measureMotion(page);
    expect(survivors, JSON.stringify(survivors, null, 2)).toEqual([]);
  });

  test("it provides the keyboard route that duplicates the board's capability", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/game");
    await page.getByLabel("Player 1").fill("Alice");
    await page.getByRole("button", { name: "Start match" }).click();
    await page.getByRole("region", { name: "Dart pad" }).waitFor();

    // The board's roving-tabindex grid: 20 sectors x 3 beds, plus both bulls.
    const board = page.getByRole("group", { name: "Dartboard" });
    const cells = board.getByRole("button");
    await expect(cells).toHaveCount(62);

    // Exactly one cell is in the tab order: the grid is a single tab stop.
    const tabbable = await page.evaluate(() => {
      const grid = document.querySelector('[role="group"][aria-label="Dartboard"] .sr-only');
      return Array.from(grid?.querySelectorAll("button") ?? []).filter(
        (button) => button.tabIndex === 0,
      ).length;
    });
    expect(tabbable).toBe(1);

    // Arrow keys move the focus across the grid.
    await page.evaluate(() => {
      const grid = document.querySelector('[role="group"][aria-label="Dartboard"] .sr-only');
      grid?.querySelector<HTMLElement>("button[tabindex='0']")?.focus();
    });
    const before = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    await page.keyboard.press("ArrowRight");
    const after = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(after).not.toBe(before);

    // The pad's segment radio group is present and focusable, and it is the
    // only control that changes the armed band.
    const segments = page.getByRole("radiogroup", { name: /segment/i });
    await expect(segments).toBeVisible();
    await page.getByRole("radio", { name: "3× Treble" }).focus();
    await expect(page.getByRole("radio", { name: "3× Treble" })).toBeFocused();
    await page.getByRole("radio", { name: "3× Treble" }).click();

    // Every outcome the board offers is offered by a conformant control:
    // the armed band plus the numeral, and the two bulls.
    const pad = page.getByRole("region", { name: "Dart pad" });
    await expect(pad.getByRole("button", { name: /Treble 20, 60 points/ })).toBeVisible();
    await expect(pad.getByRole("button", { name: "Inner bull, 50 points" })).toBeVisible();
    await expect(pad.getByRole("button", { name: "Outer bull, 25 points" })).toBeVisible();
  });

  test("it makes the board a read-only preview below 768 pixels", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const view of MATCH_VIEWS) {
      await page.goto(view.path);
      await page.getByLabel("Player 1").fill("Alice");
      await page.getByRole("button", { name: "Start match" }).click();
      await page.getByRole("region", { name: "Dart pad" }).waitFor();

      // The board is hidden from assistive technology and offers no pointer
      // target and no button. It is located by attribute, not by role,
      // because an aria-hidden element is deliberately not in the tree.
      const board = page.locator('[role="group"][aria-label="Dartboard"]');
      await expect(board).toHaveAttribute("aria-hidden", "true");
      await expect(board.locator("button")).toHaveCount(0);
      expect(
        await board.evaluate((element) => getComputedStyle(element).pointerEvents),
        `${view.name}: the board still takes pointer input`,
      ).toBe("none");

      // Clicking the board where a treble bed would be throws nothing. The
      // dart counter is the one signal every mode shares.
      const pad = page.getByRole("region", { name: "Dart pad" });
      const counter = pad.locator("p", { hasText: "/ 3 darts" });
      const before = await counter.textContent();

      const box = await board.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      await expect(counter).toHaveText(before ?? "");

      // The pad is the input, and it still works.
      await pad.getByRole("button", { name: /Single 20/ }).click();
      await expect(counter).not.toHaveText(before ?? "");
    }
  });

  test("it keeps the e2e suite passing against the new design", async ({ page }) => {
    // The Game Center is a ruled sheet, not a card grid.
    await page.goto("/game-center");
    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(page.locator("main table a")).toHaveCount(5);
    // No gradient cards survived the rebuild.
    const gradients = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("main *")).filter((element) =>
          getComputedStyle(element).backgroundImage.includes("linear-gradient"),
        ).length,
    );
    expect(gradients).toBe(0);

    // The dart pad is the new structure: a segment radio group, twenty
    // sector keys, the two bulls and a miss.
    await page.goto("/game");
    await page.getByLabel("Player 1").fill("Alice");
    await page.getByRole("button", { name: "Start match" }).click();
    const pad = page.getByRole("region", { name: "Dart pad" });
    await expect(pad.getByRole("radio")).toHaveCount(3);
    await expect(pad.getByRole("button")).toHaveCount(23);
  });
});
