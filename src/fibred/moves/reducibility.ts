/**
 * Finite order and reducibility (the C# `FiniteOrderSuggestion` and `FibredSurfaceReduction`; the thesis, § "Reducibility
 * and the periphery" and § "Reducing reducible maps").
 *
 * @module
 */
import type { CombinatorialMap } from "../../graph/combinatorial-map";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { lcm } from "../../util/number";
import type { FibredSurface } from "../fibred-surface";
import { collapseSubforest, isPeripheryFriendlyForest, orbitOfEdge } from "./collapse-forest";

/**
 * If g is a graph automorphism (every strip is mapped to a single strip), its order: the least common multiple of
 * the cycle lengths of the permutation of the oriented strips. Otherwise `undefined`.
 *
 * @throws RangeError if the order is too large to represent exactly.
 */
export function finiteOrder(fs: FibredSurface): number | undefined {
  const edges = fs.graph.orientedEdges;
  if (edges.some((e) => fs.g.image(e).length !== 1)) return undefined;
  const next = (e: OrientedEdge) => fs.g.image(e).first as OrientedEdge;
  if (new Set(edges.map(next)).size !== edges.length) {
    fs.reportInconsistency("g maps every strip to a single strip, but not bijectively");
    return undefined;
  }
  const seen = new Set<OrientedEdge>();
  let order = 1;
  for (const start of edges) {
    if (seen.has(start)) continue;
    let length = 0;
    for (let e = start; !seen.has(e); e = next(e)) {
      seen.add(e);
      length++;
    }
    order = lcm(order, length);
  }
  return order;
}

/**
 * The maximal invariant subgraph Q ⊇ `base` that deformation retracts to `base`: repeatedly add the orbit of a strip
 * if what it adds is a forest each of whose components touches Q in exactly one junction (the C#
 * `GetMaximalInvariantSubgraphDeformationRetractingTo`, which went through the strips only once; the thesis restarts
 * after each extension, and so does this function).
 */
export function maximalInvariantSubgraphRetractingTo(fs: FibredSurface, base: ReadonlySet<Edge>): Set<Edge> {
  const Q = new Set(base);
  for (let changed = true; changed;) {
    changed = false;
    for (const e of fs.graph.edges) {
      if (Q.has(e)) continue;
      const added = [...orbitOfEdge(fs, e)].filter((f) => !Q.has(f));
      if (isPeripheryFriendlyForest(fs, added, { periphery: Q, touching: true })) {
        for (const f of added) Q.add(f);
        changed = true;
      }
    }
  }
  return Q;
}

/** A way to reduce: an invariant subgraph containing essential strips. */
export interface ReductionCandidate {
  /** The smallest invariant subgraph found that leads to this reduction (the orbit of an essential strip). */
  readonly preserved: Set<Edge>;
  /** The maximal invariant subgraph that deformation retracts to it (plus, for a forest, the touched periphery). */
  readonly maximal: Set<Edge>;
}

/**
 * The invariant proper subgraphs containing essential strips (strips outside the pre-periphery), which show that f is
 * reducible (the thesis, Corollary "Reducibility and essential edges"). Each orbit of an essential strip that isn't
 * the whole graph is a candidate; candidates with the same maximal invariant subgraph are merged, keeping the smallest
 * orbit (as in C#). If the maximal subgraph is a forest, the peripheral components it touches are added (the proof of
 * the Corollary), and it is dropped if that gives the whole graph.
 */
export function reductionCandidates(fs: FibredSurface): ReductionCandidate[] {
  const prePeriphery = fs.prePeriphery();
  const all = fs.graph.edgeCount;
  const byKey = new Map<string, ReductionCandidate>();
  for (const e of fs.graph.edges) {
    if (prePeriphery.has(e)) continue;
    const preserved = orbitOfEdge(fs, e);
    if (preserved.size === all) continue;
    const maximal = maximalInvariantSubgraphRetractingTo(fs, preserved);
    if (fs.graph.isForest(maximal)) {
      for (let grown = true; grown;) {
        const vertices = new Set([...maximal].flatMap((f) => [f.source, f.target]));
        const touched = [...fs.peripheral].filter(
          (p) => !maximal.has(p) && (vertices.has(p.source) || vertices.has(p.target)),
        );
        touched.forEach((p) => maximal.add(p));
        grown = touched.length > 0;
      }
      if (maximal.size === all) continue;
    }
    const key = [...maximal]
      .map((f) => f.id)
      .sort((a, b) => a - b)
      .join(",");
    const existing = byKey.get(key);
    if (existing === undefined || preserved.size < existing.preserved.size)
      byKey.set(key, { preserved, maximal });
  }
  return [...byKey.values()];
}

