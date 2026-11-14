import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const playwrightConfigPath = resolve(process.cwd(), "playwright.config.ts");
const playwrightConfig = readFileSync(playwrightConfigPath, "utf-8");
const agentsPath = resolve(process.cwd(), "AGENTS.md");
const agents = readFileSync(agentsPath, "utf-8");

/**
 * The published site is served by the standalone server on port 3000. The
 * host-side proxy reaches the container on the container's published address,
 * so that listener has to bind every interface — and it has to be the only
 * server on the port.
 *
 * On 2026-11-14 the site answered 502 for every user while every local health
 * check passed: the server on port 3000 bound `127.0.0.1`, so the proxy's
 * connection was refused. The bind address had been replaced because the
 * Playwright suite ran its root build on port 3000 as well and, with
 * `reuseExistingServer`, silently displaced the live preview.
 *
 * These assertions are the guard against that coming back.
 */
describe("the live preview configuration", () => {
  it("keeps port 3000 out of the end-to-end suite", () => {
    // The suite must not claim the published port, or `reuseExistingServer`
    // replaces the live preview with a loopback-bound root build.
    const rootServer = playwrightConfig.match(
      /command:\s*\n?\s*"([^"]*node \.next\/standalone\/server\.js)"/,
    );
    expect(rootServer, "the root E2E server must be discoverable").not.toBeNull();

    const rootCommand = rootServer![1];
    expect(rootCommand).toMatch(/PORT=31\d\d/);
    expect(rootCommand).not.toMatch(/PORT=3000\b/);

    // The prefixed server keeps its own port and stays on loopback: it models
    // the upstream that the local test proxy talks to.
    const prefixedCommand = playwrightConfig.match(
      /"([^"]*node \.next-prefixed\/standalone\/server\.js)"/,
    );
    expect(prefixedCommand, "the prefixed E2E server must be discoverable").not.toBeNull();
    expect(prefixedCommand![1]).toMatch(/PORT=3111\b/);
    expect(prefixedCommand![1]).toMatch(/HOSTNAME=127\.0\.0\.1\b/);

    // The suite's baseURL has to agree with the port the root server binds.
    const baseURL = playwrightConfig.match(/baseURL:\s*"http:\/\/localhost:(\d+)"/);
    expect(baseURL, "the suite must declare a baseURL").not.toBeNull();
    expect(baseURL![1]).not.toBe("3000");
  });

  it("documents that the published server binds every interface", () => {
    // The runbook and its reason are the only thing that survives a restart.
    expect(agents).toContain("HOSTNAME=0.0.0.0 PORT=3000");
    expect(agents).toMatch(/502/);
    expect(agents).toMatch(/172\.18\.0\.2/);
  });

  it("records the port reservation in the deployment guide", () => {
    const deployment = readFileSync(resolve(process.cwd(), "docs/DEPLOYMENT.md"), "utf-8");
    expect(deployment).toContain("HOSTNAME=0.0.0.0 PORT=3000");
    expect(deployment).toMatch(/502/);
  });
});
