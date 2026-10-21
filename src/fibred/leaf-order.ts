/**
 * The order of horizontal leaves across the branches of τ, decided combinatorially: every position the cut needs is a
 * point on the leaf of a prong (a {@link LeafPoint}), and two points in the same branch are compared by following
 * both leaves until they leave a switch by different branches (the thesis's half-translation surface TS(τ), without
 * its heights).
 *
 * Conventions as in `singular-leaves.ts`: on the arc of a switch, the real branch ends are stacked from bottom to top
 * in the order of the star, the infinitesimal ones in the reversed order; a height in a branch is measured from its
 * bottom in the direction of traversal, so traversing a branch reverses the order (the rectangle of ē is that of e
 * rotated by 180°), and crossing an arc keeps it.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { firstBranch, prongPeriod } from "./leaf-paths";
import { imageProng, type Prong, prongs } from "./singular-leaves";
import type { TrainTrack } from "./train-track";

/** A point on the leaf of a prong: in the branch `index` of its train path (anywhere along that branch). */
export interface LeafPoint {
  /** The index of the prong in {@link LeafPoints.prongs}. */
  readonly prong: number;
  readonly index: number;
}

/** The leaves of all prongs of τ, extended as needed, and the order of their points. */
export class LeafPoints {
  readonly prongs: readonly Prong[];
  private readonly paths: OrientedEdge[][];
  private readonly images: number[];
  private readonly periods: number[] = [];
  /** For each prong: the start of the image of each branch of its leaf in the leaf of the image prong. */
  private readonly offsets: number[][];
  private readonly arcIndex = new Map<OrientedEdge, number>();

  constructor(readonly tt: TrainTrack) {
    this.prongs = prongs(tt);
    this.paths = this.prongs.map(() => []);
    this.offsets = this.prongs.map(() => [0]);
    this.images = this.prongs.map((p) => this.indexOf(imageProng(tt, p)));
    // The position of each branch end on the arc of its switch, from bottom to top on its side.
    for (const s of tt.graph.vertices) {
      const star = tt.graph.star(s);
      star.filter((e) => tt.kind.get(e.edge) === "real").forEach((e, i) => this.arcIndex.set(e, i));
      star
        .filter((e) => tt.kind.get(e.edge) === "infinitesimal")
        .toReversed()
        .forEach((e, i) => this.arcIndex.set(e, i));
    }
  }

  /** The index of a prong (prongs are compared by their switch and the branch below their corner). */
  indexOf(prong: Prong): number {
    const i = this.prongs.findIndex((p) => p.atSwitch === prong.atSwitch && p.below === prong.below);
    if (i < 0) throw new Error("Unknown prong");
    return i;
  }

  /** The index of the image prong under f. */
  imageProng(prong: number): number {
    return this.images[prong] as number;
  }

  /**
   * The train path of the leaf of a prong, through at least `length` branches. It is extended by g_τ^P (P the period
   * of the prong): the image of an initial segment of the leaf is a longer one (see `leaf-paths.ts`).
   */
  path(prong: number, length: number): readonly OrientedEdge[] {
    let path = this.paths[prong] as OrientedEdge[];
    if (path.length >= length) return path;
    const p = this.prongs[prong] as Prong;
    const period = (this.periods[prong] ??= prongPeriod(this.tt, p));
    if (path.length === 0) {
      const first = firstBranch(this.tt, p, period);
      if (first === undefined)
        throw new Error("The leaf of a prong runs into a corner (a saddle connection)");
      path = [first];
    }
    while (path.length < length) {
      const wanted = Math.max(length, 2 * path.length);
      let image = path;
      for (let i = 0; i < period; i++)
        image = image.flatMap((x) => this.tt.gTau.image(x).letters).slice(0, wanted);
      if (image.length <= path.length || path.some((x, i) => image[i] !== x))
        throw new Error("The image of the leaf under g_τ^P doesn't extend it");
      path = image;
    }
    this.paths[prong] = path;
    return path;
  }

  /** The branch of τ (in the direction of the leaf) that a point lies in. */
  letter(p: LeafPoint): OrientedEdge {
    return this.path(p.prong, p.index + 1)[p.index] as OrientedEdge;
  }

