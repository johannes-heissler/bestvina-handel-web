/**
 * The layout of G in a chart (design doc § 3, steps 2–4; port note 20): where each strand crosses each port, where
 * the junctions are, and the polyline of each strip.
 *
 * 1. **Ports.** Along each edge of G₀, the strands are placed in the order of {@link strandOrder}, with lateral widths
 *    proportional to w(e)^c for the Perron–Frobenius width w and an exponent 0 ≤ c ≤ 1 (your suggestion: c = 0 spaces
 *    them evenly, c = 1 is to scale).
 * 2. **Junctions.** Inside each region, the junctions of G are placed by a barycentric (Tutte) layout: each junction is
 *    the average of its neighbours, where the neighbours are the port points of the strands leaving it and the other
 *    junctions joined to it by strips with trivial μ. In a convex region with straight segments (Klein coordinates for
 *    hyperbolic charts: geodesics), this doesn't create crossings for a planar arrangement.
 * 3. **Strips.** A strip is a sequence of polylines ("pieces"), one per stretch between gluings: junction → port,
 *    port → (along a band) → port, …, port → junction. At a gluing the curve jumps to the partner port.
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { Complex } from "../math/complex";
import type { FibredSurface } from "../fibred/fibred-surface";
import { perronFrobenius } from "../fibred/perron-frobenius";
import type { Chart, Port } from "./chart";
import { type StrandOrder, strandKey, strandOrder } from "./strand-order";

export interface LayoutOptions {
  /** The exponent c in w(e)^c for the lateral widths of the strands; 0 spaces them evenly. */
  readonly widthExponent?: number;
}

/** A polyline in chart coordinates, without gluing jumps. */
export type Piece = readonly Complex[];

export interface Layout {
  readonly chart: Chart;
  readonly order: StrandOrder;
  readonly junctions: ReadonlyMap<Vertex, Complex>;
  /** For each strip, its pieces (a gluing between consecutive pieces). */
  readonly strips: ReadonlyMap<Edge, readonly Piece[]>;
  /** The lateral width of each strip's strands, as a fraction of its port's width (for drawing to scale). */
  readonly relativeWidth: ReadonlyMap<Edge, number>;
}

export function layout(fs: FibredSurface, chart: Chart, options: LayoutOptions = {}): Layout {
  const c = options.widthExponent ?? 0;
  const order = strandOrder(fs.mu);
  const weight = strandWeights(fs, c);

  // 1. Lateral coordinates u ∈ (−1, 1) of each strand, along the forward orientation of its edge of G₀.
  const lateral = new Map<string, number>();
  const relativeWidth = new Map<Edge, number>();
  for (const [, list] of order.along) {
    const weights = list.map((s) => weight.get(s.strand.edge) as number);
    const gap = (weights.reduce((a, b) => a + b, 0) / weights.length) * 0.6;
    const total = weights.reduce((a, b) => a + b, 0) + gap * (weights.length + 1);
    let position = gap;
    list.forEach((s, i) => {
      const w = weights[i] as number;
      lateral.set(strandKey(s.strand), -1 + (2 * (position + w / 2)) / total);
      relativeWidth.set(s.strand.edge, Math.max(relativeWidth.get(s.strand.edge) ?? 0, w / total));
      position += w + gap;
    });
  }
  /** Where the strand (e, k) passes through the port of the letter x (the direction it runs in, or its reverse). */
  const portPoint = (e: Edge, k: number, x: OrientedEdge): Complex => {
    const u = (lateral.get(strandKey({ edge: e, index: k })) as number) * (x.isForward ? 1 : -1);
    const port = chart.ports.get(x) as Port;
    return port.right.add(port.left.sub(port.right).scale((u + 1) / 2));
  };

  // 2. Junctions: a Tutte layout per region.
  const neighbours = new Map<Vertex, (Vertex | Complex)[]>(fs.graph.vertices.map((v) => [v, []]));
  const add = (v: Vertex, other: Vertex | Complex) => (neighbours.get(v) as (Vertex | Complex)[]).push(other);
  for (const e of fs.graph.edges) {
    const letters = fs.mu.image(e.forward).letters;
    if (letters.length === 0) {
      if (e.source !== e.target) {
        add(e.source, e.target);
        add(e.target, e.source);
      }
      continue;
    }
    add(e.source, portPoint(e, 0, letters[0] as OrientedEdge));
    add(e.target, portPoint(e, letters.length - 1, (letters.at(-1) as OrientedEdge).reversed));
  }
  const junctions = new Map<Vertex, Complex>(
    fs.graph.vertices.map((v) => [v, chart.regions.get(fs.mu.vertexImage(v))?.center ?? Complex.ZERO]),
  );
  for (let iteration = 0; iteration < 300; iteration++)
    for (const v of fs.graph.vertices) {
      const list = neighbours.get(v) as (Vertex | Complex)[];
      if (list.length === 0) continue;
      const sum = list.reduce<Complex>(
        (s, x) => s.add(x instanceof Complex ? x : (junctions.get(x) as Complex)),
        Complex.ZERO,
      );
      junctions.set(v, sum.scale(1 / list.length));
    }

  // 3. The strips.
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
  return { chart, order, junctions, strips, relativeWidth };
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
