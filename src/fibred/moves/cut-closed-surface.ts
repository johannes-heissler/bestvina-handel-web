/**
 * Closed surfaces, the thesis's way: cut TS(τ) along a singular leaf until the boundary word B of the artificial
 * puncture p is a circle attached at a single switch, then remove B (the thesis, § "Closed surfaces and cutting",
 * Move "Cutting along a singular leaf" and Lemma "Removing an almost peripheral subgraph").
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { cut, type CutTrack, slitsForProng, traceProngThroughBranches } from "../cut-along-leaf";
import { FibredSurface } from "../fibred-surface";
import { imageProng, type Prong, prongs } from "../singular-leaves";
import type { TrainTrack } from "../train-track";
import { collapseSubforest } from "./collapse-forest";

/**
 * The boundary word of p in the cut track: the one that contains a real branch and runs along no slit (the sides
 * of the slits belong to the new punctures at the singularities). `undefined` if there isn't exactly one.
 */
export function punctureWord(ct: CutTrack): EdgePath | undefined {
  const words = ct.graph
    .boundaryWords()
    .filter((w) => w.letters.some((x) => ct.kind.get(x.edge) === "real") && !w.letters.some(ct.isOnSlit));
  return words.length === 1 ? words[0] : undefined;
}

/**
 * If the boundary word B is a circle attached to the rest of the graph at a single switch (every other switch
 * along it has valence 2, and no branch occurs twice), that switch. This is the situation of the Lemma "Removing
 * an almost peripheral subgraph".
 */
export function attachmentSwitch(ct: CutTrack, word: EdgePath): Vertex | undefined {
  if (new Set(word.letters.map((x) => x.edge)).size !== word.length) return undefined;
  const attached = word.letters.map((x) => x.target).filter((s) => ct.graph.valence(s) > 2);
  return attached.length === 1 ? attached[0] : undefined;
}

/**
 * Removes the circle B attached at the switch v: everything mapped into B is isotoped into v, i.e. the branches of B
 * are deleted from all images (and switches mapped into B are mapped to v), then B is deleted except for v. Filling
 * in p, this is a homotopy equivalence, so the result is a spine of Σ ∖ Q carrying the same f. Its μ is reset.
 */
export function removeAlmostPeripheralCircle(ct: CutTrack, word: EdgePath, v: Vertex): FibredSurface {
  const { graph, gPrime: g } = ct;
  const circle = new Set(word.letters.map((x) => x.edge));
  const inner = new Set(word.letters.map((x) => x.target).filter((s) => s !== v));
  g.substituteInImages((e) => (circle.has(e) ? EdgePath.EMPTY : undefined));
  for (const s of graph.vertices) if (inner.has(g.vertexImage(s))) g.setVertexImage(s, v);
  for (const e of circle) {
    graph.removeEdge(e);
    g.forgetEdge(e);
  }
  for (const s of inner) {
    graph.removeVertex(s);
    g.forgetVertex(s);
  }
  // The infinitesimal polygons of the singularities that were not cut bound disks, not punctures, so the graph is
  // not yet a spine of Σ ∖ Q: fill each disk in by deleting one of its branches ε, which is homotopic to the rest ω of
  // the polygon reversed (the polygon reads ε ω).
  const disks = graph
    .boundaryWords()
    .filter((w) => w.letters.every((x) => ct.kind.get(x.edge) === "infinitesimal"));
  const remnants = new Set<Edge>();
  for (const disk of disks) {
    const [x] = disk.letters as [OrientedEdge];
    const rest = disk.slice(1);
    const forwardImage = x.isForward ? rest.inverse : rest;
    g.substituteInImages((e) => (e === x.edge ? forwardImage : undefined));
    graph.removeEdge(x.edge);
    g.forgetEdge(x.edge);
    for (const y of rest) remnants.add(y.edge);
  }
  // The rest of each such polygon is a path of infinitesimal strips; collapsing it turns the polygon back into
  // the junction it came from (the thesis treats these polygons as junctions implicitly).
  const surface = new FibredSurface({ graph, g });
  if (remnants.size > 0) collapseSubforest(surface, remnants);
  return surface;
}

/** The result of {@link cutClosedSurface}. */
export interface ClosedSurfaceCut {
  /** The fibred surface on Σ ∖ Q after removing B. */
  readonly surface: FibredSurface;
  /** The prong that was cut along, and through how many real branches. */
  readonly prong: Prong;
  readonly realBranches: number;
  /** The cut track. Its graph and carrying map are reused (and changed) by `surface`. */
  readonly cut: CutTrack;
}

/**
 * The prongs of the singularities in the orbit of `junction` (a junction of G with an infinitesimal polygon): the
 * candidates for L. The thesis allows any of them; which one reaches the goal first depends on the leaf.
 */
