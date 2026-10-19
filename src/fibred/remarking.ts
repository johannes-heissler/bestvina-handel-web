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
  /**
   * The walls: for each puncture of P, the chord to a neighbour that filling it in removes (its name in {@link spine}),
   * and what replaces it in μ. One (from p) for the first closed-surface move.
   */
  readonly walls: readonly { readonly name: string; readonly image: string }[];
  /** G₀ while both P and Q are punctures: the polygon with the points of P and Q inside. */
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
   * μ after filling in P, into the walled G₀: each wall is replaced by the rest of the boundary of the puncture it was
   * filled in from. The graph of G must have the faces of P merged with those of Q already (the circles B removed, or
   * the branches ε deleted). Always the same walled G₀.
   */
  filled(mu: CombinatorialMap): CombinatorialMap;
  /**
   * The surface with μ into the walled G₀ (converted with {@link filled} if it is still into {@link spine}), if μ comes
   * from an embedding there. Undefined if the result is inconsistent.
   */
  finish(fs: FibredSurface): FibredSurface | undefined;
  /**
   * The walled surface (from {@link finish}) after the walls are contracted (port notes 26 and 27): the filled-in points
   * move into their neighbours (`filledPoints` of them), the point of Q in the vertex's tree of walls slides into the
   * vertex (`point`, its junction's name), the other points of Q are placed anew, and cells that collapse or can be
   * joined are merged, so their chords (`merged`) drop out of μ. With a single point and the original polygon, that
   * gives back the original model and G₀. Undefined if the contraction doesn't give convex cells, or the result is
   * inconsistent; then the walls stay.
   */
  slide(fs: FibredSurface):
    | {
        surface: FibredSurface;
        point?: string;
        filledPoints: number;
        merged: readonly string[];
        pointsLeft: number;
      }
    | undefined;
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

/** The part of a piece of a cut (or a whole branch) as fractions of its branch of τ. */
export interface BranchPart {
  readonly branch: Edge;
  readonly from: number;
  readonly to: number;
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
