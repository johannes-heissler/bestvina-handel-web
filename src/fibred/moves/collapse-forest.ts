/**
 * Collapsing (invariant) subforests (the C# `FibredSurfaceCollapseSubforests`).
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { narrate } from "../narration";
import { junctionsText, stripsText } from "../text-parts";
import { slideAlong } from "./isotopy";

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
 * keeping only those not contained in another one (the C# `GetInvariantSubforests`), in the order of their first
 * edge.
 *
 * Computing the orbit of every edge separately (as C# does) takes quadratic time, which matters on the large graphs
 * that the closed-surface cut produces. Instead: two edges whose orbits contain each other have the same orbit, so
 * the orbits are computed per strongly connected component of the relation "f occurs in g(e)", in reverse
 * topological order. An orbit that is not a periphery-friendly forest makes every orbit containing it fail too, so
 * orbit sets are only built while they can still be forests (at most V − 1 edges).
 */
export function invariantSubforests(fs: FibredSurface): Set<Edge>[] {
  const edges = fs.graph.edges;
  const successors = (e: Edge) => [...new Set(fs.g.image(e.forward).letters.map((x) => x.edge))];
  const components = stronglyConnectedComponents(edges, successors); // successors come first
  const componentOf = new Map<Edge, number>();
  components.forEach((component, i) => component.forEach((e) => componentOf.set(e, i)));

  const orbits: (Set<Edge> | undefined)[] = []; // undefined: not a periphery-friendly forest
  components.forEach((component, i) => {
    const later = new Set(component.flatMap(successors).map((f) => componentOf.get(f) as number));
    later.delete(i);
    if ([...later].some((j) => orbits[j] === undefined)) return void orbits.push(undefined);
    const orbit = new Set(component);
    for (const j of later) for (const e of orbits[j] as Set<Edge>) orbit.add(e);
    const possible = orbit.size < fs.graph.vertexCount && isPeripheryFriendlyForest(fs, orbit);
    orbits.push(possible ? orbit : undefined);
  });

  const forests = orbits.filter((o): o is Set<Edge> => o !== undefined).sort((a, b) => b.size - a.size);
  const maximal: Set<Edge>[] = [];
  for (const forest of forests)
    if (!maximal.some((m) => [...forest].every((e) => m.has(e)))) maximal.push(forest);
  const position = new Map(edges.map((e, i) => [e, i]));
  const first = (forest: Set<Edge>) => Math.min(...[...forest].map((e) => position.get(e) as number));
  return maximal.sort((a, b) => first(a) - first(b));
}

/**
 * Tarjan's algorithm (iterative, so deep graphs don't overflow the stack): the strongly connected components, each
 * listed after all components reachable from it.
 */
function stronglyConnectedComponents<T>(nodes: readonly T[], successors: (node: T) => readonly T[]): T[][] {
  const index = new Map<T, number>();
  const low = new Map<T, number>();
  const onStack = new Set<T>();
  const stack: T[] = [];
  const components: T[][] = [];
  let counter = 0;
  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { node: T; next: readonly T[]; i: number }[] = [];
    const open = (node: T) => {
      index.set(node, counter);
      low.set(node, counter++);
      stack.push(node);
      onStack.add(node);
      work.push({ node, next: successors(node), i: 0 });
    };
    open(root);
    while (work.length > 0) {
      const frame = work.at(-1) as { node: T; next: readonly T[]; i: number };
      if (frame.i < frame.next.length) {
        const w = frame.next[frame.i++] as T;
        if (!index.has(w)) open(w);
        else if (onStack.has(w))
          low.set(frame.node, Math.min(low.get(frame.node) as number, index.get(w) as number));
        continue;
      }
      work.pop();
      const parent = work.at(-1);
      if (parent !== undefined)
        low.set(parent.node, Math.min(low.get(parent.node) as number, low.get(frame.node) as number));
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: T[] = [];
        let w: T;
        do {
          w = stack.pop() as T;
          onStack.delete(w);
          component.push(w);
        } while (w !== frame.node);
        components.push(component);
      }
    }
  }
  return components;
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
    const others = [...pathFromCenter.keys()].filter((v) => v !== center); // nearest first
    const treeStrips = [...component.edges].map((e) => e.name);
    narrate([
      component.edges.size === 1 ? "Collapse the strip " : "Collapse the tree ",
      ...stripsText(treeStrips),
      " onto the junction ",
      { junction: center.name },
      ...(others.length > 1
        ? [" (its other junctions are ", ...junctionsText(others.map((v) => v.name)), ")"]
        : []),
      ".",
    ]);
    // The isotopy that contracts the tree: each junction slides along the tree strip towards the centre (the nearest
    // first), so that no strip of the tree crosses a side any more.
    for (const x of others) {
      const t = (pathFromCenter.get(x) as EdgePath).letters.at(-1)?.reversed as OrientedEdge; // x → its parent
      slideAlong(fs, x, t, [
        "Isotopy: slide the junction ",
        { junction: x.name },
        " along ",
        { strip: t.name },
        ` (μ = ${String(fs.mu.image(t))}) towards `,
        { junction: center.name },
        ", so that ",
        { strip: t.name },
        " crosses no side.",
      ]);
    }
    const leaving = fs.graph.starOfSubgraph(center, component.edges).filter((e) => e.source !== center);
    narrate([
      "Contract the tree to ",
      { junction: center.name },
      ": its strips disappear from all images",
      ...(leaving.length > 0
        ? [
            ", and ",
            ...stripsText(leaving.map((e) => e.name)),
            leaving.length === 1 ? " now starts at " : " now start at ",
            { junction: center.name },
            leaving.length === 1
              ? ", its image under g prolonged by the image of the path in the tree from "
              : ", their images under g prolonged by the image of the path in the tree from ",
            { junction: center.name },
          ]
        : []),
      ".",
    ]);
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
