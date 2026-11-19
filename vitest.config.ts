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
    testTimeout: 30000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    server: {
      deps: {
        // `next-auth` imports `next/server` without the file extension.
        // Node's own ESM resolver does not add it, so the dependency has
        // to be transformed by Vite, whose resolver does. Without this the
        // Auth.js route module cannot be loaded in a test at all.
        inline: ["next-auth"],
      },
    },
  },
});
