import { describe, expect, it } from "vitest";
import { geometricMean } from "../util/number";
import { FibredSurface } from "./fibred-surface";
import { EigenvalueDecomposition, Matrix } from "ml-matrix";
import { growthRate, perronFrobenius, spectralRadius } from "./perron-frobenius";

const φ = (1 + Math.sqrt(5)) / 2;
const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;

describe("perronFrobenius", () => {
  it("finds λ = φ² and the eigenvectors of the Anosov map a ↦ ab, b ↦ bab", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");
    const { growth, widths, lengths } = perronFrobenius(fs, { essentialOnly: false });
    const [a, b] = [edge(fs, "a"), edge(fs, "b")];
    expect(growth).toBeCloseTo(φ * φ, 10);
    // M = [[1, 1], [1, 2]] is symmetric, so both eigenvectors are ∝ (1, φ).
    expect(widths.get(b)! / widths.get(a)!).toBeCloseTo(φ, 10);
    expect(lengths.get(b)! / lengths.get(a)!).toBeCloseTo(φ, 10);
    // The normalizations of the C# version.
    expect(geometricMean(widths.values())).toBeCloseTo(growth, 10);
    expect(geometricMean([2 / lengths.get(a)!, 3 / lengths.get(b)!])).toBeCloseTo(1, 10);
  });

  it("has λ = 1 and equal widths for a periodic map", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b, b -> A");
    const { growth, widths } = perronFrobenius(fs, { essentialOnly: false });
    expect(growth).toBeCloseTo(1, 10);
    const [wa, wb] = [widths.get(edge(fs, "a"))!, widths.get(edge(fs, "b"))!];
    expect(wa).toBeGreaterThan(0);
    expect(wa).toBeCloseTo(wb, 10);
  });

  it("gives finite, non-negative weights for a reducible map", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a, b -> b a");
    const { growth, widths, lengths } = perronFrobenius(fs, { essentialOnly: false });
    expect(growth).toBeCloseTo(1, 10);
    for (const x of [...widths.values(), ...lengths.values()]) {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
    }
  });

  it("finds the spectral radius of random non-negative matrices, as the eigen-decomposition does", () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let trial = 0; trial < 30; trial++) {
      const n = 2 + (trial % 9);
      // Sparse integer entries, as in transition matrices (often reducible).
      const M = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => (random() < 0.3 ? Math.floor(random() * 3) : 0)),
      );
      const eigenvalues = new EigenvalueDecomposition(new Matrix(M));
      const expected = Math.max(
        0,
        ...eigenvalues.realEigenvalues.map((re, i) =>
          Math.hypot(re, eigenvalues.imaginaryEigenvalues[i] as number),
        ),
      );
      expect(spectralRadius(M)).toBeCloseTo(expected, 8);
    }
  });

  it("stops for a near-permutation matrix with a zero column (where the QR iteration didn't)", () => {
    // A cycle of length 7, a path into it, and a strip mapped to the empty path.
    const n = 9;
    const M = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < 7; j++) (M[(j + 1) % 7] as number[])[j] = 1;
    (M[0] as number[])[7] = 1; // strip 7 ↦ strip 0; strip 8 ↦ (empty)
    expect(spectralRadius(M)).toBeCloseTo(1, 12);
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b, b -> A");
    expect(growthRate(fs, { essentialOnly: false })).toBeCloseTo(
      perronFrobenius(fs, { essentialOnly: false }).growth,
      12,
    );
  });

  it("restricts to the essential subgraph", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b", ["b"]);
    const { matrix, widths } = perronFrobenius(fs, { essentialOnly: true });
    expect(matrix.rows.map(String)).toEqual(["a"]);
    expect([...widths.keys()].map(String)).toEqual(["a"]);
  });
});
