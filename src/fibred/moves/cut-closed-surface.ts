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
import {
  cut,
  type CutTrack,
  type Piece,
  type Slit,
  slitsForProng,
  traceProngThroughBranches,
} from "../cut-along-leaf";
import { FibredSurface } from "../fibred-surface";
import { keepingStates, narrate } from "../narration";
import { type BranchPart, forgetInMarking, type Remarking } from "../remarking";
import type { TextPart } from "../suggestions";
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

/** The narration of removing the circles B. */
function removalText(circles: readonly AttachedCircle[], remarking: Remarking | undefined): TextPart[] {
  const start = (word: EdgePath) =>
    `${word.letters
      .slice(0, 6)
      .map((x) => x.name)
      .join(" ")}${word.length > 6 ? " …" : ""}`;
  const circle = (word: EdgePath) =>
    word.length === 1 ? `the loop ${start(word)}` : `a circle B of ${word.length} branches (${start(word)})`;
  const [only] = circles;
  return [
    circles.length === 1 && only !== undefined
      ? `The boundary of p is now ${circle(only.word)}, attached only at ${only.v.name}. Remove it (Lemma "Removing an almost peripheral subgraph"): its branches are deleted from all images. This fills in p.`
      : `The boundaries of the ${circles.length} punctures of P are now circles, ${circles
          .map(({ word, v }) => `${circle(word)} attached only at ${v.name}`)
          .join(
            "; ",
          )}. Remove them all at once (Lemma "Removing an almost peripheral subgraph", for the orbit; g maps each into the next): their branches are deleted from all images. This fills in P.`,
    ...(remarking === undefined ? [] : [" ", fillingText(remarking)]),
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
    `The cut left valence-2 lines, among them the boundary B of ${circles.length === 1 ? "p" : "each puncture of P"} (pink). Merge each into one strip:`,
  );
  tightenMarking(surface);
  // B is now one loop at its attachment junction.
  const loops = graph.edges.filter((e) => inB.has(e));
  if (
    loops.length !== circles.length ||
    loops.some((e) => e.source !== e.target || !circles.some(({ v }) => v === e.source))
  )
    throw new Error("The circles B didn't merge into loops at their junctions");
  narrate(
    removalText(
      loops.map((e) => ({ word: EdgePath.of(e.forward), v: e.source })),
      marking?.remarking,
    ),
    { before: keepingStates() ? surface.copy() : undefined },
  );
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

/** A way to cut: along `prong` through `realBranches` real branches, after which B is a circle attached at one switch. */
export interface CutOption {
  readonly prong: Prong;
  readonly realBranches: number;
}

/**
 * For each candidate prong, the shortest L that makes B a circle attached at one junction, sorted by that length.
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
  const punctures = punctureCount(tt);
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
    const blownUp = new Set(cutOrbit(tt, prong));
    const from = Math.max(1, firstWithinε - lap);
    for (let count = from; count <= Math.min(maxRealBranches, firstWithinε + 3 * lap); count++) {
      let ct: CutTrack;
      try {
        ct = cut(tt, slitsForProng(tt, prong, count), blownUp);
      } catch {
        continue;
      }
      if (attachedCircles(ct, punctures) !== undefined) {
        options.push({ prong, realBranches: count });
        break;
      }
    }
  }
  return options.sort((a, b) => a.realBranches - b.realBranches);
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
    narrate(
      done === 0
        ? [
            `The leaf L from the singularity of `,
            { junction: (final[0] as (typeof final)[number]).start.name },
            ` runs through ${n} branches: `,
            ...branchList(real),
            ".",
            ...(final.length > 1
              ? [
                  " Its preimages under f are cut as well, so that the new map g′ is defined on whole pieces: ",
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
                ]
              : []),
            ` Cut along ${count === n ? "all of them" : `the first ${count === 1 ? "branch" : `${count} branches`}`}: `,
            ...gains,
            ".",
          ]
        : ["Cut further: ", ...gains, ` (${count} of ${n}).`],
      { before },
    );
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
  mergeAllValenceTwoLines(surface, "Removing B left valence-2 lines. Merge each into one strip:");
  return { surface, prong: option.prong, realBranches: option.realBranches, cut: full };
}

/** What filling in P does to the picture (the side of G₀), for the narration. */
export function fillingText(remarking: Remarking): string {
  const [only] = remarking.walls;
  if (remarking.walls.length === 1 && only !== undefined) {
    const { name, image } = only;
    return `In the picture, p is filled in (the dots at the corners): the chord ${name} from p to a new puncture becomes a wall, and the strands that crossed it go around p instead (${name} ↦ ${image} in μ).`;
  }
  return `In the picture, P is filled in (the dots): from each of its punctures a chord to a neighbour becomes a wall, and the strands that crossed it go around the filled-in point instead (${remarking.walls
    .map(({ name, image }) => `${name} ↦ ${image}`)
    .join("; ")} in μ).`;
}

/** The step of contracting the walls after filling in P (port notes 26, 27), for the narration. */
function slideText(remarking: Remarking, slid: NonNullable<ReturnType<Remarking["slide"]>>): string {
  const walls = remarking.walls.map(({ name }) => name).join(", ");
  return [
    slid.filledPoints === 0
      ? `Slide the new puncture of ${slid.point ?? "q"} along the wall ${walls} into the corner, where p was: the wall disappears, and the chords that ended at the puncture now end at the corner (G₀ and μ stay the same).`
      : `Contract the walls ${walls}: each filled-in point moves along its wall into its neighbour${
          slid.point === undefined ? "" : `, and the new puncture of ${slid.point} slides into the corner`
        }. The walls disappear, and the chords that ended at a moved point now end where it went (G₀ and μ stay the same).`,
    slid.merged.length === 0
      ? ""
      : ` The cells that collapse or can be joined are merged, so the chords ${slid.merged.join(", ")} drop out of μ.`,
    slid.pointsLeft === 0
      ? " The surface is drawn in the original polygon again, with the new puncture at its vertex."
      : ` The other new ${slid.pointsLeft === 1 ? "puncture is" : "punctures are"} placed anew, each at the average of its neighbours along the chords.`,
  ].join("");
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
    narrate([slideText(remarking, slid)], { before: keepingStates() ? finished.copy() : undefined });
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
