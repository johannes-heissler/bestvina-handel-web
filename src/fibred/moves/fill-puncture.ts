/**
 * Closed surfaces: getting rid of the artificial puncture p when it would become a singularity of angle π
 * (the thesis, § "Closed surfaces and cutting"). A shortcut to the thesis's cutting move; see port note 15.
 *
 * @module
 */
import { CombinatorialMap } from "../../graph/combinatorial-map";
import { EdgePath } from "../../graph/edge-path";
import { type Edge, type OrientedEdge, RibbonGraph, type Vertex } from "../../graph/ribbon-graph";
import { FibredSurface } from "../fibred-surface";
import { explain, keepingStates, narrate, quietly } from "../narration";
import { perronFrobenius } from "../perron-frobenius";
import type { Remarking } from "../remarking";
import type { Text, TextPart } from "../suggestions";
import { blowUpText, fillingText, finishRemarking, junctionPartName } from "./cut-closed-surface";
import { tightenMarking } from "./isotopy";
import { pullTight } from "./pull-tight";
import { mergeAllValenceTwoLines } from "./valence";
import { entriesInto, trainTrack, type TrainTrack } from "../train-track";

/** A junction with an infinitesimal polygon (a singularity of angle ≥ 3π) and its period under g. */
export interface Singularity {
  readonly junction: Vertex;
  /** The orbit v, g(v), …, g^{k−1}(v) of the junction. */
  readonly orbit: readonly Vertex[];
}

/**
 * How many punctures are in the situation of the thesis's Lemma "oneCusp": no periphery, growth > 1, and the boundary
 * word of τ at every puncture has exactly one cusp. 0 if that isn't the case. After a closed-surface move the punctures
 * are an orbit, so they all have one cusp or none does; then the move is needed again (port note 26).
 */
export function oneCuspPunctures(fs: FibredSurface, tt: TrainTrack = trainTrack(fs)): number {
  const real = tt.boundaryWords().filter((b) => !b.infinitesimal);
  const all = fs.peripheral.size === 0 && tt.growth > 1 + 1e-9 && real.every((b) => b.cusps === 1);
  return all ? real.length : 0;
}

/** Whether the surface has a single puncture, with one cusp (see {@link oneCuspPunctures}). */
export function hasOneCuspPuncture(fs: FibredSurface, tt: TrainTrack = trainTrack(fs)): boolean {
  return oneCuspPunctures(fs, tt) === 1;
}

/**
 * The junctions whose switches form an infinitesimal polygon, with their orbits under g, sorted by period (the
 * choice of q is the user's; the shortest orbits need the least work).
 */
export function polygonSingularities(fs: FibredSurface, tt: TrainTrack = trainTrack(fs)): Singularity[] {
  const polygonJunctions = new Set(
    tt
      .boundaryWords()
      .filter((b) => b.infinitesimal)
      .map((b) => tt.junctionOf.get((b.word.first as OrientedEdge).source) as Vertex),
  );
  return [...polygonJunctions]
    .map((junction) => {
      const orbit = [junction];
      for (
        let v = fs.g.vertexImage(junction);
        v !== junction && orbit.length <= fs.graph.vertexCount;
        v = fs.g.vertexImage(v)
      )
        orbit.push(v);
      return { junction, orbit };
    })
    .sort((x, y) => x.orbit.length - y.orbit.length);
}

/** At most this many ways to fill in P are listed (they multiply with the number of punctures). */
export const MAX_FILLINGS = 64;

/**
 * The ways to fill in the punctures of P in the blown-up surface G₀: for each puncture, a strip of G₀ between its face
 * and another face is deleted, the letter of the strip on the puncture's face (once the puncture is filled in, the
 * strip is homotopic to the rest of that face's boundary, see {@link fillingWord}). The strip is a side of a polygon
 * of Q, or a real strip to the face of another puncture of P. In the dual graph the chosen strips form a forest whose
 * roots are the polygons of Q (so that every face left holds one puncture of Q); they are listed leaves first, the
 * order in which they are deleted. Sides of Q come first; at most `limit` ways.
 *
 * A puncture of P need not border a polygon of Q itself: bordering isn't invariant under f, since the boundary of a
 * puncture with one cusp is pulled tight at its cusp (the cut study).
 */
