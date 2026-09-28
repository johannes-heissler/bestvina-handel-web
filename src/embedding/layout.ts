/**
 * The layout of G in a chart (design doc § 3, steps 2–4; port note 20): where each strand crosses each port, where
 * the junctions are, and the polyline of each strip.
 *
 * 1. **Ports.** Along each edge of G₀, the strands are placed in the order of {@link strandOrder}, with lateral widths
 *    proportional to w(e)^c for the Perron–Frobenius width w and an exponent 0 ≤ c ≤ 1 (your suggestion: c = 0 spaces
 *    them evenly, c = 1 is to scale). This is the start; see 2′ for glued sides.
 * 2. **Junctions.** Inside each region, the junctions of G are placed by a barycentric (Tutte) layout: each junction is
 *    the average of its neighbours, where the neighbours are the port points of the strands leaving it and the other
 *    junctions joined to it by strips with trivial μ. In a convex region with straight segments (Klein coordinates for
 *    hyperbolic charts: geodesics), this doesn't create crossings for a planar arrangement.
 * 2′. **Straight through the gluings.** Where a strip crosses a glued side (a polygon side, or the glued ends of two
 *    half-bands), the crossing moves so that the strip runs straight through it: in the universal cover, the strip
 *    from the previous point A through the crossing to the next point B should be one geodesic, so the crossing goes
 *    to where the segment from A to Φ(B) meets the side, Φ being the isometry of the chart that carries the other
 *    side of the gluing onto the continuation beyond this side (a deck transformation, or the rigid motion joining
 *    the half-bands). In Klein coordinates that is a straight line. Then the strands along each side are put back in
 *    their order, with gaps (room for the widths when drawn to scale, else 30% of the gaps of step 1), and within the
 *    port, which lies inside the side.
 *    Steps 2 and 2′ alternate for `smoothing` rounds (0: the positions of step 1).
 * 3. **Strips.** A strip is a sequence of polylines ("pieces"), one per stretch between gluings: junction → port,
 *    port → (along a band) → port, …, port → junction. At a gluing the curve jumps to the partner port.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { Complex } from "../math/complex";
import type { FibredSurface } from "../fibred/fibred-surface";
import { findGates } from "../fibred/gates";
import { perronFrobenius } from "../fibred/perron-frobenius";
import type { Chart, Port } from "./chart";
import { type StrandOrder, strandKey, strandOrder } from "./strand-order";

export interface LayoutOptions {
  /** The exponent c in w(e)^c for the lateral widths of the strands; 0 spaces them evenly. */
  readonly widthExponent?: number;
  /** Rounds of moving the crossings of glued sides so that the strips run straight through them (step 2′). */
  readonly smoothing?: number;
}

/** A polyline in chart coordinates, without gluing jumps. */
export type Piece = readonly Complex[];

export interface Layout {
  readonly chart: Chart;
  readonly order: StrandOrder;
  readonly junctions: ReadonlyMap<Vertex, Complex>;
  /**
   * For each strip end, the node of its gate in the layout: a point between the junction and the strands of the gate.
   * The direction from the junction to it is the direction in which the gate leaves.
   */
  readonly switches: ReadonlyMap<OrientedEdge, Complex>;
  /** For each strip, its pieces (a gluing between consecutive pieces). */
  readonly strips: ReadonlyMap<Edge, readonly Piece[]>;
  /** The lateral width of each strip's strands, as a fraction of its port's width (for drawing to scale). */
  readonly relativeWidth: ReadonlyMap<Edge, number>;
}

