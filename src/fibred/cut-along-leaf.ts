/**
 * Cutting the half-translation surface TS(τ) along a singular leaf L and its preimages (the thesis, Move "Cutting
 * along a singular leaf"), giving a new track τ′ with a carrying map g′ for the same f and the same growth λ.
 *
 * The cut is carried out on the rectangles of TS(τ):
 * 1. Real branches are subdivided (lengthwise) where a preimage slit ends inside them.
 * 2. Each piece of a branch is split horizontally at the heights of the slits running along it.
 * 3. Each singular arc (of a switch, or of a subdivision) is split into several switches at the heights where both
 *    sides of the arc have a boundary between pieces: where a slit passes through, and at the prong corner where
 *    a slit starts.
 * 4. g′ maps each piece along the image strand of its branch (see `strands.ts`). Since f⁻¹ of the cut set lies in
 *    the cut set, the image of each piece fits exactly into whole pieces.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { type Edge, type OrientedEdge, RibbonGraph, type Vertex } from "../graph/ribbon-graph";
import { imageProng, type Prong, switchArc } from "./singular-leaves";
import { strands as computeStrands } from "./strands";
import type { BranchKind, TrainTrack } from "./train-track";

const TOLERANCE = 1e-9;
const near = (a: number, b: number, scale = 1) => Math.abs(a - b) <= TOLERANCE * Math.max(1, scale);

/** A slit: a leaf segment given by its path of branches and its height in each. */
export interface Slit {
  /** Real and infinitesimal branches, alternating, starting with a real one. */
  readonly path: readonly OrientedEdge[];
  /** The height of the slit above the bottom of each branch (in the direction of traversal). */
  readonly heights: readonly number[];
  /** If the slit ends inside its last (real) branch: the length it runs along that branch. */
  readonly partialLength?: number;
}

/**
 * The prong traced until its length (sum of the lengths of the real branches) is `length`. The last real branch
 * is entered only partially unless the length ends exactly at a switch.
 */
export function traceProngToLength(tt: TrainTrack, prong: Prong, length: number): Slit {
  return traceProng(tt, prong, { length });
}

/** The prong traced through `count` whole real branches. */
export function traceProngThroughBranches(tt: TrainTrack, prong: Prong, count: number): Slit {
  return traceProng(tt, prong, { count });
}

function traceProng(tt: TrainTrack, prong: Prong, until: { length?: number; count?: number }): Slit {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const corner = switchArc(tt, prong.atSwitch).infinitesimal.find((i) => i.end === prong.below);
  if (corner === undefined) throw new Error("The prong's lower branch doesn't start at its switch");
  const path: OrientedEdge[] = [];
  const heights: number[] = [];
  let [s, h, side] = [prong.atSwitch, corner.top, "real" as BranchKind];
  let [travelled, count] = [0, 0];
  for (let step = 0; step < 100_000; step++) {
    const interval = switchArc(tt, s)[side].find((i) => i.bottom < h && h < i.top);
    if (interval === undefined) throw new Error(`The leaf runs into a corner at ${s} (a saddle connection)`);
    const y = h - interval.bottom;
    path.push(interval.end);
    heights.push(y);
    if (side === "real") {
      const l = tt.lengths.get(interval.end.edge) as number;
      count++;
      if (until.length !== undefined && travelled + l > until.length + TOLERANCE * until.length) {
        return { path, heights, partialLength: until.length - travelled };
      }
      travelled += l;
      if (until.length !== undefined && near(travelled, until.length, until.length)) break;
      if (until.count !== undefined && count >= until.count) break; // end on the arc right after a real branch
    }
    const arrival = switchArc(tt, interval.end.target)[side].find((i) => i.end === interval.end.reversed);
    if (arrival === undefined) throw new Error("Inconsistent arcs");
    [s, h, side] = [
      interval.end.target,
      arrival.bottom + ((widths.get(interval.end.edge) as number) - y),
      side === "real" ? "infinitesimal" : "real",
    ];
  }
  return { path, heights };
}

/**
 * The slits for cutting along the prong `prong` through `count` real branches: L itself and its preimages f⁻ʲ[L]
 * for j = 1, …, P − 1, where P is the period of the prong under f. f⁻ʲ[L] is the initial segment of length ℓ(L)/λʲ
 * of the prong mapped to `prong` by fʲ.
 */
