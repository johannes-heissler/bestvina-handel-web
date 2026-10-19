/**
 * Keeping the original model through the closed-surface moves (port note 22, § 3).
 *
 * Before the move, G is drawn in the closed polygon, whose vertex is the artificial puncture p. The new punctures Q are
 * placed in the infinitesimal polygons of τ (at the centroid of their switches), the polygon is cut into cells with Q as
 * extra corners, and μ of every part of τ is read off the drawing: the cell sides its polyline crosses. The moves cut
 * (or blow up) τ, and finally {@link Remarking.finish} fills in p: the wall from p to a point q₁ of Q is replaced by the
 * rest of p's boundary (ε₀ ↦ β⁻¹). For a single point (|Q| = 1), q₁ then slides along the wall into the corner: the
 * chords end at the vertex only, merging the cells deletes their letters, and μ maps into the original G₀ again.
 *
 * @module
 */
import { CombinatorialMap } from "../graph/combinatorial-map";
import { EdgePath } from "../graph/edge-path";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";
import { Complex } from "../math/complex";
import { slideIntoCorner } from "../geometry/cells";
import { denormalizeLike } from "../geometry/normalize";
import {
  polygonCorners,
  type PolygonModel,
  type Point2,
  type Spine,
  spineOf,
  spineOfGraph,
  type SpineNames,
  type SurfaceModel,
} from "../examples/models";
import { FibredSurface } from "../fibred/fibred-surface";
import type { Remarking, RemarkingProvider } from "../fibred/remarking";
import type { TrainTrack } from "../fibred/train-track";
import { chartOf } from "./chart";
import { withTightMarking } from "./image";
import { type Layout, layout } from "./layout";
import { strandOrder } from "./strand-order";

const models = new WeakMap<RibbonGraph, SurfaceModel>();

/** The model of a G₀ that a closed-surface move created (undefined for any other G₀). */
export function modelOfSpine(spine: RibbonGraph): SurfaceModel | undefined {
  return models.get(spine);
}

/** A provider for the moves that keeps `model` (or the model of a G₀ created on the way). */
export function keepingModel(model: SurfaceModel): RemarkingProvider {
  return (fs, tt, orbit) => remarkClosedSurface(modelOfSpine(fs.spine0) ?? model, fs, tt, orbit);
}

/**
 * The {@link Remarking} for a closed-surface move on `fs`, drawn in `model`, with the orbit Q of singular junctions.
 * Undefined if the model isn't a closed polygon without interior points, or the drawing doesn't allow it.
 */
export function remarkClosedSurface(
  model: SurfaceModel,
  fs: FibredSurface,
  tt: TrainTrack,
  orbit: readonly Vertex[],
): Remarking | undefined {
  if (model.kind !== "polygon" || !model.closed || (model.points ?? []).length > 0) return undefined;
  let problem = "";
  // A switch or a strip may lie exactly on a chord (the Tutte layout averages); then the points move a little.
  for (let nudge = 0; nudge < 6; nudge++)
    try {
      return build(model, fs, tt, orbit, nudge);
    } catch (e) {
      problem = (e as Error).message;
      if (!(e instanceof Degenerate)) break;
    }
  fs.reportInconsistency(`The new punctures can't be placed in the polygon: ${problem}`);
  return undefined;
}

/** A crossing at the end of a segment or of a chord: the points are moved and the drawing is read again. */
class Degenerate extends Error {}

/** A crossing of a cell side along a branch, at the fraction `t` of the branch's drawn length. */
interface Crossing {
  readonly t: number;
  readonly letter: OrientedEdge;
}

/** A chord between two cells: from p to q counterclockwise around the cell that `exit` leaves. */
interface Chord {
  readonly p: Complex;
  readonly q: Complex;
  readonly exit: OrientedEdge;
}

const cross = (u: Complex, v: Complex) => u.re * v.im - u.im * v.re;

