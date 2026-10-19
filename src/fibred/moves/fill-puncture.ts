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
import { keepingStates, narrate } from "../narration";
import type { Remarking } from "../remarking";
import type { TextPart } from "../suggestions";
import { fillingText, finishRemarking, junctionPartName } from "./cut-closed-surface";
import { tightenMarking } from "./isotopy";
import { mergeAllValenceTwoLines } from "./valence";
import { trainTrack, type TrainTrack } from "../train-track";

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

/**
 * Replaces the artificial puncture p by the orbit Q of the singularity q: {@link blowUpOrbit}, then
 * {@link fillPuncture} with the first infinitesimal branch of q's polygon.
 *
 * The result has no periphery (Q is a single orbit of punctures), and its μ is reset to the identity onto a copy,
 * since the surface is now punctured differently. Continuing the algorithm finds the efficient representative on
 * Σ ∖ Q (see port note 15 for what that implies for the growth).
 */
export function replacePunctureBySingularity(
  fs: FibredSurface,
  q: Singularity,
  remarking?: Remarking,
  tt: TrainTrack = trainTrack(fs),
): FibredSurface {
  const blownUp = blowUpOrbit(fs, q, tt);
  const first = blownUp.polygons.get(q.junction)?.[0];
  if (first === undefined) throw new Error(`${q.junction} has no infinitesimal polygon`);
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
  // One branch ε of a polygon of Q on the boundary of each puncture of P, by its letter on that face (with a single
  // puncture p: the first branch of q's polygon, whose other side is p's face).
  const faces = surface.graph
    .boundaryWords()
    .filter((w) => w.letters.some((x) => !surface.peripheral.has(x.edge)));
  const fillings = faces.map((face) => {
    const x =
      faces.length === 1
        ? face.letters.find((y) => y.edge === first)
        : face.letters.find((y) => surface.peripheral.has(y.edge));
    if (x === undefined)
      throw new Error(`The puncture with the boundary ${face} doesn't border a polygon of Q`);
    return x;
  });
  const before = keep ? shown(surface) : undefined;
  if (fillings.length === 1) {
    const [side] = fillings as [OrientedEdge];
    const { x, forwardImage } = fillingWord(surface, side.edge, side);
    narrate(
      [
        "Fill in p: the branch ",
        { strip: side.edge.name },
        " lies between the polygon of ",
        { junction: q.junction.name },
        ` and p, so with p filled in it is homotopic to ${(x.isForward ? forwardImage : forwardImage.inverse).toString() || "a point"} (the rest of p's boundary, backwards). It is replaced by that in all images and deleted; the faces of p and q merge.`,
        ...(remarking === undefined ? [] : [" ", fillingText(remarking)]),
      ],
      { before },
    );
  } else
    narrate(
      [
        `Fill in the ${fillings.length} punctures of P: on the boundary of each lies a branch of a polygon of Q (`,
        ...fillings.flatMap((x, i): TextPart[] => [...(i === 0 ? [] : [", "]), { strip: x.edge.name }]),
        "), which, with the puncture filled in, is homotopic to the rest of the puncture's boundary, backwards. Each is replaced by that in all images and deleted; the faces of P merge with those of Q.",
        ...(remarking === undefined ? [] : [" ", fillingText(remarking)]),
      ],
      { before },
    );
  let filled = surface;
  for (const side of fillings)
    filled = fillPuncture(filled, side.edge, { keepMarking: remarking !== undefined, side });
  const result = remarking === undefined ? filled : finishRemarking(filled, remarking);
  mergeAllValenceTwoLines(result, "Filling in left valence-2 lines. Merge each into one strip:");
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
 * @throws Error if a junction outside Q is mapped into Q (not supported yet).
 */
export function blowUpOrbit(fs: FibredSurface, q: Singularity, tt: TrainTrack = trainTrack(fs)): BlownUp {
  const inQ = new Set(q.orbit);
  for (const v of fs.graph.vertices)
    if (!inQ.has(v) && inQ.has(fs.g.vertexImage(v)))
      throw new Error(
        `The junction ${v} outside the orbit of ${q.junction} is mapped into it; not supported yet`,
      );

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
    // Switches (at Q) are mapped as in τ, junctions outside Q as in G.
    const image = tt.junctionOf.has(source) ? tt.gTau.vertexImage(source) : fs.g.vertexImage(source);
    g0.setVertexImage(target, vertexOf.get(image) as Vertex);
  }
  for (const [original, edge] of edgeOf) {
    const branch = tt.realBranch.get(original) ?? original;
    g0.setImage(edge.forward, EdgePath.from(tt.gTau.image(branch.forward).letters.filter(keep).map(orient)));
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
