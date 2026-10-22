/**
 * Headless study of the closed-surface move (cut along a singular leaf, and the shortcut that fills the puncture):
 * examples, decision nodes (states where the closed-surface suggestion is next), and expanding a node by one choice
 * followed by the autopilot for everything else.
 *
 * A decision node is serialized as its graph (stars) and g only: at a decision node, the next move resets μ in the
 * headless setting (no remarking), so μ doesn't influence anything below it.
 */
import { CombinatorialMap } from "../../src/graph/combinatorial-map";
import { EdgePath } from "../../src/graph/edge-path";
import { type OrientedEdge, RibbonGraph, type Vertex } from "../../src/graph/ribbon-graph";
import { FibredSurface } from "../../src/fibred/fibred-surface";
import { applyMove, type Move } from "../../src/fibred/move";
import { autopilot, DEFAULT_AUTOMATIC, nextSuggestion, plainText, type Suggestion } from "../../src/fibred/suggestions";
import { trainTrack, type TrainTrack } from "../../src/fibred/train-track";
import { polygonSingularities } from "../../src/fibred/moves/fill-puncture";
import {
  cutOptions,
  prongsOfOrbit,
  punctureCount,
  ringLetters,
  ringsCutOff,
} from "../../src/fibred/moves/cut-closed-surface";
import { growingSlits } from "../../src/fibred/cut-along-leaf";
import { prongs, imageProng, type Prong } from "../../src/fibred/singular-leaves";
import { buildPreset, presetNamed, type Preset } from "../../src/examples/presets";
import { GENUS_2_GENERATORS } from "../../src/examples/generators";
import type { SurfaceModel } from "../../src/examples/models";

// ─── Examples ────────────────────────────────────────────────────────────────────────────────

export interface NamedMap {
  readonly text: string;
  readonly name: string;
}

export interface ExampleSpec {
  readonly id: string;
  readonly family: string;
  readonly genus: number;
  /** A preset by name, or a polygon word with reversed edges and maps (postcomposed in order). */
  readonly preset?: string;
  readonly polygon?: string;
  readonly reversed?: readonly string[];
  readonly maps?: readonly NamedMap[];
}

const polygonModel = (word: string): SurfaceModel => ({
  kind: "polygon",
  name: word,
  description: `The polygon ${word}`,
  word: word.split(" "),
  geometry: { kind: "ideal" },
  closed: false,
});

export function buildExample(spec: ExampleSpec): FibredSurface {
  if (spec.preset !== undefined) {
    const preset = presetNamed(spec.preset);
    if (preset === undefined) throw new Error(`No preset ${spec.preset}`);
    return buildPreset(preset);
  }
  const preset: Preset = {
    name: spec.id,
    description: spec.id,
    model: polygonModel(spec.polygon as string),
    options: { reversed: [...(spec.reversed ?? [])] },
    maps: (spec.maps ?? []).map((m) => ({ ...m, mode: "postcompose" as const })),
  };
  return buildPreset(preset);
}

const invert = (x: string) => (x === x.toLowerCase() ? x.toUpperCase() : x.toLowerCase());

/**
 * The point pushes of the polygon's vertex along the sides, on the rose dual to the polygon: x ↦ the boundary word W
 * read from just after X, without X (W = R or R⁻¹, R the boundary word of G). For the genus-2 point-push preset these
 * are exactly P_α, P_γ, P_δ (W = R at a, c, d), P_β̄ (W = R⁻¹ at b) and their inverses.
 */
export function pointPushes(polygon: string, reversed: readonly string[]): { name: string; inverseName: string; map: string; inverse: string }[] {
  const fs = buildExample({ id: "", family: "", genus: 0, polygon, reversed, maps: [] });
  const words = fs.graph.boundaryWords();
  if (words.length !== 1) throw new Error("Expected one boundary word");
  const R = (words[0] as EdgePath).letters.map((x) => x.name);
  const Rinv = R.toReversed().map(invert);
  const pushWith = (W: string[], x: string) => {
    const i = W.indexOf(invert(x));
    const after = [...W.slice(i + 1), ...W.slice(0, i)];
    return `${x} -> ${after.join(" ")}`;
  };
  return fs.graph.edges.map((e) => ({
    name: `P_${e.name}`,
    inverseName: `P_${e.name}⁻¹`,
    map: pushWith(R, e.name),
    inverse: pushWith(Rinv, e.name),
  }));
}

