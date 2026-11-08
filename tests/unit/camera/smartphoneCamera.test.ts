import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraDTO } from "@/camera/CameraDTO";
import type { ICameraService } from "@/camera/ICameraService";
import { SmartphoneCameraService } from "@/camera/SmartphoneCameraService";

/**
 * Test doubles for the browser MediaDevices API.
 *
 * The Camera service must run its tests inside a plain Node environment
 * (no jsdom dependency), so `navigator.mediaDevices` is mocked manually on
 * the Node global object.
 */
type FakeTrack = { stop: ReturnType<typeof vi.fn> };

type FakeStream = { getTracks: () => FakeTrack[] };

const createFakeStream = (): FakeStream => {
  const tracks: FakeTrack[] = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { getTracks: () => tracks };
};

type MediaDevicesMock = {
  getUserMedia: ReturnType<typeof vi.fn>;
};

let getUserMedia: MediaDevicesMock["getUserMedia"];

const installMediaDevices = (getUserMediaImpl: MediaDevicesMock["getUserMedia"]): void => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: getUserMediaImpl } },
  });
};

beforeEach(() => {
  const fakeStream = createFakeStream();
  getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  installMediaDevices(getUserMedia);
});

afterEach(() => {
  // Remove the mocked navigator so other test files are unaffected.
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("SmartphoneCameraService", () => {
  it("requests video permissions via getUserMedia", async () => {
    const service = new SmartphoneCameraService();

    await service.start();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
      audio: false,
    });
  });

  it("resolves a CameraDTO with dummy data when captureThrow is called", async () => {
    const service = new SmartphoneCameraService();
    await service.start();

    const before = Date.now();
    const captured: CameraDTO = await service.captureThrow();

    // Deterministic stub payload: impact at the board centre, fixed score.
    expect(captured.x).toBe(0);
    expect(captured.y).toBe(0);
    expect(captured.score).toBe(60);
    // Timestamp is a valid epoch-millisecond capture time.
    expect(Number.isFinite(captured.timestamp)).toBe(true);
    expect(captured.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("handles permission denial gracefully", async () => {
    // Scenario A: the user (or browser) denies camera permission.
    const deniedGetUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    installMediaDevices(deniedGetUserMedia);

    const deniedService = new SmartphoneCameraService();

    await expect(deniedService.start()).rejects.toThrow(/camera/i);
    // The service must not be left in a half-started state.
    await expect(deniedService.captureThrow()).rejects.toThrow(/not been started/i);

    // Scenario B: no MediaDevices implementation at all (insecure context).
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    const unavailableService = new SmartphoneCameraService();

    await expect(unavailableService.start()).rejects.toThrow(/camera/i);
    await expect(unavailableService.captureThrow()).rejects.toThrow(/not been started/i);
  });

  it("conforms to ICameraService interface", () => {
    const service = new SmartphoneCameraService();

    // Structural assignment check: the concrete class must be usable
    // wherever the implementation-agnostic contract is expected.
    const asContract: ICameraService = service;
    expect(asContract).toBe(service);

    expect(typeof service.start).toBe("function");
    expect(typeof service.stop).toBe("function");
    expect(typeof service.captureThrow).toBe("function");
  });

  it("tests run in a jsdom environment or mock MediaDevices appropriately", () => {
    // Plain Node environment on purpose: jsdom is intentionally NOT a
    // dependency, `navigator.mediaDevices` is mocked manually on the global.
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
    expect(typeof globalThis.navigator).toBe("object");
    expect(typeof globalThis.navigator.mediaDevices).toBe("object");
    expect(vi.isMockFunction(globalThis.navigator.mediaDevices.getUserMedia)).toBe(true);
  });

  it("delegates capture to an injected processor when one is provided", async () => {
    const activeStream = createFakeStream() as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(activeStream);
    installMediaDevices(getUserMedia);

    const processorDto: CameraDTO = { x: 5, y: -3, score: 40, timestamp: 1234 };
    const processor = vi.fn().mockResolvedValue(processorDto);

    const service = new SmartphoneCameraService({ processor });
    await service.start();

    await expect(service.captureThrow()).resolves.toBe(processorDto);
    // The processor receives the active camera stream for analysis.
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith(activeStream);
  });

  it("stops all stream tracks when a started session is stopped", async () => {
    const stream = createFakeStream() as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(stream);
    installMediaDevices(getUserMedia);

    const service = new SmartphoneCameraService();
    await service.start();

    await service.stop();

    for (const track of stream.getTracks()) {
      expect(track.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects stop and capture before the session started", async () => {
    const service = new SmartphoneCameraService();

    await expect(service.stop()).rejects.toThrow(/not been started/i);
  });
});
