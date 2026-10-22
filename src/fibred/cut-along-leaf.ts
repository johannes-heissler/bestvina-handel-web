/**
 * Cutting along a singular leaf L and its preimages (the thesis, Move "Cutting along a singular leaf"), giving a new
 * graph G′ with a map g′ for the same f and the same growth λ.
 *
 * The cut is carried out on the rectangles of TS(τ), combinatorially (no lengths or heights decide anything):
 * 1. The leaves are train paths found from g_τ (`leaf-paths.ts`); the slits are L and its preimages on them.
 * 2. Real branches are subdivided where a preimage slit ends inside them, one after the other in τ*
 *    (`subdivided-track.ts`).
 * 3. Each sub-branch is split across into pieces by the passes of the slits through it, in their order across the
 *    branch (`leaf-order.ts`: every pass is a point on the leaf of a prong).
 * 4. Each singular arc (of a switch, or of a subdivision) is split into several switches where the same slit crosses
 *    both sides (where it passes through, and at the prong corner where it starts).
 * 5. g′ maps each piece along g_* of its sub-branch, into the piece of each branch next to the image of a pass bounding
 *    it. Since f⁻¹ of the cut set lies in the cut set, the image of each piece fits into whole pieces.
 *
 * Only the junctions in `blownUp` are cut as the polygons of TS(τ) (port note 29): those of the new punctures Q. Before,
 * all of TS(τ) was cut, and the other polygons were contracted again afterwards. Every other junction stays a junction
 * of G: the slits through it are chords of its disk, from one strip end to another,
 * and split it into parts, each a junction of the result (its infinitesimal polygon, a disk, lies in one of them and is
 * not represented). Its infinitesimal branches get no pieces, and they are left out of the images.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { firstUnusedName, letterIndex, VERTEX_NAMES } from "../graph/names";
import { type Edge, type OrientedEdge, RibbonGraph, type Vertex } from "../graph/ribbon-graph";
import { imageProng, type Prong } from "./singular-leaves";
import { leafThroughRealBranches, realCount, throughRealBranches } from "./leaf-paths";
import { type LeafPoint, leafPoints } from "./leaf-order";
import { type Letter, type SubBranch, SubdividedTrack } from "./subdivided-track";
import { type BranchKind, entriesInto, type TrainTrack } from "./train-track";

/** A slit as a path of τ: a leaf segment from a prong corner (enough to predict the length of a cut). */
export interface SlitPath {
  /** Its branches of τ: real and infinitesimal alternating, starting and ending with a real one. */
  readonly path: readonly OrientedEdge[];
  /** The prong it starts at (its leaf is the leaf of the prong). */
  readonly prong: Prong;
  /** Whether it ends inside its last branch of τ. */
  readonly partial: boolean;
}

/** A slit: a leaf segment from a prong corner, in τ and in τ* (where it ends at a point of τ*). */
export interface Slit extends SlitPath {
  /** Its branches of τ: real and infinitesimal alternating, starting and ending with a real one. */
  readonly path: readonly OrientedEdge[];
  /** The prong it starts at (its leaf is the leaf of the prong). */
  readonly prong: Prong;
  /** Whether it ends inside its last branch of τ (at a subdivision point). */
  readonly partial: boolean;
  /** Its letters in τ* (kept up to date when the track is subdivided further). */
  readonly letters: readonly Letter[];
}

/** The slits of a cut, and τ subdivided where their ends lie. */
export interface SlitSystem {
  readonly track: SubdividedTrack;
  readonly slits: readonly Slit[];
}

/** The prong traced through `count` whole real branches. */
export function traceProngThroughBranches(tt: TrainTrack, prong: Prong, count: number): Slit {
  const { blocked, path } = traceUntilCorner(tt, prong, count);
  if (blocked !== undefined)
    throw new Error(`The leaf runs into a corner at ${blocked} (a saddle connection)`);
  const track = new SubdividedTrack(tt);
  return { path, prong, partial: false, letters: track.expand(path) };
}

/**
 * The leaf of the prong through `count` real branches (fewer if it runs into a corner, `blocked`), found
 * combinatorially ({@link leafThroughRealBranches}).
 */
function traceUntilCorner(
  tt: TrainTrack,
  prong: Prong,
  count: number,
): { path: OrientedEdge[]; blocked?: Vertex } {
  const leaf = leafThroughRealBranches(tt, prong, count);
  return leaf === undefined ? { path: [], blocked: prong.atSwitch } : { path: leaf };
}

/**
 * The slits for cutting along the prong `prong` through `count` real branches: L itself and its preimages f⁻ʲ[L]
 * for j = 1, …, P − 1, where P is the period of the prong under f. f⁻ʲ[L] is the initial segment of the leaf of the
 * prong f⁻ʲ(prong) that g_τʲ maps onto L.
 */
