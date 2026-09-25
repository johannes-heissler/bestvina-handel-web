/**
 * The half-translation surface TS(τ) seen combinatorially: heights along the singular arcs of the switches, and
 * the singular leaves (prongs) of the unstable foliation as train paths with width positions. Groundwork for
 * the closed-surface move (the thesis, § "Closed surfaces and cutting").
 *
 * Conventions (the thesis, Move "TrackToHalfTrS"): at a switch, the real branches are on the right, stacked from
 * bottom to top in the cyclic order, and the infinitesimal branches on the left. Since τ lists the star of a
 * switch counterclockwise as [real branches, infinitesimal branches], the real ones appear bottom to top and the
 * infinitesimal ones top to bottom. The rectangle of ē is the rectangle of e rotated by 180°, so height y (from
 * the bottom of e at its start) is height w(e) − y at its end.
 *
 * @module
 */
import { EdgePath } from "../graph/edge-path";
import type { OrientedEdge, Vertex } from "../graph/ribbon-graph";
import type { TrainTrack } from "./train-track";

/** A branch end at a switch with its height interval on the singular arc of the switch. */
export interface ArcInterval {
  readonly end: OrientedEdge;
  readonly bottom: number;
  readonly top: number;
}

/** The singular arc of a switch: the intervals of its real and of its infinitesimal branch ends. */
export interface SwitchArc {
  readonly real: readonly ArcInterval[];
  readonly infinitesimal: readonly ArcInterval[];
  /** The total width (equal on both sides by the switch equation). */
  readonly width: number;
}

/** The singular arc of the switch `s`. Requires the widths of τ. */
export function switchArc(tt: TrainTrack, s: Vertex): SwitchArc {
  const widths = requireWidths(tt);
  const star = tt.graph.star(s);
  const stack = (ends: readonly OrientedEdge[]): ArcInterval[] => {
    let height = 0;
    return ends.map((end) => {
      const bottom = height;
      height += widths.get(end.edge) as number;
      return { end, bottom, top: height };
    });
  };
  const real = stack(star.filter((e) => tt.kind.get(e.edge) === "real"));
  const infinitesimal = stack(star.filter((e) => tt.kind.get(e.edge) === "infinitesimal").toReversed());
  return { real, infinitesimal, width: real.at(-1)?.top ?? 0 };
}

/**
 * A prong: one of the horizontal singular leaves starting at the singularity of an infinitesimal polygon. It
 * starts at the corner between two consecutive infinitesimal branches of the polygon on the arc of `atSwitch`.
 */
export interface Prong {
  readonly atSwitch: Vertex;
  /** The infinitesimal branch end just above the corner, and the one just below (its σ-successor). */
  readonly above: OrientedEdge;
  readonly below: OrientedEdge;
}

/** All prongs: one for each cusp of each infinitesimal polygon of τ. */
export function prongs(tt: TrainTrack): Prong[] {
  return tt
    .boundaryWords()
    .filter((b) => b.infinitesimal)
    .flatMap((b) =>
      b.word.letters.map((x, i) => {
        const y = b.word.letters[(i + 1) % b.word.length] as OrientedEdge;
        return { atSwitch: y.source, above: x.reversed, below: y };
      }),
    );
}

/** The image of a prong under f: the prong between the images of its two infinitesimal branches. */
export function imageProng(tt: TrainTrack, prong: Prong): Prong {
  const image = (e: OrientedEdge) => tt.gTau.image(e).first as OrientedEdge;
  return {
    atSwitch: tt.gTau.vertexImage(prong.atSwitch),
    above: image(prong.above),
    below: image(prong.below),
  };
}

/** A traced initial segment of a leaf; see {@link traceLeaf}. */
export interface Leaf {
  /** The train path of the leaf: real and infinitesimal branches alternating, starting with a real one. */
  readonly path: EdgePath;
  /** For each branch of `path`, the height of the leaf above the bottom of the branch at its start. */
  readonly positions: readonly number[];
  /** The total length (the sum of the lengths of the real branches). Only if lengths are known. */
  readonly realBranches: number;
  /** Set if the leaf ran into a corner (it would continue into a singularity: a saddle connection). */
  readonly singular: boolean;
}

/**
 * Traces the prong through `realBranches` real branches: into the real branch whose interval contains the
 * starting height, along it, over to the infinitesimal side of the next switch, along the infinitesimal branch
 * whose interval contains the height there, and so on.
 */
export function traceLeaf(tt: TrainTrack, prong: Prong, realBranches: number): Leaf {
  const widths = requireWidths(tt);
  const startArc = switchArc(tt, prong.atSwitch);
  const corner = startArc.infinitesimal.find((i) => i.end === prong.below);
  if (corner === undefined) throw new Error("The prong's lower branch doesn't start at its switch");

  const path: OrientedEdge[] = [];
  const positions: number[] = [];
  let [s, height, side] = [prong.atSwitch, corner.top, "real" as "real" | "infinitesimal"];
  let count = 0;
  let singular = false;
  const tolerance = 1e-12 * Math.max(1, startArc.width);
  while (count < realBranches) {
    const arc = switchArc(tt, s);
    const interval = arc[side].find((i) => i.bottom - tolerance < height && height < i.top + tolerance);
    if (interval === undefined) throw new Error(`Height ${height} is not on the arc of ${s}`);
    const y = height - interval.bottom;
    if (y < tolerance || interval.top - height < tolerance) {
      singular = true; // exactly at a corner
      break;
    }
    path.push(interval.end);
    positions.push(y);
    if (side === "real") count++;
    // Along the branch to its other switch, where the height is measured from the other side.
    const next = interval.end.target;
    const w = widths.get(interval.end.edge) as number;
    const nextArc = switchArc(tt, next);
    const arrival = nextArc[side].find((i) => i.end === interval.end.reversed) as ArcInterval;
    [s, height, side] = [next, arrival.bottom + (w - y), side === "real" ? "infinitesimal" : "real"];
  }
  return { path: EdgePath.from(path), positions, realBranches: count, singular };
}

function requireWidths(tt: TrainTrack) {
  if (tt.widths === undefined) throw new Error("τ has no widths (the growth is not > 1)");
  return tt.widths;
}
