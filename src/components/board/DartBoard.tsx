"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  BOARD_DIAMETER_MM,
  BOARD_RADII_MM,
  BOARD_SEGMENT_ORDER,
  resolveBoardHit,
  toBoardMm,
} from "@/board/boardGeometry";
import type { BoardSegment as ThrowSegment } from "@/board/boardGeometry";

/**
 * The dartboard — a pure presentational component.
 *
 * It draws the board in millimetres (the SVG user unit *is* one millimetre),
 * so the picture and the scoring radii read the same constants and cannot
 * drift apart. It imports nothing but React and the shared board module: no
 * rules engine, no vision pipeline, no framework runtime.
 */

/** The band the numeral route scores. Owned by the match view. */
export type ArmedSegment = "single" | "double" | "triple";

export interface DartBoardProps {
  /** The armed band for the numeral route. Owned by the match view. */
  armedSegment: ArmedSegment;
  /** Fired with a resolved hit. `points` is 0 for a miss. */
  onThrow: (hit: { points: number; segment: ThrowSegment | null; label: string }) => void;
  /** Darts in the current visit, oldest first. Drives the hit markers. */
  markers?: ReadonlyArray<{ xMm: number; yMm: number; label: string }>;
  /** Read-only preview mode: no pointer input, no buttons, aria-hidden. */
  readOnly?: boolean;
}

/** The painted radial bands of the playing surface. */
type BandKey = "inner-single" | "treble" | "outer-single" | "double";

const BANDS: ReadonlyArray<{
  key: BandKey;
  r0: number;
  r1: number;
  segment: "single" | "treble" | "double";
}> = [
  {
    key: "inner-single",
    r0: BOARD_RADII_MM.outerBull,
    r1: BOARD_RADII_MM.innerSingleOuter,
    segment: "single",
  },
  {
    key: "treble",
    r0: BOARD_RADII_MM.innerSingleOuter,
    r1: BOARD_RADII_MM.trebleOuter,
    segment: "treble",
  },
  {
    key: "outer-single",
    r0: BOARD_RADII_MM.trebleOuter,
    r1: BOARD_RADII_MM.outerSingleOuter,
    segment: "single",
  },
  {
    key: "double",
    r0: BOARD_RADII_MM.outerSingleOuter,
    r1: BOARD_RADII_MM.doubleOuter,
    segment: "double",
  },
];

/** The five concentric wire rings. */
const WIRE_RINGS = [
  BOARD_RADII_MM.outerBull,
  BOARD_RADII_MM.innerSingleOuter,
  BOARD_RADII_MM.trebleOuter,
  BOARD_RADII_MM.outerSingleOuter,
  BOARD_RADII_MM.doubleOuter,
];

const SECTOR_ANGLE_DEG = 18;
const HALF_ANGLE_DEG = SECTOR_ANGLE_DEG / 2;
/** Every bed edge is inset so the wire channel is a constant 1.2 mm. */
const BED_INSET_MM = 0.6;
const NUMERAL_RADIUS_MM = 191;
const NUMERAL_CAP_MM = 28;

/** The viewBox is in millimetres: one user unit is one millimetre. */
const VIEW_BOX = `-${BOARD_DIAMETER_MM / 2} -${BOARD_DIAMETER_MM / 2} ${BOARD_DIAMETER_MM} ${BOARD_DIAMETER_MM}`;

const DEG_TO_RAD = Math.PI / 180;

/** A point on the board, in SVG coordinates (y grows downward). */
function polar(radiusMm: number, bearingDeg: number): { x: number; y: number } {
  const rad = bearingDeg * DEG_TO_RAD;
  return { x: radiusMm * Math.sin(rad), y: -radiusMm * Math.cos(rad) };
}

function fmt(value: number): string {
  return value.toFixed(3);
}

/** The transform of a marker at a board-plane point (y up → SVG y down). */
function markerTransform(xMm: number, yMm: number): string {
  return `translate(${xMm.toFixed(2)} ${(-yMm).toFixed(2)})`;
}