export function slitsForProng(tt: TrainTrack, prong: Prong, count: number): Slit[] {
  const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;
  const orbit = [prong]; // prong, f(prong), f²(prong), …
  for (let p = imageProng(tt, prong); !same(p, prong) && orbit.length < 10_000; p = imageProng(tt, p))
    orbit.push(p);
  const L = traceProngThroughBranches(tt, prong, count);
  const length = L.path.reduce((sum, e) => sum + (tt.lengths.get(e.edge) as number), 0);
  const P = orbit.length;
  // f⁻ʲ(prong) = f^{P−j}(prong).
  return [
    L,
    ...Array.from({ length: P - 1 }, (_, i) =>
      traceProngToLength(tt, orbit[P - 1 - i] as Prong, length / tt.growth ** (i + 1)),
    ),
  ];
}

/** A piece of τ′: a horizontal strip of a (subdivided) branch of τ. */
export interface Piece {
  readonly edge: Edge;
  /** The branch of τ it lies in. */
  readonly branch: Edge;
  /** Its heights above the bottom of the branch (forward orientation). */
  readonly bottom: number;
  readonly top: number;
  /** Its length range along the branch (forward orientation); [0, 0] for infinitesimal branches. */
  readonly start: number;
  readonly end: number;
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
  /** The side of its switch that each branch end is on (to the right: real branches, or the part after a subdivision). */
  readonly side: ReadonlyMap<OrientedEdge, "right" | "left">;
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

/** Cuts TS(τ) along the slits; see the module documentation. */
export function cut(tt: TrainTrack, slits: readonly Slit[]): CutTrack {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const lengthOf = (e: Edge) => tt.lengths.get(e) as number;
  const widthOf = (e: Edge) => widths.get(e) as number;

  // 1. Subdivision points of the real branches (forward length coordinates).
  const points = new Map<Edge, number[]>(tt.graph.edges.map((e) => [e, [0, lengthOf(e)]]));
  for (const slit of slits) {
    if (slit.partialLength === undefined) continue;
    const last = slit.path.at(-1) as OrientedEdge;
    const l = lengthOf(last.edge);
    const p = last.isForward ? slit.partialLength : l - slit.partialLength;
    const list = points.get(last.edge) as number[];
    if (!list.some((q) => near(q, p, l))) list.push(p);
  }
  for (const list of points.values()) list.sort((a, b) => a - b);
  const subBranchCount = (e: Edge) => Math.max(1, (points.get(e) as number[]).length - 1);

  // 2. Slit heights on each sub-branch (forward heights).
  const cuts = new Map<string, number[]>(); // "branchId/sub" → heights
  const key = (e: Edge, k: number) => `${e.id}/${k}`;
  slits.forEach((slit) =>
    slit.path.forEach((x, i) => {
      const w = widthOf(x.edge);
      const l = lengthOf(x.edge);
      const height = x.isForward ? (slit.heights[i] as number) : w - (slit.heights[i] as number);
      const partial = i === slit.path.length - 1 && slit.partialLength !== undefined;
      const [from, to] = !partial
        ? [0, l]
        : x.isForward
          ? [0, slit.partialLength as number]
          : [l - (slit.partialLength as number), l];
      const pts = points.get(x.edge) as number[];
      for (let k = 0; k < subBranchCount(x.edge); k++) {
        const [a, b] = [pts[k] as number, pts[k + 1] ?? l];
        if (a >= from - TOLERANCE * Math.max(1, l) && b <= to + TOLERANCE * Math.max(1, l)) {
          const list = cuts.get(key(x.edge, k)) ?? [];
          if (!list.some((c) => near(c, height, w))) list.push(height);
          cuts.set(key(x.edge, k), list);
        }
      }
    }),
  );

  // Pieces of each sub-branch.
  const pieceDrafts = new Map<string, PieceDraft[]>();
  for (const e of tt.graph.edges) {
    const pts = points.get(e) as number[];
    for (let k = 0; k < subBranchCount(e); k++) {
      const heights = [0, ...(cuts.get(key(e, k)) ?? []).sort((a, b) => a - b), widthOf(e)];
      const [start, end] = [pts[k] as number, pts[k + 1] ?? lengthOf(e)];
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
  const arcs: { name: string; ends: ArcEnd[] }[] = [];
  for (const s of tt.graph.vertices) {
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
    arcs.push({ name: s.name, ends });
  }
  for (const e of tt.graph.edges)
    for (let k = 1; k < subBranchCount(e); k++) {
      const ends: ArcEnd[] = [];
      for (const piece of pieceDrafts.get(key(e, k)) as PieceDraft[])
        ends.push({ piece, leaves: true, side: "right", low: piece.bottom, high: piece.top });
      for (const piece of pieceDrafts.get(key(e, k - 1)) as PieceDraft[])
        ends.push({ piece, leaves: false, side: "left", low: piece.bottom, high: piece.top });
      arcs.push({ name: `${e.name}@${k}`, ends });
    }

  const switchOfEnd = new Map<PieceDraft, { start?: Vertex; end?: Vertex }>();
  const starOf = new Map<Vertex, ArcEnd[]>();
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
      const v = graph.addVertex(bounds.length > 2 ? `${arc.name}.${j}` : arc.name);
      starOf.set(v, inside);
      for (const x of inside) {
        const entry = switchOfEnd.get(x.piece) ?? {};
        if (x.leaves) entry.start = v;
        else entry.end = v;
        switchOfEnd.set(x.piece, entry);
      }
    }
  }

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
    const index = (pieceDrafts.get(key(piece.branch, piece.subBranch)) as PieceDraft[]).indexOf(piece);
    const name = many
      ? `${piece.branch.name}${subBranchCount(piece.branch) > 1 ? `_${piece.subBranch}` : ""}${index > 0 ? `'`.repeat(index) : ""}`
      : piece.branch.name;
    const edge = graph.addEdge(start, end, {
      name: /\p{L}/u.test(name) ? name : `x${name}`,
      color: piece.branch.color,
    });
    piece.edge = edge;
    kind.set(edge, tt.kind.get(piece.branch) as BranchKind);
    pieces.set(edge, {
      edge,
      branch: piece.branch,
      bottom: piece.bottom,
      top: piece.top,
      start: piece.start,
      end: piece.end,
    });
    newWidths.set(edge, piece.top - piece.bottom);
    newLengths.set(edge, piece.end - piece.start);
  }
  const side = new Map<OrientedEdge, "right" | "left">();
  for (const [v, ends] of starOf) {
    const orient = (x: ArcEnd) => {
      const edge = x.piece.edge as Edge;
      return x.leaves ? edge.forward : edge.backward;
    };
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
  for (const [edge, piece] of pieces) {
    const strand = strandOf.get(piece.branch);
    if (strand === undefined) throw new Error(`No strand for ${piece.branch}`);
    const [s0, s1] = [λ * piece.start, λ * piece.end];
    const scale = Math.max(1, s1);
    const image: OrientedEdge[] = [];
    let a = 0; // cumulative length along the path
    strand.path.forEach((c, i) => {
      const l = lengthOf(c.edge);
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
      const choose = (k: number) => {
        const candidate = piecesAt(c.edge, k).find(
          (p) => p.bottom <= low + TOLERANCE * w && high <= p.top + TOLERANCE * w,
        );
        if (candidate === undefined)
          throw new Error(`The image of a piece of ${piece.branch} doesn't fit into a piece of ${c.edge}`);
        const e = candidate.edge as Edge;
        image.push(c.isForward ? e.forward : e.backward);
      };
      if (tt.kind.get(c.edge) === "infinitesimal") {
        if (
          tt.kind.get(piece.branch) === "infinitesimal" ||
          (a >= s0 - TOLERANCE * scale && a < s1 - TOLERANCE * scale)
        )
          choose(0);
      } else {
        const [u0, u1] = [Math.max(s0, a) - a, Math.min(s1, a + l) - a];
        if (u1 - u0 > TOLERANCE * scale) {
          const [f0, f1] = c.isForward ? [u0, u1] : [l - u1, l - u0];
          const pts = points.get(c.edge) as number[];
          const ks = Array.from({ length: subBranchCount(c.edge) }, (_, k) => k).filter(
            (k) =>
              (pts[k] as number) >= f0 - TOLERANCE * Math.max(1, l) &&
              (pts[k + 1] ?? l) <= f1 + TOLERANCE * Math.max(1, l),
          );
          for (const k of c.isForward ? ks : ks.toReversed()) choose(k);
        }
      }
      a += l;
    });
    gPrime.setImage(edge.forward, EdgePath.from(image));
  }
  for (const v of graph.vertices) {
    const e = graph.star(v)[0];
    const first = e === undefined ? undefined : gPrime.image(e).first;
    if (first !== undefined) gPrime.setVertexImage(v, first.source);
  }

  const isOnSlit = (e: OrientedEdge) => {
    const piece = pieces.get(e.edge) as Piece;
    if (kind.get(e.edge) !== "real") return false;
    const h = e.isForward ? piece.bottom : piece.top;
    const w = widthOf(piece.branch);
    return h > TOLERANCE * w && h < w * (1 - TOLERANCE);
  };
  return { graph, gPrime, kind, widths: newWidths, lengths: newLengths, pieces, isOnSlit, side };
}