export function slitsForProng(tt: TrainTrack, prong: Prong, count: number): SlitSystem {
  const system = slitSystems(tt, prong, count)(count);
  if (system === undefined) throw new Error("A slit runs into a corner (a saddle connection)");
  return system;
}

/**
 * The paths of the slits of {@link slitsForProng} for every count up to `maxCount` (for predicting the length of a
 * cut, without τ*): f⁻ʲ(L) is the shortest initial segment of the leaf of f⁻ʲ(prong) whose image under g_τʲ covers L,
 * found from the exact numbers of letters |g_τʲ(x)| (as BigInt: they grow like λʲ); it ends inside its last branch iff
 * that image is longer than L. `undefined` for the counts where a slit runs into a corner.
 */
export function growingSlits(
  tt: TrainTrack,
  prong: Prong,
  maxCount: number,
): (count: number) => SlitPath[] | undefined {
  const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;
  const orbit = [prong]; // prong, f(prong), f²(prong), …
  for (let p = imageProng(tt, prong); !same(p, prong) && orbit.length < 10_000; p = imageProng(tt, p))
    orbit.push(p);
  const P = orbit.length;
  const L = traceUntilCorner(tt, prong, maxCount);
  // |g_τʲ(x)| for the branches x of τ, j = 0, …, P − 1.
  const letters: Map<Edge, bigint>[] = [new Map(tt.graph.edges.map((e) => [e, 1n]))];
  for (let j = 1; j < P; j++) {
    const before = letters[j - 1] as Map<Edge, bigint>;
    letters.push(
      new Map(
        tt.graph.edges.map((e) => [
          e,
          tt.gTau.image(e.forward).letters.reduce((n, y) => n + (before.get(y.edge) as bigint), 0n),
        ]),
      ),
    );
  }
  const points = leafPoints(tt);
  /** For each j: the leaf of f⁻ʲ(prong) as far as needed, and the numbers of letters of g_τʲ of its prefixes. */
  const leaves = new Map<number, { prong: number; sums: bigint[] }>();
  /** The number of branches of the leaf of f⁻ʲ(prong) whose image under g_τʲ covers m letters, and that image's length. */
  const cover = (j: number, m: bigint): { length: number; letters: bigint } => {
    let leaf = leaves.get(j);
    if (leaf === undefined) {
      leaf = { prong: points.indexOf(orbit[P - j] as Prong), sums: [0n] };
      leaves.set(j, leaf);
    }
    const { sums } = leaf;
    const count = letters[j] as Map<Edge, bigint>;
    while ((sums.at(-1) as bigint) < m) {
      const path = points.path(leaf.prong, sums.length);
      sums.push(
        (sums.at(-1) as bigint) + (count.get((path[sums.length - 1] as OrientedEdge).edge) as bigint),
      );
    }
    // The first prefix that reaches m (binary search: the sums increase).
    let [lo, hi] = [1, sums.length - 1];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((sums[mid] as bigint) >= m) hi = mid;
      else lo = mid + 1;
    }
    return { length: lo, letters: sums[lo] as bigint };
  };
  return (count) => {
    if (L.blocked !== undefined || realCount(tt, L.path) < count) return undefined;
    const end = throughRealBranches(tt, L.path, count).length;
    const slits: SlitPath[] = [{ path: L.path.slice(0, end), prong, partial: false }];
    try {
      for (let j = 1; j < P; j++) {
        const { length, letters: covered } = cover(j, BigInt(end));
        const leaf = points.path((leaves.get(j) as { prong: number }).prong, length);
        slits.push({
          path: leaf.slice(0, length),
          prong: orbit[P - j] as Prong,
          partial: covered > BigInt(end),
        });
      }
    } catch {
      return undefined; // (a leaf runs into a corner)
    }
    return slits;
  };
}

/**
 * The slits of {@link slitsForProng} in τ*, for every count up to `maxCount`, from one leaf path per prong of the
 * orbit. `undefined` for the counts where a slit runs into a corner.
 *
 * The preimages are located one after the other in τ* (see `subdivided-track.ts`): f⁻ʲ(L) runs along the leaf of
 * f⁻ʲ(prong) until the images of its letters cover f⁻⁽ʲ⁻¹⁾(L), letter for letter, and its last sub-branch is
 * subdivided where they end.
 *
 * @throws Error if the images of a preimage leaf don't follow the slit they should cover.
 */
