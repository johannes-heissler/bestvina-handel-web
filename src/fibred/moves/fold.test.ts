import { describe, expect, it } from "vitest";
import { nameTable, parseEdgePath } from "../../graph/path-parser";
import { EdgePoint } from "../edge-point";
import { FibredSurface } from "../fibred-surface";
import { foldInitialSegments, foldOptions, foldPair, inCyclicOrder } from "./fold";
import { subdivide } from "./subdivide";

const torus = (map: string) => FibredSurface.fromText([["a", "b", "A", "B"]], map);
const edge = (fs: FibredSurface, name: string) => fs.graph.orientedEdges.find((e) => e.name === name)!;
const images = (fs: FibredSurface, map: "g" | "mu" = "g") =>
  fs.graph.edges.map((e) => `${e}:${String(fs[map].image(e.forward))}`).join(", ");

describe("subdivide", () => {
  it("splits a strip and substitutes it in all images", () => {
    const fs = torus("a -> a b, b -> b a b");
    const { first, second, junction } = subdivide(fs, edge(fs, "b").edge, 1);
    expect([first.name, second.name]).toEqual(["b1", "b2"]);
    expect(images(fs)).toBe("a:a b1 b2, b1:b1 b2, b2:a b1 b2");
    expect(fs.g.vertexImage(junction)).toBe(edge(fs, "a").source);
    expect(images(fs, "mu")).toBe("a:a, b1:, b2:b"); // w is placed before the side crossing
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("can put the new junction after a side crossing", () => {
    const fs = torus("a -> a b, b -> b a b");
    subdivide(fs, edge(fs, "b").edge, 2, 1);
    expect(images(fs, "mu")).toBe("a:a, b1:b, b2:");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("follows edge points", () => {
    const fs = torus("a -> a b, b -> b a b");
    const [a, b] = [edge(fs, "a"), edge(fs, "b")];
    const { transform } = subdivide(fs, b.edge, 1);
    // a|b in g(a) stays between a and b1 b2.
    expect(transform(new EdgePoint(a, 1)).describe(fs)).toBe("g(a) = a|b1 b2");
    // b a|b in g(b) lies on the second part: a|b1 b2.
    expect(transform(new EdgePoint(b, 2)).describe(fs)).toBe("g(b2) = a|b1 b2");
  });

  it("names parts like the C# version and keeps the periphery", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b", ["b"]);
    const { first } = subdivide(fs, edge(fs, "b").edge, 1);
    subdivide(fs, first, 1);
    expect(fs.graph.edges.map(String).sort()).toEqual(["a", "b1+", "b1-", "b2"]);
    expect([...fs.peripheral].map(String).sort()).toEqual(["b1+", "b1-", "b2"]);
  });

  it("rejects indices at the ends", () => {
    const fs = torus("a -> a b, b -> b a b");
    expect(() => subdivide(fs, edge(fs, "a").edge, 0)).toThrow();
    expect(() => subdivide(fs, edge(fs, "a").edge, 2)).toThrow();
  });
});

describe("folding initial segments", () => {
  // g(a) = a b and g(b) = a b b agree in their first two letters; a and b are adjacent at the junction.
  const make = () => torus("a -> a b, b -> a b b");

  it("finds the strips in cyclic order", () => {
    const fs = make();
    expect(fs.checkIntegrity()).toEqual([]);
    expect(inCyclicOrder(fs, [edge(fs, "a"), edge(fs, "b")]).map(String)).toEqual(["b", "a"]);
  });

  it("offers the choices of μ for the folded segment", () => {
    const fs = make();
    const options = foldOptions(fs, [edge(fs, "a"), edge(fs, "b")], 2);
    // a is folded completely and is a loop, so only c = μ(a) works without moving both of its ends.
    expect(options.map((o) => [String(o.preferred), o.l, String(o.c), o.sideCrossings])).toEqual([
      ["a", 1, "a", 3],
    ]);
  });

  it("folds a full and a partial strip (the partial-full case)", () => {
    const fs = make();
    const c = parseEdgePath("a", nameTable(fs.spine0));
    const { folded } = foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "b")], 2, { c, kept: edge(fs, "a") });
    expect(String(folded)).toBe("a");
    expect(images(fs)).toBe("a:a a b2, b2:a b2");
    expect(images(fs, "mu")).toBe("a:a, b2:A b");
    expect(fs.graph.vertexCount).toBe(1);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("folds two partial strips (the partial-partial case) without moving junctions", () => {
    const fs = make();
    foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "b")], 1);
    expect(fs.graph.edgeCount).toBe(3);
    expect(fs.mu.totalLength()).toBe(2); // the default c is the common prefix of μ(a) = a and μ(b) = b: empty
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("folds backward strip ends", () => {
    // g(A) = B A and g(B) = B B A both start with B, and A, B are adjacent.
    const fs = make();
    const options = foldOptions(fs, [edge(fs, "A"), edge(fs, "B")], 1);
    expect(options.length).toBeGreaterThan(1);
    for (const option of options) {
      const copy = fs.copy();
      foldInitialSegments(copy, [edge(copy, "A"), edge(copy, "B")], 1, {
        c: option.c,
        kept: edge(copy, String(option.preferred)),
      });
      expect(copy.checkIntegrity()).toEqual([]);
      expect(copy.mu.totalLength()).toBe(option.sideCrossings);
    }
  });

  it("rejects strips that are not adjacent or whose images differ", () => {
    const fs = make();
    expect(() => foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "B")], 1)).toThrow(/doesn't start with/);
    expect(() => foldPair(fs, edge(fs, "a"), edge(fs, "b"))).toThrow(/g\(a\) ≠ g\(b\)/);
  });
});
