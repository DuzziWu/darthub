/**
 * Smartphone-camera implementation of the {@link ICameraService} contract.
 *
 * This build is a STUB, not a computer-vision implementation: it performs the
 * real, permission-gated camera handshake through
 * `navigator.mediaDevices.getUserMedia`, but does NOT yet perform, run, or
 * contain any image analysis. `captureThrow` therefore resolves with
 * deterministic dummy {@link CameraDTO} data (impact at the board centre,
 * fixed score of 60 — see `createStubCapture`), unless a capture processor
 * is injected via the constructor. The dummy data is safe for development
 * and UX work only.
 *
 * The future CV module (see `src/camera/README.md`) will replace the dummy
 * capture path by implementing {@link ICameraProcessor}, the only contract
 * between this layer and computer vision. No CV library dependency is (or
 * may be) introduced while this stub is in place.
 *
 * Browser-only APIs (navigator / MediaDevices) are accessed lazily behind
 * runtime guards, so this module is safe to import in a plain Node
 * environment (unit tests, server-side wiring).
 */
import type { CameraDTO } from "./CameraDTO";
import type { ICameraProcessor } from "./ICameraProcessor";
import type { ICameraService } from "./ICameraService";

/**
 * Base typed error for all camera-session failures. Wrapping in a typed
 * error keeps callers free of browser-specific DOMException knowledge.
 */
export class CameraError extends Error {
  public constructor(message: string, options?: { cause: unknown }) {
    super(message);
    this.name = "CameraError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Raised when the camera cannot be initialised at all: runtime without a
 * MediaDevices API, missing hardware, or denied permission (NotAllowedError).
 */
export class CameraUnavailableError extends CameraError {
  public constructor(cause?: unknown) {
    super("Camera is unavailable or permission was denied", {
      cause: cause ?? null,
    });
    this.name = "CameraUnavailableError";
  }
}

/**
 * Video constraints used for the smartphone (back-facing) camera.
 */
const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "environment" },
  audio: false,
};

/**
 * A capture processor turns camera frames from the active stream into a
 * detected {@link CameraDTO}. Deliberately a minimal function shape so the
 * upcoming computer-vision implementation (task 044, ICameraProcessor) can
 * be adapted in without coupling this file to CV internals.
 */
export type CameraProcessor = (stream: MediaStream) => Promise<CameraDTO>;

/**
 * STUB DATA: deterministic dummy capture used until real dart detection
 * (computer vision, task 044) replaces it. Impact at the board centre,
 * fixed 60 score, current wall-clock time.
 */
const createStubCapture = (): CameraDTO => ({
  x: 0,
  y: 0,
  score: 60,
  timestamp: Date.now(),
});

export type SmartphoneCameraServiceOptions = {
  /**
   * Optional analysis hook injected instead of the built-in stub capture.
   * Accepts either the {@link ICameraProcessor} plug point (the seam the
   * future CV implementation will use) or a bare capture function.
   */
  processor?: CameraProcessor | ICameraProcessor;
};

export class SmartphoneCameraService implements ICameraService {
  private stream: MediaStream | null = null;
  private readonly processor: CameraProcessor | null;

  public constructor(options?: SmartphoneCameraServiceOptions) {
    this.processor =
      options?.processor === undefined
        ? null
        : SmartphoneCameraService.toFunction(options.processor);
  }

  /**
   * Normalises the injected processor: an {@link ICameraProcessor} object is
   * adapted to the internal function shape by delegating to `processFrame`,
   * while a bare camera processor function is used as-is.
   */
  private static toFunction(processor: CameraProcessor | ICameraProcessor): CameraProcessor {
    if (typeof processor === "function") {
      return processor;
    }
    return (stream: MediaStream) => processor.processFrame(stream);
  }

  async start(): Promise<void> {
    try {
      this.stream = await this.requestStream();
    } catch (error) {
      this.stream = null;
      // Permission denial and camera unavailability are surfaced as a clean,
      // typed error instead of letting the raw browser DOMException escape.
      throw new CameraUnavailableError(error);
    }
  }

  async stop(): Promise<void> {
    const stream = this.requireStream();
    // Releases the hardware capture resources held by the session.
    for (const track of stream.getTracks()) {
      track.stop();
    }
    this.stream = null;
  }

  async captureThrow(): Promise<CameraDTO> {
    // Snapshot so a concurrent stop can null the field mid-capture.
    const stream = this.requireStream();
    if (this.processor !== null) {
      return this.processor(stream);
    }
    return createStubCapture();
  }

  /** Guards the contract precondition: the session must be started. */
  private requireStream(): MediaStream {
    if (this.stream === null) {
      throw new CameraError("Camera session has not been started");
    }
    return this.stream;
  }

  /**
   * Requests the camera stream from the (browser-provided) MediaDevices API.
   * A runtime guard keeps the lookup lazy so Node imports stay safe.
   */
  private requestStream(): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return Promise.reject(
        new Error("MediaDevices API (navigator.mediaDevices) is not available"),
      );
    }
    return navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
  }
}