function slitSystems(
  tt: TrainTrack,
  prong: Prong,
  maxCount: number,
): (count: number) => SlitSystem | undefined {
  const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;
  const orbit = [prong]; // prong, f(prong), f²(prong), …
  for (let p = imageProng(tt, prong); !same(p, prong) && orbit.length < 10_000; p = imageProng(tt, p))
    orbit.push(p);
  const P = orbit.length;
  const L = traceUntilCorner(tt, prong, maxCount);
  /** The leaves of f⁻ʲ(prong) = f^{P−j}(prong), as long as they were needed so far (traced on demand). */
  const leaves = new Map<number, ReturnType<typeof traceUntilCorner>>();
  const leafOf = (j: number, count: number) => {
    const known = leaves.get(j);
    if (known !== undefined && (known.blocked !== undefined || realCount(tt, known.path) >= count))
      return known;
    const traced = traceUntilCorner(tt, orbit[P - j] as Prong, count);
    leaves.set(j, traced);
    return traced;
  };
  return (count) => {
    if (L.blocked !== undefined || realCount(tt, L.path) < count) return undefined;
    const track = new SubdividedTrack(tt);
    const end = throughRealBranches(tt, L.path, count).length;
    const slits: Slit[] = [
      {
        path: L.path.slice(0, end),
        prong,
        partial: false,
        letters: track.keep(track.expand(L.path.slice(0, end))),
      },
    ];
    for (let j = 1; j < P; j++) {
      const preimage = lift(track, slits[j - 1] as Slit, orbit[P - j] as Prong, (n) => leafOf(j, n));
      if (preimage === undefined) return undefined;
      slits.push(preimage);
    }
    return { track, slits };
  };
}

/**
 * The initial segment of the leaf of `prong` that g_* maps onto `target` (in τ*), with the sub-branch where it ends
 * subdivided; `leaf(n)` traces the leaf through at least n real branches. Undefined if the leaf runs into a corner first.
 */
function lift(
  track: SubdividedTrack,
  target: Slit,
  prong: Prong,
  leaf: (count: number) => { path: OrientedEdge[]; blocked?: Vertex },
): Slit | undefined {
  const tt = track.tt;
  const goal = target.letters;
  for (let n = 4; ; n *= 2) {
    const traced = leaf(n);
    // Walk along the leaf in τ*, comparing the images of its letters with the target, until they cover it.
    let covered = 0;
    let found: { t: number; q: number; k: number } | undefined;
    for (const [t, x] of traced.path.entries()) {
      for (const [q, y] of track.expand([x]).entries()) {
        const image = track.image(y);
        image.forEach((z, i) => {
          if (covered + i < goal.length && z !== goal[covered + i])
            throw new Error(
              `The preimage of a slit doesn't follow it (${z.tau} instead of ${goal[covered + i]?.tau})`,
            );
        });
        if (covered + image.length >= goal.length) {
          found = { t, q, k: goal.length - covered };
          break;
        }
        covered += image.length;
      }
      if (found !== undefined) break;
    }
    if (found === undefined) {
      if (traced.blocked !== undefined || realCount(tt, traced.path) < n) return undefined;
      continue;
    }
    const { t, q, k } = found;
    const x = traced.path[t] as OrientedEdge;
    const y = track.expand([x])[q] as Letter;
    if (k < track.image(y).length) track.subdivide(y, k);
    const last = track.expand([x]);
    const letters = track.keep([...track.expand(traced.path.slice(0, t)), ...last.slice(0, q + 1)]);
    if (letters.flatMap((z) => track.image(z)).some((z, i) => z !== goal[i]))
      throw new Error("The preimage of a slit doesn't map onto it");
    return {
      path: traced.path.slice(0, t + 1),
      prong,
      partial: q + 1 < last.length,
      letters,
    };
  }
}

/** A piece of τ′: a horizontal strip of a (subdivided) branch of τ, between two passes of slits (or its sides). */
export interface Piece {
  readonly edge: Edge;
  /** The branch of τ it lies in, and the index of its sub-branch there (see SubdividedTrack). */
  readonly branch: Edge;
  readonly subBranch: number;
  /** Whether its lower and upper side (across the branch, forward orientation) lie on a slit. */
  readonly bottomOnSlit: boolean;
  readonly topOnSlit: boolean;
  /** Its position along the branch (forward orientation; approximate, for drawing); [0, 0] for infinitesimal ones. */
  readonly start: number;
  readonly end: number;
}

/**
 * At the parts of the junctions that g maps into the blown-up orbit ({@link entriesInto}): the ends of the other gate
 * take the piece of the polygon's side from the image corner of the base gate to theirs first (in a part, both lie in
 * one piece of the side, since the cut set is invariant under f⁻¹), so that the part has a single image.
 */
