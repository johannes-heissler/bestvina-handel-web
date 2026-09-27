/**
 * Model surfaces (the combinatorial part of the C# `SurfaceGenerator` / `ModelSurface`): how a surface is drawn, and
 * the reference spine G₀ that μ maps to. The geometry (vertex positions, geodesics) is computed later from these
 * descriptions; here are only the numbers the geometry needs.
 *
 * Three kinds (port note 19):
 *
 * - **polygon**: a polygon whose sides are glued in pairs, given by its word (the side labels read counterclockwise;
 *   "a" and "A" are glued with opposite orientations). All vertex classes are punctures (ideal vertices), or, for a
 *   closed surface, the one vertex class is an artificial puncture. G₀ is the dual rose: one loop per side pair,
 *   whose star is the word itself.
 * - **plane**: the plane with punctures (plus the one at ∞), without sides. G₀ is a graph of lassos around the points.
 * - **ribbon**: the fibred surface of a ribbon graph given by its boundary words, drawn glued from rectangles. G₀ is
 *   that ribbon graph.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { fromBoundaryWords, fromStars } from "../graph/from-boundary-words";
import { invertName, isForwardName } from "../graph/names";
import type { Edge, OrientedEdge, RibbonGraph } from "../graph/ribbon-graph";
import { FibredSurface } from "../fibred/fibred-surface";

export type Point2 = readonly [number, number];

/** How a polygon is realized geometrically. */
export type PolygonGeometry =
  /** A regular ideal hyperbolic polygon: every vertex is a puncture. */
  | { readonly kind: "ideal" }
  /** A regular compact hyperbolic polygon whose angles add up to 2π at the one vertex class (closed surfaces). */
  | { readonly kind: "compact" }
  /** A Euclidean polygon with these vertices (counterclockwise), e.g. a translation surface. */
  | { readonly kind: "flat"; readonly vertices: readonly Point2[] };

interface ModelBase {
  /** A short name for the gallery. */
  readonly name: string;
  readonly description: string;
}

export interface PolygonModel extends ModelBase {
  readonly kind: "polygon";
  /** The side labels, counterclockwise; each label occurs once in lower and once in upper case. */
  readonly word: readonly string[];
  readonly geometry: PolygonGeometry;
  /** The surface is closed: the single vertex class is a marked point, not a puncture. */
  readonly closed: boolean;
}

export interface PlaneModel extends ModelBase {
  readonly kind: "plane";
  /** The punctures in the plane (the point at ∞ is one more). */
  readonly points: readonly Point2[];
  /**
   * "rose": one base point with a lasso around each point, in the order of `points`.
   * "comb": a base point below each point with its lasso, joined by a path from left to right.
   */
  readonly spine: "rose" | "comb";
  /** Where the base point of the rose is. */
  readonly basePoint: Point2;
}

export interface RibbonModel extends ModelBase {
  readonly kind: "ribbon";
  /** The boundary words of G₀ (lists of oriented edge names). */
  readonly boundaryWords: readonly (readonly string[])[];
  /** The surface is closed: the single boundary word surrounds an artificial puncture. */
  readonly closed?: boolean;
}

export type SurfaceModel = PolygonModel | PlaneModel | RibbonModel;

/** Renaming and reorienting the edges of G₀, e.g. to match the names of a paper. */
export interface SpineNames {
  /** New names for edges of G₀, by their default (forward) name. */
  readonly names?: Readonly<Record<string, string>>;
  /** Edges (by default name) whose orientation is reversed. */
  readonly reversed?: readonly string[];
}

/** G₀ with the correspondence to the parts of the model. */
export interface Spine {
  readonly graph: RibbonGraph;
  /** For a polygon: for each side (counterclockwise), the oriented edge of G₀ that leaves the centre through it. */
  readonly sides?: readonly OrientedEdge[];
  /** For the plane: for each point, the loop of G₀ around it, oriented counterclockwise. */
  readonly lassos?: readonly OrientedEdge[];
}

/** The oriented edge names at each vertex of G₀ (before renaming). */
function stars(model: SurfaceModel): string[][] | undefined {
  switch (model.kind) {
    case "polygon":
      return [[...model.word]];
    case "plane": {
      const n = model.points.length;
      const loop = (i: number) => lassoName(i);
      if (model.spine === "rose")
        return [Array.from({ length: n }, (_, i) => [loop(i), invertName(loop(i))]).flat()];
      // comb: base point i has the path edges t(i−1) (to the left), t(i) (to the right) and its lasso below it.
      const path = (i: number) => `t${i + 1}`;
      return Array.from({ length: n }, (_, i) => [
        ...(i > 0 ? [invertName(path(i - 1))] : []),
        loop(i),
        invertName(loop(i)),
        ...(i < n - 1 ? [path(i)] : []),
      ]);
    }
    case "ribbon":
      return undefined;
  }
}

