/**
 * Data transfer object describing a single captured dart throw.
 *
 * Pure data: no behaviour, no hardware coupling. It carries the detected
 * impact position and score of one throw from the camera layer into the
 * domain/runtime layers.
 */
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
   * Wall-clock capture time as epoch milliseconds (UTC).
   */
  timestamp: number;
}
