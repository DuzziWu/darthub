import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * Unit tests for Lobby page component.
 */
describe("Lobby Page", () => {
  it("renders lobby with matchmaking and room sections", async () => {
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const html = renderToString(<LobbyPage />);
    expect(html).toContain("Game Lobby");
    expect(html).toContain("Matchmaking");
    expect(html).toContain("Find Match");
    expect(html).toContain("Public Rooms");
    expect(html).toContain("Private Room");
    expect(html).toContain("Create Room");
  });

  it("shows list of rooms in lobby placeholder", async () => {
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const html = renderToString(<LobbyPage />);
    expect(html).toContain("No rooms available");
  });

  it("has interactive buttons", async () => {
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const html = renderToString(<LobbyPage />);
    expect(html).toContain("Find Match");
    expect(html).toContain("Create Room");
  });

  it("matches snapshot structure", async () => {
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const html = renderToString(<LobbyPage />);
    expect(html).toMatchSnapshot();
  });

  it("uses responsive design classes", async () => {
    const { default: LobbyPage } = await import("../../../app/lobby/page");
    const html = renderToString(<LobbyPage />);
    expect(html).toContain("min-h-screen");
    expect(html).toContain("md:p-8");
  });
});