  /**
   * The image of a point under f, in the `n`-th branch of g_τ of its branch (in the direction of the leaf): a point on
   * the leaf of the image prong, whose train path begins with g_τ of this one.
   */
  image(p: LeafPoint, n: number): LeafPoint {
    const offsets = this.offsets[p.prong] as number[];
    const path = this.path(p.prong, p.index + 1);
    for (let i = offsets.length - 1; i <= p.index; i++)
      offsets.push((offsets[i] as number) + this.tt.gTau.image(path[i] as OrientedEdge).length);
    const image = { prong: this.images[p.prong] as number, index: (offsets[p.index] as number) + n };
    const expected = this.tt.gTau.image(path[p.index] as OrientedEdge).letters[n];
    if (expected === undefined || this.letter(image) !== expected)
      throw new Error("The leaf of the image prong doesn't begin with the image of the leaf");
    return image;
  }

  /**
   * The order of two points in the same branch, across it: negative if p lies below q, seen in the direction of
   * `frame` (an orientation of their branch), 0 if they are the same point.
   *
   * Both leaves are followed until they leave a switch by different branches, or one of them reaches its prong. That
   * works in both directions along the branch (seen the other way, the order is reversed); two leaves can run side by
   * side for very long in one direction (e.g. one passing close to the corner where the other starts), so both
   * directions are tried, with a growing number of steps.
   */
  compare(p: LeafPoint, q: LeafPoint, frame: OrientedEdge): number {
    if (p.prong === q.prong && p.index === q.index) return 0;
    const [x, y] = [this.letter(p), this.letter(q)];
    if (x.edge !== frame.edge || y.edge !== frame.edge)
      throw new Error("Only points in the same branch are compared");
    for (let steps = 64; steps <= 1 << 22; steps *= 4) {
      const forward = this.compareAlong(p, q, frame, steps);
      if (forward !== undefined) return forward;
      const backward = this.compareAlong(p, q, frame.reversed, steps);
      if (backward !== undefined) return -backward;
    }
    throw new Error("Two leaves don't part");
  }

  /** {@link compare}, following the leaves in the direction of `frame` for at most `steps` branches. */
  private compareAlong(p: LeafPoint, q: LeafPoint, frame: OrientedEdge, steps: number): number | undefined {
    // Each leaf, from its point on, in the direction of `frame`: forward along its path, or back towards its prong
    // (`undefined` at the prong's corner).
    const walk = (point: LeafPoint, along: boolean) => (k: number) => {
      if (along) return this.path(point.prong, point.index + k + 1)[point.index + k] as OrientedEdge;
      const i = point.index - k;
      return i < 0 ? undefined : (this.path(point.prong, i + 1)[i] as OrientedEdge).reversed;
    };
    const [a, b] = [walk(p, this.letter(p) === frame), walk(q, this.letter(q) === frame)];
    for (let k = 1; k <= steps; k++) {
      const [u, v] = [a(k), b(k)];
      if (u === v) continue;
      // k branches traversed since the start: each reverses the order.
      const sign = k % 2 === 0 ? 1 : -1;
      const s = u?.source ?? v?.source ?? (this.prongs[p.prong] as Prong).atSwitch;
      return sign * (this.arcHeight(s, u, p) - this.arcHeight(s, v, q));
    }
    return undefined;
  }

  /**
   * The height of a leaf on the arc of `s` where it continues along `next` (its index on that side, as a half-integer
   * between the ends), or of the corner of the prong of `point` if the leaf starts there (`next` undefined).
   */
  private arcHeight(s: Vertex, next: OrientedEdge | undefined, point: LeafPoint): number {
    if (next !== undefined) return 2 * (this.arcIndex.get(next) as number) + 1;
    const prong = this.prongs[point.prong] as Prong;
    if (prong.atSwitch !== s) throw new Error("A leaf ends away from its prong");
    // The corner lies at the top of the infinitesimal branch end below it.
    return 2 * (this.arcIndex.get(prong.below) as number) + 2;
  }

  /** `count` points of the leaves of the prongs in the branch `e` (the first ones along the leaves). */
  pointsIn(e: Edge, count: number): LeafPoint[] {
    const found: LeafPoint[] = [];
    for (let length = 32; length <= 1 << 16; length *= 4) {
      found.length = 0;
      for (let prong = 0; prong < this.prongs.length && found.length < count; prong++) {
        const path = this.path(prong, length);
        for (let i = 0; i < length && found.length < count; i++)
          if ((path[i] as OrientedEdge).edge === e) found.push({ prong, index: i });
      }
      if (found.length === count) return found;
    }
    throw new Error(`No leaf of a prong runs through ${e}`);
  }
}

const cache = new WeakMap<TrainTrack, LeafPoints>();

/** The {@link LeafPoints} of τ (shared, since the leaves are extended on demand). */
export function leafPoints(tt: TrainTrack): LeafPoints {
  let points = cache.get(tt);
  if (points === undefined) {
    points = new LeafPoints(tt);
    cache.set(tt, points);
  }
  return points;
}
