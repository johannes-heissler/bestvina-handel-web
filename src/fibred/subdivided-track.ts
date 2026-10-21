/**
 * τ with its real branches subdivided at finitely many points, and g_τ written in the sub-branches: τ* with g_* (the
 * subdivision move of Bestvina–Handel, on τ). Cutting along a leaf needs the points where its preimages end: f⁻ʲ(L)
 * ends at the point mapped to the end of f⁻⁽ʲ⁻¹⁾(L). Once that end is a point of τ* (a switch or a subdivision point),
 * the next one is a boundary between two letters of the image of one sub-branch: subdividing one after the other
 * locates every end exactly, without lengths (which span λ^(P−1) and can't be resolved in floating point).
 *
 * Sub-branches carry approximate positions along their branch (from the Perron–Frobenius lengths), only for drawing.
 *
 * @module
 */
import type { Edge, OrientedEdge } from "../graph/ribbon-graph";
import type { TrainTrack } from "./train-track";

/** A part of a real branch of τ between two consecutive subdivision points (or switches). */
export interface SubBranch {
  readonly branch: Edge;
  /** Its letters in both directions. */
  readonly forward: Letter;
  readonly backward: Letter;
  /** Its position along the branch (lengths from the start of the branch; approximate, for drawing only). */
  readonly start: number;
  readonly end: number;
}

/** A letter of τ*: an oriented sub-branch, or an oriented infinitesimal branch of τ. */
export interface Letter {
  /** The oriented branch of τ it lies in. */
  readonly tau: OrientedEdge;
  /** The sub-branch (undefined for an infinitesimal branch). */
  readonly sub: SubBranch | undefined;
  readonly isForward: boolean;
  /** The same letter in the other direction. */
  readonly reversed: Letter;
}

export class SubdividedTrack {
  /** The sub-branches of each real branch, along it. */
  private readonly subs = new Map<Edge, SubBranch[]>();
  /** g_* of each sub-branch, forward. */
  private readonly images = new Map<SubBranch, Letter[]>();
  private readonly infinitesimal = new Map<OrientedEdge, Letter>();
  /** Paths kept up to date when a sub-branch is subdivided (e.g. the slits). */
  private readonly kept: Letter[][] = [];

  constructor(readonly tt: TrainTrack) {
    for (const e of tt.graph.edges) {
      if (tt.kind.get(e) === "real") this.subs.set(e, [this.newSub(e, 0, tt.lengths.get(e) ?? 0)]);
      else {
        const forward = { tau: e.forward, sub: undefined, isForward: true } as Letter & { reversed: Letter };
        const backward = { tau: e.backward, sub: undefined, isForward: false, reversed: forward } as Letter;
        forward.reversed = backward;
        this.infinitesimal.set(e.forward, forward);
        this.infinitesimal.set(e.backward, backward);
      }
    }
    for (const [e, [sub]] of this.subs)
      this.images.set(sub as SubBranch, this.expand(tt.gTau.image(e.forward).letters));
  }

  private newSub(branch: Edge, start: number, end: number): SubBranch {
    const sub = { branch, start, end } as SubBranch & { forward: Letter; backward: Letter };
    const forward = { tau: branch.forward, sub, isForward: true } as Letter & { reversed: Letter };
    const backward = { tau: branch.backward, sub, isForward: false, reversed: forward } as Letter;
    forward.reversed = backward;
    sub.forward = forward;
    sub.backward = backward;
    return sub;
  }

  /** The sub-branches of the real branch `e`, along it. */
  subBranches(e: Edge): readonly SubBranch[] {
    return this.subs.get(e) ?? [];
  }

  /** The index of a sub-branch among those of its branch. */
  indexOf(sub: SubBranch): number {
    return this.subBranches(sub.branch).indexOf(sub);
  }

  /** A path of τ in letters of τ*: each real branch becomes its sub-branches. */
  expand(path: readonly OrientedEdge[]): Letter[] {
    return path.flatMap((x) => {
      if (!this.subs.has(x.edge)) return [this.infinitesimal.get(x) as Letter];
      const subs = this.subs.get(x.edge) as SubBranch[];
      return x.isForward ? subs.map((s) => s.forward) : subs.toReversed().map((s) => s.backward);
    });
  }

  /** g_* of a letter. */
  image(x: Letter): Letter[] {
    if (x.sub === undefined) return this.expand(this.tt.gTau.image(x.tau).letters);
    const image = this.images.get(x.sub) as Letter[];
    return x.isForward ? [...image] : image.toReversed().map((y) => y.reversed);
  }

  /** Keeps `path` up to date when sub-branches are subdivided later (the array is changed in place). */
  keep(path: Letter[]): Letter[] {
    this.kept.push(path);
    return path;
  }

  /**
   * Subdivides the sub-branch of the real letter `x` after the first `k` letters of its image (0 < k < its length):
   * at the point mapped to the vertex there. Returns the two parts as letters in the direction of `x`.
   */
  subdivide(x: Letter, k: number): [Letter, Letter] {
    const sub = x.sub;
    if (sub === undefined) throw new Error("Only real branches are subdivided");
    const image = this.images.get(sub) as Letter[];
    const m = x.isForward ? k : image.length - k; // the boundary in the forward image
    if (m <= 0 || m >= image.length) throw new Error("A subdivision must lie inside the sub-branch");
    // The position (for drawing): the length of the image before the boundary, divided by λ.
    const lengthOf = (y: Letter) => (y.sub === undefined ? 0 : y.sub.end - y.sub.start);
    const before = image.slice(0, m).reduce((l, y) => l + lengthOf(y), 0);
    const total = image.reduce((l, y) => l + lengthOf(y), 0);
    const at = sub.start + (total > 0 ? (before / total) * (sub.end - sub.start) : (sub.end - sub.start) / 2);
    const [first, second] = [this.newSub(sub.branch, sub.start, at), this.newSub(sub.branch, at, sub.end)];
    const list = this.subs.get(sub.branch) as SubBranch[];
    list.splice(list.indexOf(sub), 1, first, second);
    this.images.delete(sub);
    this.images.set(first, image.slice(0, m));
    this.images.set(second, image.slice(m));
    const replace = (path: Letter[]) => {
      for (let i = path.length - 1; i >= 0; i--) {
        const y = path[i] as Letter;
        if (y === sub.forward) path.splice(i, 1, first.forward, second.forward);
        else if (y === sub.backward) path.splice(i, 1, second.backward, first.backward);
      }
    };
    for (const path of this.images.values()) replace(path);
    for (const path of this.kept) replace(path);
    return x.isForward ? [first.forward, second.forward] : [second.backward, first.backward];
  }
}
