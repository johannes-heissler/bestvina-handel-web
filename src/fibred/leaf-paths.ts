/**
 * The train paths of the singular leaves, found combinatorially from g_τ (instead of tracing heights in floating
 * point, which takes a wrong turn where a leaf passes very close to the boundary of a branch).
 *
 * The leaf L of a prong π of period P (f^P(π) = π) satisfies f^P(L) ⊃ L: the image of an initial segment of L is a
 * longer initial segment. So L is found by iterating g_τ^P from its first branch. That branch is where the real
 * branches at the prong's switch all end up under Dg_τ^P (the first letter of g_τ^P): f^P maps the singular arc of the
 * switch into itself, shrunk by λ^P towards the corner of the prong. If two branches are left, the corner lies at the
 * boundary between them: the leaf runs into a cusp (a saddle connection).
 *
 * @module
 */
import type { OrientedEdge } from "../graph/ribbon-graph";
import { imageProng, type Prong, switchArc } from "./singular-leaves";
import type { TrainTrack } from "./train-track";

const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;

/** The period of a prong under f (the number of prongs in its orbit). */
export function prongPeriod(tt: TrainTrack, prong: Prong): number {
  let period = 1;
  for (let p = imageProng(tt, prong); !same(p, prong); p = imageProng(tt, p)) {
    period++;
    if (period > tt.graph.edgeCount * 2 + 2) throw new Error("The prong isn't periodic");
  }
  return period;
}

/**
 * The real branch through which the leaf of `prong` leaves its switch, or undefined if the leaf runs into a cusp
 * right away (a saddle connection).
 */
export function firstBranch(
  tt: TrainTrack,
  prong: Prong,
  period = prongPeriod(tt, prong),
): OrientedEdge | undefined {
  const firstOfPower = (x: OrientedEdge) => {
    let y = x;
    for (let i = 0; i < period; i++) y = tt.gTau.image(y).first as OrientedEdge;
    return y;
  };
  // The images shrink to the periodic part of Dg_τ^P on these ends within as many steps as there are ends.
  let ends = new Set(switchArc(tt, prong.atSwitch).real.map((i) => i.end));
  for (let k = ends.size; k > 0; k--) ends = new Set([...ends].map(firstOfPower));
  return ends.size === 1 ? ([...ends][0] as OrientedEdge) : undefined;
}

/** The real branches of a path. */
export function realCount(tt: TrainTrack, path: readonly OrientedEdge[]): number {
  return path.reduce((n, x) => n + (tt.kind.get(x.edge) === "real" ? 1 : 0), 0);
}

/** The initial segment of a path through `max` real branches (with the infinitesimal branches between them). */
export function throughRealBranches(
  tt: TrainTrack,
  path: readonly OrientedEdge[],
  max: number,
): OrientedEdge[] {
  let count = 0;
  const last = path.findIndex((x) => tt.kind.get(x.edge) === "real" && ++count === max);
  return last < 0 ? [...path] : path.slice(0, last + 1);
}

/**
 * The train path of the leaf of `prong` (real and infinitesimal branches alternating, starting and ending with a real
 * one), long enough that `enough` holds for it, or undefined for a saddle connection. `enough` must hold for every
 * long enough path (e.g. "at least n real branches").
 *
 * @throws Error if an image of the leaf isn't an extension of it (g_τ would be inconsistent with the leaf).
 */
export function leafPath(
  tt: TrainTrack,
  prong: Prong,
  enough: (path: readonly OrientedEdge[]) => boolean,
): OrientedEdge[] | undefined {
  const period = prongPeriod(tt, prong);
  const first = firstBranch(tt, prong, period);
  if (first === undefined) return undefined;
  let path = [first];
  for (let step = 0; !enough(path); step++) {
    if (step > 10_000) throw new Error("The leaf doesn't grow under g_τ");
    // g_τ^P, cut back after each application to what the next one needs: the image of an initial segment of a leaf
    // is an initial segment of the image leaf, so the result is an initial segment of L either way.
    const keep = 2 * realCount(tt, path) + 2;
    let image = path;
    for (let i = 0; i < period; i++)
      image = throughRealBranches(
        tt,
        image.flatMap((x) => tt.gTau.image(x).letters),
        keep,
      );
    if (image.length < path.length || path.some((x, i) => image[i] !== x))
      throw new Error("The image of the leaf under g_τ^P doesn't extend it");
    if (image.length === path.length) throw new Error("The leaf doesn't grow under g_τ");
    path = image;
  }
  return path;
}

/** {@link leafPath} through (at least) `count` real branches, cut back to exactly `count`. */
export function leafThroughRealBranches(
  tt: TrainTrack,
  prong: Prong,
  count: number,
): OrientedEdge[] | undefined {
  const path = leafPath(tt, prong, (p) => realCount(tt, p) >= count);
  return path && throughRealBranches(tt, path, count);
}
