/**
 * Scaffold tests for the future computer-vision pipeline outline (task 045).
 *
 * The module is a placeholder: classes, method stubs and interfaces must
 * exist and compile, but every method honestly refuses to run (a real CV
 * implementation must not be faked with plausible-looking dummy results —
 * see NotImplementedInCvPhaseError and src/camera/vision/README.md).
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CameraCalibration, CameraDTO } from "@/camera";
import {
  Calibration,
  HitDetector,
  NotImplementedInCvPhaseError,
  Perspective,
} from "@/camera/vision";
import type { DetectedDartImpact } from "@/camera/vision";
import { runCommand } from "../../../support/run-command";

const SAMPLE_CALIBRATION: CameraCalibration = {
  homography: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  boardReferenceDiameterMm: 451,
};

const SAMPLE_FRAME = { widthPx: 1920, heightPx: 1080, capturedAt: 1234 };

const createSampleStream = (): MediaStream => ({}) as unknown as MediaStream;

describe("Camera CV module outline (task 045)", () => {
  it("defines the Calibration class with method stubs for calibrate() and apply()", async () => {
    const calibration = new Calibration();

    expect(typeof calibration.calibrate).toBe("function");
    expect(typeof calibration.apply).toBe("function");

    // calibrate() is the future camera-intrinsic/extrinsic estimation hook:
    // it must be awaited (async contract) and must refuse to produce data.
    await expect(calibration.calibrate(createSampleStream())).rejects.toBeInstanceOf(
      NotImplementedInCvPhaseError,
    );

    // apply() is the frame-normalisation hook feeding the perspective stage.
    expect(() => calibration.apply(SAMPLE_FRAME, SAMPLE_CALIBRATION)).toThrow(
      NotImplementedInCvPhaseError,
    );
  });

  it("defines the Perspective class with method stub transform()", () => {
    const perspective = new Perspective();

    expect(typeof perspective.transform).toBe("function");

    // transform() maps an image point to board-plane millimetres through the
    // calibration homography; the stub must refuse to run.
    expect(() => perspective.transform({ xPx: 960, yPx: 540 }, SAMPLE_CALIBRATION)).toThrow(
      NotImplementedInCvPhaseError,
    );
  });

  it("defines the HitDetector class with method stub detect() returning a CameraDTO", async () => {
    const hitDetector = new HitDetector();

    expect(typeof hitDetector.detect).toBe("function");

    // detect() is typed to resolve a CameraDTO (board-mm impact coordinates
    // plus the derived score); the compile-time shape is proved by the
    // scoped tsc contract run, the stub behaviour here.
    const impact: DetectedDartImpact = { xMm: 60, yMm: -45 };
    const detected: Promise<CameraDTO> = hitDetector.detect(impact);

    await expect(detected).rejects.toBeInstanceOf(NotImplementedInCvPhaseError);
  });

  it("includes type tests that the interfaces compile", () => {
    // Scoped tsc run over src/camera (incl. the vision outline) plus this
    // directory's `*.check.ts` contract probes — the same pattern as the
    // camera abstraction's compile test (task 044).
    const { exitCode, output } = runCommand(
      "npx tsc --noEmit --project tests/unit/camera/vision/tsconfig.json",
    );

    expect(exitCode, `scoped tsc exited with ${exitCode}:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error TS\d+/);
  });

  it("documents the intended algorithmic steps in the vision README", () => {
    // Acceptance criterion: the README must spell out the planned pipeline
    // (calibration -> perspective correction -> hit detection -> scoring)
    // and mark it as future work.
    const readme = readFileSync(
      resolve(import.meta.dirname, "../../../../src/camera/vision/README.md"),
      "utf8",
    );

    expect(readme).toMatch(/future\s+phase/i);
    expect(readme).toMatch(/\*\*Calibration\*\*/);
    expect(readme).toMatch(/\*\*Perspective correction\*\*/);
    expect(readme).toMatch(/\*\*Hit detection\*\*/);
    expect(readme).toMatch(/\*\*Scoring\*\*/);
  });

  it("imports no external libraries (pure outline module)", () => {
    // The module outline must compile without external dependencies: the
    // only allowed module sources are relative paths and the `@/camera`
    // sibling namespace (framework-agnostic-guard pattern, as used by the
    // game engine).
    const SRC_DIR = resolve(import.meta.dirname, "../../../../src/camera/vision");
    const files = readdirSync(SRC_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => resolve(SRC_DIR, entry.name));

    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const from of contents.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = from[1] ?? "";
        if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
          offenders.push(`${specifier}: ${file}`);
        }
      }
      if (/\b(?:import\s*\(|require\s*\()/.test(contents)) {
        offenders.push(`dynamic import/require: ${file}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
