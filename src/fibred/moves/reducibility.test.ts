import { describe, expect, it } from "vitest";
import { CombinatorialMap } from "../../graph/combinatorial-map";
import { EdgePath } from "../../graph/edge-path";
import { RibbonGraph } from "../../graph/ribbon-graph";
import { FibredSurface } from "../fibred-surface";
import { perronFrobenius } from "../perron-frobenius";
import {
  componentOrbits,
  finiteOrder,
  maximalInvariantSubgraphRetractingTo,
  reduceToSubgraph,
  reductionCandidates,
} from "./reducibility";

const genus2 = (map: string) => FibredSurface.fromText([["a", "b", "A", "B", "c", "d", "C", "D"]], map);
const names = (edges: Iterable<{ name: string }>) => [...edges].map((e) => e.name).sort();

describe("finiteOrder", () => {
  it("is the order of a graph automorphism", () => {
    expect(finiteOrder(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b, b -> A"))).toBe(4);
    expect(finiteOrder(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a, b -> b"))).toBe(1);
    expect(finiteOrder(genus2("a -> c, b -> d, c -> a, d -> b"))).toBe(2); // swapping the handles
  });

  it("is undefined if some strip is not mapped to a single strip", () => {
    expect(
      finiteOrder(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b")),
    ).toBeUndefined();
  });
});

describe("reducibility", () => {
  // The Anosov map on the first handle, the identity on the second.
  const make = () => genus2("a -> a b, b -> b a b");

  it("finds the invariant subgraphs with essential strips", () => {
    const candidates = reductionCandidates(make());
    expect(candidates.map((c) => names(c.preserved)).sort()).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("reduces to the first handle, where the map is the Anosov map", () => {
    const fs = make();
    const candidate = reductionCandidates(fs).find((c) => c.preserved.size === 2)!;
    reduceToSubgraph(fs, candidate.preserved);
    expect(names(fs.graph.edges)).toEqual(["a", "b"]);
    expect(fs.isSubsurface).toBe(true);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(perronFrobenius(fs, { essentialOnly: false }).growth).toBeCloseTo(
      ((1 + Math.sqrt(5)) / 2) ** 2,
      9,
    );
  });

  it("reduces to the second handle, where the map has finite order", () => {
    const fs = make();
    const c = fs.graph.edges.find((e) => e.name === "c")!;
    const d = fs.graph.edges.find((e) => e.name === "d")!;
    reduceToSubgraph(fs, new Set([c, d]));
    expect(finiteOrder(fs)).toBe(1);
  });
});

describe("first return maps", () => {
  // Two loops a (at u) and b (at v) that g swaps, joined by a strip e.
  const make = () => {
    const graph = new RibbonGraph();
    const u = graph.addVertex("u");
    const v = graph.addVertex("v");
    const a = graph.addEdge(u, u, { name: "a" });
    const b = graph.addEdge(v, v, { name: "b" });
    const e = graph.addEdge(u, v, { name: "e" });
    const g = CombinatorialMap.fromEdgeImages(
      graph,
      graph,
      new Map([
        [a.forward, EdgePath.of(b.forward)],
        [b.forward, EdgePath.of(a.forward)],
        [e.forward, EdgePath.of(e.backward)],
      ]),
    );
    return { fs: new FibredSurface({ graph, g }), a, b };
  };

  it("groups the components of an invariant subgraph into orbits", () => {
    const { fs, a, b } = make();
    expect(componentOrbits(fs, new Set([a, b])).map((orbit) => orbit.map(names))).toEqual([[["a"], ["b"]]]);
  });

  it("replaces g by g² when reducing to one of two swapped components", () => {
    const { fs, a, b } = make();
    reduceToSubgraph(fs, new Set([a, b]));
    expect(names(fs.graph.edges)).toEqual(["a"]);
    expect(String(fs.g.image(a.forward))).toBe("a");
  });

  it("doesn't add a strip that joins two components (that changes the homotopy type)", () => {
    const { fs, a, b } = make();
    expect(names(maximalInvariantSubgraphRetractingTo(fs, new Set([a, b])))).toEqual(["a", "b"]);
  });

  it("adds a stem that attaches to the subgraph at one junction", () => {
    // A loop a at u, a stem s from u to w, and a peripheral loop p at w, all fixed.
    const graph = new RibbonGraph();
    const u = graph.addVertex("u");
    const w = graph.addVertex("w");
    graph.addEdge(u, u, { name: "a" });
    const s = graph.addEdge(u, w, { name: "s" });
    const p = graph.addEdge(w, w, { name: "p" });
    const fs = new FibredSurface({ graph, g: CombinatorialMap.identity(graph) });
    expect(names(maximalInvariantSubgraphRetractingTo(fs, new Set([p])))).toEqual(["p", "s"]);
    expect(s.source).toBe(u);
  });
});