export function layout(fs: FibredSurface, chart: Chart, options: LayoutOptions = {}): Layout {
  const c = options.widthExponent ?? 0;
  const order = strandOrder(fs.mu);
  const weight = strandWeights(fs, c);

  // 1. Lateral coordinates u ∈ (−1, 1) of each strand, along the forward orientation of its edge of G₀: `front` at the
  // port of the forward orientation, `back` at the other one (as seen along the forward orientation, so that the
  // port coordinate there is −back). They differ only for glued half-bands after smoothing.
  const front = new Map<string, number>();
  const back = new Map<string, number>();
  const relativeWidth = new Map<Edge, number>();
  /** For each edge of G₀: the minimal gaps between consecutive strands and the bounds, for step 2′. */
  const spacing = new Map<Edge, { gaps: number[]; lo: number; hi: number }>();
  for (const [edge, list] of order.along) {
    const weights = list.map((s) => weight.get(s.strand.edge) as number);
    const gap = (weights.reduce((a, b) => a + b, 0) / weights.length) * 0.6;
    const total = weights.reduce((a, b) => a + b, 0) + gap * (weights.length + 1);
    let position = gap;
    const us: number[] = [];
    list.forEach((s, i) => {
      const w = weights[i] as number;
      const u = -1 + (2 * (position + w / 2)) / total;
      us.push(u);
      front.set(strandKey(s.strand), u);
      back.set(strandKey(s.strand), u);
      relativeWidth.set(s.strand.edge, Math.max(relativeWidth.get(s.strand.edge) ?? 0, w / total));
      position += w + gap;
    });
    // Straightening keeps 30% of the first spacing between neighbours, within 90% of the port. (The widths drawn to
    // scale are then shrunk to fit the positions, see `relativeWidth` below; the positions don't depend on them.)
    spacing.set(edge, { gaps: us.slice(1).map((u, i) => 0.3 * (u - (us[i] as number))), lo: -0.9, hi: 0.9 });
  }
  /** The port coordinate (−1 right … +1 left, looking outwards) of the strand (e, k) at the port of y. */
  const portCoordinate = (e: Edge, k: number, y: OrientedEdge): number => {
    const key = strandKey({ edge: e, index: k });
    return y.isForward ? (front.get(key) as number) : -(back.get(key) as number);
  };
  const pointOn = (port: Port, coordinate: number) =>
    port.right.add(port.left.sub(port.right).scale((coordinate + 1) / 2));
  /** Where the strand (e, k) passes through the port of the letter x (the direction it runs in, or its reverse). */
  const portPoint = (e: Edge, k: number, x: OrientedEdge): Complex =>
    pointOn(chart.ports.get(x) as Port, portCoordinate(e, k, x));
  const lateral = front; // along bands, front and back agree

  // 2. Junctions and switches: a Tutte layout per region. As in the train track τ, each gate of a junction is a node
  // (its switch) between the junction and the strands of the gate, so that strands in a gate leave in the same
  // direction. Each node is the average of its neighbours; the port points are fixed during a solve.
  const gateOf = new Map<OrientedEdge, number>();
  findGates(fs.graph, fs.g).forEach((gate, i) => gate.edges.forEach((x) => gateOf.set(x, i)));
  const junctionNode = (v: Vertex) => `j${v.id}`;
  const switchNode = (x: OrientedEdge) => `s${gateOf.get(x) ?? `${x.edge.id}${x.isForward ? "+" : "-"}`}`;
  const links = new Map<string, (string | (() => Complex))[]>();
  const link = (node: string, other: string | (() => Complex)) => {
    if (other === node) return;
    links.set(node, [...(links.get(node) ?? []), other]);
  };
  const start = new Map<string, Complex>();
  for (const v of fs.graph.vertices) {
    const center = chart.regions.get(fs.mu.vertexImage(v))?.center ?? Complex.ZERO;
    start.set(junctionNode(v), center);
    const members = new Map<string, number>();
    for (const x of fs.graph.star(v)) members.set(switchNode(x), (members.get(switchNode(x)) ?? 0) + 1);
    for (const [sw, count] of members) {
      start.set(sw, center);
      link(junctionNode(v), sw);
      // As strongly tied to its junction as to all its strands together: the switch lies halfway between the junction
      // and its strands, in the direction in which the gate leaves.
      for (let i = 0; i < count; i++) link(sw, junctionNode(v));
    }
  }
  for (const e of fs.graph.edges) {
    const letters = fs.mu.image(e.forward).letters;
    const [from, to] = [switchNode(e.forward), switchNode(e.backward)];
    if (letters.length === 0) {
      link(from, to);
      link(to, from);
      continue;
    }
    link(from, () => portPoint(e, 0, letters[0] as OrientedEdge));
    link(to, () => portPoint(e, letters.length - 1, (letters.at(-1) as OrientedEdge).reversed));
  }
  const position = new Map(start);
  const solve = (iterations: number) => {
    for (let iteration = 0; iteration < iterations; iteration++)
      for (const [node, list] of links) {
        const sum = list.reduce<Complex>(
          (acc, x) => acc.add(typeof x === "string" ? (position.get(x) as Complex) : x()),
          Complex.ZERO,
        );
        position.set(node, sum.scale(1 / list.length));
      }
  };
  solve(400);

  // 2′. Straight through the gluings.
  const gluing = gluingMaps(chart);
  const rounds = gluing.size > 0 ? (options.smoothing ?? 0) : 0;
  for (let round = 0; round < rounds; round++) {
    for (const e of fs.graph.edges) {
      const letters = fs.mu.image(e.forward).letters;
      letters.forEach((x, k) => {
        const map = gluing.get(x);
        if (map === undefined) return;
        const a =
          k === 0
            ? (position.get(switchNode(e.forward)) as Complex)
            : portPoint(e, k - 1, (letters[k - 1] as OrientedEdge).reversed);
        const b =
          k === letters.length - 1
            ? (position.get(switchNode(e.backward)) as Complex)
            : portPoint(e, k + 1, letters[k + 1] as OrientedEdge);
        const target = map.apply(b);
        const key = strandKey({ edge: e, index: k });
        const [out, over] = [chart.ports.get(x) as Port, chart.ports.get(x.reversed) as Port];
        const set = (y: OrientedEdge, coordinate: number | undefined) => {
          if (coordinate === undefined || !Number.isFinite(coordinate)) return;
          if (y.isForward) front.set(key, coordinate);
          else back.set(key, -coordinate);
        };
        const here = lineParameter(a, target, out.right, out.left);
        if (out.stub === 0) {
          // One point, on both sides of the gluing.
          if (here === undefined) return;
          const coordinate = 2 * here - 1;
          set(x, coordinate);
          set(x.reversed, -coordinate);
        } else {
          // Two points: where the line enters the half-band of x, and where it leaves the half-band of x̄.
          set(x, here === undefined ? undefined : 2 * here - 1);
          const there = lineParameter(a, target, map.apply(over.right), map.apply(over.left));
          set(x.reversed, there === undefined ? undefined : 2 * there - 1);
        }
      });
    }
    // Back into their order, with gaps, inside the ports.
    for (const [edge, list] of order.along) {
      if (!gluing.has(edge.forward)) continue;
      const { gaps, lo, hi } = spacing.get(edge) as { gaps: number[]; lo: number; hi: number };
      for (const side of [front, back]) {
        const values = list.map((p) => side.get(strandKey(p.strand)) as number);
        orderedWithGaps(values, gaps, lo, hi).forEach((u, i) =>
          side.set(strandKey((list[i] as { strand: { edge: Edge; index: number } }).strand), u),
        );
      }
      if ((chart.ports.get(edge.forward) as Port).stub === 0)
        for (const p of list) back.set(strandKey(p.strand), front.get(strandKey(p.strand)) as number);
    }
    solve(60);
  }
  // Drawn to scale, the strands must fit between their neighbours at their final positions: shrink all widths by one
  // factor (so they stay proportional to w(e)^c) until none overlaps its neighbour or the end of its port.
  let fit = 1;
  for (const list of order.along.values())
    for (const side of [front, back]) {
      const us = list.map((p) => side.get(strandKey(p.strand)) as number);
      const half = list.map((p) => relativeWidth.get(p.strand.edge) as number); // half the width, in u
      us.forEach((u, i) => {
        if (i === 0) fit = Math.min(fit, (u + 1) / (half[0] as number));
        if (i === us.length - 1) fit = Math.min(fit, (1 - u) / (half[i] as number));
        if (i > 0)
          fit = Math.min(fit, (u - (us[i - 1] as number)) / ((half[i] as number) + (half[i - 1] as number)));
      });
    }
  if (fit < 1) for (const [e, w] of relativeWidth) relativeWidth.set(e, w * Math.max(0, fit) * 0.9);
  const junctions = new Map(fs.graph.vertices.map((v) => [v, position.get(junctionNode(v)) as Complex]));
  const switches = new Map(fs.graph.orientedEdges.map((x) => [x, position.get(switchNode(x)) as Complex]));

  // 3. The strips.
  const buildStrips = (junctions: ReadonlyMap<Vertex, Complex>): Map<Edge, Piece[]> => {
    const strips = new Map<Edge, Piece[]>();
    for (const e of fs.graph.edges) {
      const letters = fs.mu.image(e.forward).letters;
      const pieces: Complex[][] = [[junctions.get(e.source) as Complex]];
      letters.forEach((x, k) => {
        const current = pieces.at(-1) as Complex[];
        const exit = portPoint(e, k, x);
        const entry = portPoint(e, k, x.reversed);
        const band = chart.bands.get(x.edge);
        if (band?.kind === "path") {
          const u = (lateral.get(strandKey({ edge: e, index: k })) as number) * (x.isForward ? 1 : -1);
          const centerline = x.isForward ? band.centerline : band.centerline.toReversed();
          current.push(...offset(centerline, u * band.halfWidth));
        } else {
          const [out, back] = [chart.ports.get(x) as Port, chart.ports.get(x.reversed) as Port];
          current.push(exit);
          if (out.stub > 0) current.push(exit.add(out.outward.scale(out.stub)));
          pieces.push(back.stub > 0 ? [entry.add(back.outward.scale(back.stub)), entry] : [entry]);
        }
      });
      (pieces.at(-1) as Complex[]).push(junctions.get(e.target) as Complex);
      strips.set(e, pieces);
    }
    return strips;
  };

  // 4. No junction on the wrong side of another strip. The barycentric placement only knows a junction's own
  // neighbours; if it was subdivided out of a bundle of parallel strips, it can land beyond one of them, and then its own
  // strips cross it. So while a segment from a junction to its first port crosses a segment of another strip, the
  // junction moves across that strip, to between the crossing and the port.
  for (let round = 0; round < 12; round++) {
    const current = buildStrips(junctions);
    let moved = false;
    for (const v of fs.graph.vertices) {
      const j = junctions.get(v) as Complex;
      const own = new Set(fs.graph.star(v).map((x) => x.edge));
      const others = fs.graph.edges
        .filter((e) => !own.has(e))
        .flatMap((e) => segments(current.get(e) as Piece[]));
      for (const x of fs.graph.star(v)) {
        const pieces = current.get(x.edge) as Piece[];
        const port = x.isForward ? (pieces[0] as Piece)[1] : (pieces.at(-1) as Piece).at(-2);
        if (port === undefined) continue;
        const crossing = others
          .map(([p, q]) => intersection(j, port, p, q))
          .find((point) => point !== undefined);
        if (crossing) {
          junctions.set(v, crossing.add(port.sub(crossing).scale(0.35)));
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }
  const strips = buildStrips(junctions);
  return { chart, order, junctions, switches, strips, relativeWidth };
}

/** w(e)^c, with the Perron–Frobenius widths (strips of width 0 or without one get the smallest positive width). */
export function strandWeights(fs: FibredSurface, exponent: number): Map<Edge, number> {
  if (exponent === 0) return new Map(fs.graph.edges.map((e) => [e, 1]));
  let widths: ReadonlyMap<Edge, number>;
  try {
    widths = perronFrobenius(fs, { essentialOnly: false }).widths;
  } catch {
    return new Map(fs.graph.edges.map((e) => [e, 1]));
  }
  const positive = [...widths.values()].filter((w) => w > 1e-12);
  const smallest = positive.length > 0 ? Math.min(...positive) : 1;
  const largest = positive.length > 0 ? Math.max(...positive) : 1;
  return new Map(
    fs.graph.edges.map((e) => {
      const w = widths.get(e) ?? 0;
      return [e, ((w > 1e-12 ? w : smallest) / largest) ** exponent];
    }),
  );
}

/** The polyline moved sideways by `distance` (to the left of its direction for positive distances). */
export function offset(line: readonly Complex[], distance: number): Complex[] {
  if (distance === 0 || line.length < 2) return [...line];
  return line.map((p, i) => {
    const before = line[Math.max(0, i - 1)] as Complex;
    const after = line[Math.min(line.length - 1, i + 1)] as Complex;
    const tangent = after.sub(before);
    const length = tangent.abs();
    if (length === 0) return p;
    return p.add(new Complex(-tangent.im, tangent.re).scale(distance / length));
  });
}

/** The segments of polylines. */
function segments(pieces: readonly Piece[]): [Complex, Complex][] {
  return pieces.flatMap((piece) =>
    piece.slice(1).map((q, i) => [piece[i] as Complex, q] as [Complex, Complex]),
  );
}

/** The point where the segments ab and cd cross (in their interiors), if they do. */
function intersection(a: Complex, b: Complex, c: Complex, d: Complex): Complex | undefined {
  const r = b.sub(a);
  const s = d.sub(c);
  const denominator = r.re * s.im - r.im * s.re;
  if (Math.abs(denominator) < 1e-12) return undefined;
  const ca = c.sub(a);
  const t = (ca.re * s.im - ca.im * s.re) / denominator;
  const u = (ca.re * r.im - ca.im * r.re) / denominator;
  const margin = 1e-6;
  return t > margin && t < 1 - margin && u > margin && u < 1 - margin ? a.add(r.scale(t)) : undefined;
}

/**
 * For each glued port x of the chart: the isometry of the chart that carries the neighbourhood of the port of x̄ to the
 * continuation of the surface beyond the port of x (and its inverse). For a polygon it is the deck transformation of
 * the copy across the side of x; for glued half-bands, the rigid motion that puts the half-band of x̄ onto the end of
 * the half-band of x.
 */
function gluingMaps(
  chart: Chart,
): Map<OrientedEdge, { apply: (z: Complex) => Complex; inverse: (z: Complex) => Complex }> {
  const result = new Map<
    OrientedEdge,
    { apply: (z: Complex) => Complex; inverse: (z: Complex) => Complex }
  >();
  const middle = (port: Port) => port.right.add(port.left).scale(0.5);
  for (const [edge, band] of chart.bands) {
    if (band.kind !== "glue") continue;
    for (const x of [edge.forward, edge.backward]) {
      const [out, over] = [chart.ports.get(x), chart.ports.get(x.reversed)];
      if (!out || !over) continue;
      if (out.stub > 0) {
        // The end of the half-band of x̄ onto the end of the half-band of x, turning its outward direction around.
        const [m, n] = [
          middle(out).add(out.outward.scale(out.stub)),
          middle(over).add(over.outward.scale(over.stub)),
        ];
        const turn = Complex.fromPolar(1, out.outward.neg().arg() - over.outward.arg());
        result.set(x, {
          apply: (z) => turn.mul(z.sub(n)).add(m),
          inverse: (z) => z.sub(m).div(turn).add(n),
        });
        continue;
      }
      // A polygon: the deck transformation (or its inverse) that maps the middle of the port of x̄ to that of x.
      const deck = chart.deck;
      if (deck === undefined) continue;
      const candidates: { apply: (z: Complex) => Complex; inverse: (z: Complex) => Complex }[] =
        deck.kind === "translation"
          ? [...deck.generators.values()].flatMap((t) => [
              { apply: (z: Complex) => z.add(t), inverse: (z: Complex) => z.sub(t) },
              { apply: (z: Complex) => z.sub(t), inverse: (z: Complex) => z.add(t) },
            ])
          : [...deck.generators.values()].flatMap((g) => {
              const h = g.inverse();
              return [
                { apply: (z: Complex) => g.applyKlein(z), inverse: (z: Complex) => h.applyKlein(z) },
                { apply: (z: Complex) => h.applyKlein(z), inverse: (z: Complex) => g.applyKlein(z) },
              ];
            });
      const error = (c: (typeof candidates)[number]) => c.apply(middle(over)).sub(middle(out)).abs();
      const best = candidates.reduce<(typeof candidates)[number] | undefined>(
        (bestSoFar, c) => (bestSoFar === undefined || error(c) < error(bestSoFar) ? c : bestSoFar),
        undefined,
      );
      if (best !== undefined && error(best) < 1e-6) result.set(x, best);
    }
  }
  return result;
}

/** The parameter s of the point p + s(q − p) where the line through a and b meets the line through p and q. */
function lineParameter(a: Complex, b: Complex, p: Complex, q: Complex): number | undefined {
  const d = b.sub(a);
  const r = q.sub(p);
  const denominator = d.re * r.im - d.im * r.re;
  if (Math.abs(denominator) < 1e-12) return undefined;
  const w = p.sub(a);
  return (d.im * w.re - d.re * w.im) / denominator;
}

/**
 * The values closest to `values` (in the least-squares sense) that increase by at least `gaps[i]` from the i-th to the
 * next and lie in [lo, hi]: subtracting the accumulated gaps turns this into an increasing fit (pool adjacent
 * violators), which is then clamped.
 */
export function orderedWithGaps(
  values: readonly number[],
  gaps: readonly number[],
  lo: number,
  hi: number,
): number[] {
  const offsets = values.map((_, i) => gaps.slice(0, i).reduce((a, b) => a + b, 0));
  const shifted = values.map((v, i) => v - (offsets[i] as number));
  const blocks: { sum: number; count: number }[] = [];
  for (const v of shifted) {
    blocks.push({ sum: v, count: 1 });
    while (blocks.length > 1) {
      const [p, q] = [
        blocks.at(-2) as { sum: number; count: number },
        blocks.at(-1) as { sum: number; count: number },
      ];
      if (p.sum / p.count <= q.sum / q.count) break;
      blocks.splice(-2, 2, { sum: p.sum + q.sum, count: p.count + q.count });
    }
  }
  const fitted = blocks.flatMap((block) => Array<number>(block.count).fill(block.sum / block.count));
  const top = hi - (offsets.at(-1) ?? 0);
  return fitted.map((w, i) => Math.min(Math.max(w, lo), Math.max(lo, top)) + (offsets[i] as number));
}