export function fillings(surface: FibredSurface, limit = MAX_FILLINGS): OrientedEdge[][] {
  const words = surface.graph.boundaryWords();
  const faceOf = new Map<OrientedEdge, number>();
  words.forEach((w, i) => w.letters.forEach((x) => faceOf.set(x, i)));
  const ofP = words.flatMap((w, i) => (w.letters.some((x) => !surface.peripheral.has(x.edge)) ? [i] : []));
  const candidates = ofP.map((i) => {
    const seen = new Set<Edge>();
    return (words[i] as EdgePath).letters
      .filter((x) => faceOf.get(x.reversed) !== i && !seen.has(x.edge) && seen.add(x.edge))
      .sort((x, y) => Number(surface.peripheral.has(y.edge)) - Number(surface.peripheral.has(x.edge)));
  });
  const result: OrientedEdge[][] = [];
  const parent = new Map<number, number>(); // face of P → the face its strip leads to
  const chosen: OrientedEdge[] = [];
  /** The faces from `i` along the parents, up to a face that has none (a polygon of Q, or one not decided yet). */
  const path = (i: number): number[] => {
    const faces = [i];
    for (let j = parent.get(i); j !== undefined && !faces.includes(j); j = parent.get(j)) faces.push(j);
    return faces;
  };
  const choose = (k: number): void => {
    if (result.length >= limit) return;
    if (k === ofP.length) {
      // Leaves first: the faces farther from Q before those they lead to.
      const depth = (i: number) => path(i).length;
      const order = ofP.map((i, n) => ({ x: chosen[n] as OrientedEdge, depth: depth(i) }));
      result.push(order.sort((a, b) => b.depth - a.depth).map((o) => o.x));
      return;
    }
    const i = ofP[k] as number;
    for (const x of candidates[k] as OrientedEdge[]) {
      parent.set(i, faceOf.get(x.reversed) as number);
      const faces = path(i);
      // (no cycle: the path from i ends at a face without a parent)
      if (parent.get(faces.at(-1) as number) === undefined) {
        chosen[k] = x;
        choose(k + 1);
      }
      parent.delete(i);
    }
  };
  choose(0);
  return result;
}

/** A way to fill in P (see {@link fillings}), with the growth and the length of μ after pulling tight. */
export interface RatedFilling {
  /** The letters of the strips to delete in G₀, by name, in order. */
  readonly letters: readonly string[];
  readonly label: Text;
  /** The growth of g after the move and pulling tight. */
  readonly growth: number;
  /** The side crossings of all strips after pulling tight (only if the model is kept). */
  readonly sideCrossings?: number;
}

/**
 * The ways to fill in P for the shortcut at q, each tried on a copy and pulled tight, sorted by the growth after
 * pulling tight, then by the length of μ. Ways that fail are left out.
 */
export function ratedFillings(
  fs: FibredSurface,
  q: Singularity,
  remark?: (tt: TrainTrack) => Remarking | undefined,
  tt: TrainTrack = trainTrack(fs),
): RatedFilling[] {
  const { surface, polygons } = blowUpOrbit(fs, q, tt);
  const rated: RatedFilling[] = [];
  for (const letters of fillings(surface)) {
    const names = letters.map((x) => x.name);
    try {
      const remarking = remark?.(tt);
      const result = quietly(() => {
        const filled = replacePunctureBySingularity(fs, q, remarking, tt, names);
        filled.onError = () => {};
        pullTight(filled);
        return filled;
      });
      rated.push({
        letters: names,
        label: fillingLabel(surface, polygons, letters),
        growth: perronFrobenius(result, { essentialOnly: true }).growth,
        ...(remarking !== undefined && { sideCrossings: result.mu.totalLength() }),
      });
    } catch {
      // (this way fails)
    }
  }
  return rated.sort((a, b) => a.growth - b.growth || (a.sideCrossings ?? 0) - (b.sideCrossings ?? 0));
}

