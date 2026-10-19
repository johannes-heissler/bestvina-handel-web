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
 *   whose star is the word itself. With punctures inside the polygon, the polygon is cut along chords into convex
 *   cells, and G₀ is the dual graph of the cells (port note 22).
 * - **plane**: the plane with punctures (plus the one at ∞), without sides. G₀ is a graph of lassos around the points.
 * - **ribbon**: the fibred surface of a ribbon graph given by its boundary words, drawn glued from rectangles. G₀ is
 *   that ribbon graph.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import { fromBoundaryWords, fromStars } from "../graph/from-boundary-words";
import { EDGE_NAMES, firstUnusedName, invertName, isForwardName, nameKey } from "../graph/names";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";
import { FibredSurface } from "../fibred/fibred-surface";
import { IDENTITY_NAME } from "../fibred/map-editing";
import { EDGE_COLORS, leastUsedColor } from "../fibred/names-and-colors";
import { cellDecomposition } from "../geometry/cells";
import { regularPolygon } from "../geometry/hyperbolic";
import { normalize, normalizeLike } from "../geometry/normalize";
import { Complex } from "../math/complex";

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
  /**
   * The single vertex class is not a puncture: without interior points it is an artificial puncture (the surface is
   * closed), with interior points it is filled in (the surface is Σ minus the points).
   */
  readonly closed: boolean;
  /**
   * Punctures inside the polygon, in chart coordinates: Klein coordinates for hyperbolic polygons (the regular polygon
   * is centred at 0), the coordinates of the vertices for flat ones.
   */
  readonly points?: readonly Point2[];
}

