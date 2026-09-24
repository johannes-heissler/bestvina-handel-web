import { describe, expect, it } from "vitest";
import { approxEqual, clamp, gcd, geometricMean, lcm, lerp, mod } from "./number";

describe("mod", () => {
  it("is non-negative for negative arguments, unlike %", () => {
    expect(mod(-1, 3)).toBe(2);
    expect(mod(-3, 3)).toBe(0);
    expect(mod(7, 3)).toBe(1);
  });
});

describe("gcd and lcm", () => {
  it("computes gcd, including signs and zero", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(-12, 18)).toBe(6);
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(0, 0)).toBe(0);
  });

  it("computes lcm of positive integers", () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(1, 7)).toBe(7);
  });

  it("throws instead of returning -1 for invalid input or overflow", () => {
    expect(() => lcm(0, 3)).toThrow(RangeError);
    expect(() => lcm(-2, 3)).toThrow(RangeError);
    expect(() => lcm(2 ** 30 + 1, 2 ** 30 - 1)).toThrow(RangeError);
    expect(() => gcd(1.5, 2)).toThrow(RangeError);
  });
});

describe("geometricMean", () => {
  it("computes the geometric mean", () => {
    expect(geometricMean([1, 4])).toBeCloseTo(2);
    expect(geometricMean([2, 8, 4])).toBeCloseTo(4);
  });

  it("accepts any iterable", () => {
    expect(geometricMean(new Set([9]))).toBeCloseTo(9);
  });

  it("does not overflow for large products", () => {
    expect(geometricMean(Array<number>(400).fill(1e300)) / 1e300).toBeCloseTo(1);
  });

  it("rejects non-positive values and empty input (the C# version returned NaN)", () => {
    expect(() => geometricMean([1, -1e-17])).toThrow(RangeError);
    expect(() => geometricMean([1, 0])).toThrow(RangeError);
    expect(() => geometricMean([NaN])).toThrow(RangeError);
    expect(() => geometricMean([])).toThrow(RangeError);
  });
});

describe("clamp, lerp, approxEqual", () => {
  it("clamps and interpolates", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
  });

  it("compares with an absolute tolerance of 1e-3 by default", () => {
    expect(approxEqual(1, 1.0005)).toBe(true);
    expect(approxEqual(1, 1.002)).toBe(false);
    expect(approxEqual(1, 1.002, 0.01)).toBe(true);
  });
});