/** The name of the lasso around the i-th point of a plane model: a, b, c, … */
function lassoName(i: number): string {
  return i < 26 ? String.fromCharCode(97 + i) : `l${i + 1}`;
}

/** G₀ of a model, with the edges renamed and reoriented as given. */
export function spineOf(model: SurfaceModel, naming: SpineNames = {}): Spine {
  const starLists = stars(model);
  const graph =
    starLists === undefined ? fromBoundaryWords((model as RibbonModel).boundaryWords) : fromStars(starLists);
  const byName = new Map(graph.orientedEdges.map((e) => [e.name, e]));
  const sides =
    model.kind === "polygon" ? model.word.map((name) => byName.get(name) as OrientedEdge) : undefined;
  const lassos =
    model.kind === "plane"
      ? // With the star "… a A …", the inside of the petal is the boundary word "A", on the right of Ā: a runs
        // counterclockwise around its point.
        model.points.map((_, i) => byName.get(lassoName(i)) as OrientedEdge)
      : undefined;
  for (const name of naming.reversed ?? []) {
    const e = byName.get(name);
    if (e === undefined || !isForwardName(name)) throw new Error(`G₀ has no edge ${name}`);
    graph.invertEdge(e.edge);
  }
  for (const [from, to] of Object.entries(naming.names ?? {})) {
    const e = byName.get(from);
    if (e === undefined || !isForwardName(from)) throw new Error(`G₀ has no edge ${from}`);
    if (!isForwardName(to)) throw new Error(`Use a lowercase name for ${from}; reverse it with "reversed"`);
    e.edge.name = to;
  }
  const names = graph.edges.map((e) => e.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Two edges of G₀ have the same name");
  return { graph, ...(sides && { sides }), ...(lassos && { lassos }) };
}

/** Genus and number of punctures of the surface of a ribbon graph (from χ = V − E and the boundary words). */
export function topologyOf(graph: RibbonGraph): { genus: number; punctures: number } {
  const punctures = graph.boundaryWords().length;
  const chi = graph.vertexCount - graph.edgeCount;
  return { genus: (2 - chi - punctures) / 2, punctures };
}

/** Genus and punctures of the surface a model describes (a closed polygon has no puncture). */
export function topology(model: SurfaceModel): { genus: number; punctures: number } {
  const { genus, punctures } = topologyOf(spineOf(model).graph);
  return isClosedModel(model) ? { genus, punctures: 0 } : { genus, punctures };
}

/** Whether the model describes a closed surface (its one puncture is artificial). */
export function isClosedModel(model: SurfaceModel): boolean {
  return (model.kind === "polygon" && model.closed) || (model.kind === "ribbon" && model.closed === true);
}

// ─── The initial fibred surface ─────────────────────────────────────────────────────────────

export interface FibredSurfaceOptions extends SpineNames {
  /**
   * The punctures that get a peripheral lasso: either how many (the punctures whose boundary word in G₀ is
   * shortest first, as in C#), or the indices of the boundary words of G₀.
   */
  readonly peripheral?: number | readonly number[];
  /** Strips of G₀ that are already peripheral circles (for ribbon models given with their periphery). */
  readonly peripheralStrips?: readonly string[];
}

/**
 * The fibred surface G = G₀ with μ = the identity (a copy of G₀ mapping onto it), g = the identity, and a peripheral
 * lasso for each chosen puncture. The map is then set with `updateMap`.
 */
export function initialFibredSurface(model: SurfaceModel, options: FibredSurfaceOptions = {}): FibredSurface {
  const spine = spineOf(model, options);
  const g0 = spine.graph;
  const copy = g0.copy();
  const graph = copy.graph;
  const mu = new CombinatorialMap(graph, g0);
  for (const [v, w] of copy.vertexMap) mu.setVertexImage(w, v);
  for (const e of g0.edges) mu.setImage(copy.orient(e.forward), EdgePath.of(e.forward));
  const fs = new FibredSurface({ graph, g: CombinatorialMap.identity(graph), mu });
  fs.isClosed = isClosedModel(model);
  for (const name of options.peripheralStrips ?? []) {
    const e = graph.edges.find((x) => x.name === name);
    if (e === undefined) throw new Error(`G₀ has no strip ${name}`);
    fs.peripheral.add(e);
  }

  const words = g0.boundaryWords();
  const chosen =
    typeof options.peripheral === "number"
      ? words
          .map((w, i) => ({ i, length: w.length }))
          .sort((x, y) => x.length - y.length)
          .slice(0, options.peripheral)
          .map((x) => x.i)
      : [...(options.peripheral ?? [])];
  if (chosen.length > 0 && fs.isClosed)
    throw new Error("A closed surface has no punctures to make peripheral");
  if (chosen.length >= words.length && chosen.length > 0 && words.length > 1)
    throw new Error("At least one puncture must stay non-peripheral");
  PUNCTURE_NAMES.slice(0, chosen.length).forEach((loopName, k) =>
    addPeripheralLasso(fs, words[chosen[k] as number] as EdgePath, loopName),
  );
  return fs;
}

/** Names for the peripheral loops, as in C#: α, β, γ, … */
const PUNCTURE_NAMES = [..."αβγδεζηθικλ", ...Array.from({ length: 100 }, (_, i) => `ρ${i + 1}`)];

/**
 * Adds a peripheral lasso around the puncture whose boundary word in G₀ is `puncture` (the C# `SpineForSurface`):
 * a strip e of G next to the puncture (ē on its boundary word F, e on another one) is replaced by a stem s, at the
 * same place in the cyclic order, and a loop q around the puncture at the end of s. The rank of G stays the same.
 *
 * μ(s) is trivial and μ(q) = μ(F′)⁻¹, where F′ is the boundary word F of G rotated to end with ē: the outer boundary
 * word then maps to the one that contained e, and q's inner side to F (port note 19).
 */
function addPeripheralLasso(fs: FibredSurface, puncture: EdgePath, loopName: string): void {
  const face = fs.graph
    .boundaryWords()
    .find((w) => fs.mu.imageOfPath(w).cyclicallyReduced().isRotationOf(puncture.cyclicallyReduced()));
  if (face === undefined) throw new Error(`No boundary word of G maps to ${puncture}`);
  const onFace = new Set(face.letters);
  const candidates = face.letters.filter(
    (y) => !onFace.has(y.reversed) && !fs.peripheral.has(y.edge) && !isStem(fs, y.edge),
  );
  // Prefer strips named with a digit (the C# rule: sides that were split for extra punctures).
  const y = candidates.find((x) => /\d$/.test(x.edge.name)) ?? candidates[0];
  if (y === undefined)
    throw new Error(`No strip next to the puncture ${puncture} can be replaced by a lasso`);
  const k = face.letters.indexOf(y);
  const rotated = [...face.letters.slice(k + 1), ...face.letters.slice(0, k + 1)]; // ends with y = ē
  const muOfLoop = fs.mu.imageOfPath(EdgePath.from(rotated)).inverse.reduced();

  const e = y.reversed;
  const c = e.source;
  // The stem takes e's place in the cyclic order at c: before the next end there that isn't ē. e is removed first,
  // so that the stem can reuse the name (as in C#, where the removed side's strip was never created).
  const next = fs.graph
    .starFrom(e)
    .slice(1)
    .find((x) => x !== y);
  fs.removeStrip(e.edge);
  const w = fs.addJunction();
  const stem = fs.addStrip(c, w, { atSource: next === undefined ? { at: "end" } : { before: next } });
  const loop = fs.addStrip(w, w, { name: freeName(fs, loopName) });
  for (const x of [stem, loop]) fs.g.setImage(x.forward, EdgePath.of(x.forward));
  fs.g.setVertexImage(w, w);
  fs.mu.setVertexImage(w, fs.mu.vertexImage(c));
  fs.mu.setImage(stem.forward, EdgePath.EMPTY);
  fs.mu.setImage(loop.forward, muOfLoop);
  fs.peripheral.add(loop);
}

function isStem(fs: FibredSurface, e: Edge): boolean {
  return fs.mu.image(e.forward).isEmpty;
}

function freeName(fs: FibredSurface, name: string): string {
  return fs.graph.edges.some((e) => e.name.toLowerCase() === name.toLowerCase()) ? fs.nextEdgeName() : name;
}
