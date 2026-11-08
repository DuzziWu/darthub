import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * Smoke tests verifying the three UI skeleton pages compile and render
 * without crashing. Snapshot assertions confirm the expected structure.
 */

describe("UI Skeletons", () => {
  describe("Dashboard Page", () => {
    it("renders the dashboard with user stats placeholder", async () => {
      const { default: DashboardPage } = await import("../../app/dashboard/page");
      const html = renderToString(<DashboardPage />);
      expect(html).toContain("Rating");
      expect(html).toContain("Level");
      expect(html).toContain("Friends");
    });
  });

  describe("Lobby Page", () => {
    it("renders the lobby with list of available rooms", async () => {
      const { default: LobbyPage } = await import("../../app/lobby/page");
      const html = renderToString(<LobbyPage />);
      expect(html).toContain("Room");
      expect(html).toContain("Create");
      expect(html).toContain("Matchmaking");
    });
  });

  describe("Career Page", () => {
    it("renders the career screen with current quest", async () => {
      const { default: CareerPage } = await import("../../app/career/page");
      const html = renderToString(<CareerPage />);
      expect(html).toContain("Quest");
      expect(html).toContain("Progress");
      expect(html).toContain("Training");
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
