import { describe, expect, it } from "vitest";
import { nameTable, parseEdgePath } from "../../graph/path-parser";
import { FibredSurface } from "../fibred-surface";
import { isotopeJunction } from "./isotopy";
import { backtracks, extremalJunctions, loosePositions, pullTight } from "./pull-tight";

const torus = (map: string) => FibredSurface.fromText([["a", "b", "A", "B"]], map);
const edge = (fs: FibredSurface, name: string) => fs.graph.orientedEdges.find((e) => e.name === name)!;
const images = (fs: FibredSurface, map: "g" | "mu" = "g") =>
  fs.graph.edges.map((e) => `${e}:${String(fs[map].image(e.forward))}`).join(", ");

describe("finding loose positions", () => {
  it("finds backtracks and groups them by the strip after the turn", () => {
    const fs = torus("a -> a b B, b -> b");
    expect(backtracks(fs)).toEqual([{ strip: edge(fs, "a"), index: 2 }]);
    expect([...loosePositions(fs).keys()].map(String)).toEqual(["B"]);
  });

  it("finds extremal junctions", () => {
    // Conjugation by b: every image starts with b.
    const fs = torus("a -> b a B, b -> b b B");
    expect(extremalJunctions(fs)).toEqual(fs.graph.vertices);
    expect(loosePositions(fs).get(edge(fs, "b"))?.extremalJunctions).toEqual(fs.graph.vertices);
  });

  it("finds nothing for a tight map", () => {
    expect(loosePositions(torus("a -> a b, b -> b a b")).size).toBe(0);
  });
});

describe("pullTight", () => {
  it("removes backtracks", () => {
    const fs = torus("a -> a b B b B A a b, b -> b");
    pullTight(fs);
    expect(images(fs)).toBe("a:a b, b:b");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("pulls an extremal junction tight, also at both ends of loops", () => {
    const fs = torus("a -> b a B, b -> b b B");
    pullTight(fs);
    expect(images(fs)).toBe("a:a, b:b");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("only removes the selected positions", () => {
    const fs = torus("a -> a b B a A, b -> b");
    pullTight(fs, new Set([edge(fs, "A")])); // the backtrack a A
    expect(images(fs)).toBe("a:a b B, b:b");
    pullTight(fs, new Set([edge(fs, "B")]));
    expect(images(fs)).toBe("a:a, b:b");
  });

  it("doesn't change μ", () => {
    const fs = torus("a -> b a B, b -> b b B a A");
    const before = images(fs, "mu");
    pullTight(fs);
    expect(images(fs, "mu")).toBe(before);
  });
});

describe("isotopeJunction", () => {
  it("conjugates μ of loops and keeps the boundary words", () => {
    const fs = torus("a -> a b, b -> b a b");
    const gamma = parseEdgePath("a", nameTable(fs.spine0));
    isotopeJunction(fs, fs.graph.vertices[0]!, gamma);
    // μ(e) ↦ γ̄ μ(e) γ for the loops a and b.
    expect(images(fs, "mu")).toBe("a:a, b:A b a");
    expect(images(fs)).toBe("a:a b, b:b a b"); // g is unchanged
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("rejects a path that doesn't start at μ(v)", () => {
    const fs = FibredSurface.fromText([["x", "y", "b", "Y", "X", "B"]], "x -> x y, y -> b, b -> b x y b");
    const m = fs.graph.orientedEdges.find((e) => e.name === "x")!.target;
    const gamma = parseEdgePath("b", nameTable(fs.spine0)); // starts at the other junction
    expect(() => isotopeJunction(fs, m, gamma)).toThrow(/doesn't start at/);
  });
});