function build(
  model: PolygonModel,
  fs: FibredSurface,
  tt: TrainTrack,
  orbit: readonly Vertex[],
  nudge: number,
): Remarking {
  const oldSpine = spineOfGraph(model, fs.spine0);
  const chart = chartOf(model, {}, oldSpine);
  let drawn: Layout;
  try {
    drawn = layout(fs, chart, {});
  } catch {
    drawn = layout(withTightMarking(fs), chart, {});
  }
  const switchAt = new Map<Vertex, Complex>();
  for (const x of fs.graph.orientedEdges)
    switchAt.set(tt.switchOf.get(x) as Vertex, drawn.switches.get(x) as Complex);

  // 1. The points of Q: the centroids of the switches of their infinitesimal polygons.
  const words = tt.boundaryWords().filter((b) => b.infinitesimal);
  const points = orbit.map((v) => {
    const word = words.find((b) => tt.junctionOf.get((b.word.first as OrientedEdge).source) === v);
    if (word === undefined) throw new Error(`${v} has no infinitesimal polygon`);
    const corners = word.word.letters.map((x) => switchAt.get(x.source) as Complex);
    const centroid = corners.reduce((sum, z) => sum.add(z), Complex.ZERO).scale(1 / corners.length);
    // Moved by a fifth of the way towards a corner, in a different direction for each attempt.
    const radius = Math.min(...corners.map((z) => z.sub(centroid).abs()));
    const center = nudge === 0 ? centroid : centroid.add(Complex.fromPolar(0.2 * radius, 2.4 * nudge));
    if (!inside(corners, center)) throw new Error(`The singularity of ${v} isn't inside its polygon`);
    return center;
  });
  const given = model.geometry.kind === "flat" ? model.geometry.vertices : undefined;
  const toModel = (z: Complex): Point2 => {
    const w = given === undefined ? z : denormalizeLike(given, z, 0.9);
    return [w.re, w.im];
  };

  // 2. The model with Q inside, its sides named and oriented as in the old G₀.
  const mid: PolygonModel = { ...model, closed: false, points: points.map(toModel) };
  const naming = sideNaming(mid, oldSpine);
  let midSpine: Spine;
  let finalNaming: SpineNames = naming;
  try {
    midSpine = spineOf(mid, naming);
  } catch {
    finalNaming = {};
    midSpine = spineOf(mid);
  }
  models.set(midSpine.graph, mid);
  const midSides = midSpine.sides as readonly OrientedEdge[];
  const oldSides = oldSpine.sides as readonly OrientedEdge[];
  const { vertices, points: cornersInside } = polygonCorners(mid);
  const cornerAt = [...vertices, ...cornersInside];
  const cells = midSpine.cells ?? [];
  const chords: Chord[] = [];
  const n = vertices.length;
  for (const cell of cells)
    cell.exits.forEach((x, i) => {
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      if (x === undefined || (a < n && b === (a + 1) % n) || !x.isForward) return;
      chords.push({ p: cornerAt[a] as Complex, q: cornerAt[b] as Complex, exit: x });
    });
  const cellOf = (z: Complex): Vertex => {
    let best = cells[0];
    let bestMargin = -Infinity;
    for (const cell of cells) {
      const ps = cell.corners.map((i) => cornerAt[i] as Complex);
      const margin = Math.min(
        ...ps.map((a, i) => cross((ps[(i + 1) % ps.length] as Complex).sub(a), z.sub(a))),
      );
      if (margin > bestMargin) [best, bestMargin] = [cell, margin];
    }
    return (best as (typeof cells)[number]).vertex;
  };
  /** The crossings of the segment from a to b with the chords, at fractions of the segment. */
  const chordCrossings = (a: Complex, b: Complex): { u: number; letter: OrientedEdge }[] => {
    const v = b.sub(a);
    const result: { u: number; letter: OrientedEdge }[] = [];
    for (const { p, q, exit } of chords) {
      const w = q.sub(p);
      const denominator = cross(v, w);
      if (Math.abs(denominator) < 1e-14) continue;
      const u = cross(p.sub(a), w) / denominator;
      const s = cross(p.sub(a), v) / denominator;
      if (u < -1e-9 || u > 1 + 1e-9 || s < -1e-9 || s > 1 + 1e-9) continue;
      if (u < 1e-9 || u > 1 - 1e-9 || s < 1e-9 || s > 1 - 1e-9) throw new Degenerate("A crossing at an end");
      // From the cell on the left of p → q (the one `exit` leaves) to the right one, or back.
      result.push({ u, letter: cross(w, v) < 0 ? exit : exit.reversed });
    }
    return result.sort((x, y) => x.u - y.u);
  };

  // 3. Each branch of τ as a polyline: real branches along their strips (from switch to switch, jumping at the polygon
  // sides), infinitesimal ones straight between their switches.
  const stripOf = new Map([...tt.realBranch].map(([e, b]) => [b, e]));
  const crossings = new Map<Edge, Crossing[]>();
  for (const b of tt.graph.edges) {
    const strip = stripOf.get(b);
    const pieces: Complex[][] =
      strip === undefined
        ? [[switchAt.get(b.source) as Complex, switchAt.get(b.target) as Complex]]
        : (drawn.strips.get(strip) ?? []).map((piece) => [...piece]);
    if (strip !== undefined) {
      (pieces[0] as Complex[])[0] = switchAt.get(b.source) as Complex;
      const last = pieces.at(-1) as Complex[];
      last[last.length - 1] = switchAt.get(b.target) as Complex;
    }
    const letters = strip === undefined ? [] : fs.mu.image(strip.forward).letters;
    const events: { s: number; letter: OrientedEdge }[] = [];
    let s = 0;
    pieces.forEach((piece, j) => {
      for (let i = 0; i + 1 < piece.length; i++) {
        const [a, c] = [piece[i] as Complex, piece[i + 1] as Complex];
        const length = c.sub(a).abs();
        for (const { u, letter } of chordCrossings(a, c)) events.push({ s: s + u * length, letter });
        s += length;
      }
      if (j + 1 < pieces.length) {
        const side = oldSides.indexOf(letters[j] as OrientedEdge);
        if (side < 0) throw new Error(`${letters[j]} is not a side of the polygon`);
        events.push({ s, letter: midSides[side] as OrientedEdge });
      }
    });
    crossings.set(
      b,
      events.map((e) => ({ t: s > 0 ? e.s / s : 0.5, letter: e.letter })),
    );
  }

  const switchCell = (v: Vertex) => cellOf(switchAt.get(v) as Complex);
  const cellAt = (b: Edge, at: number): Vertex => {
    let cell = switchCell(b.source);
    for (const c of crossings.get(b) ?? []) if (c.t <= at) cell = c.letter.target;
    return cell;
  };
  // Check that the crossings form paths from cell to cell (else the drawing isn't usable).
  for (const b of tt.graph.edges) {
    let cell = switchCell(b.source);
    for (const c of crossings.get(b) ?? []) {
      if (c.letter.source !== cell) throw new Error(`The branch ${b} jumps between cells`);
      cell = c.letter.target;
    }
    if (cell !== switchCell(b.target))
      throw new Error(
        `The branch ${b} ends in the wrong cell (${switchAt.get(b.source)} → ${switchAt.get(b.target)}, crossings ${(crossings.get(b) ?? []).map((c) => `${c.letter}@${c.t.toFixed(3)}`).join(" ")}; cells ${switchCell(b.source)} ${cell} ${switchCell(b.target)}; points ${points.join(" ")})`,
      );
  }

  const {
    fill: filled,
    wall,
    walled,
    wallEdge,
  } = filling({ model: mid, spine: midSpine, naming: finalNaming });
  const slide = sliding({
    original: model,
    mid,
    midSpine,
    walled,
    wallEdge,
    naming: finalNaming,
    oldSpine,
    toModel,
    orbit,
  });
  return {
    wall,
    slide,
    spine: midSpine.graph,
    part: (b, from, to) =>
      EdgePath.from((crossings.get(b) ?? []).filter((c) => c.t > from && c.t <= to).map((c) => c.letter)),
    cellAt,
    switchCell,
    junctionCell: (v) => cellOf(drawn.junctions.get(v) as Complex),
    toSwitch: (x) => {
      const from = drawn.junctions.get(x.source) as Complex;
      const to = switchAt.get(tt.switchOf.get(x) as Vertex) as Complex;
      return EdgePath.from(chordCrossings(from, to).map((c) => c.letter));
    },
    filled,
    finish: (surface) => {
      if (surface.spine0 !== midSpine.graph) return checked(surface);
      const result = new FibredSurface({
        graph: surface.graph,
        g: surface.g,
        mu: filled(surface.mu),
        peripheral: surface.peripheral,
      });
      result.onError = surface.onError;
      result.reductionCurves.push(...surface.reductionCurves);
      return checked(result);
    },
  };
}

