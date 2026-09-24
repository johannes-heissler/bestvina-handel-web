/**
 * Three-dimensional vectors. Replaces Unity's `Vector3` (and `Vector2`, see port note 02).
 *
 * @module
 */
import { DEFAULT_TOLERANCE } from "../util/number";
import { Complex } from "./complex";

/**
 * An immutable vector (x, y, z). Operations return new instances.
 *
 * Points of plane models (polygons in the hyperbolic or Euclidean plane) have z = 0; use
 * {@link Vec3.toComplex} / {@link Vec3.fromComplex} to switch to complex numbers.
 */
export class Vec3 {
  static readonly ZERO = new Vec3(0, 0, 0);
  static readonly X = new Vec3(1, 0, 0);
  static readonly Y = new Vec3(0, 1, 0);
  static readonly Z = new Vec3(0, 0, 1);

  constructor(
    readonly x: number,
    readonly y: number,
    readonly z = 0,
  ) {}

  /** The point (re, im, 0) of the plane. */
  static fromComplex(w: Complex): Vec3 {
    return new Vec3(w.re, w.im, 0);
  }

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  neg(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /** The cross product; (X, Y, Z) is a right-handed basis: `X.cross(Y) = Z`. */
  cross(v: Vec3): Vec3 {
    return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }

  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  lengthSquared(): number {
    return this.dot(this);
  }

  distanceTo(v: Vec3): number {
    return this.sub(v).length();
  }

  /**
   * The unit vector in the same direction. Like Unity's `normalized`, a (nearly) zero vector
   * (length < 1e-12) is returned as the zero vector instead of producing NaN.
   */
  normalized(): Vec3 {
    const length = this.length();
    return length < 1e-12 ? Vec3.ZERO : this.scale(1 / length);
  }

  /** The unsigned angle to `v` in radians, in [0, π]. (Unity's `Vector3.Angle` returns degrees.) */
  angleTo(v: Vec3): number {
    return Math.atan2(this.cross(v).length(), this.dot(v));
  }

  /** Linear interpolation: `this` at t = 0, `v` at t = 1. */
  lerp(v: Vec3, t: number): Vec3 {
    return this.add(v.sub(this).scale(t));
  }

  /** Whether the distance to `v` is less than `tolerance` (the C# `ApproximatelyEquals`). */
  approxEquals(v: Vec3, tolerance = DEFAULT_TOLERANCE): boolean {
    return this.sub(v).lengthSquared() < tolerance * tolerance;
  }

  /** The complex number x + y·i; z is dropped. */
  toComplex(): Complex {
    return new Complex(this.x, this.y);
  }

  toString(): string {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}

/** Shorthand for `new Vec3(x, y, z)`. */
export function vec3(x: number, y: number, z = 0): Vec3 {
  return new Vec3(x, y, z);
}