/**
 * "Delete the side q_α of q (between a and B); the strip c": a side of a polygon is named with the two strip ends of
 * the junction next to it, the last one of one gate and the first one of the next (the turn it bridges).
 */
function fillingLabel(
  surface: FibredSurface,
  polygons: ReadonlyMap<Vertex, readonly Edge[]>,
  letters: readonly OrientedEdge[],
): Text {
  const words = surface.graph.boundaryWords();
  const parts = letters.map((x): TextPart[] => {
    const junction = [...polygons].find(([, sides]) => sides.includes(x.edge))?.[0];
    if (junction === undefined) return ["the strip ", { strip: x.edge.name }];
    const face = words.find((w) => w.letters.includes(x)) as EdgePath;
    const k = face.letters.indexOf(x);
    const n = face.letters.length;
    const [before, after] = [face.letters[(k - 1 + n) % n], face.letters[(k + 1) % n]] as [
      OrientedEdge,
      OrientedEdge,
    ];
    return [
      "the side ",
      { strip: x.edge.name },
      " of ",
      { junction: junction.name },
      " (between ",
      { strip: before.reversed.name },
      " and ",
      { strip: after.name },
      ")",
    ];
  });
  return ["Delete ", ...parts.flatMap((p, i) => [...(i === 0 ? [] : ["; "]), ...p])];
}

/**
 * Replaces the artificial puncture p (or the orbit P of punctures) by the orbit Q of the singularity q:
 * {@link blowUpOrbit}, then {@link fillPuncture} for each puncture of P, deleting the strips of G₀ whose letters are
 * named in `fill` (see {@link fillings}; by default the first way listed there).
 *
 * The result has no periphery (Q is a single orbit of punctures), and its μ is reset to the identity onto a copy,
 * since the surface is now punctured differently. Continuing the algorithm finds the efficient representative on
 * Σ ∖ Q (see port note 15 for what that implies for the growth).
 *
 * @throws Error if a letter of `fill` isn't a strip of G₀ between the face of a puncture of P and another face.
 */
export function replacePunctureBySingularity(
  fs: FibredSurface,
  q: Singularity,
  remarking?: Remarking,
  tt: TrainTrack = trainTrack(fs),
  fill?: readonly string[],
): FibredSurface {
  const blownUp = blowUpOrbit(fs, q, tt);
  narrate(blowUpText([...blownUp.polygons.keys()].map((v) => v.name)));
  const keep = remarking !== undefined && keepingStates();
  const surface =
    remarking === undefined
      ? blownUp.surface
      : new FibredSurface({
          graph: blownUp.surface.graph,
          g: blownUp.surface.g,
          mu: markBlownUp(blownUp, remarking),
          peripheral: blownUp.surface.peripheral,
        });
  surface.onError = fs.onError;
  surface.legacyDefaultNames = fs.legacyDefaultNames;
  // A strip for each puncture of P, by its letter on that face (with a single puncture p: a side of a polygon of Q).
  const letter = (name: string) => {
    const x = surface.graph.orientedEdges.find((y) => y.name === name);
    if (x === undefined) throw new Error(`${name} is no strip of the blown-up surface`);
    return x;
  };
  const chosen = fill?.map(letter) ?? fillings(surface, 1)[0];
  if (chosen === undefined) throw new Error("The punctures of P can't be filled in");
  const ofP = surface.graph
    .boundaryWords()
    .filter((w) => w.letters.some((x) => !surface.peripheral.has(x.edge)));
  if (chosen.length !== ofP.length)
    throw new Error(`${ofP.length} punctures to fill in, but ${chosen.length} strips to delete`);
  const before = keep ? shown(surface) : undefined;
  if (chosen.length === 1) {
    const [side] = chosen as [OrientedEdge];
    const { x, forwardImage } = fillingWord(surface, side.edge, side);
    narrate(
      [
        "Fill in p: replace ",
        { strip: side.edge.name },
        ` by ${(x.isForward ? forwardImage : forwardImage.inverse).toString() || "·"} in all images.`,
      ],
      { before },
    );
    explain([
      "With p filled in, ",
      { strip: side.edge.name },
      " is homotopic to the rest of p's boundary, backwards; the faces of p and ",
      { junction: q.junction.name },
      " merge.",
    ]);
  } else {
    narrate(
      [
        "Fill in the punctures of P: replace ",
        ...chosen.flatMap((x, i): TextPart[] => [...(i === 0 ? [] : [", "]), { strip: x.edge.name }]),
        " by the rest of each boundary, backwards, in all images.",
      ],
      { before },
    );
    explain([
      "Each face of P merges with the face across the strip deleted (one of Q, or of a puncture of P filled in later).",
    ]);
  }
  if (remarking !== undefined) explain([fillingText(remarking)]);
  // The faces of G₀ merge as strips are deleted: each deletion must fill in a puncture of P whose face (with the faces
  // merged into it) holds no other puncture left, across from a different face.
  const words = surface.graph.boundaryWords();
  const faceOf = new Map(words.flatMap((w, i) => w.letters.map((x) => [x, i] as const)));
  const merged = words.map((_, i) => i);
  const root = (i: number): number => (merged[i] === i ? i : (merged[i] = root(merged[i] as number)));
  const open = words.map((w): "P" | "Q" | "filled" =>
    w.letters.every((x) => surface.peripheral.has(x.edge)) ? "Q" : "P",
  );
  let filled = surface;
  for (const side of chosen) {
    const [a, b] = [root(faceOf.get(side) as number), root(faceOf.get(side.reversed) as number)];
    const punctures = open.filter((kind, i) => kind !== "filled" && root(i) === a);
    if (a === b || punctures.length !== 1 || punctures[0] !== "P")
      throw new Error(`Deleting ${side.edge} doesn't fill in one puncture of P, across from another face`);
    open[open.findIndex((kind, i) => kind === "P" && root(i) === a)] = "filled";
    merged[a] = b;
    filled = fillPuncture(filled, side.edge, { keepMarking: remarking !== undefined, side });
  }
  const result = remarking === undefined ? filled : finishRemarking(filled, remarking);
  mergeAllValenceTwoLines(result, "Filling in left valence-2 lines.");
  return result;
}

