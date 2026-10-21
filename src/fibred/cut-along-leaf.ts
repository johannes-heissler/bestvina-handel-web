/**
 * Cutting along a singular leaf L and its preimages (the thesis, Move "Cutting along a singular leaf"), giving a new
 * graph G′ with a map g′ for the same f and the same growth λ.
 *
 * The cut is carried out on the rectangles of TS(τ):
 * 1. Real branches are subdivided where a preimage slit ends inside them: combinatorially, in τ* (see
 *    `subdivided-track.ts`), so that no lengths are compared.
 * 2. Each piece of a branch is split horizontally at the heights of the slits running along it.
 * 3. Each singular arc (of a switch, or of a subdivision) is split into several switches at the heights where both
 *    sides of the arc have a boundary between pieces: where a slit passes through, and at the prong corner where
 *    a slit starts.
 * 4. g′ maps each piece along g_* of its sub-branch; the heights there come from the image strand of its branch
 *    (see `strands.ts`). Since f⁻¹ of the cut set lies in the cut set, the image of each piece fits exactly into whole
 *    pieces.
 *
 * The leaves are found combinatorially too (`leaf-paths.ts`); only the heights across the branches are still numbers.
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
import { imageProng, type Prong, switchArc } from "./singular-leaves";
import { leafThroughRealBranches, realCount, throughRealBranches } from "./leaf-paths";
import { type Letter, type SubBranch, SubdividedTrack } from "./subdivided-track";
import { strands as computeStrands } from "./strands";
import { type BranchKind, entriesInto, type TrainTrack } from "./train-track";

const TOLERANCE = 1e-9;
const near = (a: number, b: number, scale = 1) => Math.abs(a - b) <= TOLERANCE * Math.max(1, scale);

/** A slit: a leaf segment from a prong corner, in τ and in τ* (where it ends at a point of τ*). */
export interface Slit {
  /** Its branches of τ: real and infinitesimal alternating, starting and ending with a real one. */
  readonly path: readonly OrientedEdge[];
  /** The height of the slit above the bottom of each branch of `path` (in the direction of traversal). */
  readonly heights: readonly number[];
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
  const { blocked, path, heights } = traceUntilCorner(tt, prong, count);
  if (blocked !== undefined)
    throw new Error(`The leaf runs into a corner at ${blocked} (a saddle connection)`);
  const track = new SubdividedTrack(tt);
  return { path, heights, partial: false, letters: track.expand(path) };
}

/**
 * The prong traced through `count` real branches (fewer if it runs into a corner, `blocked`). The train path of the
 * leaf is found combinatorially ({@link leafThroughRealBranches}); the heights are only computed along it (kept inside
 * each branch, where rounding would put the leaf just outside).
 */
function traceUntilCorner(
  tt: TrainTrack,
  prong: Prong,
  count: number,
): { path: OrientedEdge[]; heights: number[]; blocked?: Vertex } {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const corner = switchArc(tt, prong.atSwitch).infinitesimal.find((i) => i.end === prong.below);
  if (corner === undefined) throw new Error("The prong's lower branch doesn't start at its switch");
  const leaf = leafThroughRealBranches(tt, prong, count);
  const path: OrientedEdge[] = [];
  const heights: number[] = [];
  if (leaf === undefined) return { path, heights, blocked: prong.atSwitch };
  let [s, h, side] = [prong.atSwitch, corner.top, "real" as BranchKind];
  for (const x of leaf) {
    const interval = switchArc(tt, s)[side].find((i) => i.end === x);
    if (interval === undefined) throw new Error(`The leaf's branch ${x} doesn't leave ${s}`);
    const y = Math.min(Math.max(h - interval.bottom, 0), interval.top - interval.bottom);
    path.push(x);
    heights.push(y);
    const arrival = switchArc(tt, x.target)[side].find((i) => i.end === x.reversed);
    if (arrival === undefined) throw new Error("Inconsistent arcs");
    [s, h, side] = [
      x.target,
      arrival.bottom + ((widths.get(x.edge) as number) - y),
      side === "real" ? "infinitesimal" : "real",
    ];
  }
  return { path, heights };
}

/**
 * The slits for cutting along the prong `prong` through `count` real branches: L itself and its preimages f⁻ʲ[L]
 * for j = 1, …, P − 1, where P is the period of the prong under f. f⁻ʲ[L] is the initial segment of the leaf of the
 * prong f⁻ʲ(prong) that g_τʲ maps onto L.
 */
