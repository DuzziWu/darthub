import { describe, it, expect } from "vitest";
import {
  BOARD_SOURCES,
  CAMERA_BOARD_SOURCE,
  SMART_DART_SOURCE,
  VIRTUAL_BOARD_SOURCE,
} from "@/board/boardSource";

describe("board sources", () => {
  it("offers the virtual board and marks the planned sources unavailable", () => {
    expect([...BOARD_SOURCES]).toEqual([
      VIRTUAL_BOARD_SOURCE,
      CAMERA_BOARD_SOURCE,
      SMART_DART_SOURCE,
    ]);

    expect(VIRTUAL_BOARD_SOURCE).toMatchObject({
      id: "virtual",
      label: "Virtual Board",
      available: true,
    });
    expect(CAMERA_BOARD_SOURCE).toMatchObject({
      id: "camera",
      label: "Camera Board",
      available: false,
    });
    expect(SMART_DART_SOURCE).toMatchObject({
      id: "smart",
      label: "Smart Dart",
      available: false,
    });

    // Every unavailable source explains itself to the user.
    for (const source of BOARD_SOURCES) {
      if (!source.available) {
        expect(source.note).toBeTruthy();
      }
    }
  });
});
