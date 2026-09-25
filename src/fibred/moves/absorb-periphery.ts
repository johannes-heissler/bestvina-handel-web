/**
 * Absorbing into the periphery (the thesis, Move "Absorbing into the periphery"; the C# `AbsorbIntoPeriphery`).
 *
 * Afterwards the peripheral subgraph P is maximal (no invariant subgraph Q ⊋ P deformation retracts to it), efficient
 * (every strip leaving P starts, under g, with a strip leaving P), has no junctions of valence 2 in G, and g acts on it
 * as a graph automorphism.
 *
 * Instead of moving junctions along curves with float positions (as in C#), the port works with positions on the
 * universal cover of each peripheral annulus; see port note 17.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import { argMax, argMin, rotate } from "../../util/iter";
import { mod } from "../../util/number";
import type { FibredSurface } from "../fibred-surface";
import { collapseSubforest } from "./collapse-forest";
import { maximalInvariantSubgraphRetractingTo } from "./reducibility";

const TOLERANCE = 1e-9;

/** Whether the move has something to do: Q ≠ P, junctions of valence 2 on P, or strips leaving P that start into P. */
export function needsAbsorbing(fs: FibredSurface): boolean {
  if (fs.peripheral.size === 0 || !isUnionOfCircles(fs)) return false;
  if (maximalInvariantSubgraphRetractingTo(fs, fs.peripheral).size > fs.peripheral.size) return true;
  const onP = new Set([...fs.peripheral].flatMap((e) => [e.source, e.target]));
  for (const v of onP) {
    if (fs.graph.valence(v) <= 2) return true;
    for (const s of fs.graph.star(v)) {
      if (fs.peripheral.has(s.edge)) continue;
      const d = fs.g.derivative(s);
      if (d !== undefined && fs.peripheral.has(d.edge)) return true;
    }
  }
  return false;
}

/** Whether every component of P is a circle, i.e. P is the union of the boundary words consisting of P-strips. */
function isUnionOfCircles(fs: FibredSurface): boolean {
  const inP = (e: OrientedEdge) => fs.peripheral.has(e.edge);
  const covered = new Set(peripheralCircles(fs, inP).flatMap((c) => c.edges.map((e) => e.edge)));
  return covered.size === fs.peripheral.size;
}

/** One peripheral circle, counterclockwise around its puncture. */
interface Circle {
  /** `edges[k]` runs counterclockwise from `vertices[k]` to `vertices[k + 1]`. */
  readonly edges: OrientedEdge[];
  readonly vertices: Vertex[];
  /** The strips leaving the circle at `vertices[k]`, in the cyclic order (σ), from the clockwise to the counterclockwise side. */
  readonly outside: OrientedEdge[][];
}

/** A circle with its peripheral gates and positions on the universal cover (in old circle edges, counterclockwise). */
interface Placed {
  readonly circle: Circle;
  /** The gates, in counterclockwise order, each a list of strips in counterclockwise order. */
  readonly gates: OrientedEdge[][];
  /** The unwrapped position of each leaving strip: its junction index plus a fraction for its rank there. */
  readonly position: Map<OrientedEdge, number>;
  /** The position of each gate's new junction: that of its first strip. */
  readonly gatePosition: number[];
}

/**
 * Absorbs into the periphery. Requires every component of P to be a circle (a boundary word of G).
 *
 * 1. Collapse the maximal invariant subgraph Q ⊇ P retracting to P into P.
 * 2. For each circle: the strips leaving it in the cyclic order of G/P, and their gates in G/P (Dg with the initial
 *    piece of the image in P skipped).
 * 3. A new circle with one junction per gate, at the position p(γ) of the gate's first strip.
 * 4. g: the new circle is mapped as a graph automorphism following the gates. In every image, a piece θ inside the
 *    circle, from the junction k₁ to the junction k₂, is replaced by the path along the new circle from the gate
 *    junction at its start to the one at its end, with displacement p(γ₂) − p(γ₁) + (k₁ + T(θ) − k₂), where T(θ) is the
 *    signed length of θ (counterclockwise positive) and k₁ + T(θ) − k₂ counts its laps. Leading and trailing pieces in P
 *    of the images of strips at P are dropped (the gates guarantee this).
 * 5. μ: strips moved to a gate junction get μ of the old circle path they were moved along in front.
 */
