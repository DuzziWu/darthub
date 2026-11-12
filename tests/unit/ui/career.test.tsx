// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createQuestLoaderService } from "@/career/questLoader";
import CareerPage from "../../../app/career/page";

afterEach(() => {
  cleanup();
});

/**
 * The career page's contract: the real quest catalogue read through the
 * loader, honest empty states where there is no player progress, and one
 * primary action.
 */
describe("Career Page", () => {
  it("renders the career heading and its three sections", () => {
    const { container } = render(<CareerPage />);

    expect(container.querySelector("h1")?.textContent).toBe("Career Mode");

    const headings = [...container.querySelectorAll("h2")].map((heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toEqual(["Current Quest", "Progress", "Training"]);
  });

  it("shows the empty states instead of an invented quest or percentage", () => {
    const { container } = render(<CareerPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("No active quest.");
    expect(text).toContain("Finish a match to unlock your first training quest.");
    expect(text).toContain("No progress yet.");
    expect(text).toContain("Complete a training lesson to see your progress here.");

    // No progress bar standing in for a percentage nobody has earned.
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
    expect(text).not.toContain("0%");
  });

  it("lists the quests the loader returns", async () => {
    const loader = createQuestLoaderService();
    await loader.load();
    const quests = loader.getQuests();

    const { container } = render(<CareerPage />);
    const text = container.textContent ?? "";

    expect(quests.length).toBeGreaterThan(0);
    for (const quest of quests) {
      expect(text, `the page must show the quest "${quest.name}"`).toContain(quest.name);
      expect(text, `the page must show the quest "${quest.name}" description`).toContain(
        quest.description,
      );
    }
  });

  it("uses the semantic token layer", () => {
    const { container } = render(<CareerPage />);

    const classes = [...container.querySelectorAll("*")].map(
      (element) => element.getAttribute("class") ?? "",
    );

    expect(classes.join(" ")).toContain("text-ink");
    expect(classes.join(" ")).toContain("bg-brass");
    for (const className of classes) {
      expect(className).not.toMatch(
        /(?:bg|text|border)-(?:slate|gray|blue|green|red|amber|emerald|zinc|neutral|stone|sky|violet|purple|pink|rose|orange|yellow|lime|teal|cyan|indigo|fuchsia)/,
      );
    }
  });

  it("offers one primary action", () => {
    const { container } = render(<CareerPage />);

    const primary = [...container.querySelectorAll("a, button")].filter((element) =>
      (element.getAttribute("class") ?? "").split(/\s+/).includes("bg-brass"),
    );

    expect(primary).toHaveLength(1);
    expect(primary[0]?.getAttribute("href")).toBe("/game-center");
  });

  it("renders no landmark of its own", () => {
    const { container } = render(<CareerPage />);

    expect(container.querySelectorAll("main, footer, nav, header.sticky").length).toBe(0);
  });
});
