/**
 * Complex numbers, used for the hyperbolic plane (upper half-plane and disk models) and Möbius
 * transformations. Replaces `System.Numerics.Complex`.
 *
 * @module
 */
import { DEFAULT_TOLERANCE } from "../util/number";

/** An immutable complex number `re + im·i`. Operations return new instances. */
export class Complex {
  static readonly ZERO = new Complex(0, 0);
  static readonly ONE = new Complex(1, 0);
  /** The imaginary unit i. */
  static readonly I = new Complex(0, 1);

  constructor(
    readonly re: number,
    readonly im = 0,
  ) {}

  /** The complex number with absolute value `r` and argument `phi` (in radians). */
  static fromPolar(r: number, phi: number): Complex {
    return new Complex(r * Math.cos(phi), r * Math.sin(phi));
  }

  add(w: Complex): Complex {
    return new Complex(this.re + w.re, this.im + w.im);
  }

  sub(w: Complex): Complex {
    return new Complex(this.re - w.re, this.im - w.im);
  }

  mul(w: Complex): Complex {
    return new Complex(this.re * w.re - this.im * w.im, this.re * w.im + this.im * w.re);
  }

  /** Division; as with `number`, dividing by zero gives infinite or NaN parts rather than throwing. */
  div(w: Complex): Complex {
    const d = w.abs2();
    return new Complex((this.re * w.re + this.im * w.im) / d, (this.im * w.re - this.re * w.im) / d);
  }

  /** Multiplication by a real number. */
  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /** The complex conjugate `re - im·i`. */
  conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  /** 1 / z. */
  inv(): Complex {
    return Complex.ONE.div(this);
  }

  /** The absolute value |z|. */
  abs(): number {
    return Math.hypot(this.re, this.im);
  }

  /** The squared absolute value |z|², cheaper than `abs()`. */
  abs2(): number {
    return this.re * this.re + this.im * this.im;
  }

  /** The argument (phase) in radians, in (-π, π]. */
  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  /** Whether |z - w| < `tolerance`. */
  approxEquals(w: Complex, tolerance = DEFAULT_TOLERANCE): boolean {
    return this.sub(w).abs() < tolerance;
  }

  toString(): string {
    const sign = this.im < 0 || Object.is(this.im, -0) ? "-" : "+";
    return `${this.re} ${sign} ${Math.abs(this.im)}i`;
  }
}

/** Shorthand for `new Complex(re, im)`. */
export function complex(re: number, im = 0): Complex {
  return new Complex(re, im);
}
