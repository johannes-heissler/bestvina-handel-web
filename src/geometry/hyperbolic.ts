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

/** Klein → Poincaré: k ↦ k / (1 + √(1 − |k|²)). */
export function kleinToPoincare(k: Complex): Complex {
  return k.scale(1 / (1 + Math.sqrt(Math.max(0, 1 - k.abs2()))));
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
