import { describe, expect, it } from "vitest";
import { nameTable, parseEdgePath } from "../../graph/path-parser";
import { EdgePoint } from "../edge-point";
import { FibredSurface } from "../fibred-surface";
import { foldInitialSegments, foldOptions, foldPair, inCyclicOrder } from "./fold";
import { subdivide } from "./subdivide";
import { narrated } from "../narration";
import { plainText } from "../suggestions";

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

  it("maps the new junction correctly when the split letter is the strip itself, reversed", () => {
    // g(b) = b a B: the letter after the split point 2 is B = b̄. The new junction must go to the start of B in the old
    // graph (the end of b), not to the new junction, where b̄ starts after the subdivision.
    const fs = torus("a -> a, b -> b a B");
    const { junction } = subdivide(fs, edge(fs, "b").edge, 2);
    expect(fs.g.vertexImage(junction)).not.toBe(junction);
    expect(fs.g.checkContinuity()).toEqual([]); // (the map is not geometric, so only continuity is checked)
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
    // a is folded completely and is a loop, so c is μ(a) after moving the junction along some γ (port note 12, Q1).
    // The best option doesn't move it.
    expect(options.map((o) => [String(o.move), String(o.c), o.sideCrossings])[0]).toEqual(["", "a", 3]);
    expect(options.map((o) => String(o.c))).toContain("b a B"); // moved along b
    const ratings = options.map((o) => o.sideCrossings);
    expect(ratings).toEqual(ratings.toSorted((x, y) => x - y));
    for (const o of options) {
      const copy = fs.copy(); // shares G₀, where c and γ live
      foldInitialSegments(copy, [edge(copy, "a"), edge(copy, "b")], 2, {
        c: o.c,
        kept: edge(copy, "a"),
        ...(o.move && { move: o.move }),
      });
      expect(copy.checkIntegrity()).toEqual([]);
      expect(copy.mu.totalLength()).toBe(o.sideCrossings);
    }
  });

  it("folds a full and a partial strip (the partial-full case)", () => {
    const fs = make();
    const c = parseEdgePath("a", nameTable(fs.spine0));
    const { folded } = foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "b")], 2, { c, kept: edge(fs, "a") });
    expect(String(folded)).toBe("a");
    expect(images(fs)).toBe("a:a a b, b:a b"); // the rest of b is called b again
    expect(images(fs, "mu")).toBe("a:a, b:A b");
    expect(fs.graph.vertexCount).toBe(1);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("folds two partial strips (the partial-partial case) without moving junctions", () => {
    const fs = make();
    const colors = new Map(fs.graph.edges.map((e) => [e.name, e.color]));
    const { folded } = foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "b")], 1);
    // The folded first segments get a new letter and a new colour; the rest of a and b keep their names and colours.
    expect(fs.graph.edges.map((e) => e.name).sort()).toEqual(["a", "b", "c"]);
    expect(folded.edge.name).toBe("c");
    expect(edge(fs, "a").edge.color).toBe(colors.get("a"));
    expect(edge(fs, "b").edge.color).toBe(colors.get("b"));
    expect([colors.get("a"), colors.get("b")]).not.toContain(folded.edge.color);
    expect(fs.graph.edgeCount).toBe(3);
    expect(fs.mu.totalLength()).toBe(2); // the default c is the common prefix of μ(a) = a and μ(b) = b: empty
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("subdivides after the side crossings that μ shares with c, so that only the others are isotoped", () => {
    const fs = make();
    const c = parseEdgePath("b", nameTable(fs.spine0));
    const { result: folded, steps } = narrated(() =>
      foldInitialSegments(fs, [edge(fs, "a"), edge(fs, "b")], 1, { c }).folded,
    );
    // μ(b) = b starts with c: its new junction sits after the crossing and doesn't move. Only a's crosses b.
    expect(steps.filter((s) => plainText(s).startsWith("Isotopy")).map(plainText)).toEqual([
      "Isotopy: move the new junction along c = b in G₀, so that the initial segment crosses the sides like the folded segment will (μ = c). It crosses the side b first.",
    ]);
    expect(String(fs.mu.image(folded))).toBe("b");
    expect(images(fs, "mu")).toBe("c:b, a:B a, b:");
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