export function absorbIntoPeriphery(fs: FibredSurface): void {
  // 1. Q = P.
  const Q = maximalInvariantSubgraphRetractingTo(fs, fs.peripheral);
  const trees = new Set([...Q].filter((e) => !fs.peripheral.has(e)));
  if (trees.size > 0) {
    const onP = new Set([...fs.peripheral].flatMap((e) => [e.source, e.target]));
    collapseSubforest(
      fs,
      trees,
      (candidates) => candidates.find((v) => onP.has(v)) ?? (candidates[0] as Vertex),
    );
  }
  const P = new Set(fs.peripheral);
  const inP = (e: OrientedEdge) => P.has(e.edge);

  const circles = peripheralCircles(fs, inP);
  const circleOfVertex = new Map<Vertex, { circle: Circle; index: number }>();
  circles.forEach((circle) =>
    circle.vertices.forEach((v, index) => circleOfVertex.set(v, { circle, index })),
  );
  if (circleOfVertex.size !== new Set([...P].flatMap((e) => [e.source, e.target])).size)
    throw new Error("Every component of the periphery must be a circle");

  // 2. Dg in G/P, and gates: s ~ t iff (Dg_{G/P})^N agree.
  const firstOutsideP = (e: OrientedEdge) => {
    const letters = fs.g.image(e).letters;
    const k = letters.findIndex((x) => !inP(x));
    if (k === -1) throw new Error(`g(${e}) lies in P, but Q was maximal`);
    return { theta: letters.slice(0, k), first: letters[k] as OrientedEdge };
  };
  const leaving = circles.flatMap((c) => c.outside.flat());
  const dgQuotient = new Map(leaving.map((s) => [s, firstOutsideP(s).first]));
  const N = 2 * fs.graph.edgeCount;
  const limit = (s: OrientedEdge) => {
    let x: OrientedEdge | undefined = s;
    for (let i = 0; i < N && x !== undefined; i++) x = dgQuotient.get(x);
    return x;
  };

  // 3. Gates and positions.
  const placed = circles.map((circle) =>
    place(circle, limit, (s) =>
      signedLength(circle, EdgePath.from(firstOutsideP(s).theta).reduced().letters),
    ),
  );
  const gateOf = new Map<OrientedEdge, { placed: Placed; index: number }>();
  for (const pl of placed)
    pl.gates.forEach((gate, index) => gate.forEach((s) => gateOf.set(s, { placed: pl, index })));
  const junctions = new Map<Placed, Vertex[]>(placed.map((pl) => [pl, pl.gates.map(() => fs.addJunction())]));
  const newEdges = new Map<Placed, OrientedEdge[]>(
    placed.map((pl) => {
      const w = junctions.get(pl) as Vertex[];
      return [pl, w.map((v, i) => fs.addStrip(v, w[(i + 1) % w.length] as Vertex).forward)];
    }),
  );
  const isNewEdge = new Set([...newEdges.values()].flat().map((e) => e.edge));

  // Junctions outside P that g maps into P are moved to the closest gate junction.
  const shifted = new Map<Vertex, { placed: Placed; gate: number; unwrapped: number }>();
  for (const u of fs.graph.vertices) {
    if (circleOfVertex.has(u) || [...junctions.values()].some((w) => w.includes(u))) continue;
    const image = circleOfVertex.get(fs.g.vertexImage(u));
    if (image === undefined) continue;
    const pl = placed.find((x) => x.circle === image.circle) as Placed;
    const n = image.circle.edges.length;
    const closest = (q: number, p: number) => q + Math.round((p - q) / n) * n; // q + kn closest to p
    const gate = argMin(pl.gatePosition, (p) => Math.abs(closest(image.index, p) - p))?.index ?? 0;
    shifted.set(u, { placed: pl, gate, unwrapped: closest(image.index, pl.gatePosition[gate] as number) });
  }

  // 4. New images (computed on the old graph).
  const newImages = new Map<OrientedEdge, EdgePath>();
  for (const e of fs.graph.edges) {
    if (P.has(e) || isNewEdge.has(e)) continue;
    const letters = fs.g.image(e.forward).letters;
    const result: OrientedEdge[] = [];
    // Every visit of the image to a circle (a possibly empty piece θ in P) becomes a walk along the new circle.
    for (let i = 0; ;) {
      const at = i === 0 ? fs.g.vertexImage(e.source) : (letters[i - 1] as OrientedEdge).target;
      if (circleOfVertex.has(at)) {
        let j = i;
        while (j < letters.length && inP(letters[j] as OrientedEdge)) j++;
        const theta = letters.slice(i, j);
        const start = pieceEnd(letters[i - 1]?.reversed, e.forward.source);
        const end = pieceEnd(letters[j], e.backward.source);
        i = j;
        // The initial or final piece of a strip at P is dropped.
        if (start !== "drop" && end !== "drop") {
          const pl = start.placed;
          const laps = start.k + signedLength(pl.circle, theta) - end.k;
          if (end.placed !== pl || mod(laps, pl.circle.edges.length) !== 0)
            throw new Error(`A piece of g(${e}) in P doesn't run between the expected junctions`);
          const delta =
            (pl.gatePosition[end.gate] as number) - (pl.gatePosition[start.gate] as number) + laps;
          result.push(...walk(pl, newEdges.get(pl) as OrientedEdge[], start.gate, delta));
        }
      }
      if (i >= letters.length) break;
      result.push(letters[i++] as OrientedEdge);
    }
    newImages.set(e.forward, EdgePath.from(result));
  }

  /**
   * Where a piece in P starts (or ends): at the gate junction of the strip that leaves P there (`s`), or, if the image
   * starts (ends) in P, at the shifted image of the junction `u`. `k` is the unwrapped old junction index.
   */
  function pieceEnd(
    s: OrientedEdge | undefined,
    u: Vertex,
  ): "drop" | { placed: Placed; gate: number; k: number } {
    if (s !== undefined) {
      const { placed: pl, index } = gateOf.get(s) as { placed: Placed; index: number };
      return { placed: pl, gate: index, k: Math.floor(pl.position.get(s) as number) };
    }
    if (circleOfVertex.has(u)) return "drop";
    const shift = shifted.get(u);
    if (shift === undefined) throw new Error(`An image starts or ends in P, but ${u} is not mapped into P`);
    return { placed: shift.placed, gate: shift.gate, k: shift.unwrapped };
  }

  // 5. μ.
  for (const pl of placed) {
    const n = pl.circle.edges.length;
    const w = junctions.get(pl) as Vertex[];
    pl.gates.forEach((gate, index) => {
      const base = Math.floor(pl.gatePosition[index] as number);
      fs.mu.setVertexImage(w[index] as Vertex, fs.mu.vertexImage(pl.circle.vertices[mod(base, n)] as Vertex));
      for (const s of gate) {
        const path = circlePath(pl.circle, base, Math.floor(pl.position.get(s) as number) - base);
        fs.mu.setImage(s, muOfPath(path).concat(fs.mu.image(s)).reduced());
      }
    });
    (newEdges.get(pl) as OrientedEdge[]).forEach((edge, index) => {
      const from = Math.floor(pl.gatePosition[index] as number);
      const next = pl.gatePosition[(index + 1) % pl.gates.length] as number;
      const steps =
        pl.gates.length === 1
          ? n
          : Math.floor(next < (pl.gatePosition[index] as number) ? next + n : next) - from;
      fs.mu.setImage(edge, muOfPath(circlePath(pl.circle, from, steps)).reduced());
    });
  }
  function muOfPath(path: OrientedEdge[]): EdgePath {
    return EdgePath.concatAll(path.map((x) => fs.mu.image(x)));
  }

  // The graph: reattach the leaving strips to their gate junctions. Star: the circle edge leaving clockwise, the gate's
  // strips, the circle edge leaving counterclockwise (as at the old junctions).
  for (const pl of placed) {
    const edges = newEdges.get(pl) as OrientedEdge[];
    const w = junctions.get(pl) as Vertex[];
    pl.gates.forEach((gate, index) => {
      for (const s of gate) fs.graph.reattach(s, w[index] as Vertex);
      const clockwise = (edges[mod(index - 1, edges.length)] as OrientedEdge).reversed;
      fs.graph.setStar(w[index] as Vertex, [clockwise, ...gate, edges[index] as OrientedEdge]);
    });
  }

  // g on the new circles (a graph automorphism following the gates), on shifted junctions, and the new images.
  for (const pl of placed)
    pl.gates.forEach((gate, index) => {
      const image = gateOf.get(dgQuotient.get(gate[0] as OrientedEdge) as OrientedEdge);
      if (image === undefined) throw new Error("Dg of a peripheral gate doesn't leave P");
      fs.g.setVertexImage(
        (junctions.get(pl) as Vertex[])[index] as Vertex,
        (junctions.get(image.placed) as Vertex[])[image.index] as Vertex,
      );
      fs.g.setImage(
        (newEdges.get(pl) as OrientedEdge[])[index] as OrientedEdge,
        EdgePath.of((newEdges.get(image.placed) as OrientedEdge[])[image.index] as OrientedEdge),
      );
    });
  for (const [u, { placed: pl, gate }] of shifted)
    fs.g.setVertexImage(u, (junctions.get(pl) as Vertex[])[gate] as Vertex);
  for (const [e, image] of newImages) fs.g.setImage(e, image);

  // Replace the old circles by the new ones.
  for (const e of P) fs.removeStrip(e);
  for (const circle of circles)
    for (const v of circle.vertices) if (fs.graph.valence(v) === 0) fs.removeJunction(v);
  for (const e of isNewEdge) fs.peripheral.add(e);
}

