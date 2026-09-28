/**
 * Inefficiencies and their removal (the C# `Inefficiency`, `FibredSurfaceEssentialInefficiencies` and
 * `FibredSurfacePeripheralInefficiencies`).
 *
 * @module
 */
import type { OrientedEdge } from "../../graph/ribbon-graph";
import { sharedPrefix, sharedPrefixLength } from "../../util/iter";
import { EdgePoint } from "../edge-point";
import type { FibredSurface } from "../fibred-surface";
import { findGates } from "../gates";
import { type FoldOption, foldInitialSegments, foldOptions, type PointTransform } from "./fold";
import { pullTight, pullTightExtremalJunction } from "./pull-tight";
import { subdivide } from "./subdivide";

/**
 * An inefficiency: a point inside an image g(e) where g turns illegally, i.e. the strips a = Dg-before and
 * b = Dg-after of the turn are eventually identified by Dg: Dgᵏ(a) = Dgᵏ(b), with k minimal (the order).
 * Order 0 is a backtrack.
 */
export interface Inefficiency {
  readonly point: EdgePoint;
  readonly order: number;
  /**
   * The strips to fold to lower the order: those at the junction of Dgᵏ⁻¹(a) and Dgᵏ⁻¹(b) whose images start with
   * the common prefix of g(Dgᵏ⁻¹(a)) and g(Dgᵏ⁻¹(b)). Empty for a backtrack.
   */
  readonly edgesToFold: readonly OrientedEdge[];
  /** The length of that common prefix. */
  readonly initialSegment: number;
}

/**
 * The inefficiency at an edge point inside an image, or `undefined` if g turns legally there (the C#
 * `Inefficiency(EdgePoint)` constructor, with `AlwaysFoldAllEdgesWithShortSharedInitialSegment = false`).
 */
export function inefficiencyAt(fs: FibredSurface, point: EdgePoint): Inefficiency | undefined {
  let a = point.dgBefore(fs);
  let b = point.dgAfter(fs);
  if (a === undefined || b === undefined) return undefined;
  if (a === b) return { point, order: 0, edgesToFold: [], initialSegment: 0 };
  for (let k = 1; k <= 2 * fs.graph.edgeCount; k++) {
    const [aOld, bOld] = [a, b];
    a = fs.g.derivative(a);
    b = fs.g.derivative(b);
    if (a === undefined || b === undefined) return undefined;
    if (a !== b) continue;
    const initialSegment = sharedPrefixLength(fs.g.image(aOld), fs.g.image(bOld));
    const prefix = fs.g.image(aOld).slice(0, initialSegment);
    const edgesToFold = fs.graph
      .star(aOld.source)
      .filter((e) => fs.g.image(e).slice(0, initialSegment).equals(prefix));
    return { point, order: k, edgesToFold, initialSegment };
  }
  return undefined;
}

/**
 * The inefficiencies inside the images: one for each illegal turn (a pair of strips in the same gate), found at
 * its first occurrence. Sorted by order, and full folds before partial ones, as in the C# suggestion.
 */
export function inefficiencies(fs: FibredSurface): Inefficiency[] {
  const gateOf = new Map<OrientedEdge, number>();
  findGates(fs.graph, fs.g).forEach((gate, index) => gate.edges.forEach((e) => gateOf.set(e, index)));
  const seenTurns = new Set<string>();
  const result: Inefficiency[] = [];
  for (const strip of fs.graph.edges) {
    const letters = fs.g.image(strip.forward).letters;
    for (let i = 1; i < letters.length; i++) {
      const [x, y] = [letters[i - 1] as OrientedEdge, letters[i] as OrientedEdge];
      if (gateOf.get(x.reversed) !== gateOf.get(y)) continue;
      // The turn x y is the same as ȳ x̄ read backwards.
      const key = [x.reversed, y]
        .map((e) => `${e.edge.id}${e.isForward ? "+" : "-"}`)
        .sort()
        .join("|");
      if (seenTurns.has(key)) continue;
      seenTurns.add(key);
      const inefficiency = inefficiencyAt(fs, new EdgePoint(strip.forward, i));
      if (inefficiency !== undefined) result.push(inefficiency);
    }
  }
  const isFullFold = (p: Inefficiency) =>
    p.edgesToFold.some((e) => fs.g.image(e).length === p.initialSegment);
  const rank = (p: Inefficiency) => p.order + (isFullFold(p) ? 0 : 0.5);
  return result.sort((p, q) => rank(p) - rank(q));
}

/** Picks one of the fold options; by default the one with the fewest side crossings afterwards. */
export type FoldChoice = (options: FoldOption[]) => FoldOption;
const bestOption: FoldChoice = (options) => options[0] as FoldOption;

