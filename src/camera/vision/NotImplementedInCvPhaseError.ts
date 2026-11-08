/**
 * Typed marker error for every placeholder in the computer-vision module
 * outline (task 045, `src/camera/vision/`).
 *
 * The vision classes are outlines only: no image-processing logic exists in
 * this phase. A stub that returned plausible-looking data would be
 * dishonest (callers could mistake it for a real detection result), so the
 * stubs deliberately raise this error instead. The future CV implementation
 * will replace each throwing stub with the real algorithm.
 */
export class NotImplementedInCvPhaseError extends Error {
  public constructor(api: string) {
    super(`${api} is not implemented in the future CV phase`);
    this.name = "NotImplementedInCvPhaseError";
  }
}