/**
 * An annular sector between two bearings.
 *
 * The arc runs clockwise on screen (bearing increases clockwise), which is
 * SVG's `sweep-flag 1`; the inner arc runs back the other way.
 */
function annularSector(rInner: number, rOuter: number, a0: number, a1: number): string {
  const outer0 = polar(rOuter, a0);
  const outer1 = polar(rOuter, a1);
  const inner1 = polar(rInner, a1);
  const inner0 = polar(rInner, a0);
  return [
    `M ${fmt(outer0.x)} ${fmt(outer0.y)}`,
    `A ${fmt(rOuter)} ${fmt(rOuter)} 0 0 1 ${fmt(outer1.x)} ${fmt(outer1.y)}`,
    `L ${fmt(inner1.x)} ${fmt(inner1.y)}`,
    `A ${fmt(rInner)} ${fmt(rInner)} 0 0 0 ${fmt(inner0.x)} ${fmt(inner0.y)}`,
    "Z",
  ].join(" ");
}

/**
 * A full ring, drawn as two half arcs.
 *
 * A single 360° arc degenerates (start and end coincide) and renders nothing
 * — the outer bull and the armed-band outline both vanish. Two half arcs
 * never degenerate.
 */
function ring(rOuter: number, rInner: number): string {
  const outer = `M ${fmt(-rOuter)} 0 A ${fmt(rOuter)} ${fmt(rOuter)} 0 1 0 ${fmt(rOuter)} 0 A ${fmt(rOuter)} ${fmt(rOuter)} 0 1 0 ${fmt(-rOuter)} 0 Z`;
  if (rInner <= 0) return outer;
  const inner = `M ${fmt(-rInner)} 0 A ${fmt(rInner)} ${fmt(rInner)} 0 1 1 ${fmt(rInner)} 0 A ${fmt(rInner)} ${fmt(rInner)} 0 1 1 ${fmt(-rInner)} 0 Z`;
  return `${outer} ${inner}`;
}

/** The painted path of one bed: an annular sector, inset at every edge. */
function bedPath(r0: number, r1: number, bearingDeg: number): string {
  const rInner = r0 + BED_INSET_MM;
  const rOuter = r1 - BED_INSET_MM;
  // 0.6 mm of arc is trimmed at each wedge edge, measured at the mean radius.
  const trimDeg = BED_INSET_MM / ((rInner + rOuter) / 2) / DEG_TO_RAD;
  return annularSector(
    rInner,
    rOuter,
    bearingDeg - HALF_ANGLE_DEG + trimDeg,
    bearingDeg + HALF_ANGLE_DEG - trimDeg,
  );
}

/** Which painted band a radius falls in, or null when it misses. */
function bandAtRadius(radiusMm: number): BandKey | "bull-inner" | "bull-outer" | null {
  if (radiusMm <= BOARD_RADII_MM.innerBull) return "bull-inner";
  if (radiusMm <= BOARD_RADII_MM.outerBull) return "bull-outer";
  if (radiusMm <= BOARD_RADII_MM.innerSingleOuter) return "inner-single";
  if (radiusMm <= BOARD_RADII_MM.trebleOuter) return "treble";
  if (radiusMm <= BOARD_RADII_MM.outerSingleOuter) return "outer-single";
  if (radiusMm <= BOARD_RADII_MM.doubleOuter) return "double";
  return null;
}

/** One cell of the keyboard grid: a sector bed, or one of the bulls. */
type Cell =
  | { kind: "bed"; band: "single" | "treble" | "double"; sectorIndex: number }
  | { kind: "bull"; which: "inner" | "outer" };

/** The keyboard rows, outermost band first. */
const CELL_BANDS: ReadonlyArray<"double" | "treble" | "single"> = ["double", "treble", "single"];

const CELLS: readonly Cell[] = [
  ...CELL_BANDS.flatMap((band) =>
    BOARD_SEGMENT_ORDER.map((_number, sectorIndex): Cell => ({ kind: "bed", band, sectorIndex })),
  ),
  { kind: "bull", which: "inner" },
  { kind: "bull", which: "outer" },
];

