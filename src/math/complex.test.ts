import { describe, expect, it } from "vitest";
import { Complex, complex } from "./complex";

const expectClose = (z: Complex, w: Complex) => {
  expect(z.re).toBeCloseTo(w.re, 12);
  expect(z.im).toBeCloseTo(w.im, 12);
};

describe("Complex arithmetic", () => {
  const z = complex(1, 2);
  const w = complex(3, -1);

  it("adds, subtracts and multiplies", () => {
    expect(z.add(w)).toEqual(complex(4, 1));
    expect(z.sub(w)).toEqual(complex(-2, 3));
    expect(z.mul(w)).toEqual(complex(5, 5));
    expect(Complex.I.mul(Complex.I)).toEqual(complex(-1, 0));
  });

  it("divides, inverting multiplication", () => {
    expectClose(z.mul(w).div(w), z);
    expectClose(z.mul(z.inv()), Complex.ONE);
  });

  it("gives non-finite parts when dividing by zero, like number", () => {
    const q = Complex.ONE.div(Complex.ZERO);
    expect(Number.isFinite(q.re)).toBe(false);
  });

  it("has conjugate, absolute value and argument", () => {
    expect(z.conj()).toEqual(complex(1, -2));
    expect(complex(3, 4).abs()).toBe(5);
    expect(complex(3, 4).abs2()).toBe(25);
    expect(Complex.I.arg()).toBeCloseTo(Math.PI / 2);
    expect(complex(-1, 0).arg()).toBeCloseTo(Math.PI);
  });

  it("converts from polar coordinates", () => {
    expectClose(Complex.fromPolar(2, Math.PI / 2), complex(0, 2));
    const u = Complex.fromPolar(1.5, 0.7);
    expect(u.abs()).toBeCloseTo(1.5);
    expect(u.arg()).toBeCloseTo(0.7);
  });

  it("compares approximately and prints", () => {
    expect(z.approxEquals(complex(1.0001, 2))).toBe(true);
    expect(z.approxEquals(w)).toBe(false);
    expect(String(complex(1, -2))).toBe("1 - 2i");
  });
});
