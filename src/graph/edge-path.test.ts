import { describe, expect, it } from "vitest";
import { EdgePath } from "./edge-path";
import { fromBoundaryWords } from "./from-boundary-words";
import { nameTable, parseEdgePath } from "./path-parser";
import { RibbonGraph } from "./ribbon-graph";

// The rose of the once-punctured torus, with edges a and b.
const rose = fromBoundaryWords([["a", "b", "A", "B"]]);
const names = nameTable(rose);
const p = (text: string) => parseEdgePath(text, names);
const [a, b] = rose.edges.map((e) => e.forward) as [
  (typeof rose.orientedEdges)[number],
  (typeof rose.orientedEdges)[number],
];

describe("EdgePath basics", () => {
  it("has letters, length, first and last", () => {
    const path = EdgePath.of(a, b.reversed);
    expect(path.length).toBe(2);
    expect(path.first).toBe(a);
    expect(path.last).toBe(b.reversed);
    expect(path.at(-1)).toBe(b.reversed);
    expect(String(path)).toBe("a B");
    expect(EdgePath.from([]).isEmpty).toBe(true);
    expect(EdgePath.EMPTY.source).toBeUndefined();
  });

  it("inverts: an involution with (uv)⁻¹ = v⁻¹u⁻¹", () => {
    const u = p("a b b");
    const v = p("B a");
    expect(String(u.inverse)).toBe("B B A");
    expect(u.inverse.inverse.equals(u)).toBe(true);
    expect(u.concat(v).inverse.equals(v.inverse.concat(u.inverse))).toBe(true);
  });

  it("slices", () => {
    const path = p("a b A B");
    expect(String(path.slice(1))).toBe("b A B");
    expect(String(path.slice(0, 2))).toBe("a b");
    expect(path.slice(4).isEmpty).toBe(true);
  });
});

describe("reduction", () => {
  it("removes backtracking", () => {
    expect(String(p("a b B A b").reduced())).toBe("b");
    expect(p("a b B A").reduced().isEmpty).toBe(true);
    expect(p("a b").isReduced).toBe(true);
    expect(p("a A").isReduced).toBe(false);
  });

  it("reduces cyclically", () => {
    expect(String(p("a b A").cyclicallyReduced())).toBe("b");
    expect(String(p("a b a A A").cyclicallyReduced())).toBe("b");
    expect(String(p("a b A B").cyclicallyReduced())).toBe("a b A B");
  });

  it("cancels only at the junction when concatenating", () => {
    const { path, cancelled } = p("a b").concatReduced(p("B b"));
    expect(cancelled).toBe(1);
    expect(String(path)).toBe("a b");
  });
});

describe("continuity", () => {
  const graph = new RibbonGraph();
  const u = graph.addVertex("u");
  const v = graph.addVertex("v");
  const e = graph.addEdge(u, v, { name: "e" });
  const f = graph.addEdge(v, u, { name: "f" });

  it("detects continuous and closed paths", () => {
    expect(EdgePath.of(e.forward, f.forward).isClosed).toBe(true);
    expect(EdgePath.of(e.forward, e.forward).isContinuous).toBe(false);
    expect(EdgePath.of(e.forward).source).toBe(u);
    expect(EdgePath.of(e.forward).target).toBe(v);
  });
});

describe("substitution", () => {
  it("replaces the forward orientation by the image and the backward one by its inverse", () => {
    const image = (edge: typeof a.edge) => (edge === a.edge ? p("a b") : p("b"));
    expect(String(p("a B A").substitute(image))).toBe("a b B B A");
  });
});

describe("comparison", () => {
  it("counts, compares, rotates and keys", () => {
    expect(p("a b A").count(a.edge)).toBe(2);
    expect(p("a b").equals(p("a b"))).toBe(true);
    expect(p("a b").equals(p("a B"))).toBe(false);
    expect(p("a b A B").isRotationOf(p("A B a b"))).toBe(true);
    expect(p("a b A B").isRotationOf(p("a b B A"))).toBe(false);
    expect(p("a b").key).toBe(p("a b").key);
    expect(p("a b").key).not.toBe(p("a B").key);
    expect(new Set([p("a b").key, p("a b").key, p("b").key]).size).toBe(2);
  });
});
