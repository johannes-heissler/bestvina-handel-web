/**
 * Isotopies of the embedding of G: moving junctions (the combinatorial core of the C#
 * `FibredSurfaceMovingVertices.MoveJunction`, without the curve geometry). See docs/design/embedding.md.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { narrate } from "../narration";
import type { Text } from "../suggestions";

/**
 * Moves the junction v along the path γ in G₀ (starting at μ(v)): every strip leaving v first runs back along γ.
 *
 * - μ(e) ← γ̄ · μ(e), cancelled at the junction, for each strip end e at v. For a loop at v both ends move,
 *   so μ(e) becomes γ̄ μ(e) γ.
 * - μ(v) ← the end of γ.
 * - g doesn't change: an isotopy of the embedding changes neither G nor the carrying map.
 *
 * This is the basic operation for updating μ (the thesis, § "Keeping track of the embedding").
 */
export function isotopeJunction(fs: FibredSurface, v: Vertex, gamma: EdgePath): void {
  if (gamma.isEmpty) return;
  if (gamma.source !== fs.mu.vertexImage(v))
    throw new Error(`The path ${gamma} doesn't start at μ(${v}) = ${fs.mu.vertexImage(v)}`);
  // Read each image right before changing it, so that the second end of a loop sees the first change.
  for (const e of fs.graph.star(v)) fs.mu.setImage(e, gamma.inverse.concatReduced(fs.mu.image(e)).path);
  fs.mu.setVertexImage(v, gamma.target as Vertex);
}

/**
 * Moves the junction v along γ one side at a time (an isotopy), narrating each crossing of a side: the first with
 * `what`, the others shortly. Each step records the side it crosses, for animating the isotopy (alongside the strip
 * end `along`, if given).
 */
export function moveJunction(
  fs: FibredSurface,
  v: Vertex,
  gamma: EdgePath,
  what: Text,
  along?: OrientedEdge,
): void {
  gamma.letters.forEach((side, k) => {
    narrate(
      k === 0
        ? [...what, ` It crosses the side ${side.name} first.`]
        : [`… then it crosses the side ${side.name}.`],
      {
        motion: { junction: v.name, side: side.name, ...(along && { along: along.name }) },
      },
    );
    isotopeJunction(fs, v, EdgePath.of(side));
  });
}

/**
 * Slides the junction v along the strip t leaving it, up to the polygon of the model where t ends: v moves along μ(t)
 * one side at a time (see {@link moveJunction}), so that afterwards t crosses no side and can be contracted. This is the
 * isotopy behind contracting t (collapsing a tree, removing a junction of valence 1 or 2): the result for μ is the
 * same as prolonging the other strips at v by μ(t̄).
 */
export function slideAlong(fs: FibredSurface, v: Vertex, t: OrientedEdge, what: Text): void {
  if (t.source !== v) throw new Error(`The strip ${t.name} doesn't start at ${v.name}`);
  const gamma = fs.mu.image(t);
  if (gamma.isEmpty) return;
  moveJunction(fs, v, gamma, what);
}

/**
 * Isotopes the junctions until μ is tight at them: while all strips leaving a cluster of junctions (joined by strips
 * with trivial μ) start across the same side, the cluster moves across it. The strand order needs this: strands
 * that only part at a junction which could be pulled across the side have no order there. Each step shortens μ, so
 * this ends.
 */
export function tightenMarking(fs: FibredSurface): void {
  for (let moved = true; moved;) {
    moved = false;
    for (const cluster of clusters(fs)) {
      const leaving = cluster.flatMap((v) => fs.graph.star(v)).filter((x) => !fs.mu.image(x).isEmpty);
      if (leaving.length === 0) continue; // (the cluster is everything, or only joined by trivial strips)
      const side = fs.mu.image(leaving[0] as OrientedEdge).first;
      if (side === undefined || leaving.some((x) => fs.mu.image(x).first !== side)) continue;
      for (const v of cluster) isotopeJunction(fs, v, EdgePath.of(side));
      moved = true;
    }
  }
}

/** The junctions, grouped into the components of the strips with trivial μ. */
function clusters(fs: FibredSurface): Vertex[][] {
  const seen = new Set<Vertex>();
  const result: Vertex[][] = [];
  for (const start of fs.graph.vertices) {
    if (seen.has(start)) continue;
    const cluster = [start];
    seen.add(start);
    for (let i = 0; i < cluster.length; i++)
      for (const x of fs.graph.star(cluster[i] as Vertex))
        if (fs.mu.image(x).isEmpty && !seen.has(x.target)) {
          seen.add(x.target);
          cluster.push(x.target);
        }
    result.push(cluster);
  }
  return result;
}
