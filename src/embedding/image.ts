/**
 * The image f(G) of the spine: the same graph, embedded by μ ∘ g instead of μ. Laid out and drawn like G, it shows
 * f(τ) inside the surface (the view "f(τ)").
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import type { OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { FibredSurface } from "../fibred/fibred-surface";
import { isotopeJunction } from "../fibred/moves/isotopy";

const images = new WeakMap<FibredSurface, FibredSurface>();

/**
 * The fibred surface with the same graph, g and peripheral subgraph as `fs`, and μ replaced by μ ∘ g: each image
 * reduced, and the junctions isotoped as long as all strips leaving one start across the same side (see
 * {@link tightenAtJunctions}). It shares the graph with `fs` (so the strips and junctions are the same objects) and
 * must not be changed. Cached per surface.
 */
export function imageSurface(fs: FibredSurface): FibredSurface {
  let image = images.get(fs);
  if (image !== undefined) return image;
  const composed = fs.mu.after(fs.g);
  const mu = new CombinatorialMap(fs.graph, fs.spine0);
  for (const v of fs.graph.vertices) mu.setVertexImage(v, composed.vertexImage(v));
  for (const e of fs.graph.edges) mu.setImage(e.forward, composed.image(e.forward).reduced());
  image = new FibredSurface({ graph: fs.graph, g: fs.g, mu, peripheral: fs.peripheral });
  image.reductionCurves.push(...fs.reductionCurves);
  tightenAtJunctions(image);
  images.set(fs, image);
  return image;
}

/**
 * Isotopes the junctions until μ is tight at them: while all strips leaving a cluster of junctions (joined by strips
 * with trivial μ) start across the same side, the cluster moves across it. The strand order needs this: strands
 * that only part at a junction which could be pulled across the side have no order there. Each step shortens μ, so
 * this ends.
 */
function tightenAtJunctions(fs: FibredSurface): void {
  for (let moved = true; moved; ) {
    moved = false;
    for (const cluster of clusters(fs)) {
      const leaving = cluster.flatMap((v) => fs.graph.star(v)).filter((x) => !fs.mu.image(x).isEmpty);
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
