/**
 * The hyperbolic plane: the Klein, Poincaré and upper half-plane models, Möbius transformations of the disk, and
 * regular polygons with their side pairings (the C# `ModelSurface`, `HyperbolicGeodesicSegment`, `SwitchHyperbolicModel`,
 * `ToKleinModel`, reduced to what the embedding needs).
 *
 * The layout works in the **Klein model**, where geodesics are straight lines. Pictures are drawn in a display model;
 * a straight segment in Klein coordinates, sampled densely and mapped pointwise, is the geodesic in any model.
 *
 * @module
 */
import { Complex } from "../math/complex";

/** The models of the hyperbolic plane the views can show. */
export type HyperbolicModel = "poincare" | "klein" | "halfplane";

/**
 * Klein → Poincaré: k ↦ k / (1 + √(1 − |k|²)). Points within rounding of the boundary (1 − |k|² < 10⁻¹²) are ideal: the
 * square root would magnify a rounding error of 10⁻¹⁶ in |k|² to 10⁻⁸ in |p|, a finite point (at distance ~ 18) that
 * isn't recognised as ideal (e.g. a vertex (−½, −√3/2) of an ideal polygon).
 */
export function kleinToPoincare(k: Complex): Complex {
  const rest = 1 - k.abs2();
  if (rest < 1e-12) return k.scale(1 / Math.sqrt(k.abs2()));
  return k.scale(1 / (1 + Math.sqrt(rest)));
}

/** Poincaré → Klein: p ↦ 2p / (1 + |p|²). */
export function poincareToKlein(p: Complex): Complex {
  return p.scale(2 / (1 + p.abs2()));
}

/** Poincaré disk → upper half-plane (the Cayley transform): p ↦ i (1 + p) / (1 − p). */
export function diskToHalfPlane(p: Complex): Complex {
  return Complex.I.mul(Complex.ONE.add(p)).div(Complex.ONE.sub(p));
}

/** Upper half-plane → Poincaré disk: z ↦ (z − i) / (z + i). */
export function halfPlaneToDisk(z: Complex): Complex {
  return z.sub(Complex.I).div(z.add(Complex.I));
}

/** A point given in Klein coordinates, in the display model. */
export function fromKlein(model: HyperbolicModel, k: Complex): Complex {
  switch (model) {
    case "klein":
      return k;
    case "poincare":
      return kleinToPoincare(k);
    case "halfplane":
      return diskToHalfPlane(kleinToPoincare(k));
  }
}

/** The inverse of {@link fromKlein}. */
export function toKlein(model: HyperbolicModel, z: Complex): Complex {
  switch (model) {
    case "klein":
      return z;
    case "poincare":
      return poincareToKlein(z);
    case "halfplane":
      return poincareToKlein(halfPlaneToDisk(z));
  }
}

/**
 * The hyperbolic length of a short Euclidean segment of length 1 at the point z of the display model, in the unit
 * direction `direction`: the metric 2|dz| / (1 − |z|²) (Poincaré), |dz| / Im z (half-plane), and for the Klein model,
 * which is not conformal, √(|dz|² / (1 − |z|²) + ⟨z, dz⟩² / (1 − |z|²)²).
 */
export function lengthFactor(model: HyperbolicModel, z: Complex, direction: Complex): number {
  switch (model) {
    case "poincare":
      return 2 / Math.max(1e-12, 1 - z.abs2());
    case "halfplane":
      return 1 / Math.max(1e-12, z.im);
    case "klein": {
      const q = Math.max(1e-12, 1 - z.abs2());
      const radial = z.re * direction.re + z.im * direction.im;
      return Math.sqrt(1 / q + (radial * radial) / (q * q));
    }
  }
}

/**
 * An orientation-preserving isometry of the Poincaré disk, z ↦ (a z + b) / (b̄ z + ā) with |a|² − |b|² = 1 (up to
 * scaling). Used for the side pairings and the deck transformations.
 */
export class DiskIsometry {
  static readonly IDENTITY = new DiskIsometry(Complex.ONE, Complex.ZERO);

  constructor(
    readonly a: Complex,
    readonly b: Complex,
  ) {}

  /** The rotation by `angle` about the centre. */
  static rotation(angle: number): DiskIsometry {
    return new DiskIsometry(Complex.fromPolar(1, angle / 2), Complex.ZERO);
  }

