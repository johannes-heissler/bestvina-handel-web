/**
 * Finite order and detecting reducibility (the C# `FiniteOrderSuggestion` and `FibredSurfaceReduction`; the thesis,
 * § "Reducibility and the periphery"). The reduction itself is in `reduce.ts`.
 *
 * @module
 */
import type { CombinatorialMap } from "../../graph/combinatorial-map";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { lcm } from "../../util/number";
import type { FibredSurface } from "../fibred-surface";
import { isPeripheryFriendlyForest, orbitOfEdge } from "./collapse-forest";

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
  /**
   * The invariant subgraph to reduce along: without components that are trees, or, for an invariant forest, together
   * with the components of the periphery P that it touches.
   */
  readonly preserved: Set<Edge>;
  /** The maximal invariant subgraph that deformation retracts to it. */
  readonly maximal: Set<Edge>;
  /** Whether it comes from an invariant forest (extended by the touched components of P). */
  readonly forest: boolean;
}

/**
 * The invariant proper subgraphs containing essential strips (strips outside the pre-periphery), which show that f is
 * reducible (the thesis, Corollary "Reducibility and essential edges"). From the orbit of each essential strip that
 * isn't the whole graph:
 *
 * - its components that are not trees (g maps them into themselves: a component with loops can't be mapped into a
 *   tree by a homotopy equivalence), if they contain an essential strip;
 * - its components that are trees, with their orbits: an invariant forest, which is never periphery-friendly here
 *   (else it would have been collapsed), taken together with the components of P that it touches (the proof of the
 *   Corollary); dropped if that gives the whole graph.
 *
 * So no candidate has components that are trees: splitting along a tree cuts nothing off. Candidates with the same
 * maximal invariant subgraph are merged, keeping the smallest (as in C#).
 */
export function reductionCandidates(fs: FibredSurface): ReductionCandidate[] {
  const prePeriphery = fs.prePeriphery();
  const all = fs.graph.edgeCount;
  const byKey = new Map<string, ReductionCandidate>();
  const add = (preserved: Set<Edge>, forest: boolean) => {
    if (preserved.size === 0 || preserved.size === all) return;
    if ([...preserved].every((f) => prePeriphery.has(f))) return;
    const maximal = maximalInvariantSubgraphRetractingTo(fs, preserved);
    if (maximal.size === all) return;
    const key = [...maximal]
      .map((f) => f.id)
      .sort((a, b) => a - b)
      .join(",");
    const existing = byKey.get(key);
    if (existing === undefined || preserved.size < existing.preserved.size)
      byKey.set(key, { preserved, maximal, forest });
  };
  for (const e of fs.graph.edges) {
    if (prePeriphery.has(e)) continue;
    const orbit = orbitOfEdge(fs, e);
    if (orbit.size === all) continue;
    const components = fs.graph.components(orbit);
    const isTree = (c: { vertices: Set<Vertex>; edges: Set<Edge> }) => c.vertices.size === c.edges.size + 1;
    add(new Set(components.filter((c) => !isTree(c)).flatMap((c) => [...c.edges])), false);
    const trees = components.filter(isTree).flatMap((c) => [...c.edges]);
    if (trees.length === 0) continue;
    // The invariant forest: the trees with their orbits and what retracts to them, if that is still a forest.
    const forest = maximalInvariantSubgraphRetractingTo(
      fs,
      new Set(trees.flatMap((f) => [...orbitOfEdge(fs, f)])),
    );
    if (!fs.graph.isForest(forest)) continue;
    add(withTouchedPeriphery(fs, forest), true);
  }
  return [...byKey.values()];
}

/** The subgraph together with the components of the periphery P that it touches. */
function withTouchedPeriphery(fs: FibredSurface, edges: ReadonlySet<Edge>): Set<Edge> {
  const result = new Set(edges);
  for (let grown = true; grown;) {
    const vertices = new Set([...result].flatMap((f) => [f.source, f.target]));
    const touched = [...fs.peripheral].filter(
      (p) => !result.has(p) && (vertices.has(p.source) || vertices.has(p.target)),
    );
    touched.forEach((p) => result.add(p));
    grown = touched.length > 0;
  }
  return result;
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

/** Deletes everything outside the subgraph `edges` (which g must map into itself). */
export function restrictTo(fs: FibredSurface, edges: ReadonlySet<Edge>): void {
  for (const e of fs.graph.edges) if (!edges.has(e)) fs.removeStrip(e);
  const vertices = new Set([...edges].flatMap((e) => [e.source, e.target]));
  for (const v of fs.graph.vertices) if (!vertices.has(v)) fs.removeJunction(v);
}

/** Replaces g by g^k, in place. */
export function replaceByPower(g: CombinatorialMap, k: number): void {
  let power = g;
  for (let i = 1; i < k; i++) power = g.after(power);
  for (const v of g.source.vertices) g.setVertexImage(v, power.vertexImage(v));
  for (const e of g.source.edges) g.setImage(e.forward, power.image(e.forward));
}
