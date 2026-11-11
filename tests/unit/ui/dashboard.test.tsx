// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DashboardPage from "../../../app/dashboard/page";

/**
 * The dashboard's contract: an honest empty state instead of the four `--`
 * tiles, on the token layer, with one primary action.
 */
describe("Dashboard Page", () => {
  it("renders the dashboard heading", () => {
    const { container } = render(<DashboardPage />);

    expect(container.querySelector("h1")?.textContent).toBe("Dashboard");
  });

  it("shows the empty state instead of placeholder statistics", () => {
    const { container } = render(<DashboardPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("No completed matches yet.");
    expect(text).toContain("Finish a leg to see your rating, average and checkout rate here.");

    // A `--` tile, or a zero, is a claim about a number that does not
    // exist. The empty state is the honest answer.
    expect(text).not.toContain("--");
    expect(text).not.toMatch(/\b0\b/);
  });

  it("uses the semantic token layer", () => {
    const { container } = render(<DashboardPage />);

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
    const { container } = render(<DashboardPage />);

    const primary = [...container.querySelectorAll("a, button")].filter((element) =>
      (element.getAttribute("class") ?? "").split(/\s+/).includes("bg-brass"),
    );

    expect(primary).toHaveLength(1);
    expect(primary[0]?.getAttribute("href")).toBe("/game-center");
  });

  it("renders no landmark of its own", () => {
    const { container } = render(<DashboardPage />);

    expect(container.querySelectorAll("main, footer, nav, header.sticky").length).toBe(0);
  });
});