/**
 * μ of the blown-up graph: a strip runs along its real branch of τ, from its junction (outside Q, through the inside of
 * the junction to its switch) or from its switch (at Q); a polygon branch is its branch of τ.
 */
function markBlownUp(blownUp: BlownUp, remarking: Remarking): CombinatorialMap {
  const { tt, origin } = blownUp;
  const graph = blownUp.surface.graph;
  const mu = new CombinatorialMap(graph, remarking.spine);
  for (const v of graph.vertices) {
    const old = origin.vertices.get(v) as Vertex;
    mu.setVertexImage(v, tt.junctionOf.has(old) ? remarking.switchCell(old) : remarking.junctionCell(old));
  }
  for (const e of graph.edges) {
    const old = origin.edges.get(e) as Edge;
    const branch = tt.realBranch.get(old);
    if (branch === undefined) {
      mu.setImage(e.forward, remarking.part(old, 0, 1).reduced());
      continue;
    }
    const atQ = (x: OrientedEdge) => tt.junctionOf.has(origin.vertices.get(x.source) as Vertex);
    const start = atQ(e.forward) ? EdgePath.EMPTY : remarking.toSwitch(old.forward);
    const end = atQ(e.backward) ? EdgePath.EMPTY : remarking.toSwitch(old.backward).inverse;
    mu.setImage(e.forward, start.concat(remarking.part(branch, 0, 1), end).reduced());
  }
  return mu;
}

/** The result of {@link blowUpOrbit}. */
export interface BlownUp {
  /** G₀ with g₀; its periphery consists of the polygons of Q. */
  readonly surface: FibredSurface;
  /** The train track τ of the surface that was blown up. */
  readonly tt: TrainTrack;
  /** What each vertex (a junction of G, or a switch of τ at Q) and edge (a strip of G, or a branch of τ) comes from. */
  readonly origin: {
    readonly vertices: ReadonlyMap<Vertex, Vertex>;
    readonly edges: ReadonlyMap<Edge, Edge>;
  };
  /** For each junction of Q, the strips of G₀ that form its polygon. */
  readonly polygons: ReadonlyMap<Vertex, readonly Edge[]>;
}