function connectEntries(
  tt: TrainTrack,
  blownUp: ReadonlySet<Vertex>,
  partStars: ReadonlyMap<Vertex, readonly ArcEnd[]>,
  pieceDrafts: ReadonlyMap<string, readonly PieceDraft[]>,
  gPrime: CombinatorialMap,
): void {
  const entries = entriesInto(tt, blownUp);
  if (entries.size === 0) return;
  const sideOf = new Map(
    [...entries.values()].flatMap((entry) =>
      [...entry.sides].map(([s, side]) => [s, { base: entry.base, side }] as const),
    ),
  );
  /** The end of a piece at the part as an oriented edge leaving it, and the switch of its gate. */
  const leaving = (x: ArcEnd) => {
    const edge = x.piece.edge as Edge;
    return {
      end: x.leaves ? edge.forward : edge.backward,
      gate: x.leaves ? x.piece.branch.source : x.piece.branch.target,
    };
  };
  for (const ends of partStars.values()) {
    const all = ends.map(leaving);
    for (const { end, gate } of all) {
      const entry = sideOf.get(gate);
      if (entry === undefined) continue;
      const base = all.find((x) => x.gate === entry.base);
      if (base === undefined) continue; // (only the ends of this gate: the part maps to its corner)
      const [from, to] = [gPrime.image(base.end).first?.source, gPrime.image(end).first?.source];
      const { side } = entry;
      const candidates = (pieceDrafts.get(`${side.edge.id}/0`) ?? [])
        .map((p) => (side.isForward ? (p.edge as Edge).forward : (p.edge as Edge).backward))
        .filter((y) => y.source === from && y.target === to);
      if (candidates.length !== 1)
        throw new Error(
          `The part of ${end.source.name} meets ${candidates.length} pieces of the side ${side.edge.name} between its corners`,
        );
      const y = candidates[0] as OrientedEdge;
      const image = gPrime.image(end.edge.forward);
      gPrime.setImage(
        end.edge.forward,
        end.isForward ? EdgePath.of(y).concat(image) : image.concat(EdgePath.of(y.reversed)),
      );
    }
  }
}

/** The result of {@link cut}. */
export interface CutTrack {
  readonly graph: RibbonGraph;
  readonly gPrime: CombinatorialMap;
  readonly kind: ReadonlyMap<Edge, BranchKind>;
  /** Approximate lengths of the pieces (for drawing). */
  readonly lengths: ReadonlyMap<Edge, number>;
  readonly pieces: ReadonlyMap<Edge, Piece>;
  /**
   * Whether the side of a piece on the boundary lies on a slit, for a traversal in each direction: the lower side for
   * the forward direction (the face lies to the right, i.e. below), the upper side for the backward one.
   */
  readonly isOnSlit: (e: OrientedEdge) => boolean;
  /**
   * The side of its switch that each branch end is on (to the right: real branches, or the part after a subdivision).
   * The ends at the parts of a junction that isn't blown up are all to the right.
   */
  readonly side: ReadonlyMap<OrientedEdge, "right" | "left">;
  /** The junction of G that each vertex is (a part of): a switch or a part of a junction; undefined inside a branch. */
  readonly junctionOf: ReadonlyMap<Vertex, Vertex | undefined>;
  /** The vertices that are parts of a junction that isn't blown up (not of a switch). */
  readonly junctionParts: ReadonlySet<Vertex>;
  /** The default names of the surface that was cut (`FibredSurface.legacyDefaultNames`). */
  readonly legacyDefaultNames: boolean;
}

/** A pass of a slit through a sub-branch: a point of the slit's leaf, and the letter of the slit in τ*. */
interface Pass {
  readonly point: LeafPoint;
  readonly slit: number;
  /** The index of the letter in `Slit.letters`. */
  readonly letter: number;
  /** Whether the slit runs along the branch (forward). */
  readonly forward: boolean;
}

/** An end of a piece on an arc, and the boundary above it on the arc (a crossing of a slit, see `crossing`). */
interface ArcEnd {
  readonly piece: PieceDraft;
  /** True if the piece starts at this arc (its forward orientation leaves the arc). */
  readonly leaves: boolean;
  readonly side: "right" | "left";
  /** The crossing of a slit at the boundary above this end on the arc, if any. */
  readonly above?: string;
}

interface PieceDraft {
  readonly branch: Edge;
  readonly subBranch: number;
  /** The passes below and above it (undefined: the side of the branch). */
  readonly below?: Pass;
  readonly above?: Pass;
  readonly start: number;
  readonly end: number;
  edge?: Edge;
}

/**
 * Cuts along the slits; see the module documentation. Everything is decided combinatorially: the pieces are the gaps
 * between the passes of the slits through each sub-branch of τ*, ordered across it ({@link LeafPoints.compare}); the arcs
 * are split where the same slit crosses both sides; and the image of a piece is found from the images of the passes
 * bounding it, which are points on the leaves of the prongs again.
 *
 * @param blownUp The junctions of G that are cut as their polygons of TS(τ): those of the new punctures Q.
 */
