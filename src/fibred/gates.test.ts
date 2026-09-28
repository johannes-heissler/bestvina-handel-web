import { describe, expect, it } from "vitest";
import { CombinatorialMap } from "../graph/combinatorial-map";
import { fromBoundaryWords } from "../graph/from-boundary-words";
import { parseMap } from "../graph/path-parser";
import { RibbonGraph } from "../graph/ribbon-graph";
import { findGates, pretrivialEdges } from "./gates";

const mapOf = (graph: RibbonGraph, text: string) =>
  CombinatorialMap.fromEdgeImages(graph, graph, parseMap(text, graph).images);
const gateNames = (gates: ReturnType<typeof findGates>) =>
  gates.map((gate) => gate.edges.map((e) => e.name).join("")).sort();

describe("findGates", () => {
  it("groups edges that Dg eventually identifies", () => {
    const rose = fromBoundaryWords([["a", "b", "A", "B"]]);
    // Dg: a ↦ a, b ↦ b, A ↦ B, B ↦ B, so the gates are {a}, {b}, {A, B}.
    expect(gateNames(findGates(rose, mapOf(rose, "a -> a b, b -> b a b")))).toEqual(["AB", "a", "b"]);
  });

  it("separates edges in the same Dg-cycle at different phases", () => {
    const rose = fromBoundaryWords([["a", "b", "A", "B"]]);
    // Dg swaps a and b, and A and B: a periodic cycle of length 2, so no two edges are ever identified.
    expect(gateNames(findGates(rose, mapOf(rose, "a -> b, b -> a")))).toEqual(["A", "B", "a", "b"]);
  });

  it("identifies edges that reach the same letter after several steps", () => {
    const rose = new RibbonGraph(); // one vertex with three loops a, b, c
    const v = rose.addVertex();
    for (const name of ["a", "b", "c"]) rose.addEdge(v, v, { name });
    // Dg: a ↦ b ↦ c ↦ c; so a, b, c end up in one gate (after 2 steps).
    const g = mapOf(rose, "a -> b a, b -> c b, c -> c a");
    const gates = findGates(rose, g);
    expect(
      gates.some(
        (gate) =>
          gate.edges
            .map((e) => e.name)
            .sort()
            .join("") === "abc",
      ),
    ).toBe(true);
  });

  it("groups vertices with a custom key", () => {
    const rose = fromBoundaryWords([["a", "b", "A", "B"]]);
    const gates = findGates(rose, mapOf(rose, "a -> a b, b -> b a b"), () => "everything");
    expect(gates.every((gate) => gate.at === "everything")).toBe(true);
    expect(gates).toHaveLength(3);
  });
  it("skips pretrivial edges when iterating the derivative (Dg*)", () => {
    const rose = new RibbonGraph(); // one vertex with three loops a, b, c
    const v = rose.addVertex();
    for (const name of ["a", "b", "c"]) rose.addEdge(v, v, { name });
    // c is pretrivial (g(c) is trivial). Dg would send a and b to c and put them into one gate with c;
    // Dg* skips c: a ↦ a, b ↦ b, so a and b are separate gates.
    const g = mapOf(rose, "a -> c a, b -> c b, c -> ");
    expect([...pretrivialEdges(rose, g)].map((e) => e.name)).toEqual(["c"]);
    expect(gateNames(findGates(rose, g))).toEqual(["A", "B", "a", "b", "cC"]);
  });
});
