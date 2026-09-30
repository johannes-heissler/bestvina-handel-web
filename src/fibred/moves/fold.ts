/**
 * Folding strips and initial segments of strips (the C# `FibredSurfaceFoldingInitialSegments` and
 * `MovementForFolding`). See the thesis, § "Folding and isotopy".
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { Color } from "../../math/color";
import { EDGE_COLORS, leastUsedColor } from "../names-and-colors";
import { EdgePoint } from "../edge-point";
import type { FibredSurface } from "../fibred-surface";
import { isCyclicInterval } from "../fibred-surface";
import { singleGateOrders } from "../gate-order";
import { isotopeJunction, moveJunction } from "./isotopy";
import { narrate, quietly, stateNow } from "../narration";
import type { TextPart } from "../suggestions";
import { subdivide } from "./subdivide";

/** Maps forward-normalized edge points from before a move to after it (see {@link subdivide}). */
export type PointTransform = (point: EdgePoint) => EdgePoint;

/**
 * Folds the strip b into its neighbour a in the cyclic order at their common source: afterwards only a is left,
 * and the targets of a and b are one junction. Requires g(a) = g(b) and μ(a) = μ(b) (use an isotopy first,
 * see {@link foldInitialSegments}), and t(a) ≠ t(b) (folding two strips with the same ends would change χ).
 *
 * - The strip ends at t(b) move to t(a) as one block next to ā: before ā if b = σ(a), after ā if a = σ(b). This is
 *   the cyclic order around the folded pair (the C# `StarAtFoldedVertex`).
 * - g: every letter b becomes a, and junctions mapped to t(b) are mapped to t(a).
 * - μ: unchanged, since μ(a) = μ(b).
 */
export function foldPair(fs: FibredSurface, a: OrientedEdge, b: OrientedEdge): PointTransform {
  if (a.source !== b.source || a.edge === b.edge) throw new Error(`${a} and ${b} can't be folded`);
  const bAfterA = fs.graph.next(a) === b;
  if (!bAfterA && fs.graph.next(b) !== a) throw new Error(`${a} and ${b} are not adjacent at ${a.source}`);
  if (!fs.g.image(a).equals(fs.g.image(b))) throw new Error(`g(${a}) ≠ g(${b})`);
  if (!fs.mu.image(a).equals(fs.mu.image(b))) throw new Error(`μ(${a}) ≠ μ(${b}); isotope first`);
  const [T, U] = [a.target, b.target];
  if (T === U)
    throw new Error(`${a} and ${b} have the same ends; folding them would change the Euler characteristic`);

  // Move the ends at U (except those of b) to T, in the order that starts right after b̄.
  const block = fs.graph.starFrom(b.reversed).filter((x) => x.edge !== b.edge);
  let previous = a.reversed;
  for (const x of block) {
    fs.graph.reattach(x, T, bAfterA ? { before: a.reversed } : { after: previous });
    previous = x;
  }

  const aAsImageOfB = EdgePath.of(b.isForward ? a : a.reversed);
  fs.g.substituteInImages((x) => (x === b.edge ? aAsImageOfB : undefined));
  for (const v of fs.graph.vertices) if (fs.g.vertexImage(v) === U) fs.g.setVertexImage(v, T);
  fs.removeStrip(b.edge);
  fs.removeJunction(U);

  const length = fs.g.image(a).length;
  return (point) => {
    if (point.edge.edge !== b.edge) return point;
    const indexAlongB = b.isForward ? point.index : length - point.index;
    return new EdgePoint(a, indexAlongB).normalized(fs);
  };
}

/** The strips of `edges` in their cyclic order at the common source, which must be a contiguous block. */
export function inCyclicOrder(fs: FibredSurface, edges: readonly OrientedEdge[]): OrientedEdge[] {
  const source = edges[0]?.source;
  if (source === undefined || edges.some((e) => e.source !== source))
    throw new Error("The strips to fold must start at the same junction");
  const star = fs.graph.star(source);
  const set = new Set(edges);
  if (!isCyclicInterval(star, set))
    throw new Error(`The strips ${edges.join(", ")} are not adjacent at ${source}`);
  // At a junction with a single gate, they must also be adjacent in its linear order (not around the place where g cuts
  // the cyclic order open). Since g comes from an embedding, the strips whose images start alike always are.
  if (star.length >= 3 && set.size < star.length) {
    const linear = singleGateOrders(fs.graph, fs.g).get(source);
    if (linear !== undefined && !isCyclicInterval([...linear, undefined], set))
      fs.reportInconsistency(
        `The strips ${edges.join(", ")} are adjacent at ${source}, but not in the linear order ${linear.join(" ")} of its single gate`,
      );
  }
  const first = star.find((e) => set.has(e) && !set.has(fs.graph.previous(e)));
  return first === undefined ? [...star] : fs.graph.starFrom(first).filter((e) => set.has(e));
}

