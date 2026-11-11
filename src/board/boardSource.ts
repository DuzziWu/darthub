/**
 * The board-source vocabulary.
 *
 * A board source supplies the *image* of the board and the *points* that
 * come off it. All three differ only in where the image comes from and
 * where the hit coordinates come from — every source produces the same
 * thing: a board-plane point in millimetres.
 */

/** Identifier of a board source. */
export type BoardSourceId = "virtual" | "camera" | "smart";

/** A selectable way of playing on a board. */
export interface BoardSource {
  readonly id: BoardSourceId;
  /** Display label, e.g. "Virtual Board". */
  readonly label: string;
  /** True when the source can actually be played with. */
  readonly available: boolean;
  /** Why the source is unavailable (or what it offers), shown to the user. */
  readonly note?: string;
}

/** The built-in SVG board: clicks are converted to board millimetres. */
export const VIRTUAL_BOARD_SOURCE: BoardSource = {
  id: "virtual",
  label: "Virtual Board",
  available: true,
  note: "Ready — play on the built-in board",
};

/** A live camera feed of a real board, scored by the CV pipeline. */
export const CAMERA_BOARD_SOURCE: BoardSource = {
  id: "camera",
  label: "Camera Board",
  available: false,
  note: "Planned — needs a camera and the computer-vision pipeline",
};

/** A live camera feed scored by a smart dart's onboard sensor. */
export const SMART_DART_SOURCE: BoardSource = {
  id: "smart",
  label: "Smart Dart",
  available: false,
  note: "Planned — needs smart-dart hardware and its app",
};

/** All board sources, in display order. */
export const BOARD_SOURCES: readonly BoardSource[] = [
  VIRTUAL_BOARD_SOURCE,
  CAMERA_BOARD_SOURCE,
  SMART_DART_SOURCE,
];

/**
 * The display label of a board source, e.g. "Virtual Board".
 *
 * The match header names the source the darts come from, so every match view
 * reads the same label from the same vocabulary rather than writing its own.
 */
export function boardSourceLabel(id: BoardSourceId): string {
  return BOARD_SOURCES.find((source) => source.id === id)?.label ?? "Board";
}
