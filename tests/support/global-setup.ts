/**
 * The per-invocation global setup of the Vitest suite.
 *
 * The suite shares its machine with other worktrees and repositories, and
 * the whole-repository gate commands are the expensive part of a run: lint,
 * format check and typecheck each take minutes when several suites compete
 * for the same two cores. The gate tests and the CI workflow replay would
 * otherwise run every one of them twice per suite run.
 *
 * This setup creates one temporary directory per Vitest invocation and
 * publishes its path through the project's `provide`, so the gate commands
 * can share a single execution between the test files of that run
 * (`tests/support/gate-commands.ts`). The directory lives in the system
 * temporary directory — never in the repository — and the teardown removes
 * it again, so a run leaves nothing behind.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

let cacheDir: string | undefined;

export const setup = (project: TestProject): void => {
  if (cacheDir === undefined) {
    cacheDir = mkdtempSync(join(tmpdir(), "darthub-gate-cache-"));
  }
  project.provide("gateCacheDir", cacheDir);
};

export const teardown = (): void => {
  if (cacheDir === undefined) {
    return;
  }
  rmSync(cacheDir, { recursive: true, force: true });
  cacheDir = undefined;
};