/**
 * One step of removing an inefficiency of order k ≥ 1: folds the initial segments of `edgesToFold`, after which
 * the followed point is an inefficiency of order k − 1, which is returned. A backtrack (order 0), or an extremal
 * junction of valence 2, is pulled tight instead, and `undefined` is returned (the C# `RemoveInefficiencyInSteps`).
 */
export function removeInefficiencyStep(
  fs: FibredSurface,
  p: Inefficiency,
  choose: FoldChoice = bestOption,
): Inefficiency | undefined {
  const source = p.edgesToFold[0]?.source;
  if (p.order === 0 || source === undefined) {
    pullTight(fs, new Set([p.point.dgAfter(fs) as OrientedEdge]));
    return undefined;
  }
  if (p.edgesToFold.length === fs.graph.valence(source)) {
    pullTightExtremalJunction(fs, source); // all images at the junction start alike: pull tight instead of folding
    return undefined;
  }

  let point = p.point.normalized(fs);
  let edgesToFold = [...p.edgesToFold];
  // The subdivision points must differ from the inefficiency point itself.
  let i = p.initialSegment;
  while (i > 0 && edgesToFold.some((e) => new EdgePoint(e, i).equals(point, fs))) i--;
  if (i === 0) {
    // Split c = Dg(edgesToFold) (or, if g(c) is a single strip, its first iterate with a longer image) after one
    // letter, so that the images to fold start with a shorter strip.
    ({ point, edgesToFold } = splitFirstStrip(fs, edgesToFold, point));
    i = 1;
  }

  const options = foldOptions(fs, edgesToFold, i);
  if (options.length === 0) throw new Error(`No supported way to fold ${edgesToFold.join(", ")}`);
  const { c, preferred, move } = choose(options);
  const { transform } = foldInitialSegments(fs, edgesToFold, i, {
    c,
    kept: preferred,
    ...(move && { move }),
  });

  const next = inefficiencyAt(fs, transform(point));
  if (next === undefined || next.order !== p.order - 1)
    fs.reportInconsistency(
      `Folding did not lower the order of the inefficiency at ${p.point.describe(fs)} from ${p.order} to ${p.order - 1}`,
    );
  return next;
}

/** Removes an inefficiency completely, step by step (the C# "remove at once"). */
export function removeInefficiency(
  fs: FibredSurface,
  p: Inefficiency,
  choose: FoldChoice = bestOption,
): void {
  for (let q: Inefficiency | undefined = p, steps = 0; q !== undefined && steps <= p.order; steps++)
    q = removeInefficiencyStep(fs, q, choose);
}

/**
 * The special case of the C# code: the strips to fold agree only in their first letter c, and folding it would put
 * the new junction onto the inefficiency point. Subdivides c after its first letter (and, if g(c) has one letter,
 * first the iterates Dg(c), Dg²(c), … whose image is longer), following the point and the strips to fold.
 */
function splitFirstStrip(
  fs: FibredSurface,
  edgesToFold: OrientedEdge[],
  point: EdgePoint,
): { point: EdgePoint; edgesToFold: OrientedEdge[] } {
  const chain = [fs.g.derivative(edgesToFold[0] as OrientedEdge) as OrientedEdge];
  while (fs.g.image(chain[0] as OrientedEdge).length === 1 && chain.length <= 2 * fs.graph.edgeCount)
    chain.unshift(fs.g.derivative(chain[0] as OrientedEdge) as OrientedEdge);
  if (fs.g.image(chain[0] as OrientedEdge).length === 1)
    throw new Error(
      "All iterates of the strip have images of length 1: g permutes the strips and is efficient",
    );

  const transforms: PointTransform[] = [];
  let [toSplit, strips] = [chain, [...edgesToFold]];
  for (let j = 0; j < toSplit.length; j++) {
    const e = toSplit[j] as OrientedEdge;
    const length = fs.g.image(e).length; // the images of the later strips got longer through the earlier splits
    const { first, second, transform } = subdivide(fs, e.edge, e.isForward ? 1 : length - 1);
    transforms.push(transform);
    // A strip end at the source of the subdivided strip now belongs to the first part, one at its target to
    // the second part.
    const follow = (s: OrientedEdge) =>
      s.edge !== first ? s : s.isForward ? first.forward : second.backward;
    [toSplit, strips] = [toSplit.map(follow), strips.map(follow)];
  }
  return { point: transforms.reduce((p, t) => t(p), point), edgesToFold: strips };
}

/**
 * Peripheral inefficiencies: groups of strips at a junction with the same Dg, where that strip lies in the
 * pre-periphery (the C# `GetPeripheralInefficiencies`). Each group can be folded along its common prefix.
 */
