import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * Unit tests for Career page component.
 */
describe("Career Page", () => {
  it("renders career screen with sections", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toContain("Career Mode");
    expect(html).toContain("Current Quest");
    expect(html).toContain("Progress");
    expect(html).toContain("Training");
  });

  it("displays current quest placeholder", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toContain("No active quest");
  });

  it("shows progress bar", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toContain("bg-slate-700");
    expect(html).toContain("bg-blue-600");
    expect(html).toContain('style="width:0%"');
  });

  it("shows training placeholder", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toContain("No training available");
  });

  it("matches snapshot structure", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toMatchSnapshot();
  });

  it("uses responsive design classes", async () => {
    const { default: CareerPage } = await import("../../../app/career/page");
    const html = renderToString(<CareerPage />);
    expect(html).toContain("min-h-screen");
    expect(html).toContain("md:p-8");
  });
});
