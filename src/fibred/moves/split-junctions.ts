/**
 * Splitting junctions where the train track is disconnected (Bestvina–Handel: if the graph of gates at some junction is
 * not connected, the map is reducible, even when g is an efficient train-track map).
 *
 * At a junction v, the **gate graph** has the gates as vertices and the infinitesimal branches of τ as edges (and, to
 * be safe, every turn taken by an image of g). If it has several components, the junction disk can be cut along arcs
 * between them (the infinitesimal branches of an embedded τ don't cross), so v becomes one junction per component. g
 * stays a graph map: every turn of an image lies within one component (legal turns are infinitesimal branches,
 * illegal ones lie in one gate), and the component of a gate is carried along by Dg.
 *
 * The new graph is a regular neighbourhood of τ; its boundary curves that are not peripheral form a reduction system,
 * recorded as words in G₀. The user then chooses one piece (a component with χ < 0), and g is replaced by its
 * first-return map there. At the end of the algorithm each component of τ is then an invariant filling train track
 * for its piece, so g is pseudo-Anosov there with the growth of that component.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { trainTrack } from "../train-track";
import { componentOrbits, replaceByPower, restrictTo } from "./reducibility";

/**
 * For each junction whose gate graph is disconnected: its components, each as the list of its strip ends in the cyclic
 * order of the star. Empty if τ can't be built or every gate graph is connected.
 */
export function disconnectedJunctions(fs: FibredSurface): Map<Vertex, OrientedEdge[][]> {
  const result = new Map<Vertex, OrientedEdge[][]>();
  let tt: ReturnType<typeof trainTrack>;
  try {
    tt = trainTrack(fs);
  } catch {
    return result;
  }
  // Union–find on the switches (the gates).
  const parent = new Map<Vertex, Vertex>();
  const find = (s: Vertex): Vertex => {
    const p = parent.get(s) ?? s;
    if (p === s) return s;
    const root = find(p);
    parent.set(s, root);
    return root;
  };
  const join = (a: Vertex, b: Vertex) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const b of tt.graph.edges) if (tt.kind.get(b) === "infinitesimal") join(b.source, b.target);
  for (const e of fs.graph.edges) {
    const letters = fs.g.image(e.forward).letters;
    for (let i = 1; i < letters.length; i++) {
      const [a, b] = [
        tt.switchOf.get((letters[i - 1] as OrientedEdge).reversed),
        tt.switchOf.get(letters[i] as OrientedEdge),
      ];
      if (a && b) join(a, b);
    }
  }
  for (const v of fs.graph.vertices) {
    const byRoot = new Map<Vertex, OrientedEdge[]>();
    for (const x of fs.graph.star(v)) {
      const root = find(tt.switchOf.get(x) as Vertex);
      byRoot.set(root, [...(byRoot.get(root) ?? []), x]);
    }
    if (byRoot.size > 1) result.set(v, [...byRoot.values()]);
  }
  return result;
}

/** One piece after splitting: a component of the new graph with χ < 0. */
export interface SplitPiece {
  readonly edges: Set<Edge>;
  /** The number of pieces in its orbit under g; g is replaced by g^period on the chosen piece. */
  readonly period: number;
}

/**
 * Splits every junction with a disconnected gate graph into one junction per component, records the reduction curves
 * (the boundary words of the new graph, as words in G₀, without the peripheral ones), lets `choose` pick a piece and
 * restricts to it with the first-return map.
 *
 * @throws Error if no gate graph is disconnected.
 */
export function splitJunctions(
  fs: FibredSurface,
  choose: (pieces: readonly SplitPiece[]) => SplitPiece = (pieces) => pieces[0] as SplitPiece,
): void {
  const split = disconnectedJunctions(fs);
  if (split.size === 0) throw new Error("Every gate graph is connected: there is nothing to split");
  const { graph, g, mu } = fs;

  // The first letter of each strip end's image, before anything changes: it decides the component of the image.
  const firstLetter = new Map(graph.orientedEdges.map((x) => [x, g.image(x).letters[0]]));
  /** The new junction of each strip end (all of them: ends at unsplit junctions keep theirs). */
  const junctionOf = new Map<OrientedEdge, Vertex>();
  const originOf = new Map<Vertex, Vertex>();
  for (const v of graph.vertices) {
    const components = split.get(v);
    if (components === undefined) {
      for (const x of graph.star(v)) junctionOf.set(x, v);
      continue;
    }
    components.forEach((component, i) => {
      const w = i === 0 ? v : fs.addJunction();
      if (i > 0) mu.setVertexImage(w, mu.vertexImage(v));
      originOf.set(w, v);
      for (const x of component) junctionOf.set(x, w);
    });
  }
  // Move the strip ends, then set the cyclic orders (each component keeps the order of the old star).
  for (const components of split.values())
    components.forEach((component, i) => {
      if (i > 0) for (const x of component) graph.reattach(x, junctionOf.get(x) as Vertex);
    });
  for (const components of split.values())
    for (const component of components)
      graph.setStar(junctionOf.get(component[0] as OrientedEdge) as Vertex, component);
  // g on the junctions: the junction of the first letter of the image of any strip end there.
  for (const w of graph.vertices) {
    const x = graph.star(w).find((y) => firstLetter.get(y) !== undefined);
    const y = x === undefined ? undefined : firstLetter.get(x);
    if (y !== undefined) g.setVertexImage(w, junctionOf.get(y) as Vertex);
    else if (originOf.has(w)) g.setVertexImage(w, g.vertexImage(originOf.get(w) as Vertex)); // all images trivial
  }

  const pieces = pieceOrbits(fs);
  for (const word of graph.boundaryWords()) fs.addReductionCurve(mu.imageOfPath(word));
  if (pieces.length === 0) return; // nothing with χ < 0 is left: keep the split graph
  const piece = choose(pieces);
  if (piece.period > 1) replaceByPower(g, piece.period);
  restrictTo(fs, piece.edges);
}

/** The components of the graph with χ < 0, with their periods under g. */
function pieceOrbits(fs: FibredSurface): SplitPiece[] {
  return componentOrbits(fs, new Set(fs.graph.edges)).flatMap((orbit) =>
    orbit
      .filter((edges) => new Set([...edges].flatMap((e) => [e.source, e.target])).size < edges.size) // χ < 0
      .map((edges) => ({ edges, period: orbit.length })),
  );
}
