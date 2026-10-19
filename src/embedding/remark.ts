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
import { EDGE_NAMES, firstUnusedName, invertName } from "../graph/names";
import type { Edge, OrientedEdge, RibbonGraph, Vertex } from "../graph/ribbon-graph";
import { Complex } from "../math/complex";
import { cellDecomposition, contractWalls } from "../geometry/cells";
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
import { markTrack, type Remarking, type RemarkingProvider } from "../fibred/remarking";
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
 * The punctures P of the model are filled in: its vertex, and the points of a model left by an earlier move (port note
 * 26). Undefined if the model isn't a compact or flat polygon whose punctures are its vertex and its points, or the
 * drawing doesn't allow it.
 */
export function remarkClosedSurface(
  model: SurfaceModel,
  fs: FibredSurface,
  tt: TrainTrack,
  orbit: readonly Vertex[],
): Remarking | undefined {
  if (model.kind !== "polygon" || model.geometry.kind === "ideal" || model.filled !== undefined)
    return undefined;
  // (A closed polygon with points has its vertex filled in already: not a model a closed-surface move leaves.)
  if (model.closed && (model.points ?? []).length > 0) return undefined;
  let problem = "";
  // A switch or a strip may lie exactly on a chord (the Tutte layout averages); then the points move a little.
  for (let nudge = 0; nudge < 6; nudge++)
    try {
      const remarking = build(model, fs, tt, orbit, nudge);
      // μ of τ, as read off the drawing, must come from an embedding (a cramped drawing, e.g. with junctions on a side of
      // the polygon, can give crossings that don't).
      try {
        strandOrder(markTrack(tt, remarking));
      } catch (e) {
        throw new Degenerate(`The drawing gives no embedding: ${(e as Error).message}`);
      }
      return remarking;
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
    if (inside(corners, center)) return center;
    // A non-convex polygon of switches: the junction itself lies among them.
    const junction = drawn.junctions.get(v) as Complex;
    const near = nudge === 0 ? junction : junction.add(Complex.fromPolar(0.05 * radius, 2.4 * nudge));
    if (inside(corners, near)) return near;
    throw new Error(`The singularity of ${v} isn't inside its polygon`);
  });
  const given = model.geometry.kind === "flat" ? model.geometry.vertices : undefined;
  const toModel = (z: Complex): Point2 => {
    const w = given === undefined ? z : denormalizeLike(given, z, 0.9);
    return [w.re, w.im];
  };

  // 2. The model with P's points and Q inside, its sides named and oriented as in the old G₀. If the old model has points
  // (left by an earlier move, port note 26), its cells are kept: each cell with points of Q inside is cut into cells
  // around them, so the old chords stay chords with their names, and only the new ones are read off the drawing.
  const oldPoints = model.points ?? [];
  const n = model.word.length;
  const oldChords = new Set<string>();
  let refined: Pick<PolygonModel, "cells" | "exits"> = {};
  if (oldPoints.length > 0) {
    const { vertices: polygon, points: oldInside } = polygonCorners(model);
    const cornerOf = [...polygon, ...oldInside];
    const used = new Set(
      [...oldSpine.graph.edges.map((e) => e.name), ...model.word].map((x) => x.toLowerCase()),
    );
    const exits: Record<string, string> = {};
    const cells: number[][] = [];
    const placed = new Set<number>();
    for (const cell of oldSpine.cells ?? []) {
      cell.exits.forEach((x, i) => {
        const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
        if (x === undefined || (a < n && b === (a + 1) % n)) return;
        exits[`${a}>${b}`] = x.name;
        oldChords.add(x.edge.name);
      });
      const ps = cell.corners.map((i) => cornerOf[i] as Complex);
      const inner = points.map((z, i) => ({ z, i })).filter(({ z }) => inside(ps, z));
      if (inner.length === 0) {
        cells.push([...cell.corners]);
        continue;
      }
      let sub: readonly (readonly number[])[];
      try {
        sub = cellDecomposition(
          ps,
          inner.map(({ z }) => z),
        ).cells;
      } catch (e) {
        throw new Degenerate((e as Error).message); // (a point of Q on a side of the cell: move it a little)
      }
      for (const { i } of inner) placed.add(i);
      for (const s of sub)
        cells.push(
          s.map((j) =>
            j < ps.length
              ? (cell.corners[j] as number)
              : n + oldPoints.length + (inner[j - ps.length] as { i: number }).i,
          ),
        );
    }
    if (placed.size !== points.length) throw new Degenerate("A point of Q lies on a chord");
    // The new chords take the next free names.
    for (const cell of cells)
      cell.forEach((a, i) => {
        const b = cell[(i + 1) % cell.length] as number;
        if ((a < n && b === (a + 1) % n) || exits[`${a}>${b}`] !== undefined) return;
        const other = exits[`${b}>${a}`];
        const name = other !== undefined ? invertName(other) : firstUnusedName(EDGE_NAMES, used);
        used.add(name.toLowerCase());
        exits[`${a}>${b}`] = name;
      });
    refined = { cells, exits };
  }
  const mid: PolygonModel = {
    kind: "polygon",
    name: model.name,
    description: model.description,
    word: model.word,
    geometry: model.geometry,
    closed: false,
    points: [...oldPoints, ...points.map(toModel)],
    ...refined,
  };
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
  const chords: (Chord & { old: boolean })[] = [];
  for (const cell of cells)
    cell.exits.forEach((x, i) => {
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      if (x === undefined || (a < n && b === (a + 1) % n) || !x.isForward) return;
      chords.push({
        p: cornerAt[a] as Complex,
        q: cornerAt[b] as Complex,
        exit: x,
        old: oldChords.has(x.edge.name),
      });
    });
  const midByName = new Map(midSpine.graph.orientedEdges.map((x) => [x.name, x]));
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
  /**
   * The crossings of the segment from a to b with the chords, at fractions of the segment; with `newOnly`, only with the
   * chords that the old model doesn't have (a strip's crossings of those are the letters of its μ).
   */
  const chordCrossings = (a: Complex, b: Complex, newOnly = false): { u: number; letter: OrientedEdge }[] => {
    const v = b.sub(a);
    const result: { u: number; letter: OrientedEdge }[] = [];
    for (const { p, q, exit, old } of chords) {
      if (newOnly && old) continue;
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
      // Each piece ends at its port: the stubs beyond the ports would cross chords near them out of order.
      fs.mu.image(strip.forward).letters.forEach((x, j) => {
        if ((chart.ports.get(x)?.stub ?? 0) > 0) pieces[j]?.pop();
        if ((chart.ports.get(x.reversed)?.stub ?? 0) > 0) pieces[j + 1]?.shift();
      });
      (pieces[0] as Complex[])[0] = switchAt.get(b.source) as Complex;
      const last = pieces.at(-1) as Complex[];
      last[last.length - 1] = switchAt.get(b.target) as Complex;
    }
    // The strip's pieces end at the letters of its μ: at a polygon side it jumps to the partner side; at a chord of the
    // old model it goes on where it was (the chords are glued by the identity), and the crossings with the new chords are
    // found on the way.
    const letters = strip === undefined ? [] : fs.mu.image(strip.forward).letters;
    const events: { s: number; letter: OrientedEdge }[] = [];
    let s = 0;
    pieces.forEach((piece, j) => {
      for (let i = 0; i + 1 < piece.length; i++) {
        const [a, c] = [piece[i] as Complex, piece[i + 1] as Complex];
        const length = c.sub(a).abs();
        for (const { u, letter } of chordCrossings(a, c, strip !== undefined))
          events.push({ s: s + u * length, letter });
        s += length;
      }
      if (j + 1 < pieces.length) {
        const letter = letters[j];
        if (letter === undefined) throw new Error(`The strip ${strip} has more pieces than letters in μ`);
        const side = oldSides.indexOf(letter);
        const crossed = side >= 0 ? midSides[side] : midByName.get(letter.name);
        if (crossed === undefined)
          throw new Error(`${letter} is neither a side nor a chord of the new model`);
        events.push({ s, letter: crossed });
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
      if (c.letter.source !== cell)
        throw new Error(
          `The branch ${b} jumps between cells (in ${cell}, crossing ${c.letter}@${c.t.toFixed(3)}; crossings ${(crossings.get(b) ?? []).map((d) => `${d.letter}@${d.t.toFixed(3)}`).join(" ")}; μ of its strip ${stripOf.get(b) === undefined ? "-" : fs.mu.image((stripOf.get(b) as Edge).forward).toString()})`,
        );
      cell = c.letter.target;
    }
    if (cell !== switchCell(b.target))
      throw new Error(
        `The branch ${b} ends in the wrong cell (${switchAt.get(b.source)} → ${switchAt.get(b.target)}, crossings ${(crossings.get(b) ?? []).map((c) => `${c.letter}@${c.t.toFixed(3)}`).join(" ")}; cells ${switchCell(b.source)} ${cell} ${switchCell(b.target)}; points ${points.join(" ")})`,
      );
  }

  // The punctures P to fill in: the vertex, and the points of the old model.
  const filling = fillingIn({
    model: mid,
    spine: midSpine,
    naming: finalNaming,
    pPoints: oldPoints.map((_, i) => n + i),
    qPoints: points.map((_, i) => n + oldPoints.length + i),
  });
  const slide = sliding({
    original: model,
    mid,
    midSpine,
    filling,
    naming: finalNaming,
    oldSpine,
    toModel,
    names: new Map(orbit.map((v, i) => [n + oldPoints.length + i, v.name])),
  });
  const filled = filling.fill;
  return {
    walls: filling.walls.map(({ text }) => text),
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

/** A node of the chord graph: the vertex (all polygon corners, "V") or a point (its corner index). */
type Node = number | "V";

/** A wall: the chord dual to `edge`, from the filled-in puncture `child` to its neighbour `parent`. */
interface Wall {
  readonly edge: Edge;
  readonly child: Node;
  readonly parent: Node;
  /** The corners of the chord at the child's and at the parent's end. */
  readonly childCorner: number;
  readonly parentCorner: number;
  /** For the narration: the chord and what replaces it in μ. */
  readonly text: { readonly name: string; readonly image: string };
}

/** The result of {@link fillingIn}. */
interface Filling {
  /** μ into the walled G₀ (see {@link Remarking.filled}). */
  readonly fill: (old: CombinatorialMap) => CombinatorialMap;
  /** The walls, in the order they were filled in (outermost last). */
  readonly walls: readonly Wall[];
  /** The walled G₀: the mid G₀ without the walls, with the mid cells. */
  readonly walled: Spine;
  /** The punctures of Q, the vertex (if it is filled in) and the points of P as nodes. */
  readonly q: ReadonlySet<Node>;
}

/**
 * Filling in the punctures P on the side of G₀ (port notes 22 and 26): for each puncture of P, one chord to a neighbour
 * becomes a wall, chosen outward from Q through the chord graph, so that the merged faces form trees around the points
 * of Q. The walls are filled in from the outside in: each wall edge ε is replaced by the rest β of the boundary word of
 * its child's face (x β with x = ε, so ε ≃ β⁻¹), and the faces merge. The walled G₀ it maps into is built once, so that
 * all states share it.
 */
function fillingIn(context: {
  model: PolygonModel;
  spine: Spine;
  naming: SpineNames;
  /** The corners of the points of P (the vertex is filled in too). */
  pPoints: readonly number[];
  /** The corners of the points of Q. */
  qPoints: readonly number[];
}): Filling {
  const { model, spine } = context;
  const n = model.word.length;
  const midGraph = spine.graph;
  const cells = spine.cells ?? [];
  const node = (corner: number): Node => (corner < n ? "V" : corner);
  // The edges of G₀ in the order of the cells and their sides, with the nodes at the ends of their chords.
  const sides = cells.flatMap((cell) =>
    cell.exits.flatMap((x, i) => {
      if (x === undefined) return [];
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      return [{ edge: x.edge, a, b }];
    }),
  );

  // The walls: outward from Q, in the order of the sides.
  const q = new Set<Node>(context.qPoints);
  const toFill = new Set<Node>(["V", ...context.pPoints]);
  const reached = new Set<Node>(q);
  const chosen: Omit<Wall, "text">[] = [];
  for (let grown = true; grown;) {
    grown = false;
    for (const { edge, a, b } of sides) {
      for (const [inside, outside] of [
        [a, b],
        [b, a],
      ] as const) {
        const [from, to] = [node(inside), node(outside)];
        if (!reached.has(from) || reached.has(to) || !toFill.has(to)) continue;
        reached.add(to);
        chosen.push({ edge, child: to, parent: from, childCorner: outside, parentCorner: inside });
        grown = true;
      }
    }
  }
  if (chosen.length !== toFill.size) throw new Error("Not every puncture of P can be filled in");

  // The face of each node: the boundary word whose edges are exactly the duals of the sides at that node.
  const atNode = new Map<Node, Set<Edge>>();
  const add = (x: Node, e: Edge) => (atNode.get(x) ?? atNode.set(x, new Set()).get(x))?.add(e);
  for (const { edge, a, b } of sides) {
    add(node(a), edge);
    add(node(b), edge);
  }
  const words = midGraph.boundaryWords();
  const faceOf = new Map<Node, EdgePath>();
  for (const [x, edges] of atNode) {
    const word = words.find(
      (w) =>
        new Set(w.letters.map((y) => y.edge)).size === edges.size &&
        w.letters.every((y) => edges.has(y.edge)),
    );
    if (word === undefined) throw new Error(`No face of G₀ around the puncture ${x}`);
    faceOf.set(x, word);
  }

  // Fill in from the outside in (the reverse of the order the walls were found in).
  const root = new Map<Node, Node>();
  const find = (x: Node): Node => (root.has(x) ? find(root.get(x) as Node) : x);
  const substitution = new Map<Edge, EdgePath>();
  const walls: Wall[] = [];
  for (const wall of [...chosen].reverse()) {
    const [inner, outer] = [
      faceOf.get(find(wall.child)) as EdgePath,
      faceOf.get(find(wall.parent)) as EdgePath,
    ];
    const k = inner.letters.findIndex((y) => y.edge === wall.edge);
    const j = outer.letters.findIndex((y) => y.edge === wall.edge);
    if (k < 0 || j < 0) throw new Error(`The wall ${wall.edge} doesn't lie between the faces it should`);
    const x = inner.at(k) as OrientedEdge;
    const beta = inner.slice(k + 1).concat(inner.slice(0, k));
    const gamma = outer.slice(j + 1).concat(outer.slice(0, j));
    const forwardImage = x.isForward ? beta.inverse : beta;
    substitution.set(wall.edge, forwardImage);
    root.set(find(wall.child), find(wall.parent));
    faceOf.set(find(wall.parent), beta.concat(gamma));
    walls.push({
      ...wall,
      text: { name: wall.edge.forward.name, image: forwardImage.toString() || "(nothing)" },
    });
  }
  walls.reverse();

  // The walled model: the mid cells, without the walls' edges, the vertex and the points of P filled in.
  const exits: Record<string, string> = {};
  for (const cell of cells)
    cell.exits.forEach((x, i) => {
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      if (x !== undefined && !(a < n && b === (a + 1) % n) && !substitution.has(x.edge))
        exits[`${a}>${b}`] = x.name;
    });
  const walledModel: PolygonModel = {
    ...model,
    closed: true,
    cells: cells.map((cell) => cell.corners),
    exits,
    filled: context.pPoints.map((corner) => corner - n),
  };
  const walled = spineOf(walledModel, context.naming);
  models.set(walled.graph, walledModel);
  const byName = new Map(walled.graph.orientedEdges.map((y) => [y.name, y]));
  const vertexOf = new Map(midGraph.vertices.map((v, i) => [v, walled.graph.vertices[i] as Vertex]));
  // A letter with the walls substituted (an image only contains walls filled in later, so this ends).
  const expand = (y: OrientedEdge): OrientedEdge[] => {
    const image = substitution.get(y.edge);
    if (image === undefined) return [byName.get(y.name) as OrientedEdge];
    return (y.isForward ? image : image.inverse).letters.flatMap(expand);
  };
  const fill = (old: CombinatorialMap) => {
    const mu = new CombinatorialMap(old.source, walled.graph);
    for (const v of old.source.vertices) mu.setVertexImage(v, vertexOf.get(old.vertexImage(v)) as Vertex);
    for (const e of old.source.edges)
      mu.setImage(e.forward, EdgePath.from(old.image(e.forward).letters.flatMap(expand)).reduced());
    return mu;
  };
  return { fill, walls, walled, q };
}

/**
 * The contraction after filling in (see {@link Remarking.slide}, port notes 26 and 27): along the trees of walls, each
 * filled-in point moves into its neighbour, and the point of Q in the vertex's tree slides into the vertex (a polygon
 * corner doesn't move); the points of Q that are left are placed anew, and μ maps letter by letter into the G₀ of the
 * explicit cells that {@link contractWalls} leaves (contracted edges of G₀ drop out). Without points left, that is the
 * plain closed polygon (for the first move: the original model with its own G₀). Undefined (for every surface) if the
 * contraction doesn't give convex cells.
 */
function sliding(context: {
  original: PolygonModel;
  mid: PolygonModel;
  midSpine: Spine;
  filling: Filling;
  naming: SpineNames;
  oldSpine: Spine;
  toModel: (z: Complex) => Point2;
  /** The names of the junctions of Q, by the corners of their points. */
  names: ReadonlyMap<number, string>;
}): Remarking["slide"] {
  const { mid, midSpine, oldSpine, original } = context;
  const { walls, walled } = context.filling;
  const cells = midSpine.cells ?? [];
  const n = mid.word.length;
  const exitName = new Map<string, string>();
  for (const cell of cells)
    cell.exits.forEach((x, i) => {
      const [a, b] = [cell.corners[i] as number, cell.corners[(i + 1) % cell.corners.length] as number];
      if (x !== undefined) exitName.set(`${a}>${b}`, x.name);
    });

  // The contractions: each tree of walls collapses towards the vertex if it contains it, else towards its point of Q.
  const neighbours = new Map<Node, { other: Node; corner: number; otherCorner: number }[]>();
  const link = (x: Node, other: Node, corner: number, otherCorner: number) =>
    (neighbours.get(x) ?? neighbours.set(x, []).get(x))?.push({ other, corner, otherCorner });
  for (const w of walls) {
    link(w.child, w.parent, w.childCorner, w.parentCorner);
    link(w.parent, w.child, w.parentCorner, w.childCorner);
  }
  const contractions: [number, number][] = [];
  const done = new Set<Node>();
  let intoVertex: number | undefined;
  const anchors: Node[] = ["V", ...context.filling.q];
  for (const anchor of anchors) {
    if (done.has(anchor) || !neighbours.has(anchor)) continue;
    done.add(anchor);
    for (const queue = [anchor]; queue.length > 0;) {
      const x = queue.shift() as Node;
      for (const { other, corner, otherCorner } of neighbours.get(x) ?? []) {
        if (done.has(other)) continue;
        done.add(other);
        queue.push(other);
        contractions.push([otherCorner, corner]); // `other` moves into x (or where x went)
        if (anchor === "V" && context.filling.q.has(other)) intoVertex = otherCorner;
      }
    }
  }
  const { vertices, points } = polygonCorners(mid);
  const slid = contractWalls(
    vertices,
    points,
    cells.map((cell) => cell.corners),
    contractions,
  );
  if (slid === undefined) return () => undefined;

  // The model and G₀ after the contraction, and how the walled G₀ maps into it.
  let target: RibbonGraph;
  let letter: (y: OrientedEdge) => OrientedEdge | undefined;
  const plain = slid.pointOf.length === 0 && slid.cells.length === 1;
  if (plain && (original.points ?? []).length === 0) {
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
    const base = { kind: "polygon" as const, name: mid.name, description: mid.description, word: mid.word };
    const model: PolygonModel = plain
      ? { ...base, geometry: mid.geometry, closed: true }
      : {
          ...base,
          geometry: mid.geometry,
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
  const point = intoVertex === undefined ? undefined : context.names.get(intoVertex);
  const filledPoints = walls.filter((w) => w.child !== "V").length;
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
    return (
      ok && {
        surface: ok,
        ...(point !== undefined && { point }),
        filledPoints,
        merged,
        pointsLeft: slid.pointOf.length,
      }
    );
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