/**
 * Folds strips with equal g- and μ-images into `kept`, which stays. The strips must be adjacent at their source;
 * they are folded into `kept` one neighbour at a time.
 */
export function foldEdges(
  fs: FibredSurface,
  edges: readonly OrientedEdge[],
  kept: OrientedEdge,
): PointTransform {
  const ordered = inCyclicOrder(fs, edges);
  const k = ordered.indexOf(kept);
  if (k === -1) throw new Error(`${kept} is not among the strips to fold`);
  const transforms: PointTransform[] = [];
  for (let i = k - 1; i >= 0; i--) transforms.push(foldPair(fs, kept, ordered[i] as OrientedEdge));
  for (let i = k + 1; i < ordered.length; i++)
    transforms.push(foldPair(fs, kept, ordered[i] as OrientedEdge));
  return (point) => transforms.reduce((p, t) => t(p), point);
}

/** The result of {@link foldInitialSegments}. */
export interface FoldResult {
  /** The strip that the folded initial segments became. */
  readonly folded: OrientedEdge;
  readonly transform: PointTransform;
}

/**
 * Folds the initial segments of length `i` (in g) of the strips `edges`, which start at the same junction v, are
 * adjacent there, and whose images agree in the first `i` letters.
 *
 * 1. Strips with longer images are subdivided after i letters. The new junction is placed after the side crossings
 *    that μ(e) shares with c at its start: μ(e) = c₁ | μ(e₂) where c = c₁ c₂ with c₁ as long as possible.
 * 2. **Isotopy:** the folded segment will have μ = c, a path in G₀ from μ(v). For a subdivided strip, the new
 *    junction is moved along the rest c₂ (not at all if μ(e) starts with c), so μ(e₁) = c and μ(e₂) = c̄ μ(e)
 *    (reduced). For a strip that is folded completely,
 *    its target is moved along μ(e)⁻¹ c, which also changes the other strips at that junction. (These are the
 *    partial-partial, partial-full and full-full cases of the thesis.)
 * 3. The segments, now with equal g- and μ-images, are folded into the segment of `kept`.
 *
 * A loop at v that is folded completely can't have its target moved alone (that also moves its source). Instead, v
 * itself can first be moved along a path γ (`move`), which conjugates the loop's μ to γ̄ μ(e) γ and puts γ̄ in front
 * of the other strips at v; c must then equal the loop's new μ-image.
 *
 * @param c The μ-image of the folded segment; see {@link foldOptions} for good choices. Defaults to the longest
 *   common prefix of the μ-images, which needs no isotopy of junctions for partial folds.
 * @param move A path in G₀ from μ(v) along which v is moved first (only needed for loops folded completely).
 * @throws Error if a strip that is folded completely is a loop whose μ-image (after the move) is not c.
 */
