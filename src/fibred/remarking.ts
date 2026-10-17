/**
 * Keeping the original model through the closed-surface moves (port note 22, § 3): the embedding layer places the new
 * punctures Q inside the polygon and computes μ for the parts of τ by intersecting their drawing with the cells; the
 * moves use it through this interface and stay combinatorial.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";
import type { TrainTrack } from "./train-track";

export interface Remarking {
  /** Whether a single new puncture is moved to p's place (the original model is kept), see {@link finish}. */
  readonly contracts: boolean;
  /** The chord from p to a point of Q that filling in p removes (its name in {@link spine}), and what replaces it. */
  readonly wall: { readonly name: string; readonly image: string };
  /** G₀ while both p and Q are punctures: the polygon with the points of Q inside. */
  readonly spine: RibbonGraph;
  /** μ of the part of the branch b of τ between the fractions `from` ≤ `to` of its length (b forward). */
  part(branch: Edge, from: number, to: number): EdgePath;
  /** The cell (a vertex of {@link spine}) at the fraction `at` of the branch (forward). */
  cellAt(branch: Edge, at: number): Vertex;
  /** The cell of a switch of τ. */
  switchCell(s: Vertex): Vertex;
  /** The cell of a junction of G. */
  junctionCell(v: Vertex): Vertex;
  /** μ of the way inside the junction of the strip end x, from the junction to the switch of x. */
  toSwitch(x: OrientedEdge): EdgePath;
  /**
   * μ after filling in p, into the final G₀: the wall from p to a point of Q is replaced by the rest of p's boundary, and
   * for a single point q, q slides along the wall into p's corner (the chords disappear). The graph of G must have p's
   * face merged with q's already (B removed, or ε deleted). Always the same final G₀.
   */
  filled(mu: CombinatorialMap): CombinatorialMap;
  /**
   * The surface with μ into the final G₀ (converted with {@link filled} if it is still into {@link spine}), if μ comes
   * from an embedding there: p filled in, and (for a single point q) q moved along the chord to p's place,
   * so that the original model and G₀ are kept. Undefined if the result is inconsistent.
   */
  finish(fs: FibredSurface): FibredSurface | undefined;
}

/** Gives a {@link Remarking} for the closed-surface move on `fs` with the orbit Q of singular junctions (the session). */
export type RemarkingProvider = (
  fs: FibredSurface,
  tt: TrainTrack,
  orbit: readonly Vertex[],
) => Remarking | undefined;

/** μ of τ itself (with Q inside its infinitesimal polygons): each branch whole. */
export function markTrack(tt: TrainTrack, remarking: Remarking): CombinatorialMap {
  const mu = new CombinatorialMap(tt.graph, remarking.spine);
  for (const s of tt.graph.vertices) mu.setVertexImage(s, remarking.switchCell(s));
  for (const b of tt.graph.edges) mu.setImage(b.forward, remarking.part(b, 0, 1).reduced());
  return mu;
}

/** The part of a piece of τ′ (or a whole branch) as fractions of its branch. */
export interface BranchPart {
  readonly branch: Edge;
  readonly from: number;
  readonly to: number;
}

/** μ of a graph whose edges are parts of branches of τ, running along them (e.g. the cut track τ′). */
export function markParts(
  graph: RibbonGraph,
  partOf: (e: Edge) => BranchPart,
  remarking: Remarking,
): CombinatorialMap {
  const mu = new CombinatorialMap(graph, remarking.spine);
  for (const e of graph.edges) {
    const { branch, from, to } = partOf(e);
    mu.setImage(e.forward, remarking.part(branch, from, to).reduced());
  }
  for (const v of graph.vertices) {
    const x = graph.star(v)[0] as OrientedEdge;
    const { branch, from, to } = partOf(x.edge);
    mu.setVertexImage(v, remarking.cellAt(branch, x.isForward ? from : to));
  }
  return mu;
}

/** μ with the edges in `edges` forgotten (deleted from the graph). */
export function forgetInMarking(
  mu: CombinatorialMap | undefined,
  edges: Iterable<Edge>,
  vertices: Iterable<Vertex> = [],
) {
  if (mu === undefined) return;
  for (const e of edges) mu.forgetEdge(e);
  for (const v of vertices) mu.forgetVertex(v);
}
