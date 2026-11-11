// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LobbyPage from "../../../app/lobby/page";

/**
 * The lobby's contract: a room list that says honestly that there are no
 * rooms, on the token layer, with one primary action.
 */
describe("Lobby Page", () => {
  it("renders the lobby heading", () => {
    const { container } = render(<LobbyPage />);

    expect(container.querySelector("h1")?.textContent).toBe("Lobby");
  });

  it("shows the empty room state instead of invented rooms", () => {
    const { container } = render(<LobbyPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("No public rooms right now.");
    expect(text).toContain("Start a private room and invite someone, or find a match.");

    // No room rows, no host names and no player counts: none of that is
    // real yet.
    expect(container.querySelectorAll("tbody tr").length).toBe(0);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it("uses the semantic token layer", () => {
    const { container } = render(<LobbyPage />);

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

  it("offers one primary action and one secondary action", () => {
    const { container } = render(<LobbyPage />);

    const actions = [...container.querySelectorAll("a, button")];
    const primary = actions.filter((element) =>
      (element.getAttribute("class") ?? "").split(/\s+/).includes("bg-brass"),
    );
    const secondary = actions.filter((element) =>
      (element.getAttribute("class") ?? "").split(/\s+/).includes("bg-raised"),
    );

    expect(primary).toHaveLength(1);
    expect(primary[0]?.textContent).toBe("Find Match");
    expect(secondary).toHaveLength(1);
    expect(secondary[0]?.textContent).toBe("Create Room");
  });

  it("renders no landmark of its own", () => {
    const { container } = render(<LobbyPage />);

    expect(container.querySelectorAll("main, footer, nav, header.sticky").length).toBe(0);
  });
});
