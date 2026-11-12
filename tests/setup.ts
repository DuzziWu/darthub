/**
 * Global Vitest setup.
 *
 * Registers the Testing Library cleanup for every DOM test file. Without it,
 * a rendered React root survives until the environment is torn down: React's
 * scheduler defers work through `setImmediate`, so a pending callback then
 * fires after jsdom is gone and fails with "window is not defined".
 *
 * The cleanup is registered here rather than in each test file so no test can
 * silently forget it. `@testing-library/react` only auto-registers cleanup
 * when Vitest's `globals` option is enabled, which this project does not use.
 */

import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