/** Renaming and reorienting the sides of G₀ of `mid` as in the old G₀ (the chords keep their names). */
function sideNaming(mid: PolygonModel, oldSpine: Spine): SpineNames {
  const plain = spineOf(mid);
  const names: Record<string, string> = {};
  const reversed: string[] = [];
  (plain.sides as readonly OrientedEdge[]).forEach((x, k) => {
    const old = (oldSpine.sides as readonly OrientedEdge[])[k] as OrientedEdge;
    if (!x.isForward) return; // each side pair once
    if (!old.isForward) reversed.push(x.edge.name);
    if (old.edge.name !== x.edge.name) names[x.edge.name] = old.edge.name;
  });
  return { names, reversed };
}

/** Whether z lies inside the polygon (any orientation). */
function inside(polygon: readonly Complex[], z: Complex): boolean {
  let winding = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length] as Complex;
    const angle = b.sub(z).div(a.sub(z)).arg();
    winding += angle;
  });
  return Math.abs(winding) > Math.PI;
}

/**
 * μ after filling in p (see {@link Remarking.filled}): the wall is replaced by the rest of p's boundary. The walled G₀ it
 * maps into is built once, so that all states share it.
 */
function filling(context: { model: PolygonModel; spine: Spine; naming: SpineNames }): {
  fill: (old: CombinatorialMap) => CombinatorialMap;
  wall: { name: string; image: string };
  /** The walled G₀ (of the closed model with the points). */
  walled: Spine;
  /** The wall, an edge of the mid G₀. */
  wallEdge: Edge;
} {
  const { spine } = context;
  const midGraph = spine.graph;
  const finalModel: PolygonModel = { ...context.model, closed: true };
  const finalSpine = spineOf(finalModel, context.naming);
  // The wall: the edge of the mid G₀ that the filled-in model removes.
  const kept = new Set(finalSpine.graph.edges.map((e) => e.name));
  const wall = midGraph.edges.find((e) => !kept.has(e.name));
  if (wall === undefined) throw new Error("The filled-in model has no wall");
  // p's face: the boundary word through the polygon sides. It reads x β with x the wall: x ≃ β⁻¹.
  const sides = new Set(spine.sides);
  const face = midGraph.boundaryWords().find((w) => w.letters.some((x) => sides.has(x)));
  const k = face?.letters.findIndex((x) => x.edge === wall) ?? -1;
  if (face === undefined || k < 0) throw new Error(`The wall ${wall} doesn't lie on the boundary of p`);
  const x = face.at(k) as OrientedEdge;
  const beta = face.slice(k + 1).concat(face.slice(0, k));
  const forwardImage = x.isForward ? beta.inverse : beta;
  const substituted = (path: EdgePath): OrientedEdge[] =>
    path.letters.flatMap((y) =>
      y.edge === wall ? (y.isForward ? forwardImage : forwardImage.inverse).letters : [y],
    );
  models.set(finalSpine.graph, finalModel);
  const byName = new Map(finalSpine.graph.orientedEdges.map((y) => [y.name, y]));
  const vertexOf = new Map(midGraph.vertices.map((v, i) => [v, finalSpine.graph.vertices[i] as Vertex]));
  const wallText = { name: wall.forward.name, image: forwardImage.toString() || "(nothing)" };
  const fill = (old: CombinatorialMap) => {
    const mu = new CombinatorialMap(old.source, finalSpine.graph);
    for (const v of old.source.vertices) mu.setVertexImage(v, vertexOf.get(old.vertexImage(v)) as Vertex);
    for (const e of old.source.edges)
      mu.setImage(
        e.forward,
        EdgePath.from(
          substituted(old.image(e.forward)).map((y) => byName.get(y.name) as OrientedEdge),
        ).reduced(),
      );
    return mu;
  };
  return { fill, wall: wallText, walled: finalSpine, wallEdge: wall };
}