export function foldInitialSegments(
  fs: FibredSurface,
  edges: readonly OrientedEdge[],
  i: number,
  options: { c?: EdgePath; kept?: OrientedEdge; move?: EdgePath } = {},
): FoldResult {
  const v = edges[0]?.source;
  if (v === undefined || i < 1) throw new Error("Nothing to fold");
  const prefix = fs.g.image(edges[0] as OrientedEdge).slice(0, i);
  for (const e of edges)
    if (fs.g.image(e).length < i || !fs.g.image(e).slice(0, i).equals(prefix))
      throw new Error(`g(${e}) doesn't start with ${prefix}`);
  inCyclicOrder(fs, edges); // checks adjacency before anything changes
  if (options.move !== undefined) {
    moveJunction(fs, v, options.move, [
      "Isotopy: move the junction ",
      { junction: v.name },
      " along γ = ",
      pathText(options.move),
      " in G₀ first (a loop is folded completely, so its μ-image has to become the μ-image of the folded segment).",
    ]);
  }
  const c = options.c ?? commonPrefix(edges.map((e) => fs.mu.image(e)));
  if (c.source !== undefined && c.source !== fs.mu.vertexImage(v))
    throw new Error(`${c} doesn't start at μ(${v})`);
  for (const e of edges)
    if (fs.g.image(e).length === i && e.target === v && !fs.mu.image(e).equals(c))
      throw new Error(
        `Folding the loop ${e.edge} completely needs μ(${e}) = ${c}; move ${v} first so that it is`,
      );

  const transforms: PointTransform[] = [];
  const full = edges.filter((e) => fs.g.image(e).length === i);
  // For each strip end at v, the strip end at v that it currently corresponds to (subdividing replaces the
  // end at the target of a strip by the second part).
  const segments = new Map<OrientedEdge, OrientedEdge>(edges.map((e) => [e, e]));
  // The split points, followed through the subdivisions (each one lengthens the images of the others).
  const splitPoints = new Map(
    edges.filter((e) => !full.includes(e)).map((e) => [e, new EdgePoint(e, i).normalized(fs)]),
  );
  // The names and colours of the strips folded partially: their remaining second segments get them back.
  const original = new Map(
    [...splitPoints.keys()].map((e) => [e, { name: e.edge.name, color: e.edge.color }]),
  );
  const remainders = new Map<OrientedEdge, Edge>();
  for (const [e, point] of splitPoints) {
    const atV = segments.get(e) as OrientedEdge;
    // The point as it is now: earlier subdivisions of this fold made the images longer, so it is no longer after the
    // first i letters of the original image (the point is followed through them).
    // (Shown from the end at the junction where the fold happens.)
    const end = atV.edge === point.edge.edge ? atV : point.edge;
    const letters = fs.g.image(end).letters;
    const k = end === point.edge ? point.index : letters.length - point.index;
    narrate([
      "Subdivide ",
      { strip: point.edge.edge.name },
      k === 1 ? " after the first letter" : ` after the first ${k} letters`,
      " of its image: g(",
      { strip: end.name },
      ") = ",
      ...letterText(letters.slice(0, k)),
      " | ",
      ...letterText(letters.slice(k)),
      ". The new junction (of valence 2) sits at the subdivision point",
      ...(fs.legacyNames
        ? ["."]
        : [
            "; the rest keeps the name ",
            { strip: e.edge.name },
            ", the initial segment is called ",
            { strip: freeName(fs, `${e.edge.name}₁`) }, // (as it is named below)
            " until it is folded.",
          ]),
    ]);
    if (atV.edge !== point.edge.edge)
      throw new Error(`The initial segments of both ends of ${e.edge} overlap; they can't be folded`);
    // Subdivide as late along μ as the folded segment allows: the part at v gets the longest prefix of μ(e) that is
    // also a prefix of c (the thesis, § "Subdivision and valence-two vertices": the split of μ is free). Then the new
    // junction only has to move along the rest of c, often not at all.
    const muAtV = fs.mu.image(atV);
    let shared = 0;
    while (shared < c.length && shared < muAtV.length && muAtV.at(shared) === c.at(shared)) shared++;
    const { first, second, junction, transform } = subdivide(
      fs,
      point.edge.edge,
      point.index,
      atV.isForward ? shared : muAtV.length - shared,
    );
    transforms.push(transform);
    for (const [key, value] of segments)
      if (value.edge === first) segments.set(key, value.isForward ? first.forward : second.backward);
    const remainder = (segments.get(e) as OrientedEdge).edge === first ? second : first;
    remainders.set(e, remainder);
    // Names right away: the rest keeps the name and colour of the strip, the initial segment (folded next) gets
    // the name with "₁".
    if (!fs.legacyNames) {
      const { name: originalName, color: originalColor } = original.get(e) as { name: string; color: Color };
      const initial = remainder === first ? second : first;
      remainder.name = originalName;
      remainder.color = originalColor;
      initial.name = freeName(fs, `${originalName}₁`);
      initial.color = originalColor;
    }
    for (const [key, p] of splitPoints) splitPoints.set(key, transform(p));
    // It moves alongside the strip it is folded with: the kept one, or another one whose μ starts with c.
    const partner = [options.kept, ...edges].find(
      (x) =>
        x !== undefined &&
        x !== e &&
        fs.mu
          .image(segments.get(x) as OrientedEdge)
          .slice(0, c.length)
          .equals(c),
    );
    const rest = c.slice(shared);
    moveJunction(
      fs,
      junction,
      rest,
      [
        "Isotopy: move the new junction along ",
        ...(shared === 0 ? ["c = "] : ["the rest ", pathText(rest), " of c = "]),
        pathText(c),
        " in G₀, so that the initial segment crosses the sides like the folded segment will (μ = c).",
      ],
      partner === undefined ? undefined : (segments.get(partner) as OrientedEdge),
    );
  }
  for (const e of full) {
    const gamma = fs.mu.image(e).inverse.concat(c).reduced(); // move t(e) so that μ(e) becomes c
    moveJunction(fs, e.target, gamma, [
      "Isotopy: move the junction ",
      { junction: e.target.name },
      " at the end of ",
      { strip: e.name },
      " along γ = μ(",
      { strip: e.name },
      ")⁻¹ c = ",
      pathText(gamma),
      " in G₀, so that μ(",
      { strip: e.name },
      ") = c = ",
      pathText(c),
      " (this changes μ of the other strips there as well).",
    ]);
  }

  // A strip that is folded completely is the folded segment itself, and keeps its name and colour.
  const kept = segments.get(full[0] ?? options.kept ?? (edges[0] as OrientedEdge)) as OrientedEdge;
  const beforeFold = stateNow(); // (the fold is narrated afterwards, with the names it gives)
  const foldedNames = [...segments.values()].map((x) => x.name); // the initial segments, as they are called now
  transforms.push(foldEdges(fs, [...segments.values()], kept));
  // Names (as in C#): the remaining second segments are called like the strips they come from, with their colours;
  // a folded segment made only of first segments gets a new letter and the least used colour.
  for (const [e, remainder] of remainders) {
    const { name, color } = original.get(e) as { name: string; color: Color };
    remainder.name = name;
    remainder.color = color;
  }
  if (full.length === 0) {
    kept.edge.name = fs.nextEdgeName();
    kept.edge.color = leastUsedColor(
      EDGE_COLORS,
      fs.graph.edges.filter((x) => x !== kept.edge).map((x) => x.color),
    );
  }
  narrate(
    [
      "Fold the initial segments of ",
      ...nameList(foldedNames),
      " at ",
      { junction: v.name },
      " (image under g: ",
      ...letterText(fs.g.image(kept).letters),
      "; μ = ",
      pathText(c),
      ") into one strip ",
      { strip: kept.edge.name },
      full.length === 0 ? " (a new name and colour)." : ` (the strip folded completely keeps its name).`,
    ],
    { before: beforeFold },
  );
  return { folded: kept, transform: (point) => transforms.reduce((p, t) => t(p), point) };
}