/** Rewrites a map text with a letter substitution (lowercase → letter, inverted for uppercase). */
function substitute(map: string, letter: Record<string, string>): string {
  const sub = (x: string) => {
    const lower = x.toLowerCase();
    const y = letter[lower] ?? lower;
    return x === lower ? y : invert(y);
  };
  return map
    .split(",")
    .map((entry) => {
      const [edge, image] = entry.split("->").map((s) => s.trim().split(/\s+/).map(sub)) as [string[], string[]];
      const name = edge[0] as string;
      return name === name.toLowerCase()
        ? `${name} -> ${image.join(" ")}`
        : `${name.toLowerCase()} -> ${image.toReversed().map(invert).join(" ")}`;
    })
    .join(", ");
}

/** The Lickorish twists of GENUS_2_GENERATORS rewritten for the point-push setup (polygon a b A B c d C D, a and b reversed). */
export function genus2PointPushTwists(): NamedMap[] {
  // From the BH 6.1 setup to the point-push setup: a → A, b → B, c → D, d → C.
  const letter = { a: "A", b: "B", c: "D", d: "C" };
  return GENUS_2_GENERATORS.generators.flatMap((g) => [
    { name: g.name, text: substitute(g.map, letter) },
    { name: `${g.name}⁻¹`, text: substitute(g.inverse, letter) },
  ]);
}

/** Lickorish twists on the plain genus-3 polygon a b A B c d C D e f E F (no reversed sides), with inverses. */
export function genus3Twists(): NamedMap[] {
  const twists: [string, string, string][] = [
    ["D_a", "b -> a b", "b -> A b"],
    ["D_b", "a -> a B", "a -> a b"],
    ["D_c", "d -> c d", "d -> C d"],
    ["D_d", "c -> c D", "c -> c d"],
    ["D_e", "f -> e f", "f -> E f"],
    ["D_f", "e -> e F", "e -> e f"],
    // The chain curves b d and d f between the handles also separate the third handle from the centre of the rose.
    ["D_k₁", "a -> D B a, c -> B D c, e -> D B e b d, f -> D B f b d", "a -> b d a, c -> d b c, e -> b d e D B, f -> b d f D B"],
    ["D_k₂", "c -> F D c, e -> D F e, a -> F D a d f, b -> F D b d f", "c -> d f c, e -> f d e, a -> d f a F D, b -> d f b F D"],
  ];
  return twists.flatMap(([name, map, inverse]) => [
    { name, text: map },
    { name: `${name}⁻¹`, text: inverse },
  ]);
}

/** A small seeded pseudo-random generator (as in presets.ts). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Serialization of decision nodes ─────────────────────────────────────────────────────────

export interface SerializedSurface {
  /** Vertex names in graph order, each with its star (oriented edge names, counterclockwise). */
  readonly vertices: { name: string; star: string[] }[];
  /** Edges in graph order: name, source, target, image of the forward orientation. */
  readonly edges: { name: string; source: string; target: string; image: string[] }[];
  readonly vertexImages: Record<string, string>;
  readonly peripheral: string[];
  readonly isClosed: boolean;
  readonly mapName?: string;
}

export function serialize(fs: FibredSurface): SerializedSurface {
  return {
    vertices: fs.graph.vertices.map((v) => ({ name: v.name, star: fs.graph.star(v).map((x) => x.name) })),
    edges: fs.graph.edges.map((e) => ({
      name: e.name,
      source: e.source.name,
      target: e.target.name,
      image: fs.g.image(e.forward).letters.map((x) => x.name),
    })),
    vertexImages: Object.fromEntries(fs.graph.vertices.map((v) => [v.name, fs.g.vertexImage(v).name])),
    peripheral: [...fs.peripheral].map((e) => e.name),
    isClosed: fs.isClosed,
    ...(fs.mapName !== undefined && { mapName: fs.mapName }),
  };
}