export function prongsOfOrbit(tt: TrainTrack, junction: Vertex): Prong[] {
  const all = prongs(tt);
  // The junctions of the orbit: those of the images of a prong at the junction.
  const junctions = new Set<Vertex>();
  let prong = all.find((p) => tt.junctionOf.get(p.atSwitch) === junction);
  for (let i = 0; prong !== undefined && i < all.length; i++, prong = imageProng(tt, prong))
    junctions.add(tt.junctionOf.get(prong.atSwitch) as Vertex);
  return all.filter((p) => junctions.has(tt.junctionOf.get(p.atSwitch) as Vertex));
}

/**
 * How much shorter than L its shortest preimage slit is: λ^(P−1) for the period P of the prongs of the orbit of
 * `junction` (see `slitsForProng`). The cut computes in floating point with a tolerance of 1e-9, so beyond about
 * 1e10 the short preimages can't be resolved and no cut is found (e.g. a period-4 orbit of 3-pronged singularities
 * with λ ≈ 22.5: λ¹¹ ≈ 10¹⁵).
 */
export function preimageShrinking(tt: TrainTrack, junction: Vertex): number {
  const prong = prongsOfOrbit(tt, junction)[0];
  if (prong === undefined) return 1;
  const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;
  let period = 1;
  for (let p = imageProng(tt, prong); !same(p, prong) && period < 10_000; p = imageProng(tt, p)) period++;
  return tt.growth ** (period - 1);
}

/** Whether the cut from this orbit is beyond what the floating-point cut can resolve ({@link preimageShrinking}). */
export function cutTooFine(tt: TrainTrack, junction: Vertex): boolean {
  return preimageShrinking(tt, junction) > 1e10;
}

/**
 * The switches along the boundary word of p that still have valence > 2, i.e. where the cut hasn't yet separated
 * a thin ring along p's boundary; empty when B is a circle attached at one switch plus that one switch. For showing
 * the progress while L is prolonged. `undefined` if p's boundary word can't be identified.
 */
export function circleDefects(ct: CutTrack): Vertex[] | undefined {
  const word = punctureWord(ct);
  return word?.letters.map((x) => x.target).filter((s) => ct.graph.valence(s) > 2);
}

/** A way to cut: along `prong` through `realBranches` real branches, after which B is a circle attached at one switch. */
export interface CutOption {
  readonly prong: Prong;
  readonly realBranches: number;
}

/**
 * For each candidate prong, the shortest L that makes B a circle attached at one switch, sorted by that length.
 *
 * To avoid cutting for every length, each prong is traced once to find where it first comes within ε (the width of the
 * narrowest infinitesimal branch) of the boundary: from there it runs parallel to all of p's boundary (the thesis), so
 * a cut succeeds about one lap later. Cuts are tried from one lap before that point to three laps after it.
 */
export function cutOptions(tt: TrainTrack, candidates: readonly Prong[], maxRealBranches = 500): CutOption[] {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const infinitesimal = tt.graph.edges.filter((e) => tt.kind.get(e) === "infinitesimal");
  // ε, the width of the narrowest infinitesimal branch: once L is closer than ε to the boundary, it runs parallel to
  // all of it (the thesis). At corners with wider infinitesimal branches, success can come a little earlier.
  const ε = Math.min(...infinitesimal.map((e) => widths.get(e) as number));
  const lap = tt
    .boundaryWords()
    .filter((b) => !b.infinitesimal)
    .reduce((n, b) => n + b.word.length, 0);
  const options: CutOption[] = [];
  for (const prong of candidates) {
    let L;
    try {
      L = traceProngThroughBranches(tt, prong, maxRealBranches);
    } catch {
      continue; // the leaf runs into a singularity
    }
    let realIndex = 0;
    let firstWithinε: number | undefined;
    L.path.forEach((x, k) => {
      if (tt.kind.get(x.edge) !== "real") return;
      realIndex++;
      const w = widths.get(x.edge) as number;
      const y = L.heights[k] as number;
      if (firstWithinε === undefined && Math.min(y, w - y) < ε) firstWithinε = realIndex;
    });
    if (firstWithinε === undefined) continue;
    const from = Math.max(1, firstWithinε - lap);
    for (let count = from; count <= Math.min(maxRealBranches, firstWithinε + 3 * lap); count++) {
      let ct: CutTrack;
      try {
        ct = cut(tt, slitsForProng(tt, prong, count));
      } catch {
        continue;
      }
      const word = punctureWord(ct);
      if (word !== undefined && attachmentSwitch(ct, word) !== undefined) {
        options.push({ prong, realBranches: count });
        break;
      }
    }
  }
  return options.sort((a, b) => a.realBranches - b.realBranches);
}

/** Carries out a cut option: cuts, removes B, and returns the fibred surface on Σ ∖ Q. */
export function cutClosedSurface(tt: TrainTrack, option: CutOption): ClosedSurfaceCut {
  const ct = cut(tt, slitsForProng(tt, option.prong, option.realBranches));
  const word = punctureWord(ct);
  const v = word === undefined ? undefined : attachmentSwitch(ct, word);
  if (word === undefined || v === undefined) throw new Error("This cut doesn't make p's boundary a circle");
  return {
    surface: removeAlmostPeripheralCircle(ct, word, v),
    prong: option.prong,
    realBranches: option.realBranches,
    cut: ct,
  };
}
