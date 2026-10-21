/**
 * Closed surfaces, the thesis's way: cut along a singular leaf until the boundary word B of the artificial puncture p is a
 * circle attached at a single junction, then remove B (the thesis, § "Closed surfaces and cutting", Move "Cutting along
 * a singular leaf" and Lemma "Removing an almost peripheral subgraph"). τ gives the leaf and the image strands; the cut
 * itself is made on G with only the junctions of the new punctures Q blown up into their polygons (port note 29).
 *
 * @module
 */
import { CombinatorialMap } from "../../graph/combinatorial-map";
import { Color } from "../../math/color";
import { EdgePath } from "../../graph/edge-path";
import { letterIndex } from "../../graph/names";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { cut, type CutTrack, growingSlits, type Piece, type Slit, slitsForProng } from "../cut-along-leaf";
import { FibredSurface } from "../fibred-surface";
import { explain, keepingStates, narrate } from "../narration";
import { type BranchPart, forgetInMarking, type Remarking } from "../remarking";
import type { Text, TextPart } from "../suggestions";
import { imageProng, type Prong, prongs } from "../singular-leaves";
import type { TrainTrack } from "../train-track";
import { tightenMarking } from "./isotopy";
import { mergeAllValenceTwoLines } from "./valence";

/**
 * The boundary words of the punctures P (p, or the orbit of punctures that a former cut made, port note 26) in the cut
 * track: those that contain a real branch and run along no slit (the sides of the slits belong to the new punctures at
 * the singularities).
 */
export function punctureWords(ct: CutTrack): EdgePath[] {
  return ct.graph
    .boundaryWords()
    .filter((w) => w.letters.some((x) => ct.kind.get(x.edge) === "real") && !w.letters.some(ct.isOnSlit));
}

/** How many punctures τ has (its boundary words that aren't infinitesimal polygons): the size of P. */
export function punctureCount(tt: TrainTrack): number {
  return tt.boundaryWords().filter((b) => !b.infinitesimal).length;
}

/** A circle B of the Lemma "Removing an almost peripheral subgraph": the boundary word of a puncture of P, attached at v. */
export interface AttachedCircle {
  readonly word: EdgePath;
  readonly v: Vertex;
}

/**
 * The boundary words of all `count` punctures of P, if each is a circle attached at a single switch (see
 * {@link attachmentSwitch}); else undefined. They become circles together (port note 26, § 2), but all are checked.
 */
