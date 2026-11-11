import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/** Scratch-only config: runs the engine proof file under .devflow/tmp. */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "../../src"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 30000,
    include: [".devflow/tmp/**/*.test.ts"],
  },
});
