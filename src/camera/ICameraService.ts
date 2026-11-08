import type { CameraDTO } from "./CameraDTO";

/**
 * Contract for a camera-backed throw capture service.
 *
 * Implementations are hardware-specific (smartphone, USB, HDMI, ...) but must
 * expose the same, implementation-agnostic lifecycle: start a camera session,
 * stop it again, and capture a single dart throw from the active stream.
 * No concrete implementation ships with this contract.
 */
export interface ICameraService {
  /**
   * Starts the camera session / stream.
   * Resolves once the camera is ready to capture frames.
   * Rejects when the camera cannot be initialised or is already started.
   */
  start(): Promise<void>;

  /**
   * Stops the camera session and releases all hardware resources.
   * Resolves once the camera has been fully released.
   * Rejects when the camera session has not been started.
   */
  stop(): Promise<void>;

  /**
   * Captures the next dart throw from the active camera stream.
   * Resolves with the captured throw data.
   * Rejects when the camera session is not started or no throw could
   * be detected from the captured frames.
   */
  captureThrow(): Promise<CameraDTO>;
}
