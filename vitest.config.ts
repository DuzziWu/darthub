import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // The suite shares its machine: several worktrees and repositories run
    // their suites at the same time on two CPUs. A test that renders a
    // component in jsdom needs ~5 s on an idle machine and ~37 s when three
    // suites compete for the same cores — a 30 s budget then fails the suite
    // for a reason that has nothing to do with the code. Tests that run a
    // compiler declare their own, larger budget (900 s, see
    // tests/unit/typescript.test.ts); this is the general budget for the
    // remaining tests.
    testTimeout: 120000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // The whole-repository gate commands (lint, format:check, typecheck) are
    // executed once per suite run and shared between the gate tests and the
    // CI workflow replay. The setup creates the temporary directory that
    // holds the shared results and publishes its path; see
    // tests/support/global-setup.ts and tests/support/gate-commands.ts.
    globalSetup: ["./tests/support/global-setup.ts"],
  },
});
