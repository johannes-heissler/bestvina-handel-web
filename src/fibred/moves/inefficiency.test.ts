import { describe, expect, it } from "vitest";
import { EdgePoint } from "../edge-point";
import { FibredSurface } from "../fibred-surface";
import { perronFrobenius } from "../perron-frobenius";
import {
  inefficiencies,
  inefficiencyAt,
  peripheralInefficiencies,
  removeInefficiency,
  removeInefficiencyStep,
  removePeripheralInefficiency,
} from "./inefficiency";

const edge = (fs: FibredSurface, name: string) => fs.graph.orientedEdges.find((e) => e.name === name)!;
const growth = (fs: FibredSurface) => perronFrobenius(fs, { essentialOnly: false }).growth;

/**
 * The Anosov map a ↦ a b a, b ↦ b a, conjugated by a: g(a) = b a a, g(b) = A b a a. All four strip ends lie in one
 * gate, so every turn is illegal; the growth is (3 + √13)/2 instead of φ² for the efficient representative.
 */
function conjugatedAnosov(): { fs: FibredSurface; errors: string[] } {
  const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a a, b -> A b a a");
  const errors: string[] = [];
  fs.onError = (message) => errors.push(message);
  return { fs, errors };
}

describe("finding inefficiencies", () => {
  it("computes the order of a turn", () => {
    const { fs } = conjugatedAnosov();
    // The turn b|a in g(a): Dg(B) = A, Dg(a) = b; then Dg(A) = A = Dg(b). So the order is 2.
    const p = inefficiencyAt(fs, new EdgePoint(edge(fs, "a"), 1))!;
    expect(p.order).toBe(2);
    expect(p.initialSegment).toBe(1);
    expect(p.edgesToFold.map(String).sort()).toEqual(["A", "B", "b"]);
  });

  it("recognizes backtracks and legal turns", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b B, b -> b a b");
    expect(inefficiencyAt(fs, new EdgePoint(edge(fs, "a"), 2))?.order).toBe(0);
    const anosov = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");
    expect(inefficiencyAt(anosov, new EdgePoint(edge(anosov, "a"), 1))).toBeUndefined();
    expect(inefficiencies(anosov)).toEqual([]);
  });

  it("lists each illegal turn once", () => {
    const { fs } = conjugatedAnosov();
    const found = inefficiencies(fs);
    expect(found).toHaveLength(3); // the turns b|a, a|a and A|b
    expect(found.every((p) => p.order === 2)).toBe(true);
  });
});

describe("removing an inefficiency", () => {
  it("lowers the order by one in each step", () => {
    const { fs, errors } = conjugatedAnosov();
    const p = inefficiencies(fs)[0]!;
    const q = removeInefficiencyStep(fs, p);
    expect(errors).toEqual([]);
    expect(q?.order).toBe(1);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("removes it completely without increasing the growth", () => {
    const { fs, errors } = conjugatedAnosov();
    const before = growth(fs);
    removeInefficiency(fs, inefficiencies(fs)[0]!);
    expect(errors).toEqual([]);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(growth(fs)).toBeLessThanOrEqual(before + 1e-9);
  });
});

describe("peripheral inefficiencies", () => {
  it("finds and folds strips whose images start with the same peripheral strip", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a, b -> b", ["b"]);
    const groups = peripheralInefficiencies(fs);
    expect(groups.map((g) => g.map(String).sort())).toEqual([["a", "b"]]);
    removePeripheralInefficiency(fs, groups[0]!);
    // a ↦ b a with b peripheral reproduces itself after the fold: that is a case for absorbing into the
    // periphery, which is not ported yet. Here we only check that the fold is consistent.
    expect(fs.checkIntegrity()).toEqual([]);
  });
});