/**
 * Blows up the junctions of the orbit Q into their infinitesimal polygons (the thesis, § "The goal"): G₀ has a
 * junction per switch there and the polygon's infinitesimal branches as new strips, and g₀ is g with the
 * infinitesimal branches inserted at the turns at Q (read off g_τ). This is a spine of Σ ∖ ({p} ∪ Q) with a
 * train-track map of the same growth; the polygons form its periphery.
 *
 * A junction outside Q that g maps into Q (it has at most two gates) is mapped to the corner of one gate, and the
 * strips of the other gate take the side of the polygon to their corner first (see {@link entriesInto}).
 */
export function blowUpOrbit(fs: FibredSurface, q: Singularity, tt: TrainTrack = trainTrack(fs)): BlownUp {
  const inQ = new Set(q.orbit);
  const entries = entriesInto(tt, inQ);

  const graph = new RibbonGraph();
  const vertexOf = new Map<Vertex, Vertex>(); // junction outside Q, or switch at Q → vertex of G₀
  for (const v of fs.graph.vertices) if (!inQ.has(v)) vertexOf.set(v, graph.addVertex(v.name, v.color));
  const used = new Set(graph.vertices.map((v) => v.name));
  for (const s of tt.graph.vertices) {
    const junction = tt.junctionOf.get(s) as Vertex;
    if (inQ.has(junction))
      vertexOf.set(
        s,
        graph.addVertex(junctionPartName(junction, true, used, fs.legacyDefaultNames), s.color),
      );
  }
  const endVertex = (e: OrientedEdge) =>
    vertexOf.get(inQ.has(e.source) ? (tt.switchOf.get(e) as Vertex) : e.source) as Vertex;

  const edgeOf = new Map<Edge, Edge>(); // strip of G or infinitesimal branch at Q → edge of G₀
  for (const e of fs.graph.edges)
    edgeOf.set(
      e,
      graph.addEdge(endVertex(e.forward), endVertex(e.backward), { name: e.name, color: e.color }),
    );
  const atQ = (branch: Edge) => inQ.has(tt.junctionOf.get(branch.source) as Vertex);
  const polygons = new Map<Vertex, Edge[]>(q.orbit.map((v) => [v, []]));
  for (const branch of tt.graph.edges)
    if (tt.kind.get(branch) === "infinitesimal" && atQ(branch)) {
      const edge = graph.addEdge(
        vertexOf.get(branch.source) as Vertex,
        vertexOf.get(branch.target) as Vertex,
        {
          name: branch.name,
          color: branch.color,
        },
      );
      edgeOf.set(branch, edge);
      polygons.get(tt.junctionOf.get(branch.source) as Vertex)?.push(edge);
    }
  const strip = new Map([...tt.realBranch].map(([e, branch]) => [branch, e]));
  const orient = (x: OrientedEdge): OrientedEdge => {
    const edge = edgeOf.get(strip.get(x.edge) ?? x.edge) as Edge;
    return x.isForward ? edge.forward : edge.backward;
  };
  // Cyclic orders: as in G away from Q, as in τ at the switches of Q.
  for (const v of fs.graph.vertices)
    if (!inQ.has(v)) graph.setStar(vertexOf.get(v) as Vertex, fs.graph.star(v).map(orient));
  for (const s of tt.graph.vertices)
    if (inQ.has(tt.junctionOf.get(s) as Vertex))
      graph.setStar(vertexOf.get(s) as Vertex, tt.graph.star(s).map(orient));

  // g₀: g_τ with the infinitesimal branches outside Q dropped.
  const keep = (x: OrientedEdge) => tt.kind.get(x.edge) === "real" || atQ(x.edge);
  const g0 = new CombinatorialMap(graph, graph);
  for (const [source, target] of vertexOf) {
    // Switches (at Q) are mapped as in τ, junctions outside Q as in G, or to a corner if they enter Q.
    const entry = entries.get(source);
    const image = tt.junctionOf.has(source)
      ? tt.gTau.vertexImage(source)
      : entry !== undefined
        ? tt.gTau.vertexImage(entry.base)
        : fs.g.vertexImage(source);
    g0.setVertexImage(target, vertexOf.get(image) as Vertex);
  }
  /** The side of the polygon from the image corner of the junction where `end` starts to that of its gate, if any. */
  const side = (end: OrientedEdge): OrientedEdge[] => {
    const s = entries.get(end.source)?.sides.get(tt.switchOf.get(end) as Vertex);
    return s === undefined ? [] : [orient(s)];
  };
  for (const [original, edge] of edgeOf) {
    const branch = tt.realBranch.get(original) ?? original;
    const image = tt.gTau.image(branch.forward).letters.filter(keep).map(orient);
    const ends =
      branch === original
        ? { start: [], end: [] }
        : { start: side(original.forward), end: side(original.backward).map((x) => x.reversed) };
    g0.setImage(edge.forward, EdgePath.from([...ends.start, ...image, ...ends.end]));
  }

  const surface = new FibredSurface({ graph, g: g0, peripheral: [...polygons.values()].flat() });
  surface.onError = fs.onError;
  surface.legacyDefaultNames = fs.legacyDefaultNames;
  const invert = <K, V>(map: Map<K, V>) => new Map([...map].map(([k, v]) => [v, k] as const));
  return { surface, polygons, tt, origin: { vertices: invert(vertexOf), edges: invert(edgeOf) } };
}