/** `name`, or with more "₁" appended if it is taken. */
function freeName(fs: FibredSurface, name: string): string {
  const used = new Set(fs.graph.edges.map((e) => e.name.toLowerCase()));
  let candidate = name;
  while (used.has(candidate.toLowerCase())) candidate += "₁";
  return candidate;
}

/** Names of strips as structured text: "a, b and c". */
function nameList(names: readonly string[]): TextPart[] {
  return names.flatMap((name, i) => [
    ...(i === 0 ? [] : i === names.length - 1 ? [" and "] : [", "]),
    { strip: name },
  ]);
}

/** The letters of a path in G as structured text (the names of the strips). */
function letterText(letters: readonly OrientedEdge[]): TextPart[] {
  return letters.length === 0
    ? ["·"]
    : letters.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }]));
}

/** A path in G₀ as text (its letters are sides of the model, not strips). */
function pathText(path: EdgePath): string {
  return path.isEmpty ? "(empty)" : String(path);
}

/** A way to fold initial segments, and how many side crossings (the length of μ) there are afterwards. */
export interface FoldOption {
  /** The strip whose μ-image determines c (and that is kept). */
  readonly preferred: OrientedEdge;
  /** For a loop folded completely: the path along which its junction is moved first (see {@link foldInitialSegments}). */
  readonly move?: EdgePath;
  /** c = the first `l` letters of μ(preferred). */
  readonly l: number;
  readonly c: EdgePath;
  /** The total length of μ after the fold (the C# "badness"). */
  readonly sideCrossings: number;
  /**
   * The isotopies it takes (before folding): the target junction of a strip folded completely moves along γ, the new
   * junction on a strip folded partially along c; for a loop folded completely, first its junction along `move`.
   */
  readonly isotopies: readonly Isotopy[];
}

/** A junction moved along a path in G₀ before a fold. */
export interface Isotopy {
  /** The strip end whose target junction moves (folded completely), or on which the new junction lies (partially). */
  readonly end: OrientedEdge;
  readonly kind: "target" | "new junction" | "source";
  readonly along: EdgePath;
}

