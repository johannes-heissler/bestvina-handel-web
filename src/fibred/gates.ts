/**
 * Gates of a graph map (the C# `Gate.FindGates` and `EdgeCycle`).
 *
 * @module
 */
import type { CombinatorialMap } from "../graph/combinatorial-map";
import type { OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";

/** A gate: a maximal set of oriented edges at one junction that Dg eventually maps to the same edge. */
export interface Gate<K = Vertex> {
  /** The junction (or, with a custom grouping, the group of junctions) where the gate is. */
  readonly at: K;
  /** The edges of the gate, in the cyclic order of the star (for a vertex). */
  readonly edges: readonly OrientedEdge[];
}

/**
 * The gates of g : G → G. Two oriented edges e, e′ with the same source are in the same gate iff
 * Dgᵏ(e) = Dgᵏ(e′) for some k ≥ 0. Edges that Dg eventually sends to "undefined" (pretrivial images) form one
 * gate per junction, as in the C# version.
 *
 * It suffices to compare Dgᴺ(e) and Dgᴺ(e′) for N = the number of oriented edges: after N steps both are
 * periodic (or undefined), and Dg is injective on periodic edges, so if they agree at some k they already
 * agree at N. This replaces the edge-cycle bookkeeping of the C# code.
 *
 * @param groupOf Groups junctions whose stars are considered together (the C# `junctionIdentifier`),
 *   e.g. the components of a subgraph; by default each junction on its own. Keys are compared with `===`.
 */
export function findGates<K = Vertex>(
  graph: RibbonGraph,
  g: CombinatorialMap,
  groupOf: (v: Vertex) => K = (v) => v as unknown as K,
): Gate<K>[] {
  const n = 2 * graph.edgeCount;
  const limit = new Map<OrientedEdge, OrientedEdge | undefined>();
  const dgPowerN = (e: OrientedEdge): OrientedEdge | undefined => {
    if (!limit.has(e)) {
      let f: OrientedEdge | undefined = e;
      for (let k = 0; k < n && f !== undefined; k++) f = g.derivative(f);
      limit.set(e, f);
    }
    return limit.get(e);
  };

  const gates = new Map<K, Map<OrientedEdge | undefined, OrientedEdge[]>>();
  for (const v of graph.vertices)
    for (const e of graph.star(v)) {
      const key = groupOf(v);
      if (!gates.has(key)) gates.set(key, new Map());
      const byLimit = gates.get(key) as Map<OrientedEdge | undefined, OrientedEdge[]>;
      const target = dgPowerN(e);
      byLimit.set(target, [...(byLimit.get(target) ?? []), e]);
    }
  return [...gates].flatMap(([at, byLimit]) => [...byLimit.values()].map((edges) => ({ at, edges })));
}
