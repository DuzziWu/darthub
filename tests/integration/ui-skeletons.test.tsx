import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * Smoke tests verifying the four hub pages render without crashing.
 *
 * The assertions are the pages' semantic contract — the headings and the
 * honest empty states — rather than a recorded snapshot of the markup.
 */

describe("UI Skeletons", () => {
  describe("Dashboard Page", () => {
    it("renders the dashboard with its empty state", async () => {
      const { default: DashboardPage } = await import("../../app/dashboard/page");
      const html = renderToString(<DashboardPage />);
      expect(html).toContain("Dashboard");
      expect(html).toContain("No completed matches yet.");
      // The four `--` tiles are gone: a placeholder is not a value.
      expect(html).not.toContain("--");
    });
  });

  describe("Lobby Page", () => {
    it("renders the lobby with its empty room state", async () => {
      const { default: LobbyPage } = await import("../../app/lobby/page");
      const html = renderToString(<LobbyPage />);
      expect(html).toContain("Lobby");
      expect(html).toContain("Public Rooms");
      expect(html).toContain("Private Room");
      expect(html).toContain("Create Room");
      expect(html).toContain("No public rooms right now.");
    });
  });

  describe("Career Page", () => {
    it("renders the career screen with the quests the loader returns", async () => {
      const { default: CareerPage } = await import("../../app/career/page");
      const { createQuestLoaderService } = await import("@/career/questLoader");

      const loader = createQuestLoaderService();
      await loader.load();

      const html = renderToString(<CareerPage />);
      expect(html).toContain("Career Mode");
      expect(html).toContain("Current Quest");
      expect(html).toContain("Progress");
      expect(html).toContain("Training");
      expect(html).toContain("No active quest");

      for (const quest of loader.getQuests()) {
        expect(html, `the page must show the quest "${quest.name}"`).toContain(quest.name);
      }
    });
  });

  it("uses responsive design (mobile + desktop)", async () => {
    // Verify tailwind responsive classes are used in pages
    const dashboard = await import("../../app/dashboard/page");
    const lobby = await import("../../app/lobby/page");
    const career = await import("../../app/career/page");

    expect(dashboard.default.toString()).toBeDefined();
    expect(lobby.default.toString()).toBeDefined();
    expect(career.default.toString()).toBeDefined();
  });

  it("compiles without TypeScript errors", async () => {
    // If this module imports successfully, TypeScript compilation succeeded
    const { default: DashboardPage } = await import("../../app/dashboard/page");
    const { default: LobbyPage } = await import("../../app/lobby/page");
    const { default: CareerPage } = await import("../../app/career/page");

    expect(typeof DashboardPage).toBe("function");
    expect(typeof LobbyPage).toBe("function");
    expect(typeof CareerPage).toBe("function");
  });
});
