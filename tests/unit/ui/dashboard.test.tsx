import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * Unit tests for Dashboard page component.
 */
describe("Dashboard Page", () => {
  it("renders dashboard with mock user data", async () => {
    const { default: DashboardPage } = await import("../../../app/dashboard/page");
    const html = renderToString(<DashboardPage />);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Rating");
    expect(html).toContain("Level");
    expect(html).toContain("XP");
    expect(html).toContain("Friends");
  });

  it("displays stat placeholders", async () => {
    const { default: DashboardPage } = await import("../../../app/dashboard/page");
    const html = renderToString(<DashboardPage />);
    // Stat cards should be rendered with -- placeholder
    expect(html).toContain("--");
  });

  it("matches snapshot structure", async () => {
    const { default: DashboardPage } = await import("../../../app/dashboard/page");
    const html = renderToString(<DashboardPage />);
    expect(html).toMatchSnapshot();
  });

  it("uses responsive breakpoints (mobile view)", async () => {
    const { default: DashboardPage } = await import("../../../app/dashboard/page");
    const html = renderToString(<DashboardPage />);
    // Check for responsive Tailwind classes
    expect(html).toContain("min-h-screen");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("md:p-8");
  });
});
