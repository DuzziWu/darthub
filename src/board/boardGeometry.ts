/**
 * Shared dartboard geometry — the single place that knows where a point on
 * the board is and what it scores.
 *
 * Pure TypeScript: no DOM, no React, no Node built-ins, no filesystem, so
 * the virtual board, the game server and the camera pipeline can all import
 * it unchanged.
 *
 * Coordinate frame: millimetres in the board plane, origin at the board
 * centre, **x positive = right, y positive = above centre**. This is the
 * same frame `src/camera/CameraDTO.ts` and `src/camera/vision/Perspective.ts`
 * already use, so no adapter is needed.
 */

/** Overall board diameter in millimetres (451 mm across). */
export const BOARD_DIAMETER_MM = 451;

/**
 * Band radii in millimetres, measured from the board centre.
 *
 * The playing surface ends at `doubleOuter` (170 mm); everything beyond it
 * (the number ring and off-board space) is a miss.
 */
export const BOARD_RADII_MM: Readonly<{
  innerBull: 6.35;
  outerBull: 15.9;
  innerSingleOuter: 99;
  trebleOuter: 107;
  outerSingleOuter: 162;
  doubleOuter: 170;
  numberRingOuter: 225.5;
}> = {
  innerBull: 6.35,
  outerBull: 15.9,
  innerSingleOuter: 99,
  trebleOuter: 107,
  outerSingleOuter: 162,
  doubleOuter: 170,
  numberRingOuter: 225.5,
};

/**
 * The 20 sector numbers, clockwise from 20 at 12 o'clock. Sector *i* is
 * centred on the direction *i* × 18° clockwise from 12 o'clock.
 */
export const BOARD_SEGMENT_ORDER: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

/** The part of the board a dart hit. */
export type BoardSegment = "single" | "double" | "triple" | "bull";

/** A resolved, scoring hit on the board. */
export interface BoardHit {
  readonly segment: BoardSegment;
  /** Points awarded (0..60, or 25 / 50 for the bulls). */
  readonly points: number;
  /** The sector number 1..20, or null for a bull. */
  readonly sector: number | null;
  /** Human-readable mark, e.g. "T20", "D16", "S7", "BULL 50". */
  readonly label: string;
}

/** The outcome of resolving a board-plane point. */
export type BoardResolution =
  | { readonly hit: false; readonly points: 0; readonly label: "MISS" }
  | ({ readonly hit: true } & BoardHit);

const SECTOR_COUNT = 20;
/** Angular width of one sector: 18°. */
const SECTOR_ANGLE_RAD = (2 * Math.PI) / SECTOR_COUNT;
/** Half a sector: 9°. */
const SECTOR_HALF_ANGLE_RAD = SECTOR_ANGLE_RAD / 2;
/** Absorbs float error so a point exactly on a wedge edge lands on the side the rule names. */
const EDGE_EPSILON_RAD = 1e-9;

/**
 * The sector number containing a board-plane point.
 *
 * The bearing is measured clockwise from 12 o'clock. A point exactly on a
 * wedge edge belongs to the sector whose angular range *starts* there, so
 * the sector window is closed at its start and open at its end.
 */
function sectorNumberAt(xMm: number, yMm: number): number {
  const bearing = Math.atan2(xMm, yMm);
  const normalized = bearing < 0 ? bearing + 2 * Math.PI : bearing;
  const index =
    Math.floor((normalized + SECTOR_HALF_ANGLE_RAD + EDGE_EPSILON_RAD) / SECTOR_ANGLE_RAD) %
    SECTOR_COUNT;
  return BOARD_SEGMENT_ORDER[index] ?? 20;
}

/**
 * Resolve a point on the board, in board-plane millimetres, to a scored
 * throw. Points outside the double ring are a miss.
 */
export function resolveBoardHit(xMm: number, yMm: number): BoardResolution {
  const r = Math.hypot(xMm, yMm);
  const radii = BOARD_RADII_MM;

  if (r > radii.doubleOuter) {
    return { hit: false, points: 0, label: "MISS" };
  }
  if (r <= radii.innerBull) {
    return { hit: true, segment: "bull", points: 50, sector: null, label: "BULL 50" };
  }
  if (r <= radii.outerBull) {
    return { hit: true, segment: "bull", points: 25, sector: null, label: "BULL 25" };
  }

  const sector = sectorNumberAt(xMm, yMm);
  if (r <= radii.innerSingleOuter) {
    return { hit: true, segment: "single", points: sector, sector, label: `S${sector}` };
  }
  if (r <= radii.trebleOuter) {
    return { hit: true, segment: "triple", points: sector * 3, sector, label: `T${sector}` };
  }
  if (r <= radii.outerSingleOuter) {
    return { hit: true, segment: "single", points: sector, sector, label: `S${sector}` };
  }
  return { hit: true, segment: "double", points: sector * 2, sector, label: `D${sector}` };
}

/**
 * Convert a pixel offset from the board centre into board-plane
 * millimetres. The y axis is negated because SVG's y grows downward while
 * the board frame's y grows upward.
 */
export function toBoardMm(
  dxPx: number,
  dyPx: number,
  pxPerMm: number,
): { xMm: number; yMm: number } {
  return { xMm: dxPx / pxPerMm, yMm: -dyPx / pxPerMm };
}
