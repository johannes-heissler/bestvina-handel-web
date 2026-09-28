import { describe, expect, it } from "vitest";
import { Complex } from "../math/complex";
import {
  type HyperbolicModel,
  lengthFactor,
  DiskIsometry,
  diskToHalfPlane,
  fromKlein,
  halfPlaneToDisk,
  kleinToPoincare,
  poincareToKlein,
  regularPolygon,
  sidePairing,
  toKlein,
} from "./hyperbolic";

const close = (z: Complex, w: Complex) => expect(z.sub(w).abs()).toBeLessThan(1e-9);
/** Hyperbolic distance in the Poincaré disk. */
const distance = (p: Complex, q: Complex) =>
  Math.acosh(1 + (2 * p.sub(q).abs2()) / ((1 - p.abs2()) * (1 - q.abs2())));

describe("models", () => {
  it("converts between Klein, Poincaré and the upper half-plane", () => {
    for (const k of [new Complex(0, 0), new Complex(0.3, -0.5), new Complex(-0.9, 0.1)]) {
      close(poincareToKlein(kleinToPoincare(k)), k);
      for (const model of ["klein", "poincare", "halfplane"] as const)
        close(toKlein(model, fromKlein(model, k)), k);
    }
    close(diskToHalfPlane(Complex.ZERO), Complex.I);
    close(halfPlaneToDisk(Complex.I), Complex.ZERO);
    close(kleinToPoincare(new Complex(1, 0)), new Complex(1, 0)); // ideal points stay on the circle
  });
});

describe("DiskIsometry", () => {
  it("preserves distances and composes", () => {
    const f = DiskIsometry.halfTurn(new Complex(0.2, 0.3)).after(DiskIsometry.rotation(0.7));
    const [p, q] = [new Complex(0.1, -0.4), new Complex(-0.5, 0.2)];
    expect(distance(f.apply(p), f.apply(q))).toBeCloseTo(distance(p, q), 9);
    close(f.inverse().apply(f.apply(p)), p);
    close(DiskIsometry.halfTurn(p).apply(p), p);
  });
});

describe("regular polygons and side pairings", () => {
  it("builds ideal and compact polygons", () => {
    for (const v of regularPolygon(6, "ideal")) expect(v.abs()).toBeCloseTo(1, 12);
    const compact = regularPolygon(8, "compact");
    // Interior angle 2π/8 at each vertex, measured in the Poincaré model (conformal) between the geodesic sides.
    expect(compact.every((v) => v.abs() < 1)).toBe(true);
  });

  it("maps a side onto its partner, reversing it", () => {
    const vertices = regularPolygon(8, "compact");
    const side = (k: number, t: number) => {
      const [p, q] = [vertices[k]!, vertices[(k + 1) % 8]!];
      return p
        .add(q)
        .scale(0.5)
        .add(q.sub(p).scale(t / 2)); // Klein, t ∈ [−1, 1] from the midpoint
    };
    const pairing = sidePairing(vertices, 0, 2); // side 0 ↦ side 2
    for (const t of [-0.8, -0.3, 0, 0.5]) close(pairing.applyKlein(side(0, t)), side(2, -t));
    // The polygon's centre goes across side 2.
    const image = pairing.applyKlein(Complex.ZERO);
    const normal = vertices[2]!.add(vertices[3]!).scale(0.5);
    expect(image.re * normal.re + image.im * normal.im).toBeGreaterThan(normal.abs2());
  });
});

describe("the metric in the display models", () => {
  it("agrees between the models at corresponding points", () => {
    // A short hyperbolic segment has the same length measured in each model.
    const k = new Complex(0.3, -0.5);
    const direction = new Complex(0.6, 0.8);
    const lengthIn = (model: HyperbolicModel) => {
      const a = fromKlein(model, k);
      const b = fromKlein(model, k.add(direction.scale(1e-6)));
      const step = b.sub(a);
      return step.abs() * lengthFactor(model, a, step.scale(1 / step.abs()));
    };
    expect(lengthIn("poincare")).toBeCloseTo(lengthIn("klein") as number, 9);
    expect(lengthIn("halfplane")).toBeCloseTo(lengthIn("klein") as number, 9);
    expect(lengthFactor("poincare", Complex.ZERO, Complex.ONE)).toBe(2);
  });
});
