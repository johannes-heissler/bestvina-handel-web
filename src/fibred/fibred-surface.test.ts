import { describe, expect, it } from "vitest";
import { Color } from "../math/color";
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { nameTable, parseEdgePath } from "../graph/path-parser";
import { RibbonGraph } from "../graph/ribbon-graph";
import { FibredSurface, isCyclicInterval } from "./fibred-surface";
import { EDGE_NAMES, firstUnusedName, leastUsedColor } from "./names-and-colors";

const torus = () => FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");
const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;
const path = (fs: FibredSurface, text: string) => parseEdgePath(text, nameTable(fs.graph));

describe("FibredSurface.fromText", () => {
  it("builds G, g and μ = identity onto a copy of G", () => {
    const fs = torus();
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.spine0).not.toBe(fs.graph);
    expect(fs.spine0.edges.map(String)).toEqual(["a", "b"]);
    const a = edge(fs, "a");
    expect(fs.mu.image(a.forward).first?.edge).toBe(fs.spine0.edges[0]);
    expect(fs.mu.preservesBoundaryWords()).toBe(true);
  });
});

describe("copy", () => {
  it("is independent of the original and keeps G₀, the periphery and the flags", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b", ["b"]);
    fs.ignoreReducible = true;
    fs.isTrainTrack = true;
    const copy = fs.copy();
    expect(copy.checkIntegrity()).toEqual([]);
    expect(copy.graph).not.toBe(fs.graph);
    expect(copy.spine0).toBe(fs.spine0);
    expect([...copy.peripheral].map(String)).toEqual(["b"]);
    expect(copy.peripheral.has(edge(fs, "b"))).toBe(false);
    expect([copy.ignoreReducible, copy.isTrainTrack]).toEqual([true, true]);

    copy.g.setImage(edge(copy, "a").forward, path(copy, "a"));
    expect(String(fs.g.image(edge(fs, "a").forward))).toBe("a b");
  });
});

describe("adding and removing strips and junctions", () => {
  it("uses the next free names and least used colours", () => {
    const fs = torus();
    const v = fs.graph.vertices[0]!;
    const w = fs.addJunction();
    expect(w.name).toBe("v");
    const c = fs.addStrip(v, w);
    expect(c.name).toBe("c");
    expect(c.color.equals(edge(fs, "a").color)).toBe(false);
  });

  it("removes a strip from the graph, the maps and the periphery", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b", ["b"]);
    const w = fs.addJunction();
    const c = fs.addStrip(fs.graph.vertices[0]!, w);
    fs.peripheral.add(c);
    fs.removeStrip(c);
    fs.removeJunction(w);
    expect(fs.graph.edges.map(String)).toEqual(["a", "b"]);
    expect([...fs.peripheral].map(String)).toEqual(["b"]);
    expect(fs.checkIntegrity()).toEqual([]);
  });
});

describe("checkIntegrity", () => {
  it("reports a loop that is mapped to a vertex", () => {
    const fs = torus();
    fs.g.setImage(edge(fs, "a").forward, EdgePath.EMPTY);
    expect(fs.checkIntegrity().some((p) => p.includes("The loop a is mapped to a vertex"))).toBe(true);
  });

  it("reports duplicate names", () => {
    const fs = torus();
    edge(fs, "b").name = "a";
    expect(fs.checkIntegrity()).toContain("The edge name a is used twice");
  });

  it("reports edges with the same Dg that are not adjacent at their junction", () => {
    // Star of the rose: A b a B (cyclically). With g(a) = a b A we get Dg(a) = Dg(A) = a, but a and A
    // are not adjacent.
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b A");
    expect(fs.checkIntegrity().some((p) => p.includes("are not adjacent"))).toBe(true);
  });

  it("reports a broken μ", () => {
    const fs = torus();
    fs.mu.setImage(edge(fs, "a").forward, EdgePath.EMPTY);
    expect(fs.checkIntegrity().some((p) => p.startsWith("μ maps the boundary word"))).toBe(true);
  });

  it("reports discontinuous images", () => {
    const fs = torus();
    const w = fs.addJunction();
    fs.addStrip(fs.graph.vertices[0]!, w); // no images set
    expect(fs.checkIntegrity().some((p) => p.startsWith("g: "))).toBe(true);
  });
});

describe("pre-periphery", () => {
  // Junctions v and w; a is a loop at v, s a stem from v to w, and p, q, r loops at w.
  // P = {p}; g(q) = p, g(r) = q p, so the pre-peripheral layers are {p}, {q}, {r}.
  const graph = new RibbonGraph();
  const v = graph.addVertex("v");
  const w = graph.addVertex("w");
  const [a, s, p, q, r] = [
    graph.addEdge(v, v, { name: "a" }),
    graph.addEdge(v, w, { name: "s" }),
    graph.addEdge(w, w, { name: "p" }),
    graph.addEdge(w, w, { name: "q" }),
    graph.addEdge(w, w, { name: "r" }),
  ];
  const g = CombinatorialMap.fromEdgeImages(
    graph,
    graph,
    new Map([
      [q.forward, EdgePath.of(p.forward)],
      [r.forward, EdgePath.of(q.forward, p.forward)],
    ]),
  );
  const fs = new FibredSurface({ graph, g, peripheral: [p] });

  it("computes the layers, the pre-periphery and the essential subgraph", () => {
    expect(fs.prePeripheralLayers().map((layer) => [...layer].map(String))).toEqual([["p"], ["q"], ["r"]]);
    expect([...fs.prePeriphery()].map(String).sort()).toEqual(["p", "q", "r"]);
    expect([...fs.essentialSubgraph()]).toEqual([a, s]);
  });
});

describe("helpers", () => {
  it("detects cyclic intervals", () => {
    const cycle = [1, 2, 3, 4, 5];
    expect(isCyclicInterval(cycle, new Set([2, 3]))).toBe(true);
    expect(isCyclicInterval(cycle, new Set([5, 1]))).toBe(true);
    expect(isCyclicInterval(cycle, new Set([1, 3]))).toBe(false);
    expect(isCyclicInterval(cycle, new Set())).toBe(true);
    expect(isCyclicInterval(cycle, new Set(cycle))).toBe(true);
  });

  it("chooses names and colours", () => {
    expect(EDGE_NAMES.slice(0, 5)).toEqual(["a", "b", "c", "d", "x"]);
    for (const reserved of ["e", "f", "g", "μ", "σ", "λ"]) expect(EDGE_NAMES).not.toContain(reserved);
    expect(firstUnusedName(["a", "b", "c"], new Set(["a", "c"]))).toBe("b");
    const palette = [Color.BLACK, Color.WHITE];
    expect(leastUsedColor(palette, [Color.BLACK]).equals(Color.WHITE)).toBe(true);
    expect(leastUsedColor(palette, []).equals(Color.BLACK)).toBe(true);
  });
});
