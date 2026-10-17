/**
 * The image f(G) of the spine: the same graph, embedded by μ ∘ g instead of μ. Laid out and drawn like G, it shows
 * f(τ) inside the surface (the view "f(τ)").
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { FibredSurface } from "../fibred/fibred-surface";
import { tightenMarking } from "../fibred/moves/isotopy";

const images = new WeakMap<FibredSurface, FibredSurface>();

/**
 * The fibred surface with the same graph, g and peripheral subgraph as `fs`, and μ replaced by μ ∘ g: each image
 * reduced, and the junctions isotoped as long as all strips leaving one start across the same side (see
 * {@link tightenMarking}). It shares the graph with `fs` (so the strips and junctions are the same objects) and
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
  tightenMarking(image);
  images.set(fs, image);
  return image;
}

/**
 * The surface with the same graph, g and periphery, and a copy of μ isotoped until it is tight at the junctions (see
 * {@link tightenMarking}): for drawing a state whose μ the strand order can't order as it is.
 */
export function withTightMarking(fs: FibredSurface): FibredSurface {
  const mu = new CombinatorialMap(fs.graph, fs.spine0);
  for (const v of fs.graph.vertices) mu.setVertexImage(v, fs.mu.vertexImage(v));
  for (const e of fs.graph.edges) mu.setImage(e.forward, fs.mu.image(e.forward));
  const result = new FibredSurface({ graph: fs.graph, g: fs.g, mu, peripheral: fs.peripheral });
  result.reductionCurves.push(...fs.reductionCurves);
  tightenMarking(result);
  return result;
}
