/**
 * Closed surfaces, the thesis's way: cut TS(τ) along a singular leaf until the boundary word B of the artificial
 * puncture p is a circle attached at a single switch, then remove B (the thesis, § "Closed surfaces and cutting",
 * Move "Cutting along a singular leaf" and Lemma "Removing an almost peripheral subgraph").
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { cut, type CutTrack, slitsForProng } from "../cut-along-leaf";
import { FibredSurface } from "../fibred-surface";
import { imageProng, type Prong, prongs } from "../singular-leaves";
import type { TrainTrack } from "../train-track";

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
  for (const disk of disks) {
    const [x] = disk.letters as [OrientedEdge];
    const rest = disk.slice(1);
    const forwardImage = x.isForward ? rest.inverse : rest;
    g.substituteInImages((e) => (e === x.edge ? forwardImage : undefined));
    graph.removeEdge(x.edge);
    g.forgetEdge(x.edge);
  }
  return new FibredSurface({ graph, g });
}

/** The result of {@link cutClosedSurface}. */
export interface ClosedSurfaceCut {
  /** The fibred surface on Σ ∖ Q after removing B. */
  readonly surface: FibredSurface;
  /** The prong that was cut along, and through how many real branches. */
  readonly prong: Prong;
  readonly realBranches: number;
  /** The cut track before removing B (for display). */
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
 * Cuts along the prongs in `candidates`, prolonging L one real branch at a time up to `maxRealBranches`, until the
 * boundary word of p is a circle attached at one switch (the author's proposal for the Lemma on prolonging L, whose
 * proof is only sketched in the thesis), then removes it. Tries the prongs in the given order, each up to the
 * maximum length. Returns `undefined` if no prong reaches the goal.
 */
export function cutClosedSurface(
  tt: TrainTrack,
  candidates: readonly Prong[],
  maxRealBranches = 40,
): ClosedSurfaceCut | undefined {
  for (let count = 1; count <= maxRealBranches; count++)
    for (const prong of candidates) {
      let ct: CutTrack;
      try {
        ct = cut(tt, slitsForProng(tt, prong, count));
      } catch {
        continue; // e.g. the leaf runs into a singularity
      }
      const word = punctureWord(ct);
      const v = word === undefined ? undefined : attachmentSwitch(ct, word);
      if (word !== undefined && v !== undefined)
        return { surface: removeAlmostPeripheralCircle(ct, word, v), prong, realBranches: count, cut: ct };
    }
  return undefined;
}
