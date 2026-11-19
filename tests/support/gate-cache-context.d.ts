/**
 * The `ProvidedContext` augmentation for the shared gate command cache.
 *
 * `tests/support/global-setup.ts` publishes the path of the per-invocation
 * cache directory with the project's `provide`, and the gate tests read it
 * back with `inject("gateCacheDir")`. The augmentation makes that call
 * type-check: without it the key is not part of `ProvidedContext` and
 * `inject` rejects it.
 */

import "vitest";

declare module "vitest" {
  interface ProvidedContext {
    /**
     * The temporary directory that holds the results of the whole-repository
     * gate commands of the current Vitest invocation. It is created by
     * `tests/support/global-setup.ts` and removed in its teardown, so it
     * never outlives the run and never touches the repository.
     */
    gateCacheDir: string;
  }
}