export function slitsForProng(tt: TrainTrack, prong: Prong, count: number): SlitSystem {
  const system = growingSlits(tt, prong, count)(count);
  if (system === undefined) throw new Error("A slit runs into a corner (a saddle connection)");
  return system;
}

/**
 * The slits of {@link slitsForProng} for every count up to `maxCount`, from one leaf path per prong of the orbit:
 * those for a smaller count are initial segments. `undefined` for the counts where a slit runs into a corner.
 *
 * The preimages are located one after the other in τ* (see `subdivided-track.ts`): f⁻ʲ(L) runs along the leaf of
 * f⁻ʲ(prong) until the images of its letters cover f⁻⁽ʲ⁻¹⁾(L), letter for letter, and its last sub-branch is
 * subdivided where they end.
 *
 * @throws Error if the images of a preimage leaf don't follow the slit they should cover.
 */
export function growingSlits(
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
        heights: L.heights.slice(0, end),
        partial: false,
        letters: track.keep(track.expand(L.path.slice(0, end))),
      },
    ];
    for (let j = 1; j < P; j++) {
      const preimage = lift(track, slits[j - 1] as Slit, (n) => leafOf(j, n));
      if (preimage === undefined) return undefined;
      slits.push(preimage);
    }
    return { track, slits };
  };
}

/**
 * The initial segment of a leaf that g_* maps onto `target` (in τ*), with the sub-branch where it ends subdivided;
 * `leaf(n)` traces the leaf through at least n real branches. Undefined if the leaf runs into a corner first.
 */
function lift(
  track: SubdividedTrack,
  target: Slit,
  leaf: (count: number) => { path: OrientedEdge[]; heights: number[]; blocked?: Vertex },
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
      heights: traced.heights.slice(0, t + 1),
      partial: q + 1 < last.length,
      letters,
    };
  }
}

