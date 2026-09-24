/**
 * 3×3 matrices, stored by columns. Used for bases of tangent spaces and for derivatives (Jacobians) of
 * maps between surfaces. Replaces `Helpers/Matrix3x3.cs`.
 *
 * @module
 */
import type { Complex } from "./complex";
import { Vec3 } from "./vec3";

/**
 * An immutable 3×3 matrix with columns `a`, `b`, `c`, i.e. the matrix that maps the standard basis
 * vectors X, Y, Z to a, b, c.
 *
 * As a basis of a tangent space: `a` is the tangent direction (e.g. of a curve), `b` the direction
 * perpendicular to it within the surface, and `c` the normal of the surface.
 */
export class Mat3 {
  static readonly IDENTITY = new Mat3(Vec3.X, Vec3.Y, Vec3.Z);

  constructor(
    readonly a: Vec3,
    readonly b: Vec3,
    readonly c: Vec3,
  ) {}

  /** The diagonal matrix diag(α, β, γ). */
  static diagonal(α: number, β: number, γ = 1): Mat3 {
    return new Mat3(new Vec3(α, 0, 0), new Vec3(0, β, 0), new Vec3(0, 0, γ));
  }

  /**
   * The 2×2 matrix (p q; r s), written row by row, acting on the plane z = 0 and fixing the Z axis:
   * columns (p, r, 0), (q, s, 0), (0, 0, 1).
   */
  static fromRows2x2(p: number, q: number, r: number, s: number): Mat3 {
    return new Mat3(new Vec3(p, r, 0), new Vec3(q, s, 0), Vec3.Z);
  }

  /**
   * Multiplication by the complex number w, as a real-linear map of the plane: (Re w, −Im w; Im w, Re w).
   * This is the derivative of a holomorphic map with complex derivative w.
   */
  static fromComplex(w: Complex): Mat3 {
    return Mat3.fromRows2x2(w.re, -w.im, w.im, w.re);
  }

  /** The matrix–vector product A·v. */
  apply(v: Vec3): Vec3 {
    return this.a.scale(v.x).add(this.b.scale(v.y)).add(this.c.scale(v.z));
  }

  /** The matrix product A·B (first B, then A). */
  mul(B: Mat3): Mat3 {
    return new Mat3(this.apply(B.a), this.apply(B.b), this.apply(B.c));
  }

  scale(s: number): Mat3 {
    return new Mat3(this.a.scale(s), this.b.scale(s), this.c.scale(s));
  }

  determinant(): number {
    return this.a.cross(this.b).dot(this.c);
  }

  transpose(): Mat3 {
    const { a, b, c } = this;
    return new Mat3(new Vec3(a.x, b.x, c.x), new Vec3(a.y, b.y, c.y), new Vec3(a.z, b.z, c.z));
  }

  /**
   * The inverse matrix, via the cross products of the columns (the rows of the inverse are
   * (b × c, c × a, a × b) / det).
   *
   * @throws RangeError if the matrix is singular (|det| < 1e-12). The C# version returned infinities.
   */
  inverse(): Mat3 {
    const det = this.determinant();
    if (!(Math.abs(det) >= 1e-12)) throw new RangeError(`Mat3 is singular (det = ${det})`);
    const { a, b, c } = this;
    return new Mat3(b.cross(c), c.cross(a), a.cross(b)).scale(1 / det).transpose();
  }

  toString(): string {
    return `[${this.a}, ${this.b}, ${this.c}]`;
  }
}
