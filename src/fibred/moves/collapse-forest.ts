/**
 * Collapsing (invariant) subforests (the C# `FibredSurfaceCollapseSubforests`).
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";

/**
 * The smallest g-invariant subgraph containing `edge`: `edge` together with all strips that occur in the images
 * of its strips, repeatedly (the C# `OrbitOfEdge`).
 */
export function orbitOfEdge(fs: FibredSurface, edge: Edge): Set<Edge> {
  const orbit = new Set([edge]);
  const queue = [edge];
  for (let e = queue.pop(); e !== undefined; e = queue.pop())
    for (const letter of fs.g.image(e.forward))
      if (!orbit.has(letter.edge)) {
        orbit.add(letter.edge);
        queue.push(letter.edge);
      }
  return orbit;
}

/**
 * Whether the edges form a forest each of whose components contains at most one junction of the peripheral
 * subgraph, so that collapsing it doesn't destroy the periphery. With `touching`, each component must
 * contain exactly one.
 *
 * Unlike the C# version, the periphery that is passed in is actually used (C# always used the stored one).
 */
export function isPeripheryFriendlyForest(
  fs: FibredSurface,
  edges: Iterable<Edge>,
  options: { periphery?: ReadonlySet<Edge>; touching?: boolean } = {},
): boolean {
  const periphery = options.periphery ?? fs.peripheral;
  const edgeList = [...edges];
  if (!fs.graph.isForest(edgeList)) return false;
  const peripheralJunctions = new Set([...periphery].flatMap((e) => [e.source, e.target]));
  return fs.graph.components(edgeList).every((component) => {
    const touches = [...component.vertices].filter((v) => peripheralJunctions.has(v)).length;
    return options.touching ? touches === 1 : touches <= 1;
  });
}

/**
 * The maximal invariant subforests that are periphery-friendly: orbits of single edges that are forests,
 * keeping only those not contained in another one (the C# `GetInvariantSubforests`).
 */
export function invariantSubforests(fs: FibredSurface): Set<Edge>[] {
  let forests: Set<Edge>[] = [];
  for (const edge of fs.graph.edges) {
    if (forests.some((forest) => forest.has(edge))) continue;
    const orbit = orbitOfEdge(fs, edge);
    if (!isPeripheryFriendlyForest(fs, orbit)) continue;
    forests = forests.filter((forest) => ![...forest].every((e) => orbit.has(e)));
    forests.push(orbit);
  }
  return forests;
}

/** The possible centres of a component: its junctions, by decreasing valence (the C# default order). */
export function candidateCenters(fs: FibredSurface, component: ReadonlySet<Vertex>): Vertex[] {
  return [...component].sort((v, w) => fs.graph.valence(w) - fs.graph.valence(v));
}

/**
 * Collapses each component T of the forest to one of its junctions p, its centre. This is the homotopy
 * equivalence h that maps T to p; every strip e leaving T at x becomes e′ = [p → x]_T · e, starting at p.
 *
 * - g: g(e′) = g([p → x]_T) · g(e), then the forest strips are deleted from all images, and junctions mapped
 *   into T are mapped to p. Since g([p → x]_T) is included, the forest doesn't have to be invariant (as the C#
 *   code remarks, removing a valence-2 junction is a special case).
 * - μ: μ(e′) = μ([p → x]_T) · μ(e), reduced: the isotopy that contracts T to p (the thesis, § "Collapsing invariant
 *   subforests and isotopy").
 * - The cyclic order at p is the star of the contracted tree ({@link RibbonGraph.starOfSubgraph}).
 *
 * @param chooseCenter Picks the centre among the {@link candidateCenters} of each component; by default the
 *   first (a junction of largest valence). This is the choice the C# "in steps" mode asks the user for.
 */
export function collapseSubforest(
  fs: FibredSurface,
  forest: ReadonlySet<Edge>,
  chooseCenter: (candidates: Vertex[]) => Vertex = (candidates) => candidates[0] as Vertex,
): void {
  if (!fs.graph.isForest(forest)) throw new Error(`The edges ${[...forest].join(", ")} don't form a forest`);

  const centerOf = new Map<Vertex, Vertex>();
  for (const component of fs.graph.components(forest)) {
    const center = chooseCenter(candidateCenters(fs, component.vertices));
    if (!component.vertices.has(center)) throw new Error(`${center} is not in the component`);
    const pathFromCenter = pathsInTree(center, component.edges);
    const star = fs.graph.starOfSubgraph(center, component.edges);

    // Prolong every strip end leaving the tree by the path from the centre (loops get both ends prolonged).
    for (const e of star) {
      const path = pathFromCenter.get(e.source) as EdgePath;
      fs.g.setImage(e, fs.g.imageOfPath(path).concat(fs.g.image(e)));
      fs.mu.setImage(e, fs.mu.imageOfPath(path).concat(fs.mu.image(e)).reduced());
      if (e.source !== center) fs.graph.reattach(e, center);
    }
    for (const v of component.vertices) centerOf.set(v, center);
    for (const e of component.edges) fs.graph.removeEdge(e); // the strips are removed from g, μ, P below
    fs.graph.setStar(center, star);
  }

  // h on the target side: forest strips disappear, junctions in a tree go to its centre.
  fs.g.substituteInImages((edge) => (forest.has(edge) ? EdgePath.EMPTY : undefined));
  for (const v of fs.graph.vertices) {
    const image = fs.g.vertexImage(v);
    fs.g.setVertexImage(v, centerOf.get(image) ?? image);
  }
  for (const e of forest) {
    fs.g.forgetEdge(e);
    fs.mu.forgetEdge(e);
    fs.peripheral.delete(e);
  }
  for (const [v, center] of centerOf) if (v !== center) fs.removeJunction(v);
}

/** For each junction x of the tree, the path [center → x] inside the tree (empty for the centre). */
function pathsInTree(center: Vertex, tree: ReadonlySet<Edge>): Map<Vertex, EdgePath> {
  const paths = new Map<Vertex, EdgePath>([[center, EdgePath.EMPTY]]);
  const queue = [center];
  for (let x = queue.shift(); x !== undefined; x = queue.shift()) {
    const pathToX = paths.get(x) as EdgePath;
    for (const e of tree) {
      const step: OrientedEdge | undefined =
        e.source === x ? e.forward : e.target === x ? e.backward : undefined;
      if (step === undefined || paths.has(step.target)) continue;
      paths.set(step.target, pathToX.concat(EdgePath.of(step)));
      queue.push(step.target);
    }
  }
  return paths;
}