const BED_CELLS_PER_ROW = BOARD_SEGMENT_ORDER.length;
const BULL_ROW = CELL_BANDS.length;

/** The painted bands a keyboard cell covers. */
function paintedBandsOf(band: "single" | "treble" | "double"): BandKey[] {
  if (band === "single") return ["inner-single", "outer-single"];
  if (band === "treble") return ["treble"];
  return ["double"];
}

/** The outcome a grid cell scores, and the words a screen reader needs. */
function cellOutcome(cell: Cell): {
  points: number;
  segment: ThrowSegment;
  label: string;
  name: string;
} {
  if (cell.kind === "bull") {
    return cell.which === "inner"
      ? { points: 50, segment: "bull", label: "BULL 50", name: "Inner bull, 50 points" }
      : { points: 25, segment: "bull", label: "BULL 25", name: "Outer bull, 25 points" };
  }
  const number = BOARD_SEGMENT_ORDER[cell.sectorIndex] ?? 20;
  if (cell.band === "treble") {
    const points = number * 3;
    return {
      points,
      segment: "triple",
      label: `T${number}`,
      name: `Treble ${number}, ${points} points`,
    };
  }
  if (cell.band === "double") {
    const points = number * 2;
    return {
      points,
      segment: "double",
      label: `D${number}`,
      name: `Double ${number}, ${points} points`,
    };
  }
  return {
    points: number,
    segment: "single",
    label: `S${number}`,
    name: `Single ${number}, ${number} points`,
  };
}

/** A dart left at an impact point: disc, shaft and flight. */
function DartMarker({ xMm, yMm }: { xMm: number; yMm: number }) {
  const radius = Math.hypot(xMm, yMm);
  // The board plane is y-up and the SVG is y-down: flip.
  const dx = radius > 0 ? xMm / radius : 0;
  const dy = radius > 0 ? -yMm / radius : 0;
  const tipX = dx * 9;
  const tipY = dy * 9;
  const vane = (angleDeg: number) => {
    const rad = angleDeg * DEG_TO_RAD;
    return {
      x: tipX + 3.4 * (dx * Math.cos(rad) - dy * Math.sin(rad)),
      y: tipY + 3.4 * (dx * Math.sin(rad) + dy * Math.cos(rad)),
    };
  };
  const vaneA = vane(150);
  const vaneB = vane(-150);

  return (
    <g className="dh-marker">
      <circle r={2.4} fill="var(--board-numeral)" stroke="var(--color-brass)" strokeWidth={0.5} />
      <line x1={0} y1={0} x2={tipX} y2={tipY} stroke="var(--board-numeral)" strokeWidth={0.7} />
      <line
        x1={tipX}
        y1={tipY}
        x2={vaneA.x}
        y2={vaneA.y}
        stroke="var(--board-numeral)"
        strokeWidth={0.7}
      />
      <line
        x1={tipX}
        y1={tipY}
        x2={vaneB.x}
        y2={vaneB.y}
        stroke="var(--board-numeral)"
        strokeWidth={0.7}
      />
    </g>
  );
}

const MATERIAL_CSS = `
@keyframes dh-pulse { from { opacity: 0.35; } to { opacity: 1; } }
.dh-marker { animation: dh-pulse 220ms cubic-bezier(0.4, 0, 0.2, 1); }
.dh-highlight { transition: opacity 160ms cubic-bezier(0.4, 0, 0.2, 1); }
@media (prefers-reduced-motion: reduce) {
  .dh-marker { animation: none; opacity: 1; }
  .dh-highlight { transition: none; }
}
`;

