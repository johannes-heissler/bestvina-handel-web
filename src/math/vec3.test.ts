import { describe, expect, it } from "vitest";
import { complex } from "./complex";
import { Vec3, vec3 } from "./vec3";

describe("Vec3", () => {
  const u = vec3(1, 2, 3);
  const v = vec3(-2, 0, 1);

  it("has the vector space operations", () => {
    expect(u.add(v)).toEqual(vec3(-1, 2, 4));
    expect(u.sub(v)).toEqual(vec3(3, 2, 2));
    expect(u.scale(2)).toEqual(vec3(2, 4, 6));
    expect(u.neg()).toEqual(vec3(-1, -2, -3));
    expect(u.lerp(v, 0.5)).toEqual(vec3(-0.5, 1, 2));
  });

  it("has dot and right-handed cross products", () => {
    expect(u.dot(v)).toBe(1);
    expect(Vec3.X.cross(Vec3.Y)).toEqual(Vec3.Z);
    expect(Vec3.Y.cross(Vec3.Z)).toEqual(Vec3.X);
    const n = u.cross(v);
    expect(n.dot(u)).toBe(0);
    expect(n.dot(v)).toBe(0);
  });

  it("measures lengths, distances and angles", () => {
    expect(vec3(3, 4).length()).toBe(5);
    expect(vec3(3, 4).lengthSquared()).toBe(25);
    expect(vec3(1, 1).distanceTo(vec3(4, 5))).toBe(5);
    expect(Vec3.X.angleTo(Vec3.Y)).toBeCloseTo(Math.PI / 2);
    expect(Vec3.X.angleTo(Vec3.X.neg())).toBeCloseTo(Math.PI);
  });

  it("normalizes, returning zero for the zero vector like Unity", () => {
    expect(vec3(0, 3, 4).normalized().length()).toBeCloseTo(1);
    expect(Vec3.ZERO.normalized()).toEqual(Vec3.ZERO);
  });

  it("compares approximately with tolerance 1e-3 by default", () => {
    expect(u.approxEquals(vec3(1.0005, 2, 3))).toBe(true);
    expect(u.approxEquals(vec3(1.002, 2, 3))).toBe(false);
  });

  it("converts to and from complex numbers", () => {
    expect(Vec3.fromComplex(complex(1, 2))).toEqual(vec3(1, 2, 0));
    expect(vec3(1, 2, 5).toComplex()).toEqual(complex(1, 2));
  });
});