export function deserialize(s: SerializedSurface): FibredSurface {
  const graph = new RibbonGraph();
  const vertex = new Map<string, Vertex>();
  for (const v of s.vertices) vertex.set(v.name, graph.addVertex(v.name));
  const oriented = new Map<string, OrientedEdge>();
  for (const e of s.edges) {
    const edge = graph.addEdge(vertex.get(e.source) as Vertex, vertex.get(e.target) as Vertex, { name: e.name });
    oriented.set(edge.forward.name, edge.forward);
    oriented.set(edge.backward.name, edge.backward);
  }
  for (const v of s.vertices)
    graph.setStar(
      vertex.get(v.name) as Vertex,
      v.star.map((x) => oriented.get(x) as OrientedEdge),
    );
  const g = new CombinatorialMap(graph, graph);
  for (const e of s.edges)
    g.setImage(oriented.get(e.name) as OrientedEdge, EdgePath.from(e.image.map((x) => oriented.get(x) as OrientedEdge)));
  for (const [v, w] of Object.entries(s.vertexImages)) g.setVertexImage(vertex.get(v) as Vertex, vertex.get(w) as Vertex);
  const fs = new FibredSurface({
    graph,
    g,
    peripheral: graph.edges.filter((e) => s.peripheral.includes(e.name)),
  });
  fs.isClosed = s.isClosed;
  if (s.mapName !== undefined) fs.mapName = s.mapName;
  return fs;
}

// ─── Running ─────────────────────────────────────────────────────────────────────────────────

/** Everything automatic except the closed-surface moves: the autopilot stops at each decision. */
export const AUTOMATIC = new Set([...DEFAULT_AUTOMATIC].filter((k) => k !== "closed surface"));

export interface RunInfo {
  readonly ms: number;
  readonly moves: number;
  readonly byKind: Record<string, number>;
}

export function runAutopilot(fs: FibredSurface): { surface: FibredSurface; stoppedAt: Suggestion; info: RunInfo } {
  const t = performance.now();
  const r = autopilot(fs, { automatic: AUTOMATIC, maxSteps: 1_000_000 });
  const byKind: Record<string, number> = {};
  for (const m of r.moves) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  return { surface: r.surface, stoppedAt: r.stoppedAt, info: { ms: performance.now() - t, moves: r.moves.length, byKind } };
}

/** The boundary words of τ: the cusps of each puncture, and the prongs of each singularity (infinitesimal polygon). */
export function trackShape(tt: TrainTrack): { punctureCusps: number[]; singularityProngs: number[] } {
  const words = tt.boundaryWords();
  return {
    punctureCusps: words.filter((b) => !b.infinitesimal).map((b) => b.cusps).sort((a, b) => a - b),
    singularityProngs: words.filter((b) => b.infinitesimal).map((b) => b.cusps).sort((a, b) => a - b),
  };
}

export function sizeOf(fs: FibredSurface) {
  return { strips: fs.graph.edgeCount, junctions: fs.graph.vertexCount, imageLength: fs.g.totalLength() };
}

export interface OrbitInfo {
  readonly junction: string;
  readonly period: number;
  /** The prongs of the singularities in the orbit (all candidates for L). */
  readonly prongs: number;
  readonly prongsPerSingularity: number;
  /** λ^(P−1) for the period P of its prongs: how much shorter the shortest preimage of L is (no limit for the cut). */
  readonly shrinking: number;
}

export interface NodeInfo {
  readonly punctures: number;
  readonly growth: number;
  readonly size: ReturnType<typeof sizeOf>;
  readonly shape: ReturnType<typeof trackShape>;
  readonly orbits: OrbitInfo[];
}

export function nodeInfo(fs: FibredSurface): NodeInfo {
  const tt = trainTrack(fs);
  const seen = new Set<Vertex>();
  const orbits = polygonSingularities(fs, tt)
    .filter((q) => {
      if (seen.has(q.junction)) return false;
      for (const v of q.orbit) seen.add(v);
      return true;
    })
    .map((q) => {
      const ps = prongsOfOrbit(tt, q.junction);
      return {
        junction: q.junction.name,
        period: q.orbit.length,
        prongs: ps.length,
        prongsPerSingularity: ps.length / q.orbit.length,
        shrinking: tt.growth ** (ps[0] === undefined ? 0 : prongPeriod(tt, ps[0]) - 1),
      };
    });
  return { punctures: punctureCount(tt), growth: tt.growth, size: sizeOf(fs), shape: trackShape(tt), orbits };
}

/** The outcome after a run of the autopilot: another decision, or a leaf. */
export function outcomeOf(surface: FibredSurface, stoppedAt: Suggestion) {
  let track: { growth?: number; punctures?: number; shape?: ReturnType<typeof trackShape>; trackError?: string } = {};
  try {
    const tt = trainTrack(surface);
    track = { growth: tt.growth, punctures: punctureCount(tt), shape: trackShape(tt) };
  } catch (e) {
    track = { trackError: (e as Error).message.slice(0, 200) };
  }
  const base = {
    kind: stoppedAt.kind,
    ...track,
    size: sizeOf(surface),
    description: plainText(stoppedAt.description).slice(0, 400),
    optionKinds: stoppedAt.options.map((o) => o.move.kind),
  };
  const classification = stoppedAt.classification;
  return {
    ...base,
    ...(classification && {
      classification: classification.kind,
      ...(classification.kind === "pseudo-Anosov" && { pAGrowth: classification.growth }),
      ...(classification.kind === "finite order" && { order: (classification as { order: number }).order }),
    }),
  };
}