/**
 * The peripheral circles. A boundary word of G made of P-strips has its puncture on the right, so its inverse runs
 * counterclockwise. At each junction of such a word, the star reads: the next strip of the word, the strips leaving
 * P, the reversed previous strip, and then (the puncture side) nothing.
 */
function peripheralCircles(fs: FibredSurface, inP: (e: OrientedEdge) => boolean): Circle[] {
  return fs.graph
    .boundaryWords()
    .filter((w) => w.letters.every(inP))
    .map((w) => {
      const edges = [...w.inverse.letters];
      const vertices = edges.map((e) => e.source);
      const outside = edges.map((e, k) => {
        const clockwise = (edges[mod(k - 1, edges.length)] as OrientedEdge).reversed; // leaves vertices[k] clockwise
        const star = fs.graph.starFrom(clockwise);
        return star.slice(1, star.indexOf(e));
      });
      return { edges, vertices, outside };
    });
}

/** Groups the strips leaving a circle into gates (intervals of the cyclic order) and assigns positions. */
function place(
  circle: Circle,
  limit: (s: OrientedEdge) => OrientedEdge | undefined,
  signedInitialLength: (s: OrientedEdge) => number,
): Placed {
  const n = circle.edges.length;
  const cyclic = circle.outside.flatMap((strips, k) =>
    strips.map((s, r) => ({ s, k, rank: (r + 1) / (strips.length + 1) })),
  );
  const key = (i: number) => limit((cyclic[mod(i, cyclic.length)] as { s: OrientedEdge }).s);
  // Cut the cyclic order open at a boundary between two gates, or, for a single gate, before the strip maximizing
  // S(e), the signed length of its tight initial path in P (the thesis's remark on the subtle case).
  let start = cyclic.findIndex((_, i) => key(i) !== key(i - 1));
  if (start === -1) start = argMax(cyclic, ({ s }) => signedInitialLength(s))?.index ?? 0;
  const order = rotate(cyclic, start);
  const first = order[0] as { k: number; rank: number };
  const position = new Map<OrientedEdge, number>();
  for (const { s, k, rank } of order)
    position.set(s, k + rank + (k < first.k || (k === first.k && rank < first.rank) ? n : 0));
  const gates: OrientedEdge[][] = [];
  for (const { s } of order) {
    const last = gates.at(-1);
    if (last !== undefined && limit(last[0] as OrientedEdge) === limit(s)) last.push(s);
    else gates.push([s]);
  }
  return {
    circle,
    gates,
    position,
    gatePosition: gates.map((g) => position.get(g[0] as OrientedEdge) as number),
  };
}