export function attachedCircles(ct: CutTrack, count: number): AttachedCircle[] | undefined {
  const words = punctureWords(ct);
  if (words.length !== count) return undefined;
  const circles: AttachedCircle[] = [];
  for (const word of words) {
    const v = attachmentSwitch(ct, word);
    if (v === undefined) return undefined;
    circles.push({ word, v });
  }
  return circles;
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

/** The step of removing the loops B (attached at their junctions), for the narration. */
function removalText(loops: readonly Edge[]): Text {
  const names = (f: (e: Edge) => TextPart): TextPart[] =>
    loops.flatMap((e, i) => [...(i === 0 ? [] : [", "]), f(e)]);
  return loops.length === 1
    ? ["Remove the boundary loop ", ...names((e) => ({ strip: e.name })), " of p: this fills in p."]
    : [
        "Remove the boundary loops ",
        ...names((e) => ({ strip: e.name })),
        " of the punctures of P: this fills in P.",
      ];
}

/** The colour of B while it is shown, before it is removed (port note 28). */
const B_COLOR = Color.fromHex("#ff10f0");

/**
 * The end of the cut (port notes 28 and 29): the valence-2 lines are merged, so that each circle B becomes a loop at
 * its attachment junction (drawn in {@link B_COLOR} before), and then the loops are removed. μ is reset, unless a
 * marking is given (it is filled in together with P).
 */
function removeCirclesAfterMerging(
  ct: CutTrack,
  circles: readonly AttachedCircle[],
  marking: { mu: CombinatorialMap; remarking: Remarking } | undefined,
): FibredSurface {
  const surface = new FibredSurface({ graph: ct.graph, g: ct.gPrime, ...(marking && { mu: marking.mu }) });
  surface.legacyDefaultNames = ct.legacyDefaultNames;
  const { graph, g } = surface;
  const inB = new Set(circles.flatMap(({ word }) => word.letters.map((x) => x.edge)));
  for (const e of inB) e.color = B_COLOR;
  tightenMarking(surface);

  mergeAllValenceTwoLines(
    surface,
    `The cut left valence-2 lines, among them the boundary B of ${circles.length === 1 ? "p" : "each puncture of P"} (pink).`,
  );
  tightenMarking(surface);
  // B is now one loop at its attachment junction.
  const loops = graph.edges.filter((e) => inB.has(e));
  if (
    loops.length !== circles.length ||
    loops.some((e) => e.source !== e.target || !circles.some(({ v }) => v === e.source))
  )
    throw new Error("The circles B didn't merge into loops at their junctions");
  narrate(removalText(loops), { before: keepingStates() ? surface.copy() : undefined });
  explain([
    loops.length === 1 ? "It is" : "They are",
    ' deleted from all images (Lemma "Removing an almost peripheral subgraph").',
  ]);
  if (marking !== undefined) explain([fillingText(marking.remarking)]);
  const loopSet = new Set(loops);
  g.substituteInImages((e) => (loopSet.has(e) ? EdgePath.EMPTY : undefined));
  for (const e of loops) {
    graph.removeEdge(e);
    g.forgetEdge(e);
  }
  // Without a marking, G₀ is (a copy of) the result itself.
  if (marking === undefined) return new FibredSurface({ graph, g });
  forgetInMarking(surface.mu, loops);
  const result = new FibredSurface({ graph, g, mu: marking.remarking.filled(surface.mu) });
  result.legacyDefaultNames = ct.legacyDefaultNames;
  return result;
}

/**
 * Names the junctions of a cut after the junctions of G they come from (see
 * {@link junctionPartName}): numbered where the slits split one (v, v_2, …), lettered for the corners of the polygons of
 * Q (w_a, w_b, …). The points inside a branch, where a slit ends, keep their names.
 */
export function nameParts(ct: CutTrack, inQ: ReadonlySet<Vertex>): void {
  const used = new Set(
    ct.graph.vertices.filter((s) => ct.junctionOf.get(s) === undefined).map((s) => s.name),
  );
  for (const s of ct.graph.vertices) {
    const junction = ct.junctionOf.get(s);
    if (junction !== undefined)
      s.name = junctionPartName(junction, inQ.has(junction), used, ct.legacyDefaultNames);
  }
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
 * The switches along the boundary words of P that still have valence > 2, i.e. where the cut hasn't yet separated
 * a thin ring along a boundary; one per puncture (its attachment switch) when every boundary is a circle attached at
 * one switch. For showing the progress while L is prolonged. `undefined` if no boundary word of P can be identified.
 */
export function circleDefects(ct: CutTrack): Vertex[] | undefined {
  const words = punctureWords(ct);
  if (words.length === 0) return undefined;
  return words.flatMap((word) => word.letters.map((x) => x.target).filter((s) => ct.graph.valence(s) > 2));
}

/** No prong of the orbit gives a cut ({@link cutOptions} is empty); another closed-surface option may still work. */
export class NoCutFound extends Error {}

/** A way to cut: along `prong` through `realBranches` real branches, after which B is a circle attached at one switch. */
export interface CutOption {
  readonly prong: Prong;
  readonly realBranches: number;
}

/** The boundary of a puncture of P in τ: its real letters (p on their right), and the turn at its one cusp. */
export interface RingLetters {
  readonly letters: readonly OrientedEdge[];
  /** The index i of the cusp turn letters[i] → letters[i + 1] (cyclically). */
  readonly cusp: number;
}

/** The {@link RingLetters} of the punctures of P (the boundary words of τ that aren't infinitesimal polygons). */
export function ringLetters(tt: TrainTrack): RingLetters[] {
  const real = (x: OrientedEdge) => tt.kind.get(x.edge) === "real";
  return tt
    .boundaryWords()
    .filter((b) => !b.infinitesimal)
    .map(({ word }) => {
      const all = word.letters;
      // A cusp is a turn between two real letters (with no infinitesimal letter between them).
      const cuspAfter = all.findIndex((x, i) => real(x) && real(all[(i + 1) % all.length] as OrientedEdge));
      const letters = all.filter(real);
      return { letters, cusp: letters.indexOf(all[cuspAfter] as OrientedEdge) };
    });
}

/** The traversal of a letter of a ring by a slit that is nearest to the puncture. */
interface Traversal {
  readonly slit: number;
  /** Its index in the slit's path. */
  readonly k: number;
  readonly distance: number;
  /** Whether the slit runs along the letter (else against it). */
  readonly along: boolean;
  /** Whether it is the last branch of a slit that ends inside it. */
  readonly partial: boolean;
}

/**
 * Whether cutting along `slits` makes the boundary of every puncture of P a circle attached at one switch (port note
 * 15, update 2026-10-20), decided from the slits alone. For each real letter of the ring, take the traversal by a slit
 * nearest to the puncture: it bounds the piece next to the puncture. Every letter must be traversed completely, and
 * every turn except the cusp must be
 * - joined: the nearest traversals of its two letters are consecutive real branches of one slit, or
 * - closed by Q: they are the first branches of two slits starting at the two corners of the side of a polygon of Q
 *   that lies between the letters.
 * The cusp is then the only switch of the ring with valence > 2.
 */
export function ringsCutOff(tt: TrainTrack, rings: readonly RingLetters[], slits: readonly Slit[]): boolean {
  const widths = tt.widths as ReadonlyMap<Edge, number>;
  const occurrences = new Map<Edge, { ring: number; i: number; letter: OrientedEdge }[]>();
  rings.forEach(({ letters }, ring) =>
    letters.forEach((letter, i) => {
      const list = occurrences.get(letter.edge) ?? [];
      list.push({ ring, i, letter });
      occurrences.set(letter.edge, list);
    }),
  );
  const nearest = rings.map(({ letters }) =>
    new Array<Traversal | undefined>(letters.length).fill(undefined),
  );
  slits.forEach((slit, s) =>
    slit.path.forEach((x, k) => {
      for (const { ring, i, letter } of occurrences.get(x.edge) ?? []) {
        const y = slit.heights[k] as number;
        const along = x === letter;
        const distance = along ? y : (widths.get(x.edge) as number) - y;
        const old = (nearest[ring] as (Traversal | undefined)[])[i];
        if (old === undefined || distance < old.distance) {
          const partial = slit.partialLength !== undefined && k === slit.path.length - 1;
          (nearest[ring] as (Traversal | undefined)[])[i] = { slit: s, k, distance, along, partial };
        }
      }
    }),
  );
  return rings.every(({ letters, cusp }, ring) => {
    const ts = nearest[ring] as (Traversal | undefined)[];
    if (ts.some((t) => t === undefined || t.partial)) return false;
    const n = letters.length;
    for (let i = 0; i < n; i++) {
      if (i === cusp) continue;
      const [t, u] = [ts[i] as Traversal, ts[(i + 1) % n] as Traversal];
      const joined = t.slit === u.slit && t.along === u.along && u.k - t.k === (t.along ? 2 : -2);
      const start = (x: Traversal) => ((slits[x.slit] as Slit).path[0] as OrientedEdge).source;
      const closedByQ =
        t.k === 0 &&
        u.k === 0 &&
        start(t) === (letters[i] as OrientedEdge).target &&
        start(u) === (letters[(i + 1) % n] as OrientedEdge).source;
      if (!joined && !closedByQ) return false;
    }
    return true;
  });
}

/**
 * For each candidate prong, the shortest L that makes B a circle attached at one junction, sorted by that length.
 *
 * The length is found without cutting: each prong of the orbit is traced once ({@link growingSlits}), and
 * {@link ringsCutOff} is checked for L through 1, 2, … real branches. Only the length found is cut, to confirm it, and
 * not for prongs that would need at least twice as many real branches as the best option.
 */
export function cutOptions(tt: TrainTrack, candidates: readonly Prong[], maxRealBranches = 500): CutOption[] {
  const punctures = punctureCount(tt);
  const rings = ringLetters(tt);
  const found = candidates.flatMap((prong) => {
    const slitsFor = growingSlits(tt, prong, maxRealBranches);
    for (let count = 1; count <= maxRealBranches; count++) {
      const slits = slitsFor(count);
      if (slits === undefined) return []; // a slit runs into a corner
      if (ringsCutOff(tt, rings, slits)) return [{ prong, realBranches: count, slits }];
    }
    return [];
  });
  const options: CutOption[] = [];
  for (const { prong, realBranches, slits } of found.sort((a, b) => a.realBranches - b.realBranches)) {
    if (options.length > 0 && realBranches >= 2 * (options[0] as CutOption).realBranches) break;
    try {
      if (attachedCircles(cut(tt, slits, new Set(cutOrbit(tt, prong))), punctures) !== undefined)
        options.push({ prong, realBranches });
    } catch {
      // (the cut fails for this prong)
    }
  }
  return options;
}

/** The junctions of the singularities in the orbit of the prong (where the preimage slits start): the new punctures Q. */
export function cutOrbit(tt: TrainTrack, prong: Prong): Vertex[] {
  const same = (p: Prong, q: Prong) => p.atSwitch === q.atSwitch && p.below === q.below;
  const junctions: Vertex[] = [];
  let p = prong;
  for (let i = 0; i < 10_000; i++) {
    const v = tt.junctionOf.get(p.atSwitch) as Vertex;
    if (!junctions.includes(v)) junctions.push(v);
    p = imageProng(tt, p);
    if (same(p, prong)) break;
  }
  return junctions;
}

/**
 * μ of a cut: each piece runs along its part of its branch of τ, and from a part of a junction
 * outside Q through the inside of the junction to the switch of its gate first (as for the blown-up graph of the
 * shortcut, `markBlownUp`). The parts of such a junction are in its cell.
 */
function cutMarking(tt: TrainTrack, ct: CutTrack, remarking: Remarking): CombinatorialMap {
  const stripOf = new Map([...tt.realBranch].map(([strip, branch]) => [branch, strip]));
  const mu = new CombinatorialMap(ct.graph, remarking.spine);
  const atPart = (s: Vertex) => ct.junctionParts.has(s);
  for (const e of ct.graph.edges) {
    const { branch, from, to } = partOfPiece(tt, ct.pieces.get(e) as Piece);
    const strip = stripOf.get(branch);
    const start = strip && atPart(e.source) ? remarking.toSwitch(strip.forward) : EdgePath.EMPTY;
    const end = strip && atPart(e.target) ? remarking.toSwitch(strip.backward).inverse : EdgePath.EMPTY;
    mu.setImage(e.forward, start.concat(remarking.part(branch, from, to), end).reduced());
  }
  for (const v of ct.graph.vertices) {
    if (atPart(v)) {
      mu.setVertexImage(v, remarking.junctionCell(ct.junctionOf.get(v) as Vertex));
      continue;
    }
    const x = ct.graph.star(v)[0] as OrientedEdge;
    const { branch, from, to } = partOfPiece(tt, ct.pieces.get(x.edge) as Piece);
    mu.setVertexImage(v, remarking.cellAt(branch, x.isForward ? from : to));
  }
  return mu;
}

function partOfPiece(tt: TrainTrack, piece: Piece): BranchPart {
  const length = tt.lengths.get(piece.branch) ?? 0;
  return length > 0
    ? { branch: piece.branch, from: piece.start / length, to: piece.end / length }
    : { branch: piece.branch, from: 0, to: 1 };
}

/** How many intermediate cuts the narration shows at most. */
const SHOWN_CUTS = 24;

/**
 * Carries out a cut option: cuts, removes B, and returns the fibred surface on Σ ∖ Q. With `remarking`, the result
 * stays in the original model (port note 22), and the narration shows the cut branch by branch.
 */
export function cutClosedSurface(tt: TrainTrack, option: CutOption, remarking?: Remarking): ClosedSurfaceCut {
  const n = option.realBranches;
  const keep = remarking !== undefined && keepingStates();
  const orbit = cutOrbit(tt, option.prong);
  /** The real branches of each slit when L runs through `count` branches: L first, then f⁻¹(L), f⁻²(L), … */
  const slitBranches = (count: number) =>
    slitsForProng(tt, option.prong, count).map((slit) => ({
      start: tt.junctionOf.get((slit.path[0] as OrientedEdge).source) as Vertex,
      real: slit.path.filter((x) => tt.kind.get(x.edge) === "real"),
      partial: slit.partialLength !== undefined,
    }));
  const final = slitBranches(n);
  const real = (final[0] as (typeof final)[number]).real;
  const branchList = (list: readonly OrientedEdge[]): TextPart[] =>
    list.flatMap((x, i) => [...(i === 0 ? [] : [" "]), { strip: x.name }]);
  const name = (j: number) => (j === 0 ? "L" : `f${superscript(-j)}(L)`);

  // Only the junctions of Q are blown up into their polygons: the new punctures sit inside them (port note 29).
  const inQ = new Set(orbit);
  const track = (slits: readonly Slit[]) => {
    const ct = cut(tt, slits, inQ);
    nameParts(ct, inQ);
    return ct;
  };
  /** A state to show: a copy, with μ pulled tight (see {@link tightenMarking}). */
  const shown = (ct: CutTrack) => {
    const mu = remarking && cutMarking(tt, ct, remarking);
    const copy = new FibredSurface({ graph: ct.graph, g: ct.gPrime, ...(mu && { mu }) }).copy();
    copy.legacyDefaultNames = tt.legacyDefaultNames;
    tightenMarking(copy);
    return copy;
  };

  // The cut branch by branch (only for showing it): each count is a valid cut of its own.
  const counts = keep
    ? [
        ...new Set(
          Array.from({ length: Math.min(n, SHOWN_CUTS) }, (_, j) =>
            Math.round(((j + 1) * n) / Math.min(n, SHOWN_CUTS)),
          ),
        ),
      ]
    : [n];
  // The state before the cut: G with Q blown up.
  narrate(blowUpText(orbit.map((v) => v.name)));
  let before = keep ? shown(track([])) : undefined;
  let previous: { real: readonly OrientedEdge[]; partial: boolean }[] = [];
  let done = 0;
  let ct: CutTrack | undefined;
  for (const count of counts) {
    const now = slitBranches(count);
    // What each slit gains in this step (the preimages grow with L, λ, λ², … times slower).
    const gains = now.flatMap((slit, j): TextPart[] => {
      const added = slit.real.slice(previous[j]?.real.length ?? 0);
      if (added.length === 0) return []; // (still inside the same branch)
      return [
        j === 0 ? "" : "; ",
        `${name(j)}: `,
        ...branchList(added),
        ...(slit.partial ? [" (into it partly)"] : []),
      ];
    });
    if (done === 0) {
      explain([
        "The leaf L from ",
        { junction: (final[0] as (typeof final)[number]).start.name },
        ` runs through ${n} branches: `,
        ...branchList(real),
        ".",
      ]);
      if (final.length > 1)
        explain([
          "Its preimages are cut as well, so that g′ is defined on whole pieces: ",
          ...final
            .slice(1)
            .flatMap((slit, i): TextPart[] => [
              i === 0 ? "" : "; ",
              `${name(i + 1)} from `,
              { junction: slit.start.name },
              ": ",
              ...branchList(slit.real),
              ...(slit.partial ? [" (the last partly)"] : []),
            ]),
          ".",
        ]);
    }
    narrate(["Cut along ", ...gains, count === n && done === 0 ? "." : ` (${count} of ${n}).`], { before });
    previous = now;
    ct = track(slitsForProng(tt, option.prong, count));
    if (keep) before = shown(ct);
    done = count;
  }
  const full = ct as CutTrack;
  const circles = attachedCircles(full, punctureCount(tt));
  if (circles === undefined) throw new Error("This cut doesn't make the boundaries of P circles");
  let surface = removeCirclesAfterMerging(
    full,
    circles,
    remarking && { mu: cutMarking(tt, full, remarking), remarking },
  );
  if (remarking !== undefined) surface = finishRemarking(surface, remarking);
  mergeAllValenceTwoLines(surface, "Removing B left valence-2 lines.");
  return { surface, prong: option.prong, realBranches: option.realBranches, cut: full };
}

/** The step of blowing up the junctions of the new punctures into their polygons, for the narration. */
export function blowUpText(junctions: readonly string[]): Text {
  return [
    "Blow up ",
    ...junctions.flatMap((name, i): TextPart[] => [...(i === 0 ? [] : [", "]), { junction: name }]),
    junctions.length === 1
      ? " into its polygon, with the new puncture inside."
      : " into their polygons, with the new punctures inside.",
  ];
}

/** What filling in P does to the picture (the side of G₀), for the narration. */
export function fillingText(remarking: Remarking): string {
  const [only] = remarking.walls;
  if (remarking.walls.length === 1 && only !== undefined) {
    const { name, image } = only;
    return `In the picture, the chord ${name} from p to a new puncture becomes a wall; strands that crossed it go around p (${name} ↦ ${image} in μ).`;
  }
  return `In the picture, a chord from each puncture of P becomes a wall; strands that crossed it go around (${remarking.walls
    .map(({ name, image }) => `${name} ↦ ${image}`)
    .join("; ")} in μ).`;
}

/** The step of contracting the walls after filling in P (port notes 26, 27), and a note on it, for the narration. */
function slideText(
  remarking: Remarking,
  slid: NonNullable<ReturnType<Remarking["slide"]>>,
): { step: string; note: string } {
  const walls = remarking.walls.map(({ name }) => name).join(", ");
  return {
    step:
      slid.filledPoints === 0
        ? `Slide the new puncture of ${slid.point ?? "q"} along the wall ${walls} into p's corner.`
        : `Contract the walls ${walls}${slid.point === undefined ? "" : `, and slide the new puncture of ${slid.point} into the corner`}.`,
    note: [
      slid.filledPoints === 0
        ? "The wall disappears; chords that ended at the puncture now end at the corner."
        : "The walls disappear; chords that ended at a filled-in point now end where it went.",
      slid.merged.length === 0 ? "" : ` The chords ${slid.merged.join(", ")} drop out of μ (merged cells).`,
      slid.pointsLeft === 0
        ? " The surface is drawn in the original polygon again."
        : ` The other new ${slid.pointsLeft === 1 ? "puncture is" : "punctures are"} placed anew.`,
    ].join(""),
  };
}

/** n as a superscript, e.g. −2 as ⁻². */
function superscript(n: number): string {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return `${n < 0 ? "⁻" : ""}${[...String(Math.abs(n))].map((d) => digits[Number(d)]).join("")}`;
}

/**
 * The surface with μ into the final model: p filled in (with the wall), then the new puncture at the wall slid into p's
 * corner (port note 27; a step of its own, after the walled state), each checked and pulled tight at the junctions (see
 * {@link tightenMarking}). If the slide doesn't work, the wall stays; if filling in fails, μ is reset (the surface is
 * then drawn as its own ribbon graph).
 */
export function finishRemarking(surface: FibredSurface, remarking: Remarking): FibredSurface {
  const finished = remarking.finish(surface);
  if (finished !== undefined) {
    tightenMarking(finished);
    const slid = remarking.slide(finished);
    if (slid === undefined) return finished;
    const { step, note } = slideText(remarking, slid);
    narrate([step], { before: keepingStates() ? finished.copy() : undefined });
    explain([note]);
    tightenMarking(slid.surface);
    return slid.surface;
  }
  surface.reportInconsistency(
    "The new punctures couldn't be drawn in the original model; the surface is drawn as its own ribbon graph.",
  );
  return new FibredSurface({ graph: surface.graph, g: surface.g, peripheral: surface.peripheral });
}

/**
 * A new name for a part of the junction v: the corners of the polygon of a junction of Q are lettered (v_a, …, v_z,
 * v_aa, …), the parts of another junction that the slits split are numbered (v, v_2, …). `used` collects the names
 * given. `legacy`: as before session format 4, va, vb, … (and vb2 after vz).
 */
export function junctionPartName(v: Vertex, inQ: boolean, used: Set<string>, legacy = false): string {
  const corner = (k: number) =>
    legacy
      ? `${v.name}${"abcdefghijklmnopqrstuvwxyz"[k % 26]}${k >= 26 ? Math.floor(k / 26) + 1 : ""}`
      : `${v.name}_${letterIndex(k)}`;
  let name = inQ ? corner(0) : v.name;
  for (let k = 1; used.has(name); k++) name = inQ ? corner(k) : `${v.name}_${k + 1}`;
  used.add(name);
  return name;
}
