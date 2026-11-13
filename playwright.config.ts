import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // The suite runs against a production build, not `next dev`. The dev server
  // recompiles every route on demand and its hot-reload runtime keeps the
  // page busy, so Playwright's actionability checks stall: the visual QC
  // specs took 8+ minutes and failed on timeouts against `next dev`, while
  // the same specs pass in under a minute against a production build.
  //
  // `output: "standalone"` in next.config.ts means `next start` cannot serve
  // the app, so the standalone server is started directly. The static assets
  // are copied next to it the same way the Dockerfile's runner stage does.
  //
  // `HOSTNAME` is pinned to 127.0.0.1: without it the standalone server binds
  // to the machine's hostname, which is not reachable at localhost.
  //
  // The suite needs two builds: the root build for the specs that exercise
  // the app as a developer runs it, and a build that carries the path prefix
  // for the sub-path preview, which publishes the app under `/darthub`. The
  // second build writes to its own directory so the two do not overwrite
  // each other.
  webServer: [
    {
      command:
        "npm run build && rm -rf .next/standalone/public .next/standalone/.next/static && cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static && HOSTNAME=127.0.0.1 node .next/standalone/server.js",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      command:
        "npm run build:prefixed && rm -rf .next-prefixed/standalone/public .next-prefixed/standalone/.next-prefixed/static && cp -r public .next-prefixed/standalone/public && cp -r .next-prefixed/static .next-prefixed/standalone/.next-prefixed/static && HOSTNAME=127.0.0.1 PORT=3111 node .next-prefixed/standalone/server.js",
      url: "http://127.0.0.1:3111",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
