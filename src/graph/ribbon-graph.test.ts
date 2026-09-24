import { describe, expect, it } from "vitest";
import { fromBoundaryWords } from "./from-boundary-words";
import { invertName, isForwardName } from "./names";
import { RibbonGraph, type Edge, type OrientedEdge } from "./ribbon-graph";

const names = (word: readonly OrientedEdge[]) => word.map((e) => e.name).join("");

/** Boundary words as strings, each rotated to start at its smallest letter, sorted. Rotation-independent. */
function normalizedBoundaryWords(graph: RibbonGraph): string[] {
  return graph
    .boundaryWords()
    .map((word) => {
      const letters = word.map((e) => e.name);
      const rotations = letters.map((_, i) => [...letters.slice(i), ...letters.slice(0, i)].join(""));
      return rotations.sort()[0] as string;
    })
    .sort();
}

describe("names", () => {
  it("inverts by switching case", () => {
    expect(invertName("a")).toBe("A");
    expect(invertName("A")).toBe("a");
    expect(invertName("a1")).toBe("A1");
    expect(invertName("1b")).toBe("1B");
    expect(isForwardName("a")).toBe(true);
    expect(isForwardName("A")).toBe(false);
  });

  it("rejects names without letters (the C# version crashed)", () => {
    expect(() => invertName("12")).toThrow();
  });
});

describe("oriented edges", () => {
  const graph = new RibbonGraph();
  const u = graph.addVertex("u");
  const v = graph.addVertex("v");
  const e = graph.addEdge(u, v, { name: "a" });

  it("are unique objects with reversed, source, target and name", () => {
    expect(e.forward.reversed).toBe(e.backward);
    expect(e.backward.reversed).toBe(e.forward);
    expect([e.forward.source, e.forward.target]).toEqual([u, v]);
    expect([e.backward.source, e.backward.target]).toEqual([v, u]);
    expect([e.forward.name, e.backward.name]).toEqual(["a", "A"]);
  });
});

describe("stars and σ", () => {
  // A vertex with three edges a, b, c in this cyclic order, plus a loop d.
  const graph = new RibbonGraph();
  const center = graph.addVertex("center");
  const [x, y, z] = ["x", "y", "z"].map((n) => graph.addVertex(n)) as [
    ReturnType<RibbonGraph["addVertex"]>,
    ReturnType<RibbonGraph["addVertex"]>,
    ReturnType<RibbonGraph["addVertex"]>,
  ];
  const a = graph.addEdge(center, x, { name: "a" });
  const c = graph.addEdge(center, z, { name: "c" });
  const b = graph.addEdge(center, y, { name: "b", atSource: { after: a.forward } });
  const d = graph.addEdge(center, center, { name: "d", atSource: { before: a.forward } });

  it("keeps the requested cyclic order", () => {
    expect(names(graph.star(center))).toBe("dabcD");
    expect(graph.valence(center)).toBe(5); // the loop counts twice
  });

  it("has σ and σ⁻¹ with wrap-around", () => {
    expect(graph.next(a.forward)).toBe(b.forward);
    expect(graph.next(c.forward)).toBe(d.backward);
    expect(graph.previous(d.forward)).toBe(d.backward);
    expect(names(graph.starFrom(b.forward))).toBe("bcDda");
  });

  it("stays consistent after removing and reattaching edges", () => {
    graph.checkConsistency();
    const g = graph.copy().graph;
    const [a2, , , d2] = g.edges as [Edge, Edge, Edge, Edge];
    g.removeEdge(d2);
    g.reattach(a2.backward, g.vertices[2]!); // move the far end of a from x to y
    g.checkConsistency();
    expect(a2.target.name).toBe("y");
    expect(() => g.removeVertex(g.vertices[0]!)).toThrow();
    g.removeVertex(g.vertices[1]!); // x is now isolated
    expect(g.vertexCount).toBe(3);
  });

  it("rejects a star that is not a permutation", () => {
    expect(() => graph.setStar(center, [a.forward, b.forward])).toThrow();
  });
});