export function cut(tt: TrainTrack, system: SlitSystem, blownUp: ReadonlySet<Vertex>): CutTrack {
  const { track, slits } = system;
  const points = leafPoints(tt);
  const lengthOf = (e: Edge) => tt.lengths.get(e) ?? 0;
  const isBlownUp = (s: Vertex) => blownUp.has(tt.junctionOf.get(s) as Vertex);
  /** The branches that get pieces: the real ones, and the infinitesimal ones of the junctions that are blown up. */
  const hasPieces = (e: Edge) => tt.kind.get(e) === "real" || isBlownUp(e.source);

  // 1. The sub-branches of the real branches: τ subdivided where the slits end (see SlitSystem).
  const subBranchCount = (e: Edge) => Math.max(1, track.subBranches(e).length);
  /** The index of the sub-branch of a letter of τ* (0 for an infinitesimal branch). */
  const subIndex = (x: Letter) => (x.sub === undefined ? 0 : track.indexOf(x.sub));
  const key = (e: Edge, k: number) => `${e.id}/${k}`;

  // 2. The passes of the slits through each sub-branch, ordered across it (forward), and the pieces between them.
  const passesAt = new Map<string, Pass[]>();
  slits.forEach((slit, s) => {
    const prong = points.indexOf(slit.prong);
    let i = -1;
    slit.letters.forEach((x, n) => {
      if (n === 0 || x.tau !== (slit.letters[n - 1] as Letter).tau) i++; // the next branch of τ
      if (!hasPieces(x.tau.edge)) return;
      const list = passesAt.get(key(x.tau.edge, subIndex(x))) ?? [];
      list.push({ point: { prong, index: i }, slit: s, letter: n, forward: x.isForward });
      passesAt.set(key(x.tau.edge, subIndex(x)), list);
    });
  });
  const passes = (e: Edge, k: number) => passesAt.get(key(e, k)) ?? [];
  const pieceDrafts = new Map<string, PieceDraft[]>();
  for (const e of tt.graph.edges.filter(hasPieces))
    for (let k = 0; k < subBranchCount(e); k++) {
      const list = passes(e, k).sort((p, q) => points.compare(p.point, q.point, e.forward));
      list.forEach((p, j) => {
        if (j > 0 && points.compare(p.point, (list[j - 1] as Pass).point, e.forward) === 0)
          throw new Error(`Two slits pass through ${e} at the same place`);
      });
      const sub = track.subBranches(e)[k];
      const [start, end] = sub === undefined ? [0, lengthOf(e)] : [sub.start, sub.end];
      pieceDrafts.set(
        key(e, k),
        Array.from({ length: list.length + 1 }, (_, j) => ({
          branch: e,
          subBranch: k,
          ...(j > 0 && { below: list[j - 1] as Pass }),
          ...(j < list.length && { above: list[j] as Pass }),
          start,
          end,
        })),
      );
    }

  /**
   * Where a slit crosses from one letter of τ* into the next (or starts, n = 0): the same on both sides of an arc. A
   * pass meets the arc at the forward start of its sub-branch where it enters its letter if it runs forward.
   */
  const crossing = (slit: number, n: number) => `${slit}:${n}`;
  const crossingAt = (p: Pass, atForwardStart: boolean) =>
    crossing(p.slit, p.forward === atForwardStart ? p.letter : p.letter + 1);
  /**
   * The ends of the pieces of a sub-branch on an arc, from bottom to top, with the crossings between them: at the
   * forward start of the sub-branch (`leaves`) or its end, in their order across it or `reversed` (a branch arriving
   * at a switch: its rectangle is turned by 180° there).
   */
  const endsOn = (
    e: Edge,
    k: number,
    side: "right" | "left",
    leaves: boolean,
    reversed: boolean,
  ): ArcEnd[] => {
    const list = pieceDrafts.get(key(e, k)) as PieceDraft[];
    const ordered = reversed ? list.toReversed() : list;
    return ordered.map((piece, j) => {
      const between = j + 1 === ordered.length ? undefined : reversed ? piece.below : piece.above;
      return { piece, leaves, side, ...(between !== undefined && { above: crossingAt(between, leaves) }) };
    });
  };
  /** The ends at a switch of the pieces of the branch leaving it along `e`. */
  const endsAtSwitch = (e: OrientedEdge, side: "right" | "left") =>
    endsOn(e.edge, e.isForward ? 0 : subBranchCount(e.edge) - 1, side, e.isForward, !e.isForward);

  // 3. Arcs with their piece ends, then split into switches where the same slit crosses both sides.
  const graph = new RibbonGraph();
  const arcs: { name: string; junction: Vertex | undefined; right: ArcEnd[]; left: ArcEnd[] }[] = [];
  // The arcs of the subdivisions get new names that no junction of G and no switch has (port note 25).
  const used = new Set([...tt.junctionOf.values(), ...tt.graph.vertices].map((v) => v.name));
  const subdivisionName = () => {
    const name = firstUnusedName(VERTEX_NAMES, used);
    used.add(name);
    return name;
  };
  /** The ends of the branches leaving a switch on one side of its arc, bottom to top. */
  const sideOfArc = (s: Vertex, kind: BranchKind): OrientedEdge[] => {
    const ends = tt.graph.star(s).filter((e) => tt.kind.get(e.edge) === kind);
    return kind === "real" ? ends : ends.toReversed();
  };
  for (const s of tt.graph.vertices.filter(isBlownUp)) {
    const sideEnds = (kind: BranchKind, side: "right" | "left") => {
      const branches = sideOfArc(s, kind);
      return branches.flatMap((e, i) => {
        const ends = endsAtSwitch(e, side);
        // The boundary between two branch ends is the corner of a prong where a slit may start.
        const next = branches[i + 1];
        const start = slits.findIndex(
          (slit) => slit.prong.atSwitch === s && slit.prong.below === e && slit.prong.above === next,
        );
        if (kind === "infinitesimal" && start >= 0 && ends.length > 0)
          ends[ends.length - 1] = { ...(ends.at(-1) as ArcEnd), above: crossing(start, 0) };
        return ends;
      });
    };
    arcs.push({
      name: s.name,
      junction: tt.junctionOf.get(s),
      right: sideEnds("real", "right"),
      left: sideEnds("infinitesimal", "left"),
    });
  }
  for (const e of tt.graph.edges.filter(hasPieces))
    for (let k = 1; k < subBranchCount(e); k++)
      arcs.push({
        name: tt.legacyDefaultNames ? `${e.name}@${k}` : subdivisionName(),
        junction: undefined,
        right: endsOn(e, k, "right", true, false),
        left: endsOn(e, k - 1, "left", false, false),
      });

  const switchOfEnd = new Map<PieceDraft, { start?: Vertex; end?: Vertex }>();
  const starOf = new Map<Vertex, ArcEnd[]>();
  const junctionOf = new Map<Vertex, Vertex | undefined>();
  const attach = (v: Vertex, inside: readonly ArcEnd[]) => {
    for (const x of inside) {
      const entry = switchOfEnd.get(x.piece) ?? {};
      if (x.leaves) entry.start = v;
      else entry.end = v;
      switchOfEnd.set(x.piece, entry);
    }
  };
  for (const arc of arcs) {
    const onLeft = new Set(arc.left.flatMap((x) => (x.above === undefined ? [] : [x.above])));
    const splits = new Set(
      arc.right.flatMap((x) => (x.above !== undefined && onLeft.has(x.above) ? [x.above] : [])),
    );
    /** The ends of a side, grouped into the parts of the arc between the splits. */
    const parts = (ends: readonly ArcEnd[]) => {
      const result: ArcEnd[][] = [[]];
      for (const x of ends) {
        (result.at(-1) as ArcEnd[]).push(x);
        if (x.above !== undefined && splits.has(x.above)) result.push([]);
      }
      return result;
    };
    const [right, left] = [parts(arc.right), parts(arc.left)];
    if (right.length !== left.length)
      throw new Error(`The arc of ${arc.name} splits differently on its two sides`);
    right.forEach((ends, j) => {
      // The parts of a split arc: v_a_a, v_a_b, … (before session format 4: v_0_0, v_0_1, …).
      const part = tt.legacyDefaultNames ? String(j) : letterIndex(j);
      const v = graph.addVertex(right.length > 1 ? `${arc.name}_${part}` : arc.name);
      // The star: the right side from bottom to top, then the left side from top to bottom.
      const inside = [...ends, ...(left[j] as ArcEnd[]).toReversed()];
      starOf.set(v, inside);
      junctionOf.set(v, arc.junction);
      attach(v, inside);
    });
  }

  // The junctions that aren't blown up: their disks, split by the chords of the slits (in counterclockwise order).
  const partStars = new Map<Vertex, ArcEnd[]>();
  for (const [v, switches] of tt.switchesOf) {
    if (switches.length === 0 || isBlownUp(switches[0] as Vertex)) continue;
    // The piece ends around the junction, counterclockwise, with the crossing at the gap after each.
    const around = switches.flatMap((s) => sideOfArc(s, "real").flatMap((e) => endsAtSwitch(e, "right")));
    const gapAt = (at: string) => {
      const i = around.findIndex((x) => x.above === at);
      if (i < 0) throw new Error(`A slit through ${v} doesn't end between two pieces`);
      return i;
    };
    // The chords: a slit arrives along a real branch at the switch s, runs along an infinitesimal branch to the switch
    // t, and leaves along a real branch. Each connects the gap after one piece end with the gap after another.
    const chord = new Map<number, number>();
    slits.forEach((slit, s) =>
      slit.letters.forEach((x, n) => {
        const [through, next] = [slit.letters[n + 1], slit.letters[n + 2]];
        if (x.sub === undefined || through?.sub !== undefined || next === undefined) return;
        if (tt.junctionOf.get(x.tau.target) !== v) return;
        const [a, b] = [gapAt(crossing(s, n + 1)), gapAt(crossing(s, n + 2))];
        chord.set(a, b);
        chord.set(b, a);
      }),
    );
    // The parts: walking along the boundary of each, counterclockwise, crossing over along the chords.
    const seen = new Set<number>();
    for (let start = 0; start < around.length; start++) {
      if (seen.has(start)) continue;
      const ends: ArcEnd[] = [];
      for (let i = start; !seen.has(i); i = ((chord.get(i) ?? i) + 1) % around.length) {
        seen.add(i);
        ends.push(around[i] as ArcEnd);
      }
      const part = graph.addVertex(v.name);
      partStars.set(part, ends);
      junctionOf.set(part, v);
      attach(part, ends);
    }
  }

  /** The number of a piece among those of its branch: along the branch first, then across it from the bottom. */
  const pieceNumber = (piece: PieceDraft) => {
    let k = 0;
    for (let sub = 0; sub < piece.subBranch; sub++)
      k += (pieceDrafts.get(key(piece.branch, sub)) as PieceDraft[]).length;
    return k + (pieceDrafts.get(key(piece.branch, piece.subBranch)) as PieceDraft[]).indexOf(piece) + 1;
  };

  // 4. Edges, stars.
  const kind = new Map<Edge, BranchKind>();
  const pieces = new Map<Edge, Piece>();
  const draftOf = new Map<Edge, PieceDraft>();
  const newLengths = new Map<Edge, number>();
  for (const [piece, { start, end }] of switchOfEnd) {
    if (start === undefined || end === undefined) throw new Error("A piece is missing an end");
    const many =
      subBranchCount(piece.branch) > 1 ||
      (pieceDrafts.get(key(piece.branch, piece.subBranch)) as PieceDraft[]).length > 1;
    // The pieces of a branch are numbered b_1, b_2, … (shown as b₁, b₂): along the branch first, then across it from
    // the bottom.
    const name = many ? `${piece.branch.name}_${pieceNumber(piece)}` : piece.branch.name;
    const edge = graph.addEdge(start, end, {
      name: /\p{L}/u.test(name) ? name : `x${name}`,
      color: piece.branch.color,
    });
    piece.edge = edge;
    draftOf.set(edge, piece);
    kind.set(edge, tt.kind.get(piece.branch) as BranchKind);
    pieces.set(edge, {
      edge,
      branch: piece.branch,
      subBranch: piece.subBranch,
      bottomOnSlit: piece.below !== undefined,
      topOnSlit: piece.above !== undefined,
      start: piece.start,
      end: piece.end,
    });
    newLengths.set(edge, piece.end - piece.start);
  }
  const side = new Map<OrientedEdge, "right" | "left">();
  const orient = (x: ArcEnd) => {
    const edge = x.piece.edge as Edge;
    return x.leaves ? edge.forward : edge.backward;
  };
  for (const [v, ends] of partStars) {
    graph.setStar(v, ends.map(orient));
    for (const x of ends) side.set(orient(x), "right");
  }
  for (const [v, ends] of starOf) {
    graph.setStar(v, ends.map(orient));
    for (const x of ends) side.set(orient(x), x.side);
  }

  // 5. The carrying map g′: each piece along g_* of its sub-branch, into the piece of each branch that its image lies in.
  const gPrime = new CombinatorialMap(graph, graph);
  /** The point of `p` in the n-th branch of g_τ of its branch, counted along g_τ(b) for b forward. */
  const imageAt = (p: LeafPoint, n: number) => {
    const x = points.letter(p);
    return points.image(p, x.isForward ? n : tt.gTau.image(x).length - 1 - n);
  };
  /**
   * Whether f keeps the order across b in the n-th branch of g_τ(b) (seen forward in both): decided by two points
   * of b and their images.
   */
  const keepsOrder = new Map<string, boolean>();
  const keeps = (b: Edge, n: number) => {
    const k = `${b.id}/${n}`;
    let result = keepsOrder.get(k);
    if (result === undefined) {
      const [p, q] = points.pointsIn(b, 2) as [LeafPoint, LeafPoint];
      const c = (tt.gTau.image(b.forward).letters[n] as OrientedEdge).edge;
      result =
        Math.sign(points.compare(p, q, b.forward)) ===
        Math.sign(points.compare(imageAt(p, n), imageAt(q, n), c.forward));
      keepsOrder.set(k, result);
    }
    return result;
  };
  /** How many passes of a sorted list lie below a point, and whether one is the point. */
  const rank = (list: readonly Pass[], q: LeafPoint, frame: OrientedEdge) => {
    let [lo, hi] = [0, list.length];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points.compare((list[mid] as Pass).point, q, frame) < 0) lo = mid + 1;
      else hi = mid;
    }
    const on = lo < list.length && points.compare((list[lo] as Pass).point, q, frame) === 0;
    return { below: lo, on };
  };
  /**
   * For each branch b: g_* of its sub-branches, one after the other, is g_τ(b) in letters of τ*; for each position
   * there, the index of the branch of g_τ(b) it lies in.
   */
  const strandIndex = new Map<Edge, number[]>();
  const strandIndexOf = (b: Edge) => {
    let list = strandIndex.get(b);
    if (list === undefined) {
      list = tt.gTau.image(b.forward).letters.flatMap((c, i) => track.expand([c]).map(() => i));
      strandIndex.set(b, list);
    }
    return list;
  };
  const interior = new Map<Edge, LeafPoint>();
  for (const [edge, piece] of pieces) {
    const draft = draftOf.get(edge) as PieceDraft;
    const b = piece.branch;
    const strand = tt.gTau.image(b.forward).letters;
    // The image of the piece: g_* of its sub-branch, which starts after the images of the sub-branches before it.
    const subs = track.subBranches(b);
    const letters =
      subs.length === 0
        ? track.image(track.expand([b.forward])[0] as Letter)
        : track.image((subs[piece.subBranch] as SubBranch).forward);
    const before = subs.slice(0, piece.subBranch).reduce((n, sub) => n + track.image(sub.forward).length, 0);
    const indices = strandIndexOf(b);
    const image: OrientedEdge[] = [];
    letters.forEach((z, m) => {
      const n = indices[before + m];
      if (n === undefined || strand[n] !== z.tau)
        throw new Error(`The image of a piece of ${b} doesn't follow g_τ`);
      const c = z.tau;
      if (!hasPieces(c.edge)) return; // (an infinitesimal branch of a junction that isn't blown up)
      const list = passes(c.edge, subIndex(z));
      const frame = c.edge.forward;
      // The piece of c the image lies in: next to the image of a pass bounding the piece, on the side of the piece.
      let j: number;
      if (draft.below !== undefined || draft.above !== undefined) {
        const bound = (draft.below ?? draft.above) as Pass;
        const { below, on } = rank(list, imageAt(bound.point, n), frame);
        // The piece lies above its lower pass (below its upper one); f keeps or reverses that in c.
        const up = (draft.below !== undefined) === keeps(b, n);
        j = up ? below + (on ? 1 : 0) : below;
      } else {
        // No slit passes through this sub-branch: any point of a leaf in b (its height is the same all along b) lies
        // inside the image, and on no slit of c there (the slit's preimage would cross the sub-branch).
        let p = interior.get(b);
        if (p === undefined) {
          p = points.pointsIn(b, 1)[0] as LeafPoint;
          interior.set(b, p);
        }
        const { below, on } = rank(list, imageAt(p, n), frame);
        if (on) throw new Error("A slit crosses the image of a piece");
        j = below;
      }
      const target = (pieceDrafts.get(key(c.edge, subIndex(z))) as PieceDraft[])[j];
      if (target === undefined)
        throw new Error(`The image of a piece of ${b} doesn't fit into a piece of ${c.edge}`);
      const e = target.edge as Edge;
      image.push(c.isForward ? e.forward : e.backward);
    });
    gPrime.setImage(edge.forward, EdgePath.from(image));
  }
  connectEntries(tt, blownUp, partStars, pieceDrafts, gPrime);
  for (const v of graph.vertices) {
    const first = graph
      .star(v)
      .map((e) => gPrime.image(e).first)
      .find((x) => x !== undefined);
    if (first !== undefined) gPrime.setVertexImage(v, first.source);
  }

  const isOnSlit = (e: OrientedEdge) => {
    const piece = pieces.get(e.edge) as Piece;
    if (kind.get(e.edge) !== "real") return false;
    return e.isForward ? piece.bottomOnSlit : piece.topOnSlit;
  };
  return {
    graph,
    gPrime,
    kind,
    lengths: newLengths,
    pieces,
    isOnSlit,
    side,
    junctionOf,
    junctionParts: new Set(partStars.keys()),
    legacyDefaultNames: tt.legacyDefaultNames,
  };
}