/** The isotopies of folding the initial segments (length i) of `edges` with the μ-image c. */
function isotopiesOf(fs: FibredSurface, edges: readonly OrientedEdge[], i: number, c: EdgePath): Isotopy[] {
  return edges.flatMap((e): Isotopy[] => {
    if (fs.g.image(e).length === i) {
      const along = fs.mu.image(e).inverse.concat(c).reduced();
      return along.isEmpty ? [] : [{ end: e, kind: "target", along }];
    }
    return c.isEmpty ? [] : [{ end: e, kind: "new junction", along: c }];
  });
}

/**
 * The possible choices of c for {@link foldInitialSegments}: the prefixes of the μ-images of the strips (the C#
 * `MovementForFolding` with preferred edge and l), sorted by the number of side crossings afterwards, then
 * preferring strips in the middle of the block. Each option is evaluated on a copy of the surface.
 *
 * If a loop is folded completely, c is its μ-image after moving the junction v along some γ; the candidates for γ are
 * the prefixes of the μ-images of the strips at v (port note 12, Q1: compute the move and rate it like the others).
 */
export function foldOptions(fs: FibredSurface, edges: readonly OrientedEdge[], i: number): FoldOption[] {
  const ordered = inCyclicOrder(fs, edges);
  const v = (edges[0] as OrientedEdge).source;
  const fullLoop = edges.find((e) => fs.g.image(e).length === i && e.target === v);
  if (fullLoop !== undefined) return loopFoldOptions(fs, edges, i, fullLoop);
  const seen = new Set<string>();
  const options: { option: FoldOption; centrality: number }[] = [];
  for (const [position, preferred] of ordered.entries()) {
    const mu = fs.mu.image(preferred);
    for (let l = mu.length; l >= 0; l--) {
      const c = mu.slice(0, l);
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      const { copy, correspondence } = fs.copyWithCorrespondence();
      try {
        quietly(() =>
          foldInitialSegments(copy, edges.map(correspondence.orient), i, {
            c, // c lives in G₀, which the copy shares
            kept: correspondence.orient(preferred),
          }),
        );
      } catch {
        continue; // e.g. an unsupported loop fold
      }
      options.push({
        option: {
          preferred,
          l,
          c,
          sideCrossings: copy.mu.totalLength(),
          isotopies: isotopiesOf(fs, edges, i, c),
        },
        centrality: Math.abs(position - (ordered.length - 1) / 2),
      });
    }
  }
  return options
    .sort((x, y) => x.option.sideCrossings - y.option.sideCrossings || x.centrality - y.centrality)
    .map((x) => x.option);
}

/** {@link foldOptions} when the loop `loop` is folded completely: one option per move γ of its junction. */
function loopFoldOptions(
  fs: FibredSurface,
  edges: readonly OrientedEdge[],
  i: number,
  loop: OrientedEdge,
): FoldOption[] {
  const v = loop.source;
  const seen = new Set<string>();
  const options: FoldOption[] = [];
  for (const x of fs.graph.star(v)) {
    const mu = fs.mu.image(x);
    for (let l = 0; l <= mu.length; l++) {
      const move = mu.slice(0, l);
      if (seen.has(move.key)) continue;
      seen.add(move.key);
      const { copy, correspondence } = fs.copyWithCorrespondence();
      isotopeJunction(copy, correspondence.vertexMap.get(v) as Vertex, move);
      const c = copy.mu.image(correspondence.orient(loop));
      try {
        quietly(() =>
          foldInitialSegments(copy, edges.map(correspondence.orient), i, {
            c,
            kept: correspondence.orient(loop),
          }),
        );
      } catch {
        continue; // e.g. two loops with different μ-images after the move
      }
      options.push({
        preferred: loop,
        move,
        l: c.length,
        c,
        sideCrossings: copy.mu.totalLength(),
        isotopies: move.isEmpty ? [] : [{ end: loop, kind: "source", along: move }],
      });
    }
  }
  return options.sort(
    (x, y) => x.sideCrossings - y.sideCrossings || (x.move?.length ?? 0) - (y.move?.length ?? 0),
  );
}

/** The longest common prefix of the paths. */
function commonPrefix(paths: readonly EdgePath[]): EdgePath {
  const [first, ...rest] = paths;
  if (first === undefined) return EdgePath.EMPTY;
  let length = first.length;
  for (const p of rest) {
    let k = 0;
    while (k < length && k < p.length && p.at(k) === first.at(k)) k++;
    length = k;
  }
  return first.slice(0, length);
}