/**
 * The boundary word x β of p's face through ε (x = ε in some orientation), and what ε (forward) is homotopic to once p
 * is filled in: β⁻¹ for x = ε, β for x = ε̄. With several punctures (port note 26), `side` is the letter x of ε on the
 * face of the puncture to fill in (each oriented edge lies on exactly one face).
 */
export function fillingWord(
  fs: FibredSurface,
  epsilon: Edge,
  side?: OrientedEdge,
): { x: OrientedEdge; forwardImage: EdgePath } {
  const puncture = fs.graph
    .boundaryWords()
    .find((w) =>
      side !== undefined
        ? w.letters.includes(side)
        : w.letters.some((x) => x.edge === epsilon) && w.letters.some((x) => !fs.peripheral.has(x.edge)),
    );
  if (puncture === undefined) throw new Error(`${epsilon} doesn't lie on the boundary of the puncture`);
  const k = puncture.letters.findIndex((x) => x.edge === epsilon);
  const x = puncture.at(k) as OrientedEdge;
  const beta = puncture.slice(k + 1).concat(puncture.slice(0, k)); // the boundary word is x β
  return { x, forwardImage: x.isForward ? beta.inverse : beta }; // x ≃ β⁻¹
}

/**
 * Fills in the puncture p of a blown-up surface by deleting the strip ε of a polygon. Its other side is p's face
 * (p is the only puncture whose boundary word contains non-peripheral strips), whose boundary word reads ε β.
 * With p filled in, ε β bounds a disk, so ε ≃ β⁻¹, and ε is replaced by β⁻¹ in all images: the homotopy
 * equivalence that collapses the disk of p onto the rest of its boundary. The faces of p and of ε's polygon merge.
 *
 * Returns a new fibred surface on the same graph (without ε), without periphery and with μ reset.
 */
export function fillPuncture(
  fs: FibredSurface,
  epsilon: Edge,
  options: { keepMarking?: boolean; side?: OrientedEdge } = {},
): FibredSurface {
  const { forwardImage } = fillingWord(fs, epsilon, options.side);
  fs.g.substituteInImages((e) => (e === epsilon ? forwardImage : undefined));
  fs.graph.removeEdge(epsilon);
  fs.g.forgetEdge(epsilon);
  if (options.keepMarking) fs.mu.forgetEdge(epsilon);

  const result = new FibredSurface({ graph: fs.graph, g: fs.g, ...(options.keepMarking && { mu: fs.mu }) });
  result.onError = fs.onError;
  result.legacyDefaultNames = fs.legacyDefaultNames;
  return result;
}

/** A copy of the state to show, with μ pulled tight (see {@link tightenMarking}). */
function shown(surface: FibredSurface): FibredSurface {
  const copy = surface.copy();
  tightenMarking(copy);
  return copy;
}
