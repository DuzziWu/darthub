/**
 * Data transfer object describing a single captured dart throw.
 *
 * Pure data: no behaviour, no hardware coupling. It carries the detected
 * impact position and score of one throw from the camera layer into the
 * domain/runtime layers.
 */
import type { BoardSegment } from "@/board/boardGeometry";

export interface CameraDTO {
  /**
   * Horizontal impact coordinate, in millimetres, relative to the centre
   * of the dart board (negative = left of centre, positive = right of centre).
   */
  x: number;

  /**
   * Vertical impact coordinate, in millimetres, relative to the centre
   * of the dart board (negative = below centre, positive = above centre).
   */
  y: number;

  /**
   * Score awarded for this throw (0 in case of a miss).
   */
  score: number;

  /**
   * Board segment hit by this throw, as resolved by the shared board
   * geometry. Optional for now so the existing stub producers keep
   * compiling; a score alone is ambiguous (24 is D12 or T8), so without
   * the segment a camera could never win a Double Out.
   */
  segment?: BoardSegment;

  /**
   * Wall-clock capture time as epoch milliseconds (UTC).
   */
  timestamp: number;
}