/**
 * The slide after filling in p (see {@link Remarking.slide}, port note 27): the point of Q at the wall slides along it
 * into p's corner, the other points of Q are placed anew, and μ maps letter by letter into the G₀ of the explicit cells
 * that {@link slideIntoCorner} leaves (contracted edges of G₀ drop out). Without points left, that is the original
 * model with its own G₀. Undefined (for every surface) if the slide doesn't give convex cells.
 */
function sliding(context: {
  original: PolygonModel;
  mid: PolygonModel;
  midSpine: Spine;
  walled: Spine;
  wallEdge: Edge;
  naming: SpineNames;
  oldSpine: Spine;
  toModel: (z: Complex) => Point2;
  orbit: readonly Vertex[];
}): Remarking["slide"] {
  const { mid, midSpine, walled, oldSpine } = context;
  const cells = midSpine.cells ?? [];
  const n = mid.word.length;
  // The wall's ends: a corner of the polygon and a point of Q.
  let ends: [number, number] | undefined;
  const exitName = new Map<string, string>();
  for (const cell of cells)
    cell.exits.forEach((x, i) => {
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      if (x === undefined) return;
      exitName.set(`${a}>${b}`, x.name);
      if (x.edge === context.wallEdge) ends = a < n ? [a, b] : [b, a];
    });
  if (ends === undefined) return () => undefined;
  const [corner, point] = ends;
  const { vertices, points } = polygonCorners(mid);
  const slid = slideIntoCorner(
    vertices,
    points,
    cells.map((cell) => cell.corners),
    point,
    corner,
  );
  if (slid === undefined) return () => undefined;

  // The model and G₀ after the slide, and how the walled G₀ maps into it.
  let target: RibbonGraph;
  let letter: (y: OrientedEdge) => OrientedEdge | undefined;
  if (slid.pointOf.length === 0 && slid.cells.length === 1) {
    // Back to the original model and its G₀ (the chords have all been merged away).
    target = oldSpine.graph;
    const walledSides = walled.sides as readonly OrientedEdge[];
    const oldSides = oldSpine.sides as readonly OrientedEdge[];
    letter = (y) => {
      const side = walledSides.indexOf(y);
      return side < 0 ? undefined : oldSides[side];
    };
  } else {
    const exits: Record<string, string> = {};
    slid.cells.forEach((cell, k) =>
      cell.forEach((a, i) => {
        const b = cell[(i + 1) % cell.length] as number;
        if (a < n && b === (a + 1) % n) return;
        exits[`${a}>${b}`] = exitName.get((slid.was[k] as string[])[i] as string) as string;
      }),
    );
    const model: PolygonModel = {
      ...mid,
      closed: false,
      points: slid.corners.slice(n).map(context.toModel),
      cells: slid.cells,
      exits,
    };
    const spine = spineOf(model, context.naming);
    models.set(spine.graph, model);
    target = spine.graph;
    const byName = new Map(spine.graph.orientedEdges.map((y) => [y.name, y]));
    letter = (y) => byName.get(y.name);
  }
  const vertexOf = new Map(
    walled.graph.vertices.map((v, k) => [v, target.vertices[slid.cellOf[k] as number] as Vertex]),
  );
  const merged = walled.graph.edges
    .filter((e) => letter(e.forward) === undefined && !(walled.sides ?? []).some((x) => x.edge === e))
    .map((e) => e.name);
  const pointName = context.orbit[point - n]?.name ?? "q";
  return (surface) => {
    if (surface.spine0 !== walled.graph) return undefined;
    const mu = new CombinatorialMap(surface.graph, target);
    for (const v of surface.graph.vertices)
      mu.setVertexImage(v, vertexOf.get(surface.mu.vertexImage(v)) as Vertex);
    for (const e of surface.graph.edges)
      mu.setImage(
        e.forward,
        EdgePath.from(
          surface.mu.image(e.forward).letters.flatMap((y) => {
            const z = letter(y);
            return z === undefined ? [] : [z];
          }),
        ).reduced(),
      );
    const result = new FibredSurface({
      graph: surface.graph,
      g: surface.g,
      mu,
      peripheral: surface.peripheral,
    });
    result.onError = surface.onError;
    result.reductionCurves.push(...surface.reductionCurves);
    const ok = checked(result);
    return ok && { surface: ok, point: pointName, merged, pointsLeft: slid.pointOf.length };
  };
}

/** The surface if its μ comes from an embedding into the final model, else undefined (reported). */
function checked(surface: FibredSurface): FibredSurface | undefined {
  const problems = surface.checkIntegrity().filter((problem) => problem.includes("μ"));
  if (problems.length > 0) {
    surface.reportInconsistency(problems.join("; "));
    return undefined;
  }
  try {
    strandOrder(withTightMarking(surface).mu, surface.reductionCurves);
  } catch (e) {
    surface.reportInconsistency((e as Error).message);
    return undefined;
  }
  return surface;
}