describe("fromBoundaryWords and boundaryWords", () => {
  it("builds the rose of the once-punctured torus", () => {
    const graph = fromBoundaryWords([["a", "b", "A", "B"]]);
    graph.checkConsistency();
    expect(graph.vertexCount).toBe(1);
    expect(graph.edgeCount).toBe(2);
    expect(graph.eulerCharacteristic).toBe(-1);
    expect(normalizedBoundaryWords(graph)).toEqual([normalize("abAB")]);
  });

  it("recovers the boundary words it was built from", () => {
    const examples = [
      [["a", "b", "A", "B"]],
      [
        ["a", "B"],
        ["b", "A"],
      ], // an annulus (two boundary components)
      [["a", "b", "c", "A", "B", "C"]], // genus 1, once punctured, three edges
      [["A", "b", "a", "B"]], // starts with an inverse letter (buggy in C#)
      [["a", "b", "A", "B", "c", "d", "C", "D"]], // genus 2, once punctured
    ];
    for (const words of examples) {
      const graph = fromBoundaryWords(words);
      graph.checkConsistency();
      expect(normalizedBoundaryWords(graph)).toEqual(words.map((w) => normalize(w.join(""))).sort());
    }
  });

  it("gives χ = 2 − 2·genus − punctures", () => {
    const genus2 = fromBoundaryWords([["a", "b", "A", "B", "c", "d", "C", "D"]]);
    expect(genus2.eulerCharacteristic).toBe(2 - 2 * 2 - 1);
    expect(genus2.boundaryWords()).toHaveLength(1);
  });

  it("rejects missing or repeated oriented edges", () => {
    expect(() => fromBoundaryWords([["a", "b", "A"]])).toThrow(/occurs in no boundary word/);
    expect(() => fromBoundaryWords([["a", "a", "A"]])).toThrow(/more than once/);
  });
});

describe("components, forests and contracted stars", () => {
  // A path x — y — z with a pendant edge at y, inside a rose.
  const graph = fromBoundaryWords([["a", "b", "A", "B"]]);
  const [v] = graph.vertices as [ReturnType<RibbonGraph["addVertex"]>];
  const w = graph.addVertex("w");
  const t = graph.addEdge(v, w, { name: "t", atSource: { after: graph.star(v)[0]! } });
  const s = graph.addEdge(w, graph.addVertex("u"), { name: "s" });

  it("finds connected components of subsets", () => {
    expect(graph.components()).toHaveLength(1);
    const [a, b] = graph.edges as [Edge, Edge];
    expect(graph.components([a, s])).toHaveLength(2);
    expect(graph.components([t, s])).toHaveLength(1);
    expect(graph.isForest([t, s])).toBe(true);
    expect(graph.isForest([a])).toBe(false); // a loop
    expect(graph.isForest([t, b])).toBe(false);
  });

  it("computes the star of a contracted tree", () => {
    const tree = new Set([t, s]);
    const contracted = graph.starOfSubgraph(v, tree);
    // Contracting t and s leaves the rose's four edge ends, in the same cyclic order.
    expect(contracted).toHaveLength(4);
    expect(new Set(contracted)).toEqual(new Set(graph.star(v).filter((e) => e.edge !== t)));
    // Starting inside the tree gives the same cyclic order.
    const fromLeaf = graph.starOfSubgraph(graph.vertices[2]!, tree);
    expect(normalize(names(fromLeaf))).toBe(normalize(names(contracted)));
  });

  it("returns an empty star if nothing leaves the component", () => {
    expect(graph.starOfSubgraph(v, new Set(graph.edges))).toEqual([]);
  });
});

/** The lexicographically smallest rotation of a cyclic word. */
function normalize(word: string): string {
  const letters = [...word];
  return letters.map((_, i) => [...letters.slice(i), ...letters.slice(0, i)].join("")).sort()[0] as string;
}
