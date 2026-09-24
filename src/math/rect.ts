/**
 * Axis-parallel rectangles, used for the chart domains of parametric surfaces. Replaces Unity's `Rect`
 * and `VectorHelpers.Minus`.
 *
 * @module
 */
import { clamp } from "../util/number";

/**
 * How {@link Rect.minus} cuts A ∖ B into rectangles:
 * - `"corners"`: up to 8 pieces: the 4 pieces beside B's sides plus the 4 corners;
 * - `"horizontal"`: up to 4 pieces: full-width strips above and below B, plus the pieces left and right of B;
 * - `"vertical"`: up to 4 pieces: full-height strips left and right of B, plus the pieces above and below B.
 */
export type RectCutMode = "corners" | "horizontal" | "vertical";

/** An immutable axis-parallel rectangle [xMin, xMin + width] × [yMin, yMin + height]. */
export class Rect {
  constructor(
    readonly xMin: number,
    readonly yMin: number,
    readonly width: number,
    readonly height: number,
  ) {}

  /** The rectangle with the given corner coordinates. */
  static fromBounds(xMin: number, yMin: number, xMax: number, yMax: number): Rect {
    return new Rect(xMin, yMin, xMax - xMin, yMax - yMin);
  }

  get xMax(): number {
    return this.xMin + this.width;
  }

  get yMax(): number {
    return this.yMin + this.height;
  }

  get area(): number {
    return this.width * this.height;
  }

  /** Whether (x, y) lies in the closed rectangle. */
  contains(x: number, y: number): boolean {
    return x >= this.xMin && x <= this.xMax && y >= this.yMin && y <= this.yMax;
  }

  /** The intersection with `other`, or `undefined` if it has no interior. */
  intersect(other: Rect): Rect | undefined {
    const xMin = Math.max(this.xMin, other.xMin);
    const yMin = Math.max(this.yMin, other.yMin);
    const xMax = Math.min(this.xMax, other.xMax);
    const yMax = Math.min(this.yMax, other.yMax);
    return xMin < xMax && yMin < yMax ? Rect.fromBounds(xMin, yMin, xMax, yMax) : undefined;
  }

  /**
   * The set difference A ∖ B (A = this) as a list of rectangles with non-empty interior. The pieces don't
   * overlap (except along edges) and together cover the closure of A ∖ B. See {@link RectCutMode}.
   */
  minus(B: Rect, mode: RectCutMode = "corners"): Rect[] {
    // B clipped to A = this.
    const bxMin = clamp(B.xMin, this.xMin, this.xMax);
    const bxMax = clamp(B.xMax, this.xMin, this.xMax);
    const byMin = clamp(B.yMin, this.yMin, this.yMax);
    const byMax = clamp(B.yMax, this.yMin, this.yMax);

    const left = Rect.fromBounds(this.xMin, byMin, bxMin, byMax);
    const right = Rect.fromBounds(bxMax, byMin, this.xMax, byMax);
    const below = Rect.fromBounds(bxMin, this.yMin, bxMax, byMin);
    const above = Rect.fromBounds(bxMin, byMax, bxMax, this.yMax);

    let pieces: Rect[];
    switch (mode) {
      case "corners":
        pieces = [
          left,
          right,
          above,
          below,
          Rect.fromBounds(this.xMin, this.yMin, bxMin, byMin),
          Rect.fromBounds(bxMax, this.yMin, this.xMax, byMin),
          Rect.fromBounds(this.xMin, byMax, bxMin, this.yMax),
          Rect.fromBounds(bxMax, byMax, this.xMax, this.yMax),
        ];
        break;
      case "horizontal":
        pieces = [
          left,
          right,
          Rect.fromBounds(this.xMin, this.yMin, this.xMax, byMin),
          Rect.fromBounds(this.xMin, byMax, this.xMax, this.yMax),
        ];
        break;
      case "vertical":
        pieces = [
          above,
          below,
          Rect.fromBounds(this.xMin, this.yMin, bxMin, this.yMax),
          Rect.fromBounds(bxMax, this.yMin, this.xMax, this.yMax),
        ];
        break;
    }
    return pieces.filter((r) => r.width > 0 && r.height > 0);
  }

  toString(): string {
    return `[${this.xMin}, ${this.xMax}] × [${this.yMin}, ${this.yMax}]`;
  }
}
