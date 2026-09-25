/**
 * Where the images f(R_b) of the rectangles of τ lie inside the branches they cross. Needed to define the
 * carrying map after cutting the half-translation surface TS(τ) (the thesis, § "The cutting move": "the width
 * position of the image of the corresponding rectangle R_{e′} in the rectangles R_{g(e′)} has to be kept track of").
 *
 * f contracts vertical segments by 1/λ and maps the singular arc of each switch s into the arc of g_τ(s):
 * height h ↦ c_s + h/λ. The offsets c_s are fixed by the prong corners, which f maps to prong corners, and
 * propagated along the branches. The image of a rectangle is then a strip of width w(b)/λ whose lower edge is a
 * horizontal leaf segment, traced like the prongs.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { imageProng, prongs, switchArc, type ArcInterval } from "./singular-leaves";
import type { TrainTrack } from "./train-track";

type Side = "real" | "infinitesimal";

/** The image strip of a branch: the path g_τ(b) and, in each of its branches, the height of the strip's lower edge. */
export interface Strand {
  /** The branch b, forward orientation. */
  readonly branch: Edge;
  /** g_τ(b). */
  readonly path: readonly OrientedEdge[];
  /** For each branch of `path`, the height of the strip's lower edge above the bottom of that branch (in the direction of traversal). */
  readonly offsets: readonly number[];
  /** w(b)/λ. */
  readonly width: number;
}

/** The side of a switch that a branch end belongs to. */
function sideOf(tt: TrainTrack, e: OrientedEdge): Side {
  return tt.kind.get(e.edge) === "real" ? "real" : "infinitesimal";
}

/** The interval of the branch end `e` on the arc of its source. */
function intervalOf(tt: TrainTrack, e: OrientedEdge): ArcInterval {
  const interval = switchArc(tt, e.source)[sideOf(tt, e)].find((i) => i.end === e);
  if (interval === undefined) throw new Error(`${e} is not on the arc of ${e.source}`);
  return interval;
}

/**
 * Follows a horizontal leaf from height `height` on side `side` of the arc of `s` through `steps` branches.
 * Returns the branches and the height within each branch (above its bottom, in the direction of traversal),
 * and the arrival height on the last arc.
 */
export function followLeaf(
  tt: TrainTrack,
  s: Vertex,
  side: Side,
  height: number,
  steps: number,
): { path: OrientedEdge[]; heights: number[]; arrivalHeight: number; arrivalSwitch: Vertex } {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const path: OrientedEdge[] = [];
  const heights: number[] = [];
  let [x, h, sd] = [s, height, side];
  for (let i = 0; i < steps; i++) {
    const interval = switchArc(tt, x)[sd].find((j) => j.bottom <= h && h <= j.top);
    if (interval === undefined) throw new Error(`Height ${h} is not on the ${sd} side of ${x}`);
    const y = h - interval.bottom;
    path.push(interval.end);
    heights.push(y);
    const arrival = intervalOf(tt, interval.end.reversed);
    [x, h, sd] = [
      interval.end.target,
      arrival.bottom + ((widths.get(interval.end.edge) as number) - y),
      sd === "real" ? "infinitesimal" : "real",
    ];
  }
  return { path, heights, arrivalHeight: h, arrivalSwitch: x };
}

/**
 * The offsets c_s: f maps height h on the arc of s to height c_s + h/λ on the arc of g_τ(s).
 *
 * @throws Error if some switch can't be reached from a switch with a prong corner.
 */
export function arcOffsets(tt: TrainTrack): Map<Vertex, number> {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const λ = tt.growth;
  const offsets = new Map<Vertex, number>();
  const cornerHeight = (p: { atSwitch: Vertex; below: OrientedEdge }) =>
    (switchArc(tt, p.atSwitch).infinitesimal.find((i) => i.end === p.below) as ArcInterval).top;
  for (const prong of prongs(tt))
    offsets.set(prong.atSwitch, cornerHeight(imageProng(tt, prong)) - cornerHeight(prong) / λ);

  // Propagate along branches: trace the image of the branch's middle leaf from s to t.
  const queue = [...offsets.keys()];
  for (let s = queue.shift(); s !== undefined; s = queue.shift())
    for (const e of tt.graph.star(s)) {
      const t = e.target;
      if (offsets.has(t)) continue;
      const w = widths.get(e.edge) as number;
      const image = tt.gTau.image(e);
      const start = (offsets.get(s) as number) + (intervalOf(tt, e).bottom + w / 2) / λ;
      const { arrivalHeight } = followLeaf(tt, tt.gTau.vertexImage(s), sideOf(tt, e), start, image.length);
      offsets.set(t, arrivalHeight - (intervalOf(tt, e.reversed).bottom + w / 2) / λ);
      queue.push(t);
    }
  if (offsets.size !== tt.graph.vertexCount) throw new Error("Some switches are not connected to a prong");
  return offsets;
}

/**
 * The image strand of every branch. The lower edge is traced through the middle of the strand, so that it never
 * runs exactly along a boundary between two branches.
 *
 * @throws Error if a traced strand doesn't follow g_τ(b) (which would mean inconsistent widths or orientations).
 */
export function strands(
  tt: TrainTrack,
  offsets: ReadonlyMap<Vertex, number> = arcOffsets(tt),
): Map<Edge, Strand> {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const λ = tt.growth;
  const result = new Map<Edge, Strand>();
  for (const branch of tt.graph.edges) {
    const e = branch.forward;
    const width = (widths.get(branch) as number) / λ;
    const image = tt.gTau.image(e).letters;
    const middle = (offsets.get(e.source) as number) + intervalOf(tt, e).bottom / λ + width / 2;
    const { path, heights } = followLeaf(
      tt,
      tt.gTau.vertexImage(e.source),
      sideOf(tt, e),
      middle,
      image.length,
    );
    if (path.some((x, i) => x !== image[i]))
      throw new Error(
        `The image strand of ${branch} runs along ${path.join(" ")} instead of g_τ = ${image.join(" ")}`,
      );
    result.set(branch, { branch, path, offsets: heights.map((h) => h - width / 2), width });
  }
  return result;
}
