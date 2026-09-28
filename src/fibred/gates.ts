/**
 * Gates of a graph map (the C# `Gate.FindGates` and `EdgeCycle`).
 *
 * @module
 */
import type { CombinatorialMap } from "../graph/combinatorial-map";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";

/** A gate: a maximal set of oriented edges at one junction that Dg* eventually maps to the same edge. */
export interface Gate<K = Vertex> {
  /** The junction (or, with a custom grouping, the group of junctions) where the gate is. */
  readonly at: K;
  /** The edges of the gate, in the cyclic order of the star (for a vertex). */
  readonly edges: readonly OrientedEdge[];
}

/**
 * The pretrivial edges: those that some power of g maps to a trivial path. Found from below: first the edges with
 * trivial image, then the edges whose image consists only of edges found so far, until nothing changes.
 */
export function pretrivialEdges(graph: RibbonGraph, g: CombinatorialMap): Set<Edge> {
  const pretrivial = new Set<Edge>();
  for (let changed = true; changed;) {
    changed = false;
    for (const e of graph.edges)
      if (!pretrivial.has(e) && g.image(e.forward).letters.every((x) => pretrivial.has(x.edge))) {
        pretrivial.add(e);
        changed = true;
      }
  }
  return pretrivial;
}

/**
 * Dg*: e ↦ the first letter of g(e) that is not pretrivial, or `undefined` if e is pretrivial itself. Unlike Dg, it
 * never leads to a pretrivial edge, so edges whose Dg-orbit runs into a pretrivial edge still get their own gates.
 */
export function reducedDerivative(
  graph: RibbonGraph,
  g: CombinatorialMap,
): (e: OrientedEdge) => OrientedEdge | undefined {
  const pretrivial = pretrivialEdges(graph, g);
  return (e) => g.image(e).letters.find((x) => !pretrivial.has(x.edge));
}

/**
 * The gates of g : G → G. Two oriented edges e, e′ with the same source are in the same gate iff
 * Dg*ᵏ(e) = Dg*ᵏ(e′) for some k ≥ 0 (see `reducedDerivative`).
 *
 * Dg* says nothing about the pretrivial edges, so their gates are a convention, chosen so that gates stay consecutive
 * in the cyclic order: a run of pretrivial edges in the star whose neighbours on both sides are in the same gate joins
 * that gate (collapsing the pretrivial edges would bring the ends there together anyway); any other run of pretrivial
 * edges is a gate of its own. (The C# version put all pretrivial edges at a junction into one gate, which could split
 * other gates.)
 *
 * It suffices to compare Dg*ᴺ(e) and Dg*ᴺ(e′) for N = the number of oriented edges: Dg* maps the non-pretrivial
 * edges to themselves, so after N steps both are periodic, and Dg* is injective on periodic edges, so if they agree
 * at some k they already agree at N. This replaces the edge-cycle bookkeeping of the C# code.
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
  const dg = reducedDerivative(graph, g);
  const limit = new Map<OrientedEdge, OrientedEdge | undefined>();
  const dgPowerN = (e: OrientedEdge): OrientedEdge | undefined => {
    if (!limit.has(e)) {
      let f: OrientedEdge | undefined = e;
      for (let k = 0; k < n && f !== undefined; k++) f = dg(f);
      limit.set(e, f);
    }
    return limit.get(e);
  };

  const gates = new Map<K, Map<OrientedEdge | string, OrientedEdge[]>>();
  for (const v of graph.vertices) {
    const star = graph.star(v);
    const limits = star.map(dgPowerN);
    /** The limit of the nearest edge in the star that is not pretrivial, going in the direction `step` from i. */
    const nearest = (i: number, step: number): OrientedEdge | undefined => {
      for (let k = 1; k < star.length; k++) {
        const limit = limits[(((i + step * k) % star.length) + star.length) % star.length];
        if (limit !== undefined) return limit;
      }
      return undefined;
    };
    star.forEach((e, i) => {
      const key = groupOf(v);
      if (!gates.has(key)) gates.set(key, new Map());
      const byLimit = gates.get(key) as Map<OrientedEdge | string, OrientedEdge[]>;
      let target: OrientedEdge | string | undefined = limits[i];
      if (target === undefined) {
        const [before, after] = [nearest(i, -1), nearest(i, 1)];
        if (before !== undefined && before === after) target = before;
        else {
          // Its own gate: named after the first edge of its run of pretrivial edges.
          let first = i;
          while (
            limits[(first - 1 + star.length) % star.length] === undefined &&
            (first - 1 + star.length) % star.length !== i
          )
            first = (first - 1 + star.length) % star.length;
          target = `pretrivial ${v.id} ${first}`;
        }
      }
      byLimit.set(target, [...(byLimit.get(target) ?? []), e]);
    });
  }
  return [...gates].flatMap(([at, byLimit]) => [...byLimit.values()].map((edges) => ({ at, edges })));
}
