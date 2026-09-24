import { describe, expect, it } from "vitest";
import { complex } from "./complex";
import { Mat3 } from "./mat3";
import { Vec3, vec3 } from "./vec3";

const expectMatClose = (A: Mat3, B: Mat3) => {
  for (const col of ["a", "b", "c"] as const)
    for (const coord of ["x", "y", "z"] as const) expect(A[col][coord]).toBeCloseTo(B[col][coord], 12);
};

describe("Mat3", () => {
  const A = new Mat3(vec3(2, 0, 1), vec3(1, 3, 0), vec3(0, -1, 4));

  it("maps the standard basis to its columns", () => {
    expect(A.apply(Vec3.X)).toEqual(A.a);
    expect(A.apply(Vec3.Y)).toEqual(A.b);
    expect(A.apply(Vec3.Z)).toEqual(A.c);
  });

  it("builds diagonal and 2×2 matrices", () => {
    expect(Mat3.diagonal(2, 3).apply(vec3(1, 1, 1))).toEqual(vec3(2, 3, 1));
    // (1 2; 3 4) · (1, 1) = (3, 7)
    expect(Mat3.fromRows2x2(1, 2, 3, 4).apply(vec3(1, 1, 5))).toEqual(vec3(3, 7, 5));
  });

  it("represents complex multiplication", () => {
    const w = complex(2, 3);
    const z = complex(-1, 4);
    expect(Mat3.fromComplex(w).apply(Vec3.fromComplex(z))).toEqual(Vec3.fromComplex(w.mul(z)));
  });

  it("composes: (A·B)·v = A·(B·v)", () => {
    const B = Mat3.fromRows2x2(0, -1, 1, 0);
    const v = vec3(1, 2, 3);
    expect(A.mul(B).apply(v)).toEqual(A.apply(B.apply(v)));
  });

  it("computes determinant, transpose and inverse", () => {
    expect(Mat3.IDENTITY.determinant()).toBe(1);
    expect(A.determinant()).toBeCloseTo(23); // rows (2 1 0; 0 3 -1; 1 0 4)
    expect(A.transpose().transpose()).toEqual(A);
    expectMatClose(A.mul(A.inverse()), Mat3.IDENTITY);
    expectMatClose(A.inverse().mul(A), Mat3.IDENTITY);
  });

  it("throws on inverting a singular matrix (the C# version returned infinities)", () => {
    expect(() => new Mat3(Vec3.X, Vec3.Y, Vec3.X).inverse()).toThrow(RangeError);
  });
});
