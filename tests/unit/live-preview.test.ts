import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const playwrightConfigPath = resolve(process.cwd(), "playwright.config.ts");
const playwrightConfig = readFileSync(playwrightConfigPath, "utf-8");
const agentsPath = resolve(process.cwd(), "AGENTS.md");
const agents = readFileSync(agentsPath, "utf-8");
const deployment = readFileSync(resolve(process.cwd(), "docs/DEPLOYMENT.md"), "utf-8");

/**
 * The published site is served by the standalone server on port 3000. It is a
 * host process — the proxy that forwards to it runs on the same host — and it
 * has to be the only server on the port.
 *
 * The bind address follows the topology, and both topologies are pinned here:
 *
 * - The live preview binds `127.0.0.1`, because the Tailscale mount points at
 *   `http://127.0.0.1:3000` on this very host. Loopback is the correct and the
 *   safe choice: the published site reaches the server, nothing else does.
 * - The container image binds `0.0.0.0`, because there the proxy runs on the
 *   host and reaches the container across the bridge on `172.18.0.2:3000`. A
 *   loopback-only container refuses that connection.
 *
 * On 2026-11-14 the site answered 502 for every user while every local health
 * check passed: the preview was still the container variant, its server was
 * restarted with the E2E convention `HOSTNAME=127.0.0.1`, and the proxy's
 * connection to the container's bridge address `172.18.0.2:3000` was refused —
 * while the application kept answering 200 on `http://127.0.0.1:3000/` inside
 * the container.
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
    expect(rootCommand).toMatch(/PORT=3100\b/);
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

  it("documents the published server's bind address and the 502 failure form", () => {
    // The runbook and its reason are the only thing that survives a restart.
    // The preview is a host process and the mount points at the loopback
    // address of the same host, so loopback is what it has to bind.
    expect(agents).toMatch(
      /setsid -f env HOSTNAME=127\.0\.0\.1 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
    );
    expect(agents).not.toMatch(
      /setsid -f env HOSTNAME=0\.0\.0\.0 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
    );

    // The preview is the standalone server of the prefixed build, started
    // detached so it outlives the session that started it, and the mount
    // points at it on the loopback address of the same host.
    expect(agents).toContain(".next-prefixed/standalone/server.js");
    expect(agents).toContain("setsid -f");
    expect(agents).toContain("http://127.0.0.1:3000");

    // The table is the artefact an operator consults for "which address do I
    // bind?" — pin both of its rows, not only the command line above.
    expect(agents).toMatch(/\|\s*Live preview \(port 3000\)\s*\|\s*`127\.0\.0\.1`/);
    expect(agents).toMatch(/\|\s*Container image \(port 3000\)\s*\|\s*`0\.0\.0\.0`/);

    // The 502 shape, not just the word: the runbook has to keep the symptom
    // that is expensive to rediscover — broken for every user while every
    // local health check passes.
    expect(agents).toMatch(/502 Bad Gateway/);
    expect(agents).toMatch(/broken for every user while every local health check\s+passes/);

    // The port reservation: the suite runs on 3100 and 3111, port 3000 belongs
    // to the preview alone.
    expect(agents).toMatch(/3100\D+3111/);
    expect(agents).toMatch(/port 3000 belongs to the live preview alone/);
  });

  it("keeps the container variant documented as an alternative", () => {
    // The image can serve the same mount. There the proxy reaches the
    // container across the bridge, so the container has to bind every
    // interface — and the runbook has to keep that address, it is the check
    // that tells the two topologies apart.
    expect(agents).toMatch(/172\.18\.0\.2/);
    expect(agents).toContain("BASE_PATH=/darthub");
    expect(agents).toContain("HOSTNAME=0.0.0.0");
  });

  it("records the port reservation in the deployment guide", () => {
    expect(deployment).toMatch(
      /setsid -f env HOSTNAME=127\.0\.0\.1 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
    );
    expect(deployment).not.toMatch(
      /setsid -f env HOSTNAME=0\.0\.0\.0 PORT=3000 node \.next-prefixed\/standalone\/server\.js/,
    );

    // Same topology as the runbook: a host process reached on the loopback
    // address, plus the container variant as the alternative.
    expect(deployment).toContain("http://127.0.0.1:3000");
    expect(deployment).toMatch(/172\.18\.0\.2/);
    expect(deployment).toContain("BASE_PATH=/darthub");
    expect(deployment).toContain("HOSTNAME=0.0.0.0");

    // The same table rows and the same 502 shape as in the runbook.
    expect(deployment).toMatch(/\|\s*Live preview \(port 3000\)\s*\|\s*`127\.0\.0\.1`/);
    expect(deployment).toMatch(/\|\s*Container image \(port 3000\)\s*\|\s*`0\.0\.0\.0`/);
    expect(deployment).toMatch(/502 Bad Gateway/);
    expect(deployment).toMatch(/broken for every user while every local health check\s+passes/);

    // The port reservation.
    expect(deployment).toMatch(/3100\D+3111/);
    expect(deployment).toMatch(/port 3000 is reserved for the published app\s+alone/);
  });
});
