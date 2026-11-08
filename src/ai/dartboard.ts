import type { AccuracyClass, DartResult, RingType } from "./types"; /**
 * Real dartboard geometry (millimetres from the board centre) and the throw
 * resolution model. Sector order starts at 20 (top centre) and runs clockwise:
 * 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5.
 */
export const SECTOR_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const RING_RADII_MM = {
  innerBull: 6.35,
  outerBull: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  boardEdge: 225.5,
} as const;

/** Radii the engine aims at: the centre of each target bed along its sector. */
const AIM_RADII_MM = {
  single: 134.5, // centre of the big single bed (107-162)
  double: 166, // centre of the double ring (162-170)
  triple: 103, // centre of the triple ring (99-107)
  outerBull: 11, // centre of the outer bull ring (6.35-15.9)
  bull: 0,
} as const;

export interface BoardPoint {
  x: number;
  y: number;
}

export interface Aim {
  label: string;
  point: BoardPoint;
  accuracyClass: "single" | "double" | "triple" | "bull" | "outerBull";
  /** Sector (1-20) the aim belongs to, or 0 for bull aims. */
  number: number;
}

const SECTOR_COUNT = 20;
const SECTOR_ARC_DEG = 360 / SECTOR_COUNT;
const HALF_SECTOR_ARC_DEG = SECTOR_ARC_DEG / 2;

const RING_TO_CLASS: Record<string, "single" | "double" | "triple"> = {
  S: "single",
  D: "double",
  T: "triple",
};

export function sectorIndexFor(sector: number): number | undefined {
  const index = SECTOR_ORDER.indexOf(sector as (typeof SECTOR_ORDER)[number]);
  return index === -1 ? undefined : index;
}

/** Maps an aim to the accuracy-class sigma that drives its aim spread. */
export function sigmaClassFor(aim: Aim): AccuracyClass {
  return aim.accuracyClass === "outerBull" ? "bull" : aim.accuracyClass;
}

/** Clockwise angle of a sector centre, measured from the top (20). */
function sectorBearingDeg(sector: number): number {
  const index = sectorIndexFor(sector);
  if (index === undefined) {
    throw new Error(`Unknown dartboard sector: ${sector}`);
  }
  return index * SECTOR_ARC_DEG;
}

/** Parses a canonical aim label ("S20", "D16", "T19", "BULL", "BULL25"). */
export function parseAimLabel(label: string): Aim {
  if (label === "BULL") {
    return { label, point: { x: 0, y: 0 }, accuracyClass: "bull", number: 0 };
  }
  if (label === "BULL25") {
    return {
      label,
      point: { x: 0, y: AIM_RADII_MM.outerBull },
      accuracyClass: "outerBull",
      number: 0,
    };
  }
  const match = /^([SDT])(\d{1,2})$/.exec(label);
  if (!match) {
    throw new Error(`Invalid aim label: ${label}`);
  }
  const [, ring, digits] = match;
  const number = Number.parseInt(digits ?? "", 10);
  if (number < 1 || number > 20) {
    throw new Error(`Invalid sector in aim label: ${label}`);
  }
  const accuracyClass = ring ? RING_TO_CLASS[ring] : undefined;
  if (!accuracyClass) {
    throw new Error(`Invalid ring in aim label: ${label}`);
  }
  const bearing = (sectorBearingDeg(number) * Math.PI) / 180;
  const radius = AIM_RADII_MM[accuracyClass];
  return {
    label,
    point: { x: radius * Math.sin(bearing), y: radius * Math.cos(bearing) },
    accuracyClass,
    number,
  };
}

/** True when a resolved hit landed exactly on the intended target. */
export function isIntendedHit(hit: DartResult, aim: Aim): boolean {
  switch (aim.accuracyClass) {
    case "single":
    case "double":
    case "triple":
      return hit.ring === aim.accuracyClass && hit.sector === aim.number;
    case "bull":
      return hit.ring === "innerBull";
    case "outerBull":
      return hit.ring === "outerBull";
  }
}

function ringForRadius(r: number): { ring: RingType; multiplier: 1 | 2 | 3 } | null {
  if (r <= RING_RADII_MM.tripleInner) {
    return { ring: "single", multiplier: 1 };
  }
  if (r <= RING_RADII_MM.tripleOuter) {
    return { ring: "triple", multiplier: 3 };
  }
  if (r <= RING_RADII_MM.doubleInner) {
    return { ring: "single", multiplier: 1 };
  }
  if (r <= RING_RADII_MM.doubleOuter) {
    return { ring: "double", multiplier: 2 };
  }
  return null;
}

/**
 * Resolves where a dart lands: the aim point offset by an aim error vector,
 * mapped onto real dartboard geometry. Beyond the double ring darts score
 * nothing (`noScore` inside the rim, `offBoard` past the board edge).
 */
export function resolveHit(aim: BoardPoint, errorDx: number, errorDy: number): DartResult {
  const x = aim.x + errorDx;
  const y = aim.y + errorDy;
  const r = Math.hypot(x, y);

  if (r <= RING_RADII_MM.innerBull) {
    return { ring: "innerBull", sector: 0, score: 50 };
  }
  if (r <= RING_RADII_MM.outerBull) {
    return { ring: "outerBull", sector: 0, score: 25 };
  }
  if (r > RING_RADII_MM.boardEdge) {
    return { ring: "offBoard", sector: 0, score: 0 };
  }

  const ring = ringForRadius(r);
  if (!ring) {
    // Inside the rim between the double ring and the board edge: no score.
    return { ring: "noScore", sector: 0, score: 0 };
  }

  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const sectorIndex = Math.floor(((bearing + HALF_SECTOR_ARC_DEG) % 360) / SECTOR_ARC_DEG);
  const sector = sectorIndex === undefined ? 0 : (SECTOR_ORDER[sectorIndex] ?? 0);
  if (sector === 0) {
    return { ring: "offBoard", sector: 0, score: 0 };
  }
  return { ring: ring.ring, sector, score: sector * ring.multiplier };
}