/** A piece of τ′: a horizontal strip of a (subdivided) branch of τ. */
export interface Piece {
  readonly edge: Edge;
  /** The branch of τ it lies in, and the index of its sub-branch there (see SubdividedTrack). */
  readonly branch: Edge;
  readonly subBranch: number;
  /** Its heights above the bottom of the branch (forward orientation). */
  readonly bottom: number;
  readonly top: number;
  /** Its length range along the branch (forward orientation); [0, 0] for infinitesimal branches. */
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
  readonly widths: ReadonlyMap<Edge, number>;
  readonly lengths: ReadonlyMap<Edge, number>;
  readonly pieces: ReadonlyMap<Edge, Piece>;
  /**
   * The height of each piece's side on the boundary, for a traversal in each direction: the bottom for the
   * forward direction (the face lies to the right, i.e. below), the top for the backward one. Sides at height
   * strictly between 0 and the branch width lie on a slit.
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

/** An end of a piece on an arc, with its height interval on the arc. */
interface ArcEnd {
  readonly piece: PieceDraft;
  /** True if the piece starts at this arc (its forward orientation leaves the arc). */
  readonly leaves: boolean;
  readonly side: "right" | "left";
  readonly low: number;
  readonly high: number;
}

interface PieceDraft {
  readonly branch: Edge;
  readonly subBranch: number;
  readonly bottom: number;
  readonly top: number;
  readonly start: number;
  readonly end: number;
  edge?: Edge;
}

/**
 * Cuts along the slits; see the module documentation.
 *
 * @param blownUp The junctions of G that are cut as their polygons of TS(τ): those of the new punctures Q.
 */
export function cut(tt: TrainTrack, system: SlitSystem, blownUp: ReadonlySet<Vertex>): CutTrack {
  const { track, slits } = system;
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const lengthOf = (e: Edge) => tt.lengths.get(e) as number;
  const widthOf = (e: Edge) => widths.get(e) as number;
  const isBlownUp = (s: Vertex) => blownUp.has(tt.junctionOf.get(s) as Vertex);
  /** The branches that get pieces: the real ones, and the infinitesimal ones of the junctions that are blown up. */
  const hasPieces = (e: Edge) => tt.kind.get(e) === "real" || isBlownUp(e.source);

  // 1. The sub-branches of the real branches: τ subdivided where the slits end (see SlitSystem).
  const subBranchCount = (e: Edge) => Math.max(1, track.subBranches(e).length);
  /** The index of the sub-branch of a letter of τ* (0 for an infinitesimal branch). */
  const subIndex = (x: Letter) => (x.sub === undefined ? 0 : track.indexOf(x.sub));

  // 2. Slit heights on each sub-branch (forward heights): each letter of a slit in τ* lies in its branch of τ, at the
  // slit's height there.
  const cuts = new Map<string, number[]>(); // "branchId/sub" → heights
  const key = (e: Edge, k: number) => `${e.id}/${k}`;
  for (const slit of slits) {
    let i = -1;
    slit.letters.forEach((x, n) => {
      if (n === 0 || x.tau !== (slit.letters[n - 1] as Letter).tau) i++; // the next branch of τ
      if (!hasPieces(x.tau.edge)) return;
      const w = widthOf(x.tau.edge);
      const height = x.tau.isForward ? (slit.heights[i] as number) : w - (slit.heights[i] as number);
      const list = cuts.get(key(x.tau.edge, subIndex(x))) ?? [];
      if (!list.some((c) => near(c, height, w))) list.push(height);
      cuts.set(key(x.tau.edge, subIndex(x)), list);
    });
  }

  // Pieces of each sub-branch.
  const pieceDrafts = new Map<string, PieceDraft[]>();
  for (const e of tt.graph.edges.filter(hasPieces)) {
    for (let k = 0; k < subBranchCount(e); k++) {
      const heights = [0, ...(cuts.get(key(e, k)) ?? []).sort((a, b) => a - b), widthOf(e)];
      const sub = track.subBranches(e)[k];
      const [start, end] = sub === undefined ? [0, lengthOf(e)] : [sub.start, sub.end];
      pieceDrafts.set(
        key(e, k),
        heights
          .slice(1)
          .map((top, j) => ({ branch: e, subBranch: k, bottom: heights[j] as number, top, start, end })),
      );
    }
  }

  // 3. Arcs with their piece ends, then split into switches.
  const graph = new RibbonGraph();
  const arcs: { name: string; junction: Vertex | undefined; ends: ArcEnd[] }[] = [];
  // The arcs of the subdivisions get new names that no junction of G and no switch has (port note 25).
  const used = new Set([...tt.junctionOf.values(), ...tt.graph.vertices].map((v) => v.name));
  const subdivisionName = () => {
    const name = firstUnusedName(VERTEX_NAMES, used);
    used.add(name);
    return name;
  };
  for (const s of tt.graph.vertices.filter(isBlownUp)) {
    const arc = switchArc(tt, s);
    const ends: ArcEnd[] = [];
    for (const [sideName, intervals] of [
      ["right", arc.real],
      ["left", arc.infinitesimal],
    ] as const)
      for (const interval of intervals) {
        const e = interval.end;
        const k = e.isForward ? 0 : subBranchCount(e.edge) - 1;
        const w = widthOf(e.edge);
        for (const piece of pieceDrafts.get(key(e.edge, k)) as PieceDraft[])
          ends.push({
            piece,
            leaves: e.isForward,
            side: sideName,
            low: interval.bottom + (e.isForward ? piece.bottom : w - piece.top),
            high: interval.bottom + (e.isForward ? piece.top : w - piece.bottom),
          });
      }
    arcs.push({ name: s.name, junction: tt.junctionOf.get(s), ends });
  }
  for (const e of tt.graph.edges.filter(hasPieces))
    for (let k = 1; k < subBranchCount(e); k++) {
      const ends: ArcEnd[] = [];
      for (const piece of pieceDrafts.get(key(e, k)) as PieceDraft[])
        ends.push({ piece, leaves: true, side: "right", low: piece.bottom, high: piece.top });
      for (const piece of pieceDrafts.get(key(e, k - 1)) as PieceDraft[])
        ends.push({ piece, leaves: false, side: "left", low: piece.bottom, high: piece.top });
      arcs.push({
        name: tt.legacyDefaultNames ? `${e.name}@${k}` : subdivisionName(),
        junction: undefined,
        ends,
      });
    }

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
    const width = Math.max(...arc.ends.map((x) => x.high));
    const boundaries = (side: "right" | "left") =>
      arc.ends.filter((x) => x.side === side).flatMap((x) => [x.low, x.high]);
    const [right, left] = [boundaries("right"), boundaries("left")];
    const splits = right
      .filter(
        (h) => h > TOLERANCE * width && h < width * (1 - TOLERANCE) && left.some((g) => near(g, h, width)),
      )
      .sort((a, b) => a - b)
      .filter((h, i, all) => i === 0 || !near(h, all[i - 1] as number, width));
    const bounds = [0, ...splits, width];
    for (let j = 0; j + 1 < bounds.length; j++) {
      const [lo, hi] = [bounds[j] as number, bounds[j + 1] as number];
      const inside = arc.ends.filter(
        (x) => x.low >= lo - TOLERANCE * width && x.high <= hi + TOLERANCE * width,
      );
      // The parts of a split arc: v_a_a, v_a_b, … (before session format 4: v_0_0, v_0_1, …).
      const part = tt.legacyDefaultNames ? String(j) : letterIndex(j);
      const v = graph.addVertex(bounds.length > 2 ? `${arc.name}_${part}` : arc.name);
      starOf.set(v, inside);
      junctionOf.set(v, arc.junction);
      attach(v, inside);
    }
  }