/**
 * The path along the new circle starting at the junction of gate `from`, with (unwrapped) displacement `delta`: it
 * passes gate junctions until it has moved by `delta`, which must end exactly at a gate junction.
 */
function walk(pl: Placed, edges: OrientedEdge[], from: number, delta: number): OrientedEdge[] {
  const n = pl.circle.edges.length;
  const m = pl.gates.length;
  const gap = (i: number) =>
    m === 1 ? n : mod((pl.gatePosition[(i + 1) % m] as number) - (pl.gatePosition[i] as number), n);
  const result: OrientedEdge[] = [];
  let [index, moved] = [from, 0];
  while (Math.abs(moved - delta) > TOLERANCE) {
    if (delta > moved) {
      moved += gap(index);
      result.push(edges[index] as OrientedEdge);
      index = (index + 1) % m;
      if (moved > delta + TOLERANCE) throw new Error("A path in P doesn't end at a gate junction");
    } else {
      index = mod(index - 1, m);
      moved -= gap(index);
      result.push((edges[index] as OrientedEdge).reversed);
      if (moved < delta - TOLERANCE) throw new Error("A path in P doesn't end at a gate junction");
    }
  }
  return result;
}

/** The signed length of a path in the circle: +1 per strip traversed counterclockwise, −1 per strip clockwise. */
function signedLength(circle: Circle, path: readonly OrientedEdge[]): number {
  return path.reduce(
    (sum, x) => sum + (circle.edges.includes(x) ? 1 : circle.edges.includes(x.reversed) ? -1 : 0),
    0,
  );
}

/** The path along the old circle from `vertices[from]` with `steps` strips (counterclockwise if positive). */
function circlePath(circle: Circle, from: number, steps: number): OrientedEdge[] {
  const n = circle.edges.length;
  return Array.from({ length: Math.abs(steps) }, (_, i) =>
    steps > 0
      ? (circle.edges[mod(from + i, n)] as OrientedEdge)
      : (circle.edges[mod(from - i - 1, n)] as OrientedEdge).reversed,
  );
}
