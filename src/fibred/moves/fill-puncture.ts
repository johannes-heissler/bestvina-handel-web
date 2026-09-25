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
import { trainTrack, type TrainTrack } from "../train-track";

/** A junction with an infinitesimal polygon (a singularity of angle ≥ 3π) and its period under g. */
export interface Singularity {
  readonly junction: Vertex;
  /** The orbit v, g(v), …, g^{k−1}(v) of the junction. */
  readonly orbit: readonly Vertex[];
}

/**
 * Whether the fibred surface is in the situation of the thesis's Lemma "oneCusp": a single puncture (no
 * periphery, one boundary word), growth > 1, and the boundary word of τ at the puncture has exactly one cusp.
 */
export function hasOneCuspPuncture(fs: FibredSurface, tt: TrainTrack = trainTrack(fs)): boolean {
  const real = tt.boundaryWords().filter((b) => !b.infinitesimal);
  return fs.peripheral.size === 0 && tt.growth > 1 + 1e-9 && real.length === 1 && real[0]?.cusps === 1;
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
 * Replaces the artificial puncture p by the orbit Q of the singularity q:
 *
 * 1. **Blow up** the junctions of Q into their infinitesimal polygons: G₀ has a junction per switch there, the
 *    polygon's infinitesimal branches as new strips, and g₀ is g with the infinitesimal branches inserted at the
 *    turns at Q (from g_τ). This is a spine of Σ ∖ ({p} ∪ Q) with a train-track map of the same growth (the thesis,
 *    § "The goal").
 * 2. **Fill in p:** delete one infinitesimal branch ε of q's polygon. Its other side is p's face, whose boundary word
 *    reads ε β; with p filled in, ε β bounds a disk, so ε is replaced by β⁻¹ in all images. The faces of p and q merge,
 *    and the result is a spine of Σ ∖ Q with a carrying map of the same f̂.
 *
 * The result has no periphery (Q is a single orbit of punctures), and its μ is reset to the identity onto a copy,
 * since the surface is now punctured differently. Continuing the algorithm finds the efficient representative on
 * Σ ∖ Q; by the thesis there is one with growth < λ, so the growth drops strictly.
 *
 * @throws Error if a junction outside Q is mapped into Q (not supported yet).
 */
export function replacePunctureBySingularity(fs: FibredSurface, q: Singularity): FibredSurface {
  const tt = trainTrack(fs);
  const inQ = new Set(q.orbit);
  for (const v of fs.graph.vertices)
    if (!inQ.has(v) && inQ.has(fs.g.vertexImage(v)))
      throw new Error(
        `The junction ${v} outside the orbit of ${q.junction} is mapped into it; not supported yet`,
      );

  // Step 1: G₀.
  const graph = new RibbonGraph();
  const vertexOf = new Map<Vertex, Vertex>(); // junction outside Q, or switch at Q → vertex of G₀
  for (const v of fs.graph.vertices) if (!inQ.has(v)) vertexOf.set(v, graph.addVertex(v.name, v.color));
  for (const s of tt.graph.vertices) {
    const junction = tt.junctionOf.get(s) as Vertex;
    if (inQ.has(junction)) vertexOf.set(s, graph.addVertex(s.name, s.color));
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
  for (const branch of tt.graph.edges)
    if (tt.kind.get(branch) === "infinitesimal" && atQ(branch))
      edgeOf.set(
        branch,
        graph.addEdge(vertexOf.get(branch.source) as Vertex, vertexOf.get(branch.target) as Vertex, {
          name: branch.name,
          color: branch.color,
        }),
      );
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

  // Step 2: fill in p by deleting an infinitesimal branch ε of q's polygon.
  const epsilonBranch = tt.graph.edges.find(
    (b) => tt.kind.get(b) === "infinitesimal" && tt.junctionOf.get(b.source) === q.junction,
  );
  if (epsilonBranch === undefined) throw new Error(`${q.junction} has no infinitesimal polygon`);
  const epsilon = edgeOf.get(epsilonBranch) as Edge;
  // The boundary word of p is the one that contains strips; the other side of ε is the polygon of q.
  const isStrip = (x: OrientedEdge) => [...tt.realBranch.keys()].some((e) => edgeOf.get(e) === x.edge);
  const puncture = graph
    .boundaryWords()
    .find((w) => w.letters.some((x) => x.edge === epsilon) && w.letters.some(isStrip));
  if (puncture === undefined) throw new Error("The branch ε doesn't lie on the boundary of p");
  const k = puncture.letters.findIndex((x) => x.edge === epsilon);
  const x = puncture.at(k) as OrientedEdge;
  const beta = puncture.slice(k + 1).concat(puncture.slice(0, k)); // B = x β
  const forwardImage = x.isForward ? beta.inverse : beta; // x ≃ β⁻¹
  g0.substituteInImages((e) => (e === epsilon ? forwardImage : undefined));
  graph.removeEdge(epsilon);
  g0.forgetEdge(epsilon);

  const result = new FibredSurface({ graph, g: g0 });
  result.onError = fs.onError;
  return result;
}