  /** The isometry z ↦ (z − m) / (1 − m̄ z), which moves m to 0. */
  static toOrigin(m: Complex): DiskIsometry {
    return new DiskIsometry(Complex.ONE, m.neg());
  }

  /** The half-turn (rotation by π) about the point m (Poincaré coordinates). */
  static halfTurn(m: Complex): DiskIsometry {
    const t = DiskIsometry.toOrigin(m);
    return t.inverse().after(DiskIsometry.rotation(Math.PI)).after(t);
  }

  apply(z: Complex): Complex {
    return this.a.mul(z).add(this.b).div(this.b.conj().mul(z).add(this.a.conj()));
  }

  /** Applies the isometry to a point in Klein coordinates. */
  applyKlein(k: Complex): Complex {
    return poincareToKlein(this.apply(kleinToPoincare(k)));
  }

  /** this ∘ first. */
  after(first: DiskIsometry): DiskIsometry {
    // Matrices [[a, b], [b̄, ā]] multiply to the same form.
    const a = this.a.mul(first.a).add(this.b.mul(first.b.conj()));
    const b = this.a.mul(first.b).add(this.b.mul(first.a.conj()));
    return new DiskIsometry(a, b);
  }

  inverse(): DiskIsometry {
    return new DiskIsometry(this.a.conj(), this.b.neg());
  }
}

/** Whether a point of the closed disk is on the boundary circle (an ideal point). */
export function isIdeal(z: Complex): boolean {
  return z.abs() >= 1 - 1e-12;
}

/**
 * A complete geodesic of the hyperbolic plane (the C# `HyperbolicGeodesicSegment`, extended to whole geodesics), stored
 * as the isometry M of the Poincaré disk that maps the standard geodesic, the diameter (−1, 1), onto it: M(0) is its
 * base point and M(tanh(t/2)) the point at signed distance t from it, so t is an arc-length parameter. All points are
 * in Poincaré coordinates unless the method says otherwise.
 */
export class Geodesic {
  constructor(readonly isometry: DiskIsometry) {}

  /** The geodesic through the point m of the disk, towards the point d ≠ m (which may be ideal). */
  static from(m: Complex, d: Complex): Geodesic {
    const toOrigin = DiskIsometry.toOrigin(m);
    return new Geodesic(toOrigin.inverse().after(DiskIsometry.rotation(toOrigin.apply(d).arg())));
  }

  /** The geodesic through p and q, from p towards q; either or both may be ideal. */
  static throughPoints(p: Complex, q: Complex): Geodesic {
    if (!isIdeal(p)) return Geodesic.from(p, q);
    if (!isIdeal(q)) return Geodesic.from(q, p).reversed();
    return Geodesic.fromIdealPoints(p, q);
  }

  /** The geodesic from the ideal point a to the ideal point b; its base point is its point closest to the centre. */
  static fromIdealPoints(a: Complex, b: Complex): Geodesic {
    const [u, v] = [a.scale(1 / a.abs()), b.scale(1 / b.abs())];
    const sum = u.add(v);
    if (sum.abs() < 1e-12) return Geodesic.from(Complex.ZERO, v); // a diameter
    // The circle orthogonal to the unit circle through u and v is centred where the tangents at u and v meet.
    const centre = sum.scale(1 / (1 + u.re * v.re + u.im * v.im));
    const radius = centre.sub(u).abs();
    return Geodesic.from(centre.sub(centre.scale(radius / centre.abs())), v);
  }

  /** The geodesic through p in the direction of the (nonzero) tangent vector v. */
  static fromTangent(p: Complex, v: Complex): Geodesic {
    // z ↦ (z − p)/(1 − p̄z) has the positive real derivative 1/(1 − |p|²) at p, so it keeps directions there.
    return new Geodesic(DiskIsometry.toOrigin(p).inverse().after(DiskIsometry.rotation(v.arg())));
  }

  /** The same geodesic, run backwards (with the same base point). */
  reversed(): Geodesic {
    return new Geodesic(this.isometry.after(DiskIsometry.rotation(Math.PI)));
  }

  /** The point at signed distance t from the base point (the ideal end points for t = ±∞). */
  pointAt(t: number): Complex {
    return this.isometry.apply(new Complex(Math.tanh(t / 2), 0));
  }

