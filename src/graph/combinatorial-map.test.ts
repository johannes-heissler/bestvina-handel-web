import { describe, expect, it } from "vitest";
import { CombinatorialMap } from "./combinatorial-map";
import { EdgePath } from "./edge-path";
import { fromBoundaryWords } from "./from-boundary-words";
import { nameTable, parseEdgePath, parseMap } from "./path-parser";
import { RibbonGraph } from "./ribbon-graph";

/** The map of `graph` to itself given as text; unmentioned edges map to themselves. */
function mapOf(graph: RibbonGraph, text: string): CombinatorialMap {
  return CombinatorialMap.fromEdgeImages(graph, graph, parseMap(text, graph).images);
}

const torus = () => fromBoundaryWords([["a", "b", "A", "B"]]);
const path = (graph: RibbonGraph, text: string) => parseEdgePath(text, nameTable(graph));

describe("CombinatorialMap on the once-punctured torus", () => {
  const graph = torus();
  const g = mapOf(graph, "a -> a b, b -> b a b"); // a mapping class (Anosov)
  const [a, b] = graph.edges;

  it("stores images and inverts them for the reversed orientation", () => {
    expect(String(g.image(a!.forward))).toBe("a b");
    expect(String(g.image(b!.backward))).toBe("B A B");
    expect(g.vertexImage(graph.vertices[0]!)).toBe(graph.vertices[0]);
    expect(g.derivative(a!.backward)).toBe(b!.backward);
    expect(g.checkContinuity()).toEqual([]);
  });

  it("maps paths homomorphically", () => {
    const u = path(graph, "a B");
    const v = path(graph, "b b A");
    expect(g.imageOfPath(u.concat(v)).equals(g.imageOfPath(u).concat(g.imageOfPath(v)))).toBe(true);
  });

  it("composes associatively", () => {
    expect(String(g.after(g).image(a!.forward))).toBe("a b b a b");
    const left = g.after(g).after(g);
    const right = g.after(g.after(g));
    for (const e of graph.orientedEdges) expect(left.image(e).equals(right.image(e))).toBe(true);
    const id = CombinatorialMap.identity(graph);
    for (const e of graph.orientedEdges) expect(g.after(id).image(e).equals(g.image(e))).toBe(true);
  });

  it("has the transition matrix [[1, 1], [1, 2]]", () => {
    const M = g.transitionMatrix();
    expect(M.entries).toEqual([
      [1, 1],
      [1, 2],
    ]);
    expect(M.get(a!, b!)).toBe(1);
    expect(M.total).toBe(5);
    expect(g.totalLength()).toBe(5);
  });

  it("preserves the boundary word, while a ↦ a a doesn't", () => {
    expect(g.preservesBoundaryWords()).toBe(true);
    const [report] = g.boundaryWordReport();
    expect(report?.matchedIndex).toBe(0);
    expect(mapOf(graph, "a -> a a").preservesBoundaryWords()).toBe(false);
  });

  it("substitutes in images after a change of the target", () => {
    const h = mapOf(graph, "a -> a b, b -> b a b");
    h.substituteInImages((edge) => (edge === a ? path(graph, "a a") : undefined));
    expect(String(h.image(a!.forward))).toBe("a a b");
    expect(String(h.image(b!.backward))).toBe("B A A B");
  });

  it("copies along a graph copy, independently of the original", () => {
    const copy = graph.copy();
    const h = g.copy(copy);
    expect(h.source).toBe(copy.graph);
    expect(h.target).toBe(copy.graph);
    const [a2] = copy.graph.edges;
    expect(String(h.image(a2!.forward))).toBe("a b");
    expect(h.image(a2!.forward).first).toBe(a2!.forward);
    h.setImage(a2!.forward, path(copy.graph, "a"));
    expect(String(g.image(a!.forward))).toBe("a b");
  });
});

describe("maps between different graphs (like μ : G → G₀)", () => {
  const g0 = fromBoundaryWords([["a", "b", "A", "B"]]);
  const G = fromBoundaryWords([["c", "d", "C", "D"]]);
  const [c, d] = G.edges;
  const mu = CombinatorialMap.fromEdgeImages(
    G,
    g0,
    new Map([
      [c!.forward, path(g0, "a")],
      [d!.forward, path(g0, "b a")],
    ]),
  );

  it("has a transition matrix with target rows and source columns", () => {
    const M = mu.transitionMatrix();
    expect(M.rows).toEqual(g0.edges);
    expect(M.columns).toEqual(G.edges);
    expect(M.entries).toEqual([
      [1, 1],
      [0, 1],
    ]);
  });

  it("checks boundary words against the target's", () => {
    expect(mu.preservesBoundaryWords()).toBe(true); // c d C D ↦ a b a A A B = a b A B
    const bad = CombinatorialMap.fromEdgeImages(
      G,
      g0,
      new Map([
        [c!.forward, path(g0, "a")],
        [d!.forward, path(g0, "a")],
      ]),
    );
    expect(bad.preservesBoundaryWords()).toBe(false);
  });

  it("requires every edge to have an image", () => {
    expect(() => CombinatorialMap.fromEdgeImages(G, g0, new Map([[c!.forward, path(g0, "a")]]))).toThrow(
      /no image/,
    );
  });
});

describe("continuity check", () => {
  // A circle u —e→ v —f→ u.
  const graph = new RibbonGraph();
  const u = graph.addVertex("u");
  const v = graph.addVertex("v");
  const e = graph.addEdge(u, v, { name: "e" });
  const f = graph.addEdge(v, u, { name: "f" });

  it("accepts the rotation of the circle and rejects broken images", () => {
    const rotation = CombinatorialMap.fromEdgeImages(
      graph,
      graph,
      new Map([
        [e.forward, EdgePath.of(f.forward)],
        [f.forward, EdgePath.of(e.forward)],
      ]),
    );
    expect(rotation.vertexImage(u)).toBe(v);
    expect(rotation.checkContinuity()).toEqual([]);

    const broken = CombinatorialMap.identity(graph);
    broken.setImage(e.forward, EdgePath.of(f.forward));
    expect(broken.checkContinuity()).toHaveLength(1);
    broken.setImage(e.forward, EdgePath.of(e.forward, e.forward));
    expect(broken.checkContinuity()[0]).toMatch(/not a continuous path/);
  });

  it("rejects edges at one vertex whose images start at different vertices", () => {
    expect(() =>
      CombinatorialMap.fromEdgeImages(
        graph,
        graph,
        new Map([
          [e.forward, EdgePath.of(e.forward)],
          [f.forward, EdgePath.of(e.forward)],
        ]),
      ),
    ).toThrow(/start at different vertices/);
  });

  it("allows an empty image only between vertices with the same image", () => {
    const collapse = CombinatorialMap.identity(graph);
    collapse.setVertexImage(v, u);
    collapse.setImage(e.forward, EdgePath.EMPTY);
    collapse.setImage(f.forward, EdgePath.EMPTY);
    expect(collapse.checkContinuity()).toEqual([]);
    collapse.setVertexImage(v, v);
    expect(collapse.checkContinuity()).toHaveLength(2);
  });
});
