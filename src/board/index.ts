/**
 * Public entry point of the shared board module.
 *
 * Pure TypeScript: importable unchanged by the browser, the game server
 * and the camera pipeline.
 */
export {
  BOARD_DIAMETER_MM,
  BOARD_RADII_MM,
  BOARD_SEGMENT_ORDER,
  resolveBoardHit,
  toBoardMm,
} from "./boardGeometry";
export type { BoardHit, BoardResolution, BoardSegment } from "./boardGeometry";

export {
  BOARD_SOURCES,
  CAMERA_BOARD_SOURCE,
  SMART_DART_SOURCE,
  VIRTUAL_BOARD_SOURCE,
  boardSourceLabel,
} from "./boardSource";
export type { BoardSource, BoardSourceId } from "./boardSource";