  // The junctions that aren't blown up: their disks, split by the chords of the slits (in counterclockwise order).
  const partStars = new Map<Vertex, ArcEnd[]>();
  for (const [v, switches] of tt.switchesOf) {
    if (switches.length === 0 || isBlownUp(switches[0] as Vertex)) continue;
    // The piece ends around the junction, counterclockwise, with the switch and arc height of the gap after each.
    const around: { end: ArcEnd; s: Vertex }[] = [];
    for (const s of switches)
      for (const interval of switchArc(tt, s).real) {
        const e = interval.end;
        const k = e.isForward ? 0 : subBranchCount(e.edge) - 1;
        const w = widthOf(e.edge);
        const ends = (pieceDrafts.get(key(e.edge, k)) as PieceDraft[]).map((piece) => ({
          piece,
          leaves: e.isForward,
          side: "right" as const,
          low: interval.bottom + (e.isForward ? piece.bottom : w - piece.top),
          high: interval.bottom + (e.isForward ? piece.top : w - piece.bottom),
        }));
        for (const end of ends.sort((a, b) => a.low - b.low)) around.push({ end, s });
      }
    const gapAt = (s: Vertex, height: number) => {
      const width = switchArc(tt, s).width;
      const i = around.findIndex((x) => x.s === s && near(x.end.high, height, width));
      if (i < 0) throw new Error(`A slit through ${v} doesn't end between two pieces`);
      return i;
    };
    // The chords: a slit arrives along a real branch at the switch s, runs along an infinitesimal branch to the switch
    // t, and leaves along a real branch. Each connects the gap after one piece end with the gap after another.
    const chord = new Map<number, number>();
    for (const slit of slits)
      slit.path.forEach((x, i) => {
        const next = slit.path[i + 2];
        if (tt.kind.get(x.edge) !== "real" || next === undefined) return;
        const s = x.target;
        if (tt.junctionOf.get(s) !== v) return;
        const arrival = switchArc(tt, s).real.find((a) => a.end === x.reversed) as { bottom: number };
        const departure = switchArc(tt, next.source).real.find((a) => a.end === next) as { bottom: number };
        const a = gapAt(s, arrival.bottom + widthOf(x.edge) - (slit.heights[i] as number));
        const b = gapAt(next.source, departure.bottom + (slit.heights[i + 2] as number));
        chord.set(a, b);
        chord.set(b, a);
      });
    // The parts: walking along the boundary of each, counterclockwise, crossing over along the chords.
    const seen = new Set<number>();
    for (let start = 0; start < around.length; start++) {
      if (seen.has(start)) continue;
      const ends: ArcEnd[] = [];
      for (let i = start; !seen.has(i); i = ((chord.get(i) ?? i) + 1) % around.length) {
        seen.add(i);
        ends.push((around[i] as { end: ArcEnd }).end);
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
  const newWidths = new Map<Edge, number>();
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
    kind.set(edge, tt.kind.get(piece.branch) as BranchKind);
    pieces.set(edge, {
      edge,
      branch: piece.branch,
      subBranch: piece.subBranch,
      bottom: piece.bottom,
      top: piece.top,
      start: piece.start,
      end: piece.end,
    });
    newWidths.set(edge, piece.top - piece.bottom);
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
    const right = ends.filter((x) => x.side === "right").sort((a, b) => a.low - b.low);
    const left = ends.filter((x) => x.side === "left").sort((a, b) => b.low - a.low);
    graph.setStar(v, [...right, ...left].map(orient));
    for (const x of right) side.set(orient(x), "right");
    for (const x of left) side.set(orient(x), "left");
  }

  // 5. The carrying map g′ along the image strands.
  const strandOf = computeStrands(tt);
  const λ = tt.growth;
  const gPrime = new CombinatorialMap(graph, graph);
  const piecesAt = (e: Edge, k: number) => pieceDrafts.get(key(e, k)) as PieceDraft[];
  // The heights of the slits are traced through branches of very different widths, so their rounding errors are
  // absolute, on the scale of the widest branch: a thin (e.g. infinitesimal) branch needs more than TOLERANCE · w.
  const heightError = 1e-11 * Math.max(...widths.values());
  /**
   * For each branch b: g_* of its sub-branches, one after the other, is its strand g_τ(b) in letters of τ*; for each
   * position there, the index of the branch of the strand it lies in.
   */
  const strandIndex = new Map<Edge, number[]>();
  const strandIndexOf = (b: Edge, path: readonly OrientedEdge[]) => {
    let list = strandIndex.get(b);
    if (list === undefined) {
      list = path.flatMap((c, i) => track.expand([c]).map(() => i));
      strandIndex.set(b, list);
    }
    return list;
  };
  for (const [edge, piece] of pieces) {
    const strand = strandOf.get(piece.branch);
    if (strand === undefined) throw new Error(`No strand for ${piece.branch}`);
    // The image of the piece: g_* of its sub-branch, which starts after the images of the sub-branches before it.
    const subs = track.subBranches(piece.branch);
    const letters =
      subs.length === 0
        ? track.image(track.expand([piece.branch.forward])[0] as Letter)
        : track.image((subs[piece.subBranch] as SubBranch).forward);
    const before = subs.slice(0, piece.subBranch).reduce((n, sub) => n + track.image(sub.forward).length, 0);
    const indices = strandIndexOf(piece.branch, strand.path);
    const image: OrientedEdge[] = [];
    letters.forEach((z, n) => {
      const i = indices[before + n];
      if (i === undefined || strand.path[i] !== z.tau)
        throw new Error(`The image of a piece of ${piece.branch} doesn't follow its strand`);
      const c = z.tau;
      if (!hasPieces(c.edge)) return; // (an infinitesimal branch of a junction that isn't blown up)
      const o = strand.offsets[i] as number;
      // Heights are measured from the bottom of the arc where a traversal starts. For real branches (which leave
      // to the right) that is the rectangle's own bottom; for infinitesimal ones (which leave to the left) it is
      // its top. So the image is flipped when exactly one of the two branches is infinitesimal.
      const flipped =
        (tt.kind.get(piece.branch) === "infinitesimal") !== (tt.kind.get(c.edge) === "infinitesimal");
      const [y0, y1] = flipped
        ? [o + strand.width - piece.top / λ, o + strand.width - piece.bottom / λ]
        : [o + piece.bottom / λ, o + piece.top / λ];
      const w = widthOf(c.edge);
      const [low, high] = c.isForward ? [y0, y1] : [w - y1, w - y0];
      const tolerance = Math.max(TOLERANCE * w, heightError);
      const candidate = piecesAt(c.edge, subIndex(z)).find(
        (p) => p.bottom <= low + tolerance && high <= p.top + tolerance,
      );
      if (candidate === undefined)
        throw new Error(`The image of a piece of ${piece.branch} doesn't fit into a piece of ${c.edge}`);
      const e = candidate.edge as Edge;
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
    const h = e.isForward ? piece.bottom : piece.top;
    const w = widthOf(piece.branch);
    return h > TOLERANCE * w && h < w * (1 - TOLERANCE);
  };
  return {
    graph,
    gPrime,
    kind,
    widths: newWidths,
    lengths: newLengths,
    pieces,
    isOnSlit,
    side,
    junctionOf,
    junctionParts: new Set(partStars.keys()),
    legacyDefaultNames: tt.legacyDefaultNames,
  };
}