  /** The parameter of a point on the geodesic (±∞ for its ideal points). */
  parameterOf(z: Complex): number {
    const x = Math.max(-1, Math.min(1, this.isometry.inverse().apply(z).re));
    // Within rounding of ±1 (|t| > 30 or so), the point is ideal.
    return x >= 1 - 1e-12 ? Infinity : x <= -1 + 1e-12 ? -Infinity : 2 * Math.atanh(x);
  }

  /** The ideal points at t = −∞ and t = +∞. */
  get idealPoints(): [Complex, Complex] {
    return [this.isometry.apply(new Complex(-1, 0)), this.isometry.apply(Complex.ONE)];
  }

  /** The Möbius transformation of the Poincaré disk that maps the standard geodesic (−1, 1) onto this one. */
  get mobius(): DiskIsometry {
    return this.isometry;
  }

  /**
   * The geodesic in the Poincaré disk: an arc of the circle with this centre and radius, orthogonal to the unit
   * circle, or (`centre` undefined) a diameter.
   */
  diskCircle(): { centre?: Complex; radius: number } {
    const [a, b] = this.idealPoints;
    const sum = a.add(b);
    if (sum.abs() < 1e-9) return { radius: Infinity };
    const centre = sum.scale(1 / (1 + a.re * b.re + a.im * b.im));
    return { centre, radius: centre.sub(a).abs() };
  }

  /**
   * The geodesic in the upper half-plane: the half-circle with this centre on the real axis and radius, or
   * (`centre` undefined) the vertical line Re z = `x`.
   */
  halfPlaneCircle(): { centre?: number; radius: number; x?: number } {
    const [a, b] = this.idealPoints.map(diskToHalfPlane) as [Complex, Complex];
    const finite = (z: Complex) => Number.isFinite(z.re) && Math.abs(z.re) < 1e12;
    if (!finite(a)) return { radius: Infinity, x: b.re };
    if (!finite(b)) return { radius: Infinity, x: a.re };
    return { centre: (a.re + b.re) / 2, radius: Math.abs(a.re - b.re) / 2 };
  }

  /** The geodesic through two points given in Klein coordinates (either may be ideal). */
  static throughKleinPoints(p: Complex, q: Complex): Geodesic {
    return Geodesic.throughPoints(kleinToPoincare(p), kleinToPoincare(q));
  }
}

/**
 * The vertices of a regular hyperbolic n-gon, in Klein coordinates, counterclockwise, the first at angle `start`.
 * Ideal: on the unit circle. Compact: with interior angles 2π/n, so that all n vertices together have angle 2π (one
 * vertex class of a closed surface). Its Poincaré radius is √cos(2π/n) (as in C#).
 */
export function regularPolygon(
  n: number,
  kind: "ideal" | "compact",
  start = -Math.PI / 2 - Math.PI / n,
): Complex[] {
  const radius = kind === "ideal" ? 1 : poincareRadiusToKlein(Math.sqrt(Math.cos((2 * Math.PI) / n)));
  return Array.from({ length: n }, (_, k) => Complex.fromPolar(radius, start + (2 * Math.PI * k) / n));
}

function poincareRadiusToKlein(r: number): number {
  return (2 * r) / (1 + r * r);
}

/**
 * The side pairing of a regular polygon (centred at 0, n sides, side k from vertex k to vertex k+1): the isometry that
 * maps side `from` onto side `to`, reversing its direction, and the polygon onto its neighbour across side `to`. It is
 * the rotation taking side `from` to side `to`, followed by the half-turn about the midpoint of side `to` (the foot of
 * the perpendicular from the centre). A point at parameter t along a side (Klein, from its midpoint, counterclockwise)
 * goes to −t on the other side.
 */
export function sidePairing(vertices: readonly Complex[], from: number, to: number): DiskIsometry {
  const n = vertices.length;
  const [p, q] = [vertices[to] as Complex, vertices[(to + 1) % n] as Complex];
  const midpointKlein = p.add(q).scale(0.5);
  return DiskIsometry.halfTurn(kleinToPoincare(midpointKlein)).after(
    DiskIsometry.rotation((2 * Math.PI * (to - from)) / n),
  );
}