export function peripheralInefficiencies(fs: FibredSurface): OrientedEdge[][] {
  const prePeriphery = fs.prePeriphery();
  const groups: OrientedEdge[][] = [];
  for (const v of fs.graph.vertices) {
    const byDerivative = Map.groupBy(fs.graph.star(v), (e) => fs.g.derivative(e));
    for (const [d, edges] of byDerivative)
      if (d !== undefined && prePeriphery.has(d.edge) && edges.length > 1) groups.push(edges);
  }
  return groups;
}

/** Folds a peripheral inefficiency along the common prefix of the images. */
export function removePeripheralInefficiency(
  fs: FibredSurface,
  edges: readonly OrientedEdge[],
  choose: FoldChoice = bestOption,
): void {
  const i = sharedPrefix(edges.map((e) => fs.g.image(e).letters)).length;
  const options = foldOptions(fs, edges, i);
  if (options.length === 0) throw new Error(`No supported way to fold ${edges.join(", ")}`);
  const { c, preferred, move } = choose(options);
  foldInitialSegments(fs, edges, i, { c, kept: preferred, ...(move && { move }) });
}

/**
 * A fold that the algorithm can do next: folding the initial segments (of length `initialSegment`) of the strip ends
 * `edgesToFold` at one junction, which all have the same Dg.
 *
 * It is suggested because inefficiencies lead to it (the thesis: removing an inefficiency (α, β) of order k starts by
 * folding Dgᵏ⁻¹(α) and Dgᵏ⁻¹(β)), or because Dg of these strips lies in the pre-periphery (a peripheral inefficiency).
 */
export interface FoldCandidate {
  readonly edgesToFold: readonly OrientedEdge[];
  readonly initialSegment: number;
  /** The smallest order of the inefficiencies whose removal starts with this fold (undefined if there is none). */
  readonly order: number | undefined;
  /** How many places in the images have an inefficiency of that order leading to this fold. */
  readonly count: number;
  /** One of them, for carrying out the first step. */
  readonly representative: Inefficiency | undefined;
  /** Whether Dg of the strips lies in the pre-periphery. */
  readonly peripheral: boolean;
}

/**
 * The folds the algorithm can do next (your proposal: show the pairs of strips that are folded, with the order and
 * number of the inefficiencies behind them, instead of the inefficiencies). Every occurrence of an illegal turn in
 * an image counts. Peripheral folds come first (as in the C# priority order), then by order and number.
 */
export function foldCandidates(fs: FibredSurface): FoldCandidate[] {
  const gateOf = new Map<OrientedEdge, number>();
  findGates(fs.graph, fs.g).forEach((gate, index) => gate.edges.forEach((e) => gateOf.set(e, index)));
  const keyOf = (edges: readonly OrientedEdge[], initialSegment: number) =>
    `${edges
      .map((e) => `${e.edge.id}${e.isForward ? "+" : "-"}`)
      .sort()
      .join(",")}@${initialSegment}`;
  const groups = new Map<
    string,
    { edges: readonly OrientedEdge[]; initialSegment: number; found: Inefficiency[] }
  >();
  for (const strip of fs.graph.edges) {
    const letters = fs.g.image(strip.forward).letters;
    for (let i = 1; i < letters.length; i++) {
      const [x, y] = [letters[i - 1] as OrientedEdge, letters[i] as OrientedEdge];
      if (gateOf.get(x.reversed) !== gateOf.get(y)) continue;
      const p = inefficiencyAt(fs, new EdgePoint(strip.forward, i));
      if (p === undefined || p.order === 0) continue; // backtracks are pulled tight
      const key = keyOf(p.edgesToFold, p.initialSegment);
      const group = groups.get(key) ?? { edges: p.edgesToFold, initialSegment: p.initialSegment, found: [] };
      group.found.push(p);
      groups.set(key, group);
    }
  }
  const prePeriphery = fs.prePeriphery();
  const isPeripheral = (edges: readonly OrientedEdge[]) => {
    const d = fs.g.derivative(edges[0] as OrientedEdge);
    return d !== undefined && prePeriphery.has(d.edge);
  };
  const candidates: FoldCandidate[] = [...groups.values()].map(({ edges, initialSegment, found }) => {
    const order = Math.min(...found.map((p) => p.order));
    const lowest = found.filter((p) => p.order === order);
    return {
      edgesToFold: edges,
      initialSegment,
      order,
      count: lowest.length,
      representative: lowest[0],
      peripheral: isPeripheral(edges),
    };
  });
  for (const group of peripheralInefficiencies(fs)) {
    const initialSegment = sharedPrefix(group.map((e) => fs.g.image(e).letters)).length;
    if (groups.has(keyOf(group, initialSegment))) continue;
    candidates.push({
      edgesToFold: group,
      initialSegment,
      order: undefined,
      count: 0,
      representative: undefined,
      peripheral: true,
    });
  }
  const rank = (c: FoldCandidate) => [c.peripheral ? 0 : 1, c.order ?? 0, -c.count] as const;
  return candidates.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });
}
