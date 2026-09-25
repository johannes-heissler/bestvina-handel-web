/**
 * Isotopies of the embedding of G: moving junctions (the combinatorial core of the C#
 * `FibredSurfaceMovingVertices.MoveJunction`, without the curve geometry). See docs/design/embedding.md.
 *
 * @module
 */
import type { EdgePath } from "../../graph/edge-path";
import type { Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";

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