export interface ProngAnalysis {
  readonly index: number;
  readonly junction: string;
  readonly orbitJunction: string;
  /** The length of L (real branches) at which the rings are cut off, if found within the limit. */
  readonly realBranches?: number;
  readonly failure?: string;
}

/** For every prong of every orbit, the length of L at which the boundaries of P are cut off (not confirmed by cutting). */
export function analyzeProngs(fs: FibredSurface, maxRealBranches = 500): ProngAnalysis[] {
  const tt = trainTrack(fs);
  const all = prongs(tt);
  const rings = ringLetters(tt);
  const result: ProngAnalysis[] = [];
  const info = nodeInfo(fs);
  for (const orbit of info.orbits) {
    const j = fs.graph.vertices.find((v) => v.name === orbit.junction) as Vertex;
    for (const prong of prongsOfOrbit(tt, j)) {
      const index = all.findIndex((p) => p.atSwitch === prong.atSwitch && p.below === prong.below);
      const junction = (tt.junctionOf.get(prong.atSwitch) as Vertex).name;
      try {
        const slitsFor = growingSlits(tt, prong, maxRealBranches);
        let found: number | undefined;
        let failure: string | undefined = "not within limit";
        for (let count = 1; count <= maxRealBranches; count++) {
          const slits = slitsFor(count);
          if (slits === undefined) {
            failure = "corner";
            break;
          }
          if (ringsCutOff(tt, rings, slits)) {
            found = count;
            failure = undefined;
            break;
          }
        }
        result.push({
          index,
          junction,
          orbitJunction: orbit.junction,
          ...(found !== undefined && { realBranches: found }),
          ...(failure !== undefined && { failure }),
        });
      } catch (e) {
        result.push({ index, junction, orbitJunction: orbit.junction, failure: `error: ${(e as Error).message.slice(0, 200)}` });
      }
    }
  }
  return result;
}

export type Choice =
  | { readonly kind: "cut"; readonly junction: string; readonly prong?: number; readonly realBranches?: number }
  | { readonly kind: "shortcut"; readonly junction: string };

/** Applies a closed-surface choice; returns the surface and what the cut chose. */
export function applyChoice(fs: FibredSurface, choice: Choice) {
  const t0 = performance.now();
  if (choice.kind === "shortcut") {
    const surface = applyMove(fs, { kind: "replace puncture by singularity", junction: choice.junction });
    return { surface, moveMs: performance.now() - t0, optionsMs: 0 };
  }
  const tt = trainTrack(fs);
  let prong = choice.prong;
  let realBranches = choice.realBranches;
  let options: { prong: number; realBranches: number }[] = [];
  let optionsMs = 0;
  if (prong === undefined) {
    const j = fs.graph.vertices.find((v) => v.name === choice.junction) as Vertex;
    const all = prongs(tt);
    const index = (p: Prong) => all.findIndex((q) => q.atSwitch === p.atSwitch && q.below === p.below);
    options = cutOptions(tt, prongsOfOrbit(tt, j)).map((o) => ({ prong: index(o.prong), realBranches: o.realBranches }));
    optionsMs = performance.now() - t0;
    if (options.length === 0) throw new NoCut("cutOptions found no cut");
    ({ prong, realBranches } = options[0] as { prong: number; realBranches: number });
  }
  const move: Move = {
    kind: "cut along a singular leaf",
    junction: choice.junction,
    prong,
    realBranches,
  } as Move;
  const t1 = performance.now();
  const surface = applyMove(fs, move);
  return { surface, moveMs: performance.now() - t1, optionsMs, options, prong, realBranches };
}

export class NoCut extends Error {}

/** The period of a prong under g_τ (for reports). */
export function prongPeriod(tt: TrainTrack, prong: Prong): number {
  let period = 1;
  for (let p = imageProng(tt, prong); !(p.atSwitch === prong.atSwitch && p.below === prong.below) && period < 10000; p = imageProng(tt, p))
    period++;
  return period;
}

export { nextSuggestion };