export interface PlaneModel extends ModelBase {
  readonly kind: "plane";
  /** The punctures in the plane (the point at ∞ is one more). */
  readonly points: readonly Point2[];
  /**
   * "rose": one base point with a lasso around each point; the lassos leave the base point counterclockwise in the
   * order of `points` (for points on a line: base point above them, the first point on the left).
   * "comb": a base point above each point with its lasso below it, joined by a path from left to right.
   */
  readonly spine: "rose" | "comb";
  /** Where the base point of the rose is (for the comb: the height of the base points above the points). */
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

/** A cell of a polygon model: a vertex of G₀ (port note 22). */
export interface SpineCell {
  readonly vertex: Vertex;
  /** Its corners counterclockwise: indices into the polygon's vertices, followed by its interior points. */
  readonly corners: readonly number[];
  /**
   * For each side, from corners[i] to corners[i + 1]: the oriented edge of G₀ that leaves the cell through it, or
   * undefined for the wall that a filled-in vertex removed.
   */
  readonly exits: readonly (OrientedEdge | undefined)[];
}

/** G₀ with the correspondence to the parts of the model. */
export interface Spine {
  readonly graph: RibbonGraph;
  /** For a polygon: for each side (counterclockwise), the oriented edge of G₀ that leaves its cell through it. */
  readonly sides?: readonly OrientedEdge[];
  /** For a polygon: its cells, in the order of the vertices of G₀. */
  readonly cells?: readonly SpineCell[];
  /** For the plane: for each point, the loop of G₀ around it, oriented counterclockwise. */
  readonly lassos?: readonly OrientedEdge[];
}

/** The corners of a polygon model in its chart, and its interior points (in the same coordinates). */
export function polygonCorners(model: PolygonModel): { vertices: Complex[]; points: Complex[] } {
  const points = (model.points ?? []).map(([x, y]) => new Complex(x, y));
  if (model.geometry.kind !== "flat")
    return { vertices: regularPolygon(model.word.length, model.geometry.kind), points };
  const given = model.geometry.vertices;
  return {
    vertices: normalize(given.map(([x, y]) => new Complex(x, y))),
    points: points.map((p) => normalizeLike(given, p, 0.9)),
  };
}

/** The cells of a polygon model, with the names of the edges of G₀ leaving each cell through each of its sides. */
interface PolygonCells {
  readonly cells: readonly (readonly number[])[];
  /** Before renaming: the side label for a polygon side, a chord name (lowercase leaving the earlier cell) for a chord. */
  readonly names: readonly (readonly string[])[];
  /** The forward name of the chord that a filled-in vertex removes (port note 22). */
  readonly wall: string | undefined;
}

/** How the edges of G₀ that the model itself doesn't name are named. */
interface DefaultNaming {
  /** Names the chords may not take (the new names of the sides). */
  readonly reserved?: Iterable<string>;
  /** The names as before session format 4 (`FibredSurface.legacyDefaultNames`). */
  readonly legacy?: boolean;
}

/**
 * The cells and the names of their exits. The chords take the next names of {@link EDGE_NAMES} after the sides, in the
 * order they appear, the wall candidate (the first chord from the vertex class to an interior point) last, so that the
 * open and the closed model of a polygon name their chords alike (port note 25). Before session format 4 they were
 * s_1, s_2, … in the order they appear.
 */
function polygonCells(model: PolygonModel, naming: DefaultNaming = {}): PolygonCells {
  if ((model.points ?? []).length === 0)
    return { cells: [model.word.map((_, i) => i)], names: [[...model.word]], wall: undefined };
  const { vertices, points } = polygonCorners(model);
  const n = vertices.length;
  const { cells } = cellDecomposition(vertices, points);
  // The sides of each cell; a chord is keyed "a-b" (smaller corner first).
  const sides = cells.map((cell, k) =>
    cell.map((a, i) => {
      const b = cell[(i + 1) % cell.length] as number;
      return { a, b, k, i, key: a < b ? `${a}-${b}` : `${b}-${a}`, onPolygon: a < n && b === (a + 1) % n };
    }),
  );
  const wall = sides.flat().find(({ a, b }) => a < n !== b < n);
  if (model.closed && wall === undefined) throw new Error("No chord joins the vertex to an interior point");
  // The chords in the order they appear; each leaves the cell where it appears first by its forward name.
  const chords = [...new Set(sides.flat().flatMap((x) => (x.onPolygon ? [] : [x.key])))];
  if (!naming.legacy && wall !== undefined) chords.push(...chords.splice(chords.indexOf(wall.key), 1));
  const reserved = naming.legacy ? [] : (naming.reserved ?? []);
  const used = new Set([...model.word, ...reserved].map((x) => x.toLowerCase()));
  const chordNames = new Map<string, string>();
  for (const key of chords) {
    let name: string;
    if (naming.legacy) {
      let k = 1;
      while (used.has(`s_${k}`)) k++;
      name = `s_${k}`;
    } else name = firstUnusedName(EDGE_NAMES, used);
    used.add(name);
    chordNames.set(key, name);
  }
  const seen = new Set<string>();
  const names = sides.map((cell) =>
    cell.map((side) => {
      if (side.onPolygon) return model.word[side.a] as string;
      const name = chordNames.get(side.key) as string;
      if (seen.has(side.key)) return invertName(name);
      seen.add(side.key);
      return name;
    }),
  );
  if (!model.closed || wall === undefined) return { cells, names, wall: undefined };
  return { cells, names, wall: (names[wall.k] as string[])[wall.i]?.toLowerCase() };
}

/** Whether the exit with this name is the wall. */
function isWall(cells: PolygonCells, name: string): boolean {
  return cells.wall !== undefined && name.toLowerCase() === cells.wall;
}

/** The oriented edge names at each vertex of G₀ (before renaming). */
function stars(model: SurfaceModel, naming: DefaultNaming): string[][] | undefined {
  switch (model.kind) {
    case "polygon":
      return polygonCells(model, naming).names.map((names) => [...names]);
    case "plane": {
      const n = model.points.length;
      const loop = (i: number) => lassoName(i, naming.legacy);
      if (model.spine === "rose")
        return [Array.from({ length: n }, (_, i) => [loop(i), invertName(loop(i))]).flat()];
      // comb: base point i has the path edges t(i−1) (to the left), t(i) (to the right) and its lasso below it.
      const path = (i: number) => (naming.legacy ? `t${i + 1}` : `t_${i + 1}`);
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

/** The name of the lasso around the i-th point of a plane model: a, b, c, d, x, … ({@link EDGE_NAMES}). */
function lassoName(i: number, legacy = false): string {
  if (legacy) return i < 26 ? String.fromCharCode(97 + i) : `l${i + 1}`;
  return EDGE_NAMES[i] as string;
}

/**
 * G₀ of a model, with the edges renamed and reoriented as given. `legacy`: the default names as before session format
 * 4 (port note 25).
 */
export function spineOf(model: SurfaceModel, naming: SpineNames = {}, legacy = false): Spine {
  const starLists = stars(model, { reserved: Object.values(naming.names ?? {}), legacy });
  const graph =
    starLists === undefined ? fromBoundaryWords((model as RibbonModel).boundaryWords) : fromStars(starLists);
  if (legacy) legacyVertexNames(graph);
  const byName = new Map(graph.orientedEdges.map((e) => [e.name, e]));
  const sides =
    model.kind === "polygon" ? model.word.map((name) => byName.get(name) as OrientedEdge) : undefined;
  let cells: SpineCell[] | undefined;
  if (model.kind === "polygon") {
    const decomposition = polygonCells(model, { reserved: Object.values(naming.names ?? {}), legacy });
    cells = decomposition.cells.map((corners, k) => ({
      vertex: graph.vertices[k] as Vertex,
      corners,
      exits: (decomposition.names[k] as string[]).map((name) =>
        isWall(decomposition, name) ? undefined : (byName.get(name) as OrientedEdge),
      ),
    }));
    if (decomposition.wall !== undefined)
      graph.removeEdge((byName.get(decomposition.wall) as OrientedEdge).edge);
  }
  const lassos =
    model.kind === "plane"
      ? // With the star "… a A …", the inside of the petal is the boundary word "A", on the right of Ā: a runs
        // counterclockwise around its point.
        model.points.map((_, i) => byName.get(lassoName(i, legacy)) as OrientedEdge)
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
  graph.edges.forEach((e, i) => (e.color = EDGE_COLORS[i % EDGE_COLORS.length] as typeof e.color));
  const names = graph.edges.map((e) => e.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Two edges of G₀ have the same name");
  return { graph, ...(sides && { sides }), ...(cells && { cells }), ...(lassos && { lassos }) };
}

/**
 * The {@link Spine} of a model on an existing G₀ (e.g. `fs.spine0`), recovered from its structure, so that it stays
 * right after renaming or reversing edges: for a polygon, the star of each cell's vertex lists the exits through its
 * sides counterclockwise (skipping the wall); for the plane, each lasso is the first of its two ends in the star of its
 * base point.
 */
export function spineOfGraph(model: SurfaceModel, graph: RibbonGraph): Spine {
  if (model.kind === "polygon") {
    const decomposition = polygonCells(model);
    const n = model.word.length;
    const cells = decomposition.cells.map((corners, k): SpineCell => {
      const vertex = graph.vertices[k] as Vertex;
      const star = [...graph.star(vertex)];
      const exits = (decomposition.names[k] as string[]).map((name) =>
        isWall(decomposition, name) ? undefined : star.shift(),
      );
      return { vertex, corners, exits };
    });
    const sides = model.word.map((_, side) => {
      for (const cell of cells) {
        const i = cell.corners.findIndex(
          (a, j) => a === side && cell.corners[(j + 1) % cell.corners.length] === (side + 1) % n,
        );
        if (i >= 0) return cell.exits[i] as OrientedEdge;
      }
      throw new Error(`No cell has the side ${side}`);
    });
    return { graph, sides, cells };
  }
  if (model.kind === "plane") {
    const lassos: OrientedEdge[] = [];
    for (const v of graph.vertices) {
      const seen = new Set<Edge>();
      for (const x of graph.star(v))
        if (x.edge.isLoop && !seen.has(x.edge)) {
          seen.add(x.edge);
          lassos.push(x);
        }
    }
    return { graph, lassos };
  }
  return { graph };
}

/** Genus and number of punctures of the surface of a ribbon graph (from χ = V − E and the boundary words). */
export function topologyOf(graph: RibbonGraph): { genus: number; punctures: number } {
  const punctures = graph.boundaryWords().length;
  const chi = graph.vertexCount - graph.edgeCount;
  return { genus: (2 - chi - punctures) / 2, punctures };
}

/** Genus and punctures of the surface a model describes (a closed polygon without interior points has none). */
export function topology(model: SurfaceModel): { genus: number; punctures: number } {
  const { genus, punctures } = topologyOf(spineOf(model).graph);
  return isClosedModel(model) ? { genus, punctures: 0 } : { genus, punctures };
}

/**
 * Whether the model describes a closed surface (its one puncture is artificial). A closed polygon with interior points
 * is not: its vertex is filled in, and the points are genuine punctures.
 */
export function isClosedModel(model: SurfaceModel): boolean {
  return (
    (model.kind === "polygon" && model.closed && (model.points ?? []).length === 0) ||
    (model.kind === "ribbon" && model.closed === true)
  );
}

/**
 * The model of the same surface with its one puncture marked as artificial, on the same G₀ (port note 24): an ideal
 * polygon becomes the compact one with the same word, a flat polygon or a ribbon model is only marked closed.
 * Undefined if that isn't possible on the same G₀ (a polygon with interior points, the plane).
 */
export function closedModel(model: SurfaceModel): SurfaceModel | undefined {
  const named = { name: `${model.name} (closed)`, description: `${model.description} Marked as closed.` };
  if (model.kind === "ribbon") return { ...model, ...named, closed: true };
  if (model.kind !== "polygon" || (model.points ?? []).length > 0) return undefined;
  const geometry: PolygonGeometry = model.geometry.kind === "ideal" ? { kind: "compact" } : model.geometry;
  return { ...model, ...named, geometry, closed: true };
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
  /**
   * For a polygon: start with this graph G (by its boundary words) instead of a copy of G₀. Contracting a spanning tree
   * of G must give the rose of the polygon, i.e. {@link contractedWord} of G is the polygon's word up to rotation; μ
   * maps the tree to the vertex and the other edges to the sides of the same names.
   */
  readonly graph?: readonly (readonly string[])[];
}

/**
 * The ribbon graph contracted along a breadth-first spanning tree: a rose, given by its star (the word of a polygon whose
 * sides are glued as the edges of the rose), and the tree.
 */
export function contractedWord(graph: RibbonGraph): { word: string[]; tree: Set<Edge> } {
  const root = graph.vertices[0] as Vertex;
  const tree = new Set<Edge>();
  const seen = new Set([root]);
  for (let queue = [root]; queue.length > 0;) {
    const v = queue.shift() as Vertex;
    for (const x of graph.star(v))
      if (!seen.has(x.target)) {
        seen.add(x.target);
        tree.add(x.edge);
        queue.push(x.target);
      }
  }
  // Walk around the tree: along tree edges to their other end, past the other edges (they leave the contracted vertex).
  const start = graph.star(root)[0] as OrientedEdge;
  const word: string[] = [];
  let x = start;
  do {
    if (tree.has(x.edge)) x = graph.next(x.reversed);
    else {
      word.push(x.name);
      x = graph.next(x);
    }
  } while (x !== start);
  return { word, tree };
}

/**
 * The fibred surface G = G₀ with μ = the identity (a copy of G₀ mapping onto it), g = the identity, and a peripheral
 * lasso for each chosen puncture. The map (and its name) is then set with `updateMap`. `legacy`: the default names as
 * before session format 4 (`FibredSurface.legacyDefaultNames`).
 */
export function initialFibredSurface(
  model: SurfaceModel,
  options: FibredSurfaceOptions = {},
  legacy = false,
): FibredSurface {
  const spine = spineOf(model, options, legacy);
  const g0 = spine.graph;
  let graph: RibbonGraph;
  let mu: CombinatorialMap;
  if (options.graph === undefined) {
    const copy = g0.copy();
    graph = copy.graph;
    mu = new CombinatorialMap(graph, g0);
    for (const [v, w] of copy.vertexMap) mu.setVertexImage(w, v);
    for (const e of g0.edges) mu.setImage(copy.orient(e.forward), EdgePath.of(e.forward));
  } else {
    graph = fromBoundaryWords(options.graph);
    if (legacy) legacyVertexNames(graph);
    const { word, tree } = contractedWord(graph);
    if (
      g0.vertexCount !== 1 ||
      !EdgePath.from(g0.star(g0.vertices[0] as Vertex)).isRotationOf(
        EdgePath.from(word.map((name) => g0.orientedEdges.find((x) => x.name === name) as OrientedEdge)),
      )
    )
      throw new Error(`Contracting a spanning tree of the graph gives the rose ${word.join(" ")}, not G₀`);
    mu = new CombinatorialMap(graph, g0);
    const [w] = g0.vertices as [Vertex];
    for (const v of graph.vertices) mu.setVertexImage(v, w);
    const byName = new Map(g0.orientedEdges.map((x) => [x.name, x]));
    for (const e of graph.edges)
      mu.setImage(
        e.forward,
        tree.has(e) ? EdgePath.EMPTY : EdgePath.of(byName.get(e.forward.name) as OrientedEdge),
      );
    // The edges outside the tree keep the colours of the sides they map to; the tree edges get the least used ones.
    for (const e of graph.edges)
      if (!tree.has(e)) e.color = (byName.get(e.forward.name) as OrientedEdge).color;
    for (const e of tree)
      e.color = leastUsedColor(
        EDGE_COLORS,
        graph.edges.map((x) => x.color),
      );
  }
  const fs = new FibredSurface({ graph, g: CombinatorialMap.identity(graph), mu });
  fs.mapName = IDENTITY_NAME;
  fs.isClosed = isClosedModel(model);
  fs.legacyDefaultNames = legacy;
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
  chosen.forEach((i, k) =>
    addPeripheralLasso(
      fs,
      words[i] as EdgePath,
      legacy ? (LEGACY_PUNCTURE_NAMES[k] as string) : fs.nextPeripheralEdgeName(),
    ),
  );
  return fs;
}

/** The names of the peripheral loops before session format 4, as in C#: α, β, γ, … */
const LEGACY_PUNCTURE_NAMES = [..."αβγδεζηθικλ", ...Array.from({ length: 100 }, (_, i) => `ρ${i + 1}`)];

/** The vertex names before session format 4: v0, v1, … by id (port note 25). */
function legacyVertexNames(graph: RibbonGraph): void {
  for (const v of graph.vertices) v.name = `v${v.id}`;
}

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
  // Before session format 4: prefer strips named with a digit (the C# rule for sides split for extra punctures).
  const y =
    (fs.legacyDefaultNames ? candidates.find((x) => /\d$/.test(x.edge.name)) : undefined) ?? candidates[0];
  if (y === undefined)
    throw new Error(`No strip next to the puncture ${puncture} can be replaced by a lasso`);
  const k = face.letters.indexOf(y);
  const rotated = [...face.letters.slice(k + 1), ...face.letters.slice(0, k + 1)]; // ends with y = ē
  const muOfLoop = fs.mu.imageOfPath(EdgePath.from(rotated)).inverse.reduced();

  const e = y.reversed;
  const c = e.source;
  // The stem takes e's place in the cyclic order at c: before the next end there that isn't ē. It gets a name that no
  // edge of G₀ has (μ of the stem is trivial); before session format 4 e was removed first, so that the stem could
  // reuse its name (as in C#).
  const next = fs.graph
    .starFrom(e)
    .slice(1)
    .find((x) => x !== y);
  const stemName = fs.legacyDefaultNames
    ? undefined
    : firstUnusedName(
        EDGE_NAMES,
        new Set([...fs.graph.edges, ...fs.spine0.edges].map((x) => nameKey(x.name))),
      );
  fs.removeStrip(e.edge);
  const w = fs.addJunction();
  const stem = fs.addStrip(c, w, {
    ...(stemName && { name: stemName }),
    atSource: next === undefined ? { at: "end" } : { before: next },
  });
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
  return fs.graph.edges.some((e) => nameKey(e.name) === nameKey(name)) ? fs.nextEdgeName() : name;
}
