/**
 * Closed surfaces, the thesis's way: cut TS(τ) along a singular leaf until the boundary word B of the artificial
 * puncture p is a circle attached at a single switch, then remove B (the thesis, § "Closed surfaces and cutting",
 * Move "Cutting along a singular leaf" and Lemma "Removing an almost peripheral subgraph").
 *
 * @module
 */
import type { CombinatorialMap } from "../../graph/combinatorial-map";
import { EdgePath } from "../../graph/edge-path";
import { letterIndex } from "../../graph/names";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../../graph/ribbon-graph";
import { cut, type CutTrack, type Piece, slitsForProng, traceProngThroughBranches } from "../cut-along-leaf";
import { FibredSurface } from "../fibred-surface";
import { keepingStates, narrate, quietly } from "../narration";
import { type BranchPart, forgetInMarking, markParts, markTrack, type Remarking } from "../remarking";
import type { TextPart } from "../suggestions";
import { imageProng, type Prong, prongs } from "../singular-leaves";
import type { TrainTrack } from "../train-track";
import { collapseSubforest } from "./collapse-forest";
import { tightenMarking } from "./isotopy";

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

/**
 * Removes the circles B attached at their switches v (one for each puncture of P, all at once, since g maps each into
 * the next): everything mapped into a circle is isotoped into its v, i.e. the branches of the circles are deleted from
 * all images (and switches mapped into a circle are mapped to its v), then the circles are deleted except for the v.
 * Filling in P, this is a homotopy equivalence, so the result is a spine of Σ ∖ Q carrying the same f. Then the
 * polygons of the junctions outside Q, which never needed to be blown up, are contracted back into their junctions
 * ({@link collapseUncut}). μ is reset, unless a marking is given (it is filled in together with P).
 */
export function removeAlmostPeripheralCircles(
  ct: CutTrack,
  circles: readonly AttachedCircle[],
  options: {
    readonly uncut: ReadonlySet<Edge>;
    readonly junctionOf: (s: Vertex) => Vertex | undefined;
    /** The junctions of the new punctures Q. */
    readonly inQ: ReadonlySet<Vertex>;
    readonly marking?: { mu: CombinatorialMap; remarking: Remarking };
    /** The state shown before this step (for the narration). */
    readonly before?: FibredSurface;
  },
): FibredSurface {
  const { graph, gPrime: g } = ct;
  const { marking } = options;
  let mu = marking?.mu;
  const start = (word: EdgePath) =>
    `${word.letters
      .slice(0, 6)
      .map((x) => x.name)
      .join(" ")}${word.length > 6 ? " …" : ""}`;
  const [only] = circles;
  narrate(
    [
      circles.length === 1 && only !== undefined
        ? `The boundary of p is now a circle B of ${only.word.length} branches (${start(only.word)}), attached only at ${only.v.name}. Remove it (Lemma "Removing an almost peripheral subgraph"): its branches are deleted from all images. This fills in p.`
        : `The boundaries of the ${circles.length} punctures of P are now circles, ${circles
            .map(({ word, v }) => `of ${word.length} branches (${start(word)}) attached only at ${v.name}`)
            .join(
              "; ",
            )}. Remove them all at once (Lemma "Removing an almost peripheral subgraph", for the orbit; g maps each into the next): their branches are deleted from all images. This fills in P.`,
      ...(marking === undefined ? [] : [" ", fillingText(marking.remarking)]),
    ],
    { before: options.before },
  );
  const circle = new Set(circles.flatMap(({ word }) => word.letters.map((x) => x.edge)));
  // The switches along each circle except its attachment, and where they go.
  const inner = new Map(
    circles.flatMap(({ word, v }) =>
      word.letters
        .map((x) => x.target)
        .filter((s) => s !== v)
        .map((s) => [s, v] as const),
    ),
  );
  g.substituteInImages((e) => (circle.has(e) ? EdgePath.EMPTY : undefined));
  for (const s of graph.vertices) {
    const to = inner.get(g.vertexImage(s));
    if (to !== undefined) g.setVertexImage(s, to);
  }
  for (const e of circle) {
    graph.removeEdge(e);
    g.forgetEdge(e);
  }
  for (const s of inner.keys()) {
    graph.removeVertex(s);
    g.forgetVertex(s);
  }
  forgetInMarking(mu, circle, inner.keys());
  // Filling in P on the side of G₀ too, at the same time (port note 22, § 4).
  if (marking !== undefined && mu !== undefined) mu = marking.remarking.filled(mu);
  const surface = new FibredSurface({ graph, g, ...(mu && { mu }) });
  surface.legacyDefaultNames = ct.legacyDefaultNames;
  collapseUncut(surface, options.uncut, options.junctionOf, options.inQ);
  // Without a marking, G₀ is (a copy of) the result itself.
  return mu === undefined ? new FibredSurface({ graph, g }) : surface;
}

/**
 * Contracts the infinitesimal branches in `uncut` (those at the junctions outside Q) back into junctions: their polygons
 * bound disks, not punctures, so these junctions never needed to be blown up (port note 22, § 6). Each polygon loses
 * one branch ε, which is homotopic to the rest of the polygon reversed (that replaces ε in all images); the rest is a
 * forest and is collapsed. The junctions get the names of the junctions of G they come from (`junctionOf`): numbered
 * where the slits split one (v, v_2, …), and lettered for the corners of the polygons of Q (w_a, w_b, …).
 */
