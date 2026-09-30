/**
 * The linear order of the edges of a gate.
 *
 * Every gate has a linear order of its edges: across the band of the fibred surface that f maps the neighbourhood of
 * the junction into, from right to left (looking along the gate's direction). At a junction with several gates it is
 * the cyclic order of the star, cut open where another gate lies. At a junction with a single gate (gatewise extremal)
 * the star gives only a cyclic order, and where to cut it open is decided by g.
 *
 * It is found from the order of the strands of f[F] ⊆ F (the striped view, `strandOrder(g)`): for two edges x, y of
 * the gate, if g(x) and g(y) start with the same strip d, their first strands run side by side in d, and their order
 * across d is the order of x and y. Otherwise g(x) and g(y) leave the image junction by different strips x′, y′ of one
 * gate there, and the order of x′ and y′ decides (recursively; the Dg-iterates of edges of one gate eventually agree).
 * Unlike following where the images of g^k diverge, this also decides when g(x) = g(y). Since f preserves the
 * orientation, the order found is a rotation of the cyclic order of the star, which is checked.
 *
 * @module
 */
import type { CombinatorialMap } from "../graph/combinatorial-map";
import type { OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";
import { type StrandOrder, strandKey, strandOrder } from "../embedding/strand-order";
import { findGates } from "./gates";

/** How the edges x, y (at one junction) are ordered across the band: negative if x is on the right of y. */
type Compare = (x: OrientedEdge, y: OrientedEdge) => number | undefined;

/**
 * The comparison of edges at a junction by the strands of their images (undefined where it can't be decided). At a
 * junction with several gates, two edges of one gate are compared by the known order (the star cut open after the
 * previous gate).
 */
export function bandComparison(graph: RibbonGraph, g: CombinatorialMap, order: StrandOrder): Compare {
  const depth = 2 * graph.edgeCount + 2;
  const known = knownGateRanks(graph, g);
  /** The position of the first strand of g(x) across its strip, increasing from right to left looking along it. */
  const across = (x: OrientedEdge): number | undefined => {
    const image = g.image(x.edge.forward).letters;
    if (image.length === 0) return undefined;
    const first = (x.isForward ? image[0] : image.at(-1)?.reversed) as OrientedEdge;
    const position = order.position.get(
      strandKey({ edge: x.edge, index: x.isForward ? 0 : image.length - 1 }),
    );
    if (position === undefined) return undefined;
    // Positions run from right to left along the forward orientation of the strip.
    return first.isForward ? position : -position;
  };
  const compare = (x: OrientedEdge, y: OrientedEdge, k: number): number | undefined => {
    if (x === y) return 0;
    const [rx, ry] = [known.get(x), known.get(y)];
    if (rx !== undefined && ry !== undefined && rx.gate === ry.gate) return rx.rank - ry.rank;
    const [a, b] = [g.image(x).first, g.image(y).first];
    if (a === undefined || b === undefined) return undefined;
    if (a === b) {
      const [p, q] = [across(x), across(y)];
      return p === undefined || q === undefined ? undefined : p - q;
    }
    if (a.source !== b.source || k >= depth) return undefined;
    return compare(a, b, k + 1);
  };
  return (x, y) => compare(x, y, 0);
}

/**
 * For the edges of the gates at junctions with several gates: their gate and rank in its linear order (the star from
 * the first edge after another gate, counterclockwise).
 */
function knownGateRanks(
  graph: RibbonGraph,
  g: CombinatorialMap,
): Map<OrientedEdge, { gate: number; rank: number }> {
  const result = new Map<OrientedEdge, { gate: number; rank: number }>();
  const gates = findGates(graph, g);
  const count = new Map<Vertex, number>();
  for (const gate of gates) count.set(gate.at, (count.get(gate.at) ?? 0) + 1);
  gates.forEach((gate, index) => {
    if ((count.get(gate.at) ?? 0) < 2) return;
    const star = graph.star(gate.at);
    const inGate = new Set(gate.edges);
    const start = star.findIndex(
      (x, i) => inGate.has(x) && !inGate.has(star[(i - 1 + star.length) % star.length] as OrientedEdge),
    );
    [...star.slice(start), ...star.slice(0, start)]
      .filter((x) => inGate.has(x))
      .forEach((x, rank) => result.set(x, { gate: index, rank }));
  });
  return result;
}

/**
 * The linear order of the edges at each junction with a single gate (from right to left across the band, i.e.
 * counterclockwise), where it could be decided: a rotation of the star. Empty if g is not the carrying map of an
 * embedding (the strands of f[F] ⊆ F have no order, e.g. with backtracking).
 */
export function singleGateOrders(graph: RibbonGraph, g: CombinatorialMap): Map<Vertex, OrientedEdge[]> {
  const result = new Map<Vertex, OrientedEdge[]>();
  let order: StrandOrder;
  try {
    order = strandOrder(g);
  } catch {
    return result;
  }
  const compare = bandComparison(graph, g, order);
  const gateCount = new Map<Vertex, number>();
  for (const gate of findGates(graph, g)) gateCount.set(gate.at, (gateCount.get(gate.at) ?? 0) + 1);
  for (const v of graph.vertices) {
    const star = graph.star(v);
    if (gateCount.get(v) !== 1 || star.length < 2) continue;
    // Edges with a trivial image (pretrivial ones, only during the algorithm) have no strand to compare: the order is
    // decided among the others, and they keep their places in the cyclic order.
    const linear = linearOrder(star, compare, (x) => g.image(x).length > 0);
    if (linear !== undefined) result.set(v, linear);
  }
  return result;
}

/**
 * The star as a linear order: the edges that `decides` are sorted by `compare`, which must decide every pair of them
 * consistently and give a rotation of their cyclic order (as it must for an orientation-preserving f); the star is cut
 * open before the first of them.
 */
export function linearOrder(
  star: readonly OrientedEdge[],
  compare: Compare,
  decides: (x: OrientedEdge) => boolean = () => true,
): OrientedEdge[] | undefined {
  const decided = star.filter(decides);
  if (decided.length < 2) return undefined;
  let undecided = false;
  const sorted = [...decided].sort((x, y) => {
    const c = compare(x, y);
    if (c === undefined || c === 0) undecided = true;
    return c ?? 0;
  });
  if (undecided) return undefined;
  const start = star.indexOf(sorted[0] as OrientedEdge);
  const rotated = [...star.slice(start), ...star.slice(0, start)];
  return rotated.filter(decides).every((x, i) => x === sorted[i]) ? rotated : undefined;
}