export function DartBoard({ armedSegment, onThrow, markers, readOnly = false }: DartBoardProps) {
  // The grid is one tab stop: this is the cell `Tab` enters at.
  const [focusedCell, setFocusedCell] = useState<number | null>(0);
  // The focus indicators are drawn on the SVG, so they only appear once the
  // grid actually holds focus.
  const [gridFocused, setGridFocused] = useState(false);
  const [lastHit, setLastHit] = useState<{
    xMm: number;
    yMm: number;
    band: BandKey | "bull-inner" | "bull-outer" | null;
    sector: number | null;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const beds = useMemo(
    () =>
      BOARD_SEGMENT_ORDER.flatMap((number, sectorIndex) =>
        BANDS.map((band) => {
          const bearing = sectorIndex * SECTOR_ANGLE_DEG;
          // Odd position in the segment order: black bed, red bands.
          const oddPosition = sectorIndex % 2 === 0;
          const isBed = band.segment === "single";
          return {
            key: `${number}-${band.key}`,
            number,
            sectorIndex,
            bearing,
            band: band.key,
            segment: band.segment,
            d: bedPath(band.r0, band.r1, bearing),
            fill: isBed
              ? oddPosition
                ? "var(--board-sisal-dark)"
                : "var(--board-sisal-light)"
              : oddPosition
                ? "var(--board-red)"
                : "var(--board-green)",
          };
        }),
      ),
    [],
  );

  const numerals = useMemo(
    () =>
      BOARD_SEGMENT_ORDER.map((number, sectorIndex) => {
        const bearing = sectorIndex * SECTOR_ANGLE_DEG;
        const point = polar(NUMERAL_RADIUS_MM, bearing);
        return {
          number,
          sectorIndex,
          bearing,
          x: point.x,
          y: point.y,
          transform: `rotate(${bearing} ${fmt(point.x)} ${fmt(point.y)})`,
        };
      }),
    [],
  );

  const spokes = useMemo(
    () =>
      BOARD_SEGMENT_ORDER.map((_number, index) => {
        // The wire spokes sit on the wedge boundaries: 9° off every centre.
        const bearing = index * SECTOR_ANGLE_DEG + HALF_ANGLE_DEG;
        return {
          inner: polar(BOARD_RADII_MM.outerBull, bearing),
          outer: polar(BOARD_RADII_MM.doubleOuter, bearing),
        };
      }),
    [],
  );

  const throwArmedSector = useCallback(
    (sectorIndex: number) => {
      const number = BOARD_SEGMENT_ORDER[sectorIndex] ?? 20;
      const multiplier = armedSegment === "triple" ? 3 : armedSegment === "double" ? 2 : 1;
      const segment: ThrowSegment =
        armedSegment === "triple" ? "triple" : (armedSegment as ThrowSegment);
      const prefix = armedSegment === "triple" ? "T" : armedSegment === "double" ? "D" : "S";
      onThrow({ points: number * multiplier, segment, label: `${prefix}${number}` });
    },
    [armedSegment, onThrow],
  );

  const handleSvgClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const pxPerMm = rect.width / BOARD_DIAMETER_MM;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const { xMm, yMm } = toBoardMm(dx, dy, pxPerMm);
      const resolution = resolveBoardHit(xMm, yMm);
      if (!resolution.hit) {
        onThrow({ points: 0, segment: null, label: "MISS" });
        return;
      }
      setLastHit({
        xMm,
        yMm,
        band: bandAtRadius(Math.hypot(xMm, yMm)),
        sector: resolution.sector,
      });
      onThrow({ points: resolution.points, segment: resolution.segment, label: resolution.label });
    },
    [onThrow, readOnly],
  );

  const handleNumeralClick = useCallback(
    (event: React.MouseEvent<SVGTextElement>, sectorIndex: number) => {
      event.stopPropagation();
      if (readOnly) return;
      throwArmedSector(sectorIndex);
    },
    [readOnly, throwArmedSector],
  );

  /**
   * Roving tabindex: the grid is one tab stop; arrows move between cells.
   *
   * Rows run outermost band first (double, treble, single) and the two bulls
   * sit at the inner end, so `ArrowUp` moves outward and `ArrowDown` inward.
   */
  const moveFocus = useCallback((from: number, key: string) => {
    let next = from;
    if (from < BULL_ROW * BED_CELLS_PER_ROW) {
      const row = Math.floor(from / BED_CELLS_PER_ROW);
      const column = from % BED_CELLS_PER_ROW;
      if (key === "ArrowRight") next = row * BED_CELLS_PER_ROW + ((column + 1) % BED_CELLS_PER_ROW);
      else if (key === "ArrowLeft")
        next = row * BED_CELLS_PER_ROW + ((column - 1 + BED_CELLS_PER_ROW) % BED_CELLS_PER_ROW);
      else if (key === "ArrowUp") next = row > 0 ? from - BED_CELLS_PER_ROW : from;
      // Down from the innermost bed row lands on the inner bull.
      else if (key === "ArrowDown")
        next =
          row < BULL_ROW - 1
            ? from + BED_CELLS_PER_ROW
            : BULL_ROW * BED_CELLS_PER_ROW + (column % 2);
    } else {
      const bull = from - BULL_ROW * BED_CELLS_PER_ROW;
      if (key === "ArrowRight") next = BULL_ROW * BED_CELLS_PER_ROW + ((bull + 1) % 2);
      else if (key === "ArrowLeft") next = BULL_ROW * BED_CELLS_PER_ROW + ((bull - 1 + 2) % 2);
      // Up from a bull lands on the single bed of the same column.
      else if (key === "ArrowUp") next = (BULL_ROW - 1) * BED_CELLS_PER_ROW + bull;
      else if (key === "ArrowDown") next = from;
    }
    setFocusedCell(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus();
  }, []);

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const cell = Number((event.target as HTMLElement).dataset.cell);
      if (Number.isNaN(cell)) return;
      event.preventDefault();
      moveFocus(cell, event.key);
    },
    [moveFocus],
  );

  const focused = focusedCell === null ? null : (CELLS[focusedCell] ?? null);
  const focusBed = focused?.kind === "bed" ? focused : null;
  const focusBull = focused?.kind === "bull" ? focused : null;

  const lastHitBand = lastHit?.band ?? null;
  const lastHitSector = lastHit?.sector ?? null;
  const lastHitBeds =
    lastHitBand &&
    lastHitBand !== "bull-inner" &&
    lastHitBand !== "bull-outer" &&
    lastHitSector !== null
      ? BANDS.filter((band) => band.key === lastHitBand)
      : [];
  const lastHitSectorIndex =
    lastHitSector !== null ? BOARD_SEGMENT_ORDER.indexOf(lastHitSector) : -1;

  return (
    <div
      role="group"
      aria-label="Dartboard"
      aria-hidden={readOnly ? "true" : undefined}
      className="w-full"
      style={readOnly ? { pointerEvents: "none" } : undefined}
    >
      {/*
        The well is capped at each breakpoint so the board lands on the size
        the design specifies — 300 px as the phone preview, 520 px at 1024,
        600 px at 1440 — and the SVG fills whatever the well allows, so the
        board shrinks rather than colliding with the score sheet beside it.

        The cap is on the *well*, not the SVG: the well's own padding is part
        of the budget (300 + 2x8 + 2 borders = 318, 520 + 2x8 + 2 = 538,
        600 + 2x16 + 2 = 634), so the board's painted diameter is the size
        the design names. The well's padding is thinner at 1024 than at 1440,
        and that is what buys the 520 px board beside a 400 px score column.
        The block-level wrapper is what lets the well take that width — an
        inline-block shrink-wraps to the SVG's intrinsic 300 px and the caps
        never bite.
      */}
      <div className="mx-auto w-full max-w-[400px] rounded-md border border-rule bg-sunken p-sm md:max-w-[538px] md:p-md lg:max-w-[538px] xl:max-w-[634px] xl:p-xl">
        <svg
          viewBox={VIEW_BOX}
          aria-hidden="true"
          onClick={handleSvgClick}
          className="block h-auto w-full"
        >
          <style>{MATERIAL_CSS}</style>
          <defs>
            {/* Sisal grain: fractal noise, desaturated, over the beds only. */}
            <filter id="dh-sisal" x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8 0.25"
                numOctaves={3}
                result="noise"
              />
              <feColorMatrix in="noise" type="saturate" values="0" result="grain" />
              <feComposite in="grain" in2="SourceGraphic" operator="in" />
            </filter>
            <mask id="dh-bed-mask">
              <circle r={BOARD_RADII_MM.doubleOuter} fill="var(--board-source-white)" />
            </mask>
            <mask id="dh-ring-mask">
              <path
                d={ring(BOARD_DIAMETER_MM / 2, BOARD_RADII_MM.doubleOuter)}
                fill="var(--board-source-white)"
                fillRule="evenodd"
              />
            </mask>
            {/* Brushed steel: anisotropic noise over the number ring. */}
            <filter id="dh-steel" x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.015 0.55"
                numOctaves={2}
                result="noise"
              />
              <feColorMatrix in="noise" type="saturate" values="0" result="grain" />
              <feComposite in="grain" in2="SourceGraphic" operator="in" />
            </filter>
            {/* Warm key light from the upper left. */}
            <radialGradient
              id="dh-key-light"
              gradientUnits="userSpaceOnUse"
              cx={-70}
              cy={-90}
              r={260}
            >
              <stop offset="0" stopColor="var(--board-key-light)" stopOpacity={0.1} />
              <stop offset="1" stopColor="var(--board-key-light)" stopOpacity={0} />
            </radialGradient>
            {/* Vignette: transparent at the centre, 25% black at the rim. */}
            <radialGradient
              id="dh-vignette"
              gradientUnits="userSpaceOnUse"
              cx={0}
              cy={0}
              r={BOARD_DIAMETER_MM / 2}
            >
              <stop offset="0.5" stopColor="var(--board-vignette)" stopOpacity={0} />
              <stop offset="1" stopColor="var(--board-vignette)" stopOpacity={0.25} />
            </radialGradient>
            {/* The steel rim catches light on the upper left. */}
            <linearGradient id="dh-rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--board-steel-lit)" />
              <stop offset="0.5" stopColor="var(--board-steel)" />
              <stop offset="1" stopColor="var(--board-steel-dark)" />
            </linearGradient>
          </defs>

          {/* The face and its number ring, inside the steel rim. */}
          <circle
            r={BOARD_DIAMETER_MM / 2 - 3}
            fill="var(--board-ring)"
            stroke="url(#dh-rim)"
            strokeWidth={6}
            data-part="number-ring"
          />

          {/* Beds: 20 sectors x 4 radial bands. */}
          <g data-part="beds">
            {beds.map((bed) => (
              <path
                key={bed.key}
                d={bed.d}
                fill={bed.fill}
                data-band={bed.band}
                data-sector={bed.number}
                data-bearing={bed.bearing}
              />
            ))}
          </g>

          {/* Bulls: outer ring then inner disc, both painted. */}
          <path
            d={ring(
              BOARD_RADII_MM.outerBull - BED_INSET_MM,
              BOARD_RADII_MM.innerBull + BED_INSET_MM,
            )}
            fill="var(--board-bull-outer)"
            fillRule="evenodd"
            data-bull="outer"
          />
          <circle
            r={BOARD_RADII_MM.innerBull - BED_INSET_MM}
            fill="var(--board-bull-inner)"
            data-bull="inner"
          />

          {/* Wire: a dark groove with a lit edge. */}
          <g data-part="wire" fill="none">
            {WIRE_RINGS.map((radius) => (
              <g key={radius}>
                <circle r={radius} stroke="var(--board-wire-groove)" strokeWidth={1.6} />
                <circle r={radius - 0.55} stroke="var(--board-wire)" strokeWidth={0.5} />
              </g>
            ))}
            {spokes.map((spoke, index) => (
              <g key={index}>
                <line
                  x1={fmt(spoke.inner.x)}
                  y1={fmt(spoke.inner.y)}
                  x2={fmt(spoke.outer.x)}
                  y2={fmt(spoke.outer.y)}
                  stroke="var(--board-wire-groove)"
                  strokeWidth={1.6}
                />
                <line
                  x1={fmt(spoke.inner.x - 0.55)}
                  y1={fmt(spoke.inner.y - 0.55)}
                  x2={fmt(spoke.outer.x - 0.55)}
                  y2={fmt(spoke.outer.y - 0.55)}
                  stroke="var(--board-wire)"
                  strokeWidth={0.5}
                />
              </g>
            ))}
          </g>

          {/* Numerals, set radially with their tops pointing outward. */}
          <g data-part="numerals">
            {numerals.map((numeral) => (
              <text
                key={numeral.number}
                data-numeral={numeral.number}
                x={fmt(numeral.x)}
                y={fmt(numeral.y)}
                transform={numeral.transform}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={NUMERAL_CAP_MM}
                fontFamily="var(--font-display)"
                fill="var(--board-numeral)"
                style={{ cursor: readOnly ? "default" : "pointer" }}
                onClick={(event) => handleNumeralClick(event, numeral.sectorIndex)}
              >
                {numeral.number}
              </text>
            ))}
          </g>

          {/* Bull labels. */}
          <g data-part="bull-labels" fill="var(--board-numeral)" opacity={0.55}>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontFamily="var(--font-mono)"
            >
              50
            </text>
            <text
              x={0}
              y={-11}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fontFamily="var(--font-mono)"
            >
              25
            </text>
          </g>

          {/* Procedural materials: sisal over the beds, brushed steel on the
              ring. The grain and the lights are painted over the numerals,
              so the group takes no pointer events: otherwise they swallow
              the tap on a numeral and the throw falls back to a coordinate
              hit, which misses the sector the player aimed at. */}
          <g style={{ pointerEvents: "none" }}>
            <circle
              r={BOARD_RADII_MM.doubleOuter}
              fill="var(--board-source-white)"
              filter="url(#dh-sisal)"
              mask="url(#dh-bed-mask)"
              opacity={0.15}
              style={{ mixBlendMode: "overlay" }}
            />
            <circle
              r={BOARD_DIAMETER_MM / 2 - 3}
              fill="var(--board-source-white)"
              filter="url(#dh-steel)"
              mask="url(#dh-ring-mask)"
              opacity={0.1}
              style={{ mixBlendMode: "overlay" }}
            />

            {/* Lighting: key light and vignette. */}
            <circle
              r={BOARD_DIAMETER_MM / 2 - 3}
              fill="url(#dh-key-light)"
              style={{ mixBlendMode: "screen" }}
            />
            <circle
              r={BOARD_DIAMETER_MM / 2 - 3}
              fill="url(#dh-vignette)"
              style={{ mixBlendMode: "multiply" }}
            />
          </g>

          {/* The armed band, outlined in brass. Like the lights, it is
              painted over the numerals and takes no pointer events. */}
          <g data-part="armed" fill="none" style={{ pointerEvents: "none" }}>
            {armedSegment === "double" && (
              <path
                data-armed="double"
                d={ring(BOARD_RADII_MM.doubleOuter, BOARD_RADII_MM.outerSingleOuter)}
                stroke="var(--color-brass)"
                strokeWidth={1}
              />
            )}
            {armedSegment === "triple" && (
              <path
                data-armed="triple"
                d={ring(BOARD_RADII_MM.trebleOuter, BOARD_RADII_MM.innerSingleOuter)}
                stroke="var(--color-brass)"
                strokeWidth={1}
              />
            )}
            {armedSegment === "single" && (
              <>
                <path
                  data-armed="single"
                  d={ring(BOARD_RADII_MM.innerSingleOuter, BOARD_RADII_MM.outerBull)}
                  stroke="var(--color-brass)"
                  strokeWidth={1}
                />
                <path
                  data-armed="single-outer"
                  d={ring(BOARD_RADII_MM.outerSingleOuter, BOARD_RADII_MM.trebleOuter)}
                  stroke="var(--color-brass)"
                  strokeWidth={1}
                />
              </>
            )}
          </g>

          {/* Focus: two indicators, because a 9 mm band cannot carry one. */}
          {gridFocused && focusBed && (
            <g data-part="focus">
              {paintedBandsOf(focusBed.band).map((key) => {
                const band = BANDS.find((candidate) => candidate.key === key);
                if (!band) return null;
                return (
                  <path
                    key={key}
                    d={bedPath(band.r0, band.r1, focusBed.sectorIndex * SECTOR_ANGLE_DEG)}
                    fill="none"
                    stroke="var(--color-ink)"
                    strokeWidth={2}
                  />
                );
              })}
              <path
                d={annularSector(
                  BOARD_RADII_MM.outerBull,
                  BOARD_RADII_MM.doubleOuter,
                  focusBed.sectorIndex * SECTOR_ANGLE_DEG - HALF_ANGLE_DEG,
                  focusBed.sectorIndex * SECTOR_ANGLE_DEG + HALF_ANGLE_DEG,
                )}
                fill="none"
                stroke="var(--color-brass)"
                strokeWidth={1}
              />
            </g>
          )}
          {gridFocused && focusBull && (
            <g data-part="focus">
              {focusBull.which === "inner" ? (
                <circle
                  r={BOARD_RADII_MM.innerBull}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth={2}
                />
              ) : (
                <path
                  d={ring(BOARD_RADII_MM.outerBull, BOARD_RADII_MM.innerBull)}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth={2}
                />
              )}
              <circle
                r={BOARD_RADII_MM.outerBull + 2}
                fill="none"
                stroke="var(--color-brass)"
                strokeWidth={1}
              />
            </g>
          )}

          {/* The struck bed is highlighted. */}
          {lastHitBeds.map((band) => (
            <path
              key={band.key}
              className="dh-highlight"
              data-highlight={band.key}
              data-sector={lastHitSector ?? undefined}
              d={bedPath(band.r0, band.r1, lastHitSectorIndex * SECTOR_ANGLE_DEG)}
              fill="none"
              stroke="var(--color-brass)"
              strokeWidth={1.5}
            />
          ))}
          {lastHitBand === "bull-inner" && (
            <circle
              className="dh-highlight"
              data-highlight="bull-inner"
              r={BOARD_RADII_MM.innerBull}
              fill="none"
              stroke="var(--color-brass)"
              strokeWidth={1.5}
            />
          )}
          {lastHitBand === "bull-outer" && (
            <path
              className="dh-highlight"
              data-highlight="bull-outer"
              d={ring(BOARD_RADII_MM.outerBull, BOARD_RADII_MM.innerBull)}
              fill="none"
              stroke="var(--color-brass)"
              strokeWidth={1.5}
            />
          )}

          {/* Dart markers: the visit's darts, plus the dart just thrown. */}
          <g data-part="markers">
            {markers?.map((marker, index) => (
              <g
                key={`${marker.label}-${index}`}
                data-marker="visit"
                transform={markerTransform(marker.xMm, marker.yMm)}
              >
                <DartMarker xMm={marker.xMm} yMm={marker.yMm} />
              </g>
            ))}
            {lastHit &&
              !markers?.some(
                (marker) =>
                  Math.abs(marker.xMm - lastHit.xMm) < 0.01 &&
                  Math.abs(marker.yMm - lastHit.yMm) < 0.01,
              ) && (
                <g data-marker="last" transform={markerTransform(lastHit.xMm, lastHit.yMm)}>
                  <DartMarker xMm={lastHit.xMm} yMm={lastHit.yMm} />
                </g>
              )}
          </g>
        </svg>
      </div>

      {!readOnly && (
        <div
          ref={gridRef}
          className="sr-only"
          onKeyDown={handleGridKeyDown}
          onFocus={() => setGridFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setGridFocused(false);
          }}
        >
          {CELLS.map((cell, index) => {
            const outcome = cellOutcome(cell);
            return (
              <button
                key={index}
                type="button"
                data-cell={index}
                tabIndex={focusedCell === index ? 0 : -1}
                aria-label={outcome.name}
                onFocus={() => setFocusedCell(index)}
                onClick={() =>
                  onThrow({
                    points: outcome.points,
                    segment: outcome.segment,
                    label: outcome.label,
                  })
                }
              >
                {outcome.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