/**
 * Prepares a reduction along the invariant subgraph `preserved`: collapses the trees that the maximal invariant subgraph
 * retracting to it hangs off `preserved`, towards junctions of `preserved` (the C# `PrepareReduction`). Afterwards, the
 * invariant subgraph is exactly `preserved` with no trees attached.
 */
export function prepareReduction(fs: FibredSurface, preserved: ReadonlySet<Edge>): void {
  const maximal = maximalInvariantSubgraphRetractingTo(fs, preserved);
  const trees = new Set([...maximal].filter((e) => !preserved.has(e)));
  if (trees.size === 0) return;
  const inPreserved = new Set([...preserved].flatMap((e) => [e.source, e.target]));
  collapseSubforest(
    fs,
    trees,
    (candidates) => candidates.find((v) => inPreserved.has(v)) ?? (candidates[0] as Vertex),
  );
}

/** The connected components of the subgraph `edges`, grouped into orbits under g (each orbit in the order of g). */
export function componentOrbits(fs: FibredSurface, edges: ReadonlySet<Edge>): Set<Edge>[][] {
  const components = fs.graph.components(edges).map((c) => c.edges);
  const componentOf = (v: Vertex) =>
    components.findIndex((c) => [...c].some((e) => e.source === v || e.target === v));
  const imageOf = (i: number) => {
    const e = [...(components[i] as Set<Edge>)][0] as Edge;
    return componentOf(fs.g.vertexImage(e.source));
  };
  const seen = new Set<number>();
  const orbits: Set<Edge>[][] = [];
  components.forEach((_, i) => {
    if (seen.has(i)) return;
    const orbit: Set<Edge>[] = [];
    for (let j = i; j >= 0 && !seen.has(j); j = imageOf(j)) {
      seen.add(j);
      orbit.push(components[j] as Set<Edge>);
    }
    orbits.push(orbit);
  });
  return orbits;
}

/**
 * Reduces to the invariant subgraph `preserved` (the C# `ReduceToSubgraph`, "Reduce to subgraph"): prepares the reduction,
 * keeps one component C of it, and replaces g by the first return map g^k on C if g permutes k components.
 *
 * The result is a fibred surface for a subsurface of the original surface: μ still records the embedding, and the
 * boundary words of the component that aren't punctures are recorded as reduction curves.
 *
 * @param choose Picks the component to keep among the components of `preserved` (by default the first one).
 */
export function reduceToSubgraph(
  fs: FibredSurface,
  preserved: ReadonlySet<Edge>,
  choose: (components: Set<Edge>[]) => Set<Edge> = (components) => components[0] as Set<Edge>,
): void {
  prepareReduction(fs, preserved);
  const kept = new Set([...preserved].filter((e) => fs.graph.hasEdge(e)));
  const orbits = componentOrbits(fs, kept);
  const component = choose(orbits.flat());
  const k = (orbits.find((orbit) => orbit.includes(component)) as Set<Edge>[]).length;
  if (k > 1) replaceByPower(fs.g, k); // before deleting the components that g maps C to
  restrictTo(fs, component);
  for (const word of fs.graph.boundaryWords()) fs.addReductionCurve(fs.mu.imageOfPath(word));
}

/** Deletes everything outside the subgraph `edges` (which g must map into itself). */
function restrictTo(fs: FibredSurface, edges: ReadonlySet<Edge>): void {
  for (const e of fs.graph.edges) if (!edges.has(e)) fs.removeStrip(e);
  const vertices = new Set([...edges].flatMap((e) => [e.source, e.target]));
  for (const v of fs.graph.vertices) if (!vertices.has(v)) fs.removeJunction(v);
}

/** Replaces g by g^k, in place. */
function replaceByPower(g: CombinatorialMap, k: number): void {
  let power = g;
  for (let i = 1; i < k; i++) power = g.after(power);
  for (const v of g.source.vertices) g.setVertexImage(v, power.vertexImage(v));
  for (const e of g.source.edges) g.setImage(e.forward, power.image(e.forward));
}