export function collapseUncut(
  surface: FibredSurface,
  uncut: ReadonlySet<Edge>,
  junctionOf: (s: Vertex) => Vertex | undefined,
  inQ: ReadonlySet<Vertex>,
): void {
  const { graph, g } = surface;
  const origin = new Map(graph.vertices.map((s) => [s, junctionOf(s)] as const));
  const present = () => new Set(graph.edges.filter((e) => uncut.has(e)));
  const findDisk = () => {
    const edges = present();
    return graph.boundaryWords().find((w) => w.letters.every((x) => edges.has(x.edge)));
  };
  for (let disk = findDisk(); disk !== undefined; disk = findDisk()) {
    const [x] = disk.letters as [OrientedEdge];
    const rest = disk.slice(1);
    const forwardImage = x.isForward ? rest.inverse : rest;
    g.substituteInImages((e) => (e === x.edge ? forwardImage : undefined));
    graph.removeEdge(x.edge);
    g.forgetEdge(x.edge);
    surface.mu.forgetEdge(x.edge);
  }
  const forest = present();
  if (forest.size > 0) quietly(() => collapseSubforest(surface, forest));
  const used = new Set(graph.vertices.filter((s) => origin.get(s) === undefined).map((s) => s.name));
  for (const s of graph.vertices) {
    const junction = origin.get(s);
    if (junction === undefined) continue;
    s.name = junctionPartName(junction, inQ.has(junction), used, surface.legacyDefaultNames);
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
    const from = Math.max(1, firstWithinε - lap);
    for (let count = from; count <= Math.min(maxRealBranches, firstWithinε + 3 * lap); count++) {
      let ct: CutTrack;
      try {
        ct = cut(tt, slitsForProng(tt, prong, count));
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

/** μ of a cut track, from the parts of the branches of τ that its pieces are. */
function cutMarking(tt: TrainTrack, ct: CutTrack, remarking: Remarking): CombinatorialMap {
  return markParts(ct.graph, (e) => partOfPiece(tt, ct.pieces.get(e) as Piece), remarking);
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

  // Only the junctions of Q are blown up into their polygons (the new punctures sit inside them). The polygons at the
  // other junctions bound disks: the cut needs them (it runs on all of τ), but they are contracted again in the states
  // shown and at the end.
  const inQ = new Set(orbit);
  const uncutOf = (graph: RibbonGraph, branchOf: (e: Edge) => Edge) =>
    new Set(
      graph.edges.filter(
        (e) =>
          tt.kind.get(branchOf(e)) === "infinitesimal" &&
          !inQ.has(tt.junctionOf.get(branchOf(e).source) as Vertex),
      ),
    );
  /** The junction of G that a switch belongs to (undefined for a point inside a branch, where a slit ends). */
  const junctionOfSwitch =
    (graph: RibbonGraph, partOf: (e: Edge) => BranchPart) =>
    (s: Vertex): Vertex | undefined => {
      for (const x of graph.star(s)) {
        const { branch, from, to } = partOf(x.edge);
        const at = x.isForward ? from : to;
        const end =
          tt.kind.get(branch) === "infinitesimal" || at === 0
            ? branch.source
            : at === 1
              ? branch.target
              : undefined;
        if (end === undefined) continue;
        return tt.junctionOf.get(end);
      }
      return undefined;
    };
  /** A state to show: a copy with the polygons outside Q contracted, and μ pulled tight (see {@link tightenMarking}). */
  const shown = (
    graph: RibbonGraph,
    g: CombinatorialMap,
    mu: CombinatorialMap,
    partOf: (e: Edge) => BranchPart,
  ): FibredSurface => {
    const { copy, correspondence } = new FibredSurface({ graph, g, mu }).copyWithCorrespondence();
    copy.legacyDefaultNames = tt.legacyDefaultNames;
    const back = new Map([...correspondence.vertexMap].map(([a, b]) => [b, a]));
    const junctionOf = junctionOfSwitch(graph, partOf);
    const uncut = [...uncutOf(graph, (e) => partOf(e).branch)].map(
      (e) => correspondence.edgeMap.get(e) as Edge,
    );
    collapseUncut(copy, new Set(uncut), (s) => junctionOf(back.get(s) as Vertex), inQ);
    tightenMarking(copy);
    return copy;
  };
  const wholeBranch = (b: Edge): BranchPart => ({ branch: b, from: 0, to: 1 });

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
  let before = keep ? shown(tt.graph, tt.gTau, markTrack(tt, remarking), wholeBranch) : undefined;
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
    ct = cut(tt, slitsForProng(tt, option.prong, count));
    const track = ct;
    if (keep)
      before = shown(track.graph, track.gPrime, cutMarking(tt, track, remarking), (e) =>
        partOfPiece(tt, track.pieces.get(e) as Piece),
      );
    done = count;
  }
  const full = ct as CutTrack;
  const circles = attachedCircles(full, punctureCount(tt));
  if (circles === undefined) throw new Error("This cut doesn't make the boundaries of P circles");
  const mu = remarking ? cutMarking(tt, full, remarking) : undefined;
  const partOf = (e: Edge) => partOfPiece(tt, full.pieces.get(e) as Piece);
  let surface = removeAlmostPeripheralCircles(full, circles, {
    uncut: uncutOf(full.graph, (e) => partOf(e).branch),
    junctionOf: junctionOfSwitch(full.graph, partOf),
    inQ,
    ...(mu && remarking && { marking: { mu, remarking } }),
    ...(before && { before }),
  });
  if (remarking !== undefined) surface = finishRemarking(surface, remarking);
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
