/**
 * Drawing a laid-out fibred surface as SVG (the 2D views; port note 20). Headless: returns a string, so it runs in
 * Node for tests and exports, and the UI puts it into the page.
 *
 * Views (your description of D3):
 * - **trainTrack**: the train track τ: the strips, ending at the switches of their gates on a small transparent disk
 *   around each junction, with the infinitesimal branches of τ between the switches;
 * - **striped**: each strip as a ribbon with one stripe per piece of the image f(F) inside it, in the colour of the
 *   strip it comes from (f[F] ⊆ F). This needs g to be tight (see `strandOrder`).
 *
 * @module
 */
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { Complex } from "../math/complex";
import type { Color } from "../math/color";
import type { FibredSurface } from "../fibred/fibred-surface";
import { trainTrack } from "../fibred/train-track";
import { DiskIsometry, fromKlein, type HyperbolicModel } from "../geometry/hyperbolic";
import type { Chart, Decoration } from "../embedding/chart";
import { type Layout, offset } from "../embedding/layout";
import { strandOrder } from "../embedding/strand-order";

export type ViewKind = "trainTrack" | "striped";
export type Smoothing = "none" | "spline" | "rounded";

export interface RenderOptions {
  readonly view?: ViewKind;
  /** For hyperbolic charts: the model to display. */
  readonly model?: HyperbolicModel;
  readonly smoothing?: Smoothing;
  /** How many layers of copies of the polygon (deck transformations) to draw around it. */
  readonly deckDepth?: number;
  /** The width and height in pixels. */
  readonly size?: number;
  /** Draw the names of strips and junctions. */
  readonly labels?: boolean;
  /** "uniform": thin lines; "toScale": as wide as their share of the ports (with the layout's width exponent c). */
  readonly stripWidth?: "uniform" | "toScale";
}

export interface Rendered {
  readonly svg: string;
  /** Remarks for the user, e.g. why the striped view isn't available. */
  readonly notes: readonly string[];
}

const COPY_OPACITY = 0.35;

export function renderSvg(fs: FibredSurface, layout: Layout, options: RenderOptions = {}): Rendered {
  const size = options.size ?? 640;
  const view = options.view ?? "trainTrack";
  const model = options.model ?? "poincare";
  const smoothing = options.smoothing ?? "spline";
  const chart = layout.chart;
  const notes: string[] = [];
  const hyperbolic = chart.geometry === "hyperbolic";

  const toDisplay = (z: Complex) => (hyperbolic ? fromKlein(model, z) : z);
  const bounds = displayBounds(chart, toDisplay, hyperbolic ? model : undefined);
  const scale = size / Math.max(bounds.width, bounds.height);
  const px = (z: Complex) => `${fmt((z.re - bounds.minX) * scale)},${fmt((bounds.maxY - z.im) * scale)}`;

  /** A chart polyline, smoothed and densified in chart coordinates, then mapped to the display. */
  const display = (line: readonly Complex[], transform?: (z: Complex) => Complex): Complex[] => {
    const smooth = smooth_(line, smoothing);
    const dense = hyperbolic ? densify(smooth, 0.02) : smooth;
    return dense.map((z) => toDisplay(transform ? transform(z) : z));
  };
  const path = (points: readonly Complex[]) => `M${points.map(px).join("L")}`;

  const parts: string[] = [];
  const copies = deckCopies(chart, options.deckDepth ?? 0, toDisplay);

  // Strip widths: thin and uniform, or to scale with their share of the ports.
  const portPixels = averagePortPixels(chart, toDisplay) * scale;
  const strokeWidth = (e: Edge) =>
    options.stripWidth === "toScale"
      ? Math.max(0.8, (layout.relativeWidth.get(e) ?? 0.2) * portPixels * 0.9)
      : 2.2;

  // Junction disks and the switches of the gates.
  const junctionPixels = Math.max(5, size / 110);
  const junctionRadius = junctionPixels / scale; // in display units
  let gatesOf: (v: Vertex) => { switchOf: Map<OrientedEdge, Vertex>; infinitesimal: [Vertex, Vertex][] };
  try {
    const tt = trainTrack(fs);
    gatesOf = (v) => ({
      switchOf: new Map(fs.graph.star(v).map((x) => [x, tt.switchOf.get(x) as Vertex])),
      infinitesimal: tt.graph.edges
        .filter((b) => tt.kind.get(b) === "infinitesimal" && tt.junctionOf.get(b.source) === v)
        .map((b) => [b.source, b.target] as [Vertex, Vertex]),
    });
  } catch {
    gatesOf = (v) => ({ switchOf: new Map(fs.graph.star(v).map((x) => [x, v])), infinitesimal: [] });
  }

  /** The display polylines of a strip (in the chart, before a deck transformation). */
  const stripLines = (e: Edge, transform?: (z: Complex) => Complex) =>
    (layout.strips.get(e) ?? []).map((piece) => display(piece, transform));

  /**
   * For each junction, the distance in the chart to the nearest other junction or strip that doesn't end there (Infinity
   * if there is none): its disk and the bends of its strips stay well within it, so they don't reach across a strip
   * passing close by (e.g. when the junction was subdivided out of a bundle of parallel strips).
   */
  const nearest = new Map<Vertex, number>(
    fs.graph.vertices.map((v) => {
      const p = layout.junctions.get(v) as Complex;
      const toJunctions = fs.graph.vertices
        .filter((u) => u !== v)
        .map((u) => (layout.junctions.get(u) as Complex).sub(p).abs());
      const own = new Set(fs.graph.star(v).map((x) => x.edge));
      const toStrips = fs.graph.edges
        .filter((e) => !own.has(e))
        .flatMap((e) => layout.strips.get(e) ?? [])
        .flatMap((piece) => piece.slice(1).map((q, i) => distanceToSegment(p, piece[i] as Complex, q)));
      return [v, Math.min(Infinity, ...toJunctions, ...toStrips)];
    }),
  );

  /** Moves the ends of the strips at junctions onto the switch points of their gates. */
  const attachToSwitches = (
    lines: Map<Edge, Complex[][]>,
    junctionAt: (v: Vertex) => Complex,
    radiusOf: (v: Vertex) => number,
    toScreen: (z: Complex) => Complex,
  ): Map<Vertex, Map<Vertex, Complex>> => {
    const switchPoints = new Map<Vertex, Map<Vertex, Complex>>();
    const ends = new Map<OrientedEdge, StripEnd>();
    for (const v of fs.graph.vertices) {
      const center = junctionAt(v);
      const junctionRadius = radiusOf(v);
      const { switchOf } = gatesOf(v);
      // Each gate leaves in the middle of its angular span: the directions of its strands, taken in the cyclic order
      // of the star and unrolled counterclockwise, from the first to the last. Then the direction straight behind the
      // gate lies outside its span, so that the strands side by side (in star order) don't have to cross. (The node of
      // the gate in the layout is only a fallback: for a wide gate its direction is arbitrary.)
      const star = fs.graph.star(v);
      // The directions are taken in the chart (Klein coordinates for polygons), where each strip leaves straight
      // towards its next point. Near the junction in the display model they can be almost equal: geodesics towards the
      // far side of the Poincaré disk all start towards its centre, and their order then gets lost in the sampling.
      const junctionInChart = layout.junctions.get(v) as Complex;
      const chartAngle = (x: OrientedEdge) => {
        const pieces = layout.strips.get(x.edge) as readonly (readonly Complex[])[];
        const next = x.isForward
          ? (pieces[0] as readonly Complex[])[1]
          : (pieces.at(-1) as readonly Complex[]).at(-2);
        return (next ?? junctionInChart.add(Complex.ONE)).sub(junctionInChart).arg();
      };
      const gateStart = (s: Vertex) =>
        star.findIndex(
          (y, i) =>
            switchOf.get(y) === s &&
            switchOf.get(star[(i - 1 + star.length) % star.length] as OrientedEdge) !== s,
        );
      const points = new Map<Vertex, Complex>();
      const psiInChartOf = new Map<Vertex, number>();
      /** The strands of each gate from right to left, looking outwards (the lanes): as used for its direction. */
      const lanesOf = new Map<Vertex, OrientedEdge[]>();
      for (const s of new Set(star.map((y) => switchOf.get(y) as Vertex))) {
        // A counterclockwise step between consecutive strands; a tiny backward step (nearly parallel strands) stays
        // backward instead of becoming almost a full turn.
        const step = (from: number, to: number) => {
          const d = (((to - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          return d > 2 * Math.PI - 0.35 ? d - 2 * Math.PI : d;
        };
        let inGate: OrientedEdge[];
        if (star.every((y) => switchOf.get(y) === s)) {
          // A single gate has no boundary in the star: start after the largest gap between consecutive strands.
          const gaps = star.map((y, i) =>
            step(chartAngle(y), chartAngle(star[(i + 1) % star.length] as OrientedEdge)),
          );
          const widest = gaps.indexOf(Math.max(...gaps));
          inGate = [...star.slice(widest + 1), ...star.slice(0, widest + 1)];
        } else {
          const start = Math.max(0, gateStart(s));
          inGate = [...star.slice(start), ...star.slice(0, start)].filter((y) => switchOf.get(y) === s);
        }
        let unrolled = chartAngle(inGate[0] as OrientedEdge);
        const first = unrolled;
        for (const y of inGate.slice(1)) unrolled += step(unrolled, chartAngle(y));
        const psiInChart = (first + unrolled) / 2;
        psiInChartOf.set(s, psiInChart);
        lanesOf.set(s, inGate);
        // The same direction in the display.
        const psi = toScreen(junctionInChart.add(Complex.fromPolar(1e-4, psiInChart)))
          .sub(toScreen(junctionInChart))
          .arg();
        points.set(s, center.add(Complex.fromPolar(junctionRadius, psi)));
      }
      switchPoints.set(v, points);
      // The strips of a gate leave their switch side by side, perpendicular to the circle (like the branches of a
      // train track). Everything is constructed in the chart (Klein coordinates for polygons: geodesics are straight)
      // and then mapped to the display.
      const scale =
        toScreen(junctionInChart.add(new Complex(1e-5, 0)))
          .sub(toScreen(junctionInChart))
          .abs() / 1e-5;
      const radius = junctionRadius / (scale || 1); // the junction's radius in the chart
      const pixel = junctionRadius / junctionPixels / (scale || 1); // one pixel in the chart
      const members = new Map<Vertex, OrientedEdge[]>();
      for (const x of star)
        members.set(switchOf.get(x) as Vertex, [...(members.get(switchOf.get(x) as Vertex) ?? []), x]);
      for (const [s, list] of members) {
        const psi = psiInChartOf.get(s) as number;
        const out = Complex.fromPolar(1, psi);
        const left = new Complex(-out.im, out.re);
        const gap = Math.min(radius * 0.35, radius / Math.max(1, list.length)); // the gate is at most ~R wide
        const length = radius * 0.9;
        // The same order as for the gate's direction (a single gate is cut at its widest gap, not where the star starts).
        const lanes = lanesOf.get(s) as OrientedEdge[];
        list.sort((p, q) => lanes.indexOf(p) - lanes.indexOf(q));
        list.forEach((x, j) => {
          const shift = left.scale((j - (list.length - 1) / 2) * gap);
          ends.set(x, {
            x,
            center,
            junctionRadius,
            switchPoint: points.get(s) as Complex,
            radialStart: junctionInChart.add(out.scale(radius * 1.2)).add(shift),
            radialEnd: junctionInChart.add(out.scale(radius + length)).add(shift),
            out,
            nominal: Math.max(length * 1.4, 16 * pixel),
            cap: (nearest.get(v) as number) * 0.4,
          });
        });
      }
    }

    // Each strip end turns on a circular arc only until it points at its target, and then runs straight (a geodesic)
    // to it: the port on the side it crosses, or, for a strip with trivial mu, the end of the arc at its other end
    // (found in two rounds, starting from the midpoint). Strands that turn further use smaller circles, so they stay
    // on the inside and the curves are nested.
    const targetOf = (x: OrientedEdge, tangent: Map<OrientedEdge, Complex>): Complex => {
      const pieces = layout.strips.get(x.edge) as readonly (readonly Complex[])[];
      const path = x.isForward
        ? (pieces[0] as readonly Complex[])
        : (pieces.at(-1) as readonly Complex[]).toReversed();
      if (!fs.mu.image(x.edge.forward).isEmpty) return path[1] ?? (path[0] as Complex);
      const other = tangent.get(x.reversed);
      if (other) return other;
      return (layout.junctions.get(x.source) as Complex)
        .add(layout.junctions.get(x.target) as Complex)
        .scale(0.5);
    };
    const arcs = new Map<OrientedEdge, { arc: Complex[]; tangent: Complex } | undefined>();
    let tangentPoints = new Map<OrientedEdge, Complex>();
    for (let round = 0; round < 2; round++) {
      const next = new Map<OrientedEdge, Complex>();
      for (const [x, end] of ends) {
        const arc = arcTowards(end, targetOf(x, tangentPoints));
        arcs.set(x, arc);
        if (arc) next.set(x, arc.tangent);
      }
      tangentPoints = next;
    }
    for (const [x, end] of ends) {
      const { line, atStart } = endAt(lines, x);
      const displayPath = atStart ? [...line] : line.toReversed();
      const target = targetOf(x, tangentPoints);
      const arc = arcs.get(x);
      let result: Complex[];
      if (arc === undefined) {
        // Too short to bend: drop the points inside the disk and start at the switch.
        const rest = displayPath.filter((p) => p.sub(end.center).abs() >= end.junctionRadius);
        result = [end.switchPoint, ...(rest.length > 0 ? rest : [displayPath.at(-1) as Complex])];
      } else {
        // Continue with the rest of the strip from its point closest to the target.
        const onScreen = toScreen(target);
        let k = 0;
        displayPath.forEach((p, i) => {
          if (p.sub(onScreen).abs() < (displayPath[k] as Complex).sub(onScreen).abs()) k = i;
        });
        const straight = densify([arc.tangent, target], 0.01).slice(1, -1);
        result = [
          end.switchPoint,
          toScreen(end.radialStart),
          toScreen(end.radialEnd),
          ...arc.arc.map(toScreen),
          ...straight.map(toScreen),
          ...displayPath.slice(k),
        ];
      }
      line.splice(0, line.length, ...(atStart ? result : result.toReversed()));
    }
    return switchPoints;
  };

  const drawSurface = (transform: ((z: Complex) => Complex) | undefined, opacity: number) => {
    const group: string[] = [];
    const labels = (options.labels ?? true) && transform === undefined; // copies get no labels
    /** How much the copy shrinks the display near z (1 for the polygon itself). */
    const localScale = (z: Complex) => {
      if (transform === undefined) return 1;
      const delta = new Complex(1e-4, 0);
      const before = toDisplay(z.add(delta)).sub(toDisplay(z)).abs();
      return before === 0
        ? 1
        : toDisplay(transform(z.add(delta)))
            .sub(toDisplay(transform(z)))
            .abs() / before;
    };
    for (const d of chart.decorations)
      group.push(decoration(d, (z) => toDisplay(transform ? transform(z) : z), px, scale, labels));

    const lines = new Map<Edge, Complex[][]>(fs.graph.edges.map((e) => [e, stripLines(e, transform)]));
    const junctionAt = (v: Vertex) =>
      toDisplay(
        transform ? transform(layout.junctions.get(v) as Complex) : (layout.junctions.get(v) as Complex),
      );
    /** The radius of a junction's disk in the display: fixed, but at most 0.3 of the distance to the nearest junction. */
    const radiusOf = (v: Vertex) => {
      const p = layout.junctions.get(v) as Complex;
      const toScreen = (z: Complex) => toDisplay(transform ? transform(z) : z);
      const d = nearest.get(v) as number;
      const nearestOnScreen = Number.isFinite(d)
        ? toScreen(p.add(new Complex(d, 0)))
            .sub(toScreen(p))
            .abs()
        : Infinity;
      return Math.min(junctionRadius * localScale(p), nearestOnScreen * 0.3);
    };
    const switchPoints = attachToSwitches(lines, junctionAt, radiusOf, (z) =>
      toDisplay(transform ? transform(z) : z),
    );

    if (view === "striped") {
      let stripes: ReturnType<typeof strandOrder> | undefined;
      try {
        stripes = strandOrder(fs.g);
      } catch {
        if (!notes.includes(STRIPED_NOTE)) notes.push(STRIPED_NOTE);
      }
      for (const e of fs.graph.edges) {
        const width = strokeWidth(e) * 2.2;
        for (const line of lines.get(e) ?? [])
          group.push(
            `<path data-edge="${escape(e.name)}" d="${path(line)}" stroke="${css(e.color)}" stroke-opacity="0.18" stroke-width="${fmt(width)}" fill="none" stroke-linejoin="round"/>`,
          );
        const list = stripes?.along.get(e) ?? [];
        list.forEach((s, i) => {
          const shift = (width / scale) * (-0.5 + (i + 0.5) / list.length);
          for (const line of lines.get(e) ?? [])
            group.push(
              `<path d="${path(offset(line, shift))}" stroke="${css(s.strand.edge.color)}" stroke-width="${fmt((0.8 * width) / list.length)}" fill="none"/>`,
            );
        });
      }
    } else {
      // A small arrow in the middle of each segment, in the direction of the strip.
      for (const e of fs.graph.edges)
        for (const line of lines.get(e) ?? []) {
          const arrow = arrowAt(line, (4 + strokeWidth(e)) / scale);
          if (arrow) group.push(`<path d="M${arrow.map(px).join("L")}Z" fill="${css(e.color)}"/>`);
        }
      for (const e of fs.graph.edges)
        for (const line of lines.get(e) ?? [])
          group.push(
            `<path data-edge="${escape(e.name)}" d="${path(line)}" stroke="${css(e.color)}" stroke-width="${fmt(strokeWidth(e))}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
          );
    }

    for (const v of fs.graph.vertices) {
      const center = junctionAt(v);
      const points = switchPoints.get(v) as Map<Vertex, Complex>;
      const transparent = view === "trainTrack";
      const radius = radiusOf(v) * scale;
      if (radius < 1) continue;
      group.push(
        `<circle cx="${px(center).split(",")[0]}" cy="${px(center).split(",")[1]}" r="${fmt(radius)}" fill="${transparent ? "#ffffff" : "#fafafa"}" fill-opacity="${transparent ? 0.35 : 1}" stroke="#333" stroke-width="1"/>`,
      );
      if (transparent)
        for (const [a, b] of gatesOf(v).infinitesimal) {
          const [p, q] = [points.get(a), points.get(b)];
          if (p && q)
            group.push(
              `<path d="M${px(p)}Q${px(center)} ${px(q)}" stroke="#555" stroke-width="1" fill="none"/>`,
            );
        }
      for (const p of points.values())
        group.push(`<circle cx="${px(p).split(",")[0]}" cy="${px(p).split(",")[1]}" r="1.6" fill="#333"/>`);
      if (labels)
        group.push(
          label(center.add(new Complex(junctionRadius * 1.3, junctionRadius * 1.3)), v.name, "#666", px, 10),
        );
    }
    if (labels)
      for (const e of fs.graph.edges) {
        const line = lines.get(e)?.reduce((a, b) => (b.length > a.length ? b : a), []) ?? [];
        const mid = line[Math.floor(line.length / 2)];
        if (mid) group.push(label(mid, e.name, css(e.color), px, 12, true));
      }
    parts.push(`<g opacity="${opacity}">${group.join("")}</g>`);
  };

  for (const copy of copies) drawSurface((z) => copy.applyKlein(z), COPY_OPACITY);
  if (hyperbolic && model !== "halfplane")
    parts.unshift(
      `<circle cx="${px(Complex.ZERO).split(",")[0]}" cy="${px(Complex.ZERO).split(",")[1]}" r="${fmt(scale)}" fill="none" stroke="#999" stroke-width="1"/>`,
    );
  if (hyperbolic && model === "halfplane")
    parts.unshift(
      `<path d="M${px(new Complex(bounds.minX, 0))}L${px(new Complex(bounds.maxX, 0))}" stroke="#999" stroke-width="1"/>`,
    );
  drawSurface(undefined, 1);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" font-family="Georgia, 'Times New Roman', serif">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>${parts.join("")}</svg>`;
  return { svg, notes };
}

const STRIPED_NOTE = "The striped view needs g to be tight: pull tight (or run the algorithm) first.";

/** The polyline of the strip end x, and whether x is its start (otherwise its end is at x's junction). */
function endAt(lines: Map<Edge, Complex[][]>, x: OrientedEdge): { line: Complex[]; atStart: boolean } {
  const pieces = lines.get(x.edge) as Complex[][];
  return x.isForward
    ? { line: pieces[0] as Complex[], atStart: true }
    : { line: pieces[pieces.length - 1] as Complex[], atStart: false };
}

function decoration(
  d: Decoration,
  toDisplay: (z: Complex) => Complex,
  px: (z: Complex) => string,
  scale: number,
  labels: boolean,
): string {
  const line = (points: readonly Complex[]) => `M${points.map((z) => px(toDisplay(z))).join("L")}`;
  switch (d.kind) {
    case "polygon":
      return `<path d="${line(densify([...d.vertices, d.vertices[0] as Complex], 0.02))}" fill="#f7f7f4" stroke="none"/>`;
    case "side": {
      const mid = d.from.add(d.to).scale(0.5);
      const along = d.to.sub(d.from);
      const outward = new Complex(along.im, -along.re).scale(0.06 / (along.abs() || 1)); // the polygon is counterclockwise
      const text = labels ? label(toDisplay(mid.add(outward)), d.label, css(d.color), px, 13, true) : "";
      return `<path d="${line(densify([d.from, d.to], 0.02))}" stroke="${css(d.color)}" stroke-width="1.5" fill="none"/>${text}`;
    }
    case "puncture": {
      const [x, y] = px(toDisplay(d.at)).split(",");
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="#222"/>`;
    }
    case "disk": {
      const [x, y] = px(toDisplay(d.center)).split(",");
      return `<circle cx="${x}" cy="${y}" r="${fmt(d.radius * scale)}" fill="#f0f0ec" stroke="#bbb" stroke-width="0.8"/>`;
    }
    case "band":
      return `<path d="${line(d.centerline)}" stroke="${css(d.color)}" stroke-opacity="0.12" stroke-width="${fmt(2 * d.halfWidth * scale)}" fill="none" stroke-linejoin="round"/>`;
    case "stub": {
      const text = labels
        ? label(toDisplay(d.to.add(d.to.sub(d.from).scale(0.25))), d.label, css(d.color), px, 11, true)
        : "";
      return `<path d="${line([d.from, d.to])}" stroke="${css(d.color)}" stroke-opacity="0.15" stroke-width="${fmt(2 * d.halfWidth * scale)}" fill="none"/>${text}`;
    }
  }
}

function label(
  at: Complex,
  text: string,
  color: string,
  px: (z: Complex) => string,
  fontSize: number,
  italic = false,
): string {
  const [x, y] = px(at).split(",");
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle"${italic ? ' font-style="italic"' : ""}>${escape(text)}</text>`;
}

// ─── Geometry helpers ───────────────────────────────────────────────────────────────────────

/** Splits the segments of a polyline so that no piece is longer than `step`. */
function densify(line: readonly Complex[], step: number): Complex[] {
  const result: Complex[] = [];
  line.forEach((p, i) => {
    if (i === 0) return void result.push(p);
    const q = line[i - 1] as Complex;
    const n = Math.max(1, Math.ceil(p.sub(q).abs() / step));
    for (let k = 1; k <= n; k++) result.push(q.add(p.sub(q).scale(k / n)));
  });
  return result;
}

/** Smooths a polyline in chart coordinates. */
function smooth_(line: readonly Complex[], smoothing: Smoothing): Complex[] {
  if (smoothing === "none" || line.length < 3) return [...line];
  if (smoothing === "rounded") {
    const result: Complex[] = [line[0] as Complex];
    for (let i = 1; i < line.length - 1; i++) {
      const [a, b, c] = [line[i - 1] as Complex, line[i] as Complex, line[i + 1] as Complex];
      const [p, q] = [b.add(a.sub(b).scale(0.3)), b.add(c.sub(b).scale(0.3))];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        result.push(
          p
            .scale((1 - t) ** 2)
            .add(b.scale(2 * t * (1 - t)))
            .add(q.scale(t * t)),
        );
      }
    }
    result.push(line.at(-1) as Complex);
    return result;
  }
  // Catmull–Rom through the points.
  const result: Complex[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const p0 = line[Math.max(0, i - 1)] as Complex;
    const [p1, p2] = [line[i] as Complex, line[i + 1] as Complex];
    const p3 = line[Math.min(line.length - 1, i + 2)] as Complex;
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      result.push(
        p1
          .scale(2)
          .add(p2.sub(p0).scale(t))
          .add(p0.scale(2).sub(p1.scale(5)).add(p2.scale(4)).sub(p3).scale(t2))
          .add(p1.scale(3).sub(p0).sub(p2.scale(3)).add(p3).scale(t3))
          .scale(0.5),
      );
    }
  }
  result.push(line.at(-1) as Complex);
  return result;
}

/** The region of the display to show. */
function displayBounds(
  chart: Chart,
  toDisplay: (z: Complex) => Complex,
  model: HyperbolicModel | undefined,
): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  if (model === "poincare" || model === "klein") return box(-1.08, 1.08, -1.08, 1.08);
  const points: Complex[] = [];
  for (const d of chart.decorations) {
    if (d.kind === "polygon") points.push(...d.vertices);
    if (d.kind === "puncture") points.push(d.at);
    if (d.kind === "disk")
      points.push(
        d.center.add(new Complex(d.radius, d.radius)),
        d.center.sub(new Complex(d.radius, d.radius)),
      );
    if (d.kind === "band")
      points.push(
        ...d.centerline.map((p) => p.add(new Complex(d.halfWidth, d.halfWidth))),
        ...d.centerline.map((p) => p.sub(new Complex(d.halfWidth, d.halfWidth))),
      );
    if (d.kind === "stub") points.push(d.to.add(d.to.sub(d.from).scale(0.5)));
  }
  const shown = points
    .map(toDisplay)
    .filter((z) => Number.isFinite(z.re) && Number.isFinite(z.im) && z.abs() < 20);
  if (model === "halfplane") return box(-4, 4, -0.2, 7.8);
  const xs = shown.map((z) => z.re);
  const ys = shown.map((z) => z.im);
  const margin = 0.12 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.5);
  const [cx, cy] = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + margin;
  return box(cx - half, cx + half, cy - half, cy + half);
}

function box(minX: number, maxX: number, minY: number, maxY: number) {
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function averagePortPixels(chart: Chart, toDisplay: (z: Complex) => Complex): number {
  const lengths = [...chart.ports.values()].map((p) => toDisplay(p.left).sub(toDisplay(p.right)).abs());
  return lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
}

/** The deck transformations up to `depth` generators (hyperbolic: isometries; flat: translations), without the identity. */
function deckCopies(
  chart: Chart,
  depth: number,
  toDisplay: (z: Complex) => Complex,
): { applyKlein: (z: Complex) => Complex }[] {
  const deck = chart.deck;
  if (deck === undefined || depth <= 0) return [];
  if (deck.kind === "translation") {
    const seen = new Set(["0,0"]);
    let frontier = [Complex.ZERO];
    const result: Complex[] = [];
    for (let d = 0; d < depth; d++) {
      const next: Complex[] = [];
      for (const t of frontier)
        for (const v of deck.generators.values()) {
          const u = t.add(v);
          const key = `${u.re.toFixed(6)},${u.im.toFixed(6)}`;
          if (!seen.has(key)) {
            seen.add(key);
            next.push(u);
            result.push(u);
          }
        }
      frontier = next;
    }
    return result.map((u) => ({ applyKlein: (z: Complex) => z.add(u) }));
  }
  const seen = new Set<string>(["0.000000,0.000000"]);
  let frontier: DiskIsometry[] = [DiskIsometry.IDENTITY];
  const result: DiskIsometry[] = [];
  for (let d = 0; d < depth && result.length < 300; d++) {
    const next: DiskIsometry[] = [];
    for (const t of frontier)
      for (const generator of deck.generators.values()) {
        const u = t.after(generator);
        const c = u.applyKlein(Complex.ZERO);
        const key = `${c.re.toFixed(6)},${c.im.toFixed(6)}`;
        if (seen.has(key) || toDisplay(c).abs() > 0.995) continue;
        seen.add(key);
        next.push(u);
        result.push(u);
      }
    frontier = next;
  }
  return result;
}

function css(color: Color): string {
  const channel = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return `rgb(${channel(color.r)},${channel(color.g)},${channel(color.b)})`;
}

function fmt(x: number): string {
  return Number.isFinite(x) ? x.toFixed(2) : "0";
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A small triangle pointing along the polyline at the middle of its length (undefined if it is too short). */
function arrowAt(line: readonly Complex[], size: number): Complex[] | undefined {
  const lengths = line.map((p, i) => (i === 0 ? 0 : p.sub(line[i - 1] as Complex).abs()));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total < size * 4) return undefined;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const segment = lengths[i] as number;
    if (walked + segment >= total / 2 && segment > 0) {
      const [a, b] = [line[i - 1] as Complex, line[i] as Complex];
      const direction = b.sub(a).scale(1 / segment);
      const tip = a.add(direction.scale(total / 2 - walked + size / 2));
      const back = tip.sub(direction.scale(size));
      const side = new Complex(-direction.im, direction.re).scale(size * 0.55);
      return [tip, back.add(side), back.sub(side)];
    }
    walked += segment;
  }
  return undefined;
}

/** A strip end at a junction, as it leaves its switch (display) and its lane (chart). */
interface StripEnd {
  readonly x: OrientedEdge;
  readonly center: Complex;
  readonly junctionRadius: number;
  readonly switchPoint: Complex;
  readonly radialStart: Complex;
  readonly radialEnd: Complex;
  /** The direction of the lane (unit, chart). */
  readonly out: Complex;
  /** The radius of the turning circle for a small turn, and its cap (from the nearest junction). */
  readonly nominal: number;
  readonly cap: number;
}

/**
 * The circular arc from the end of the lane, tangent to it, that turns towards `target` until its direction points
 * at the target (the tangent point), in chart coordinates. Strands that turn further use smaller circles, so that the
 * arcs of a gate are nested. Undefined if the target is too close to turn towards it.
 */
function arcTowards(end: StripEnd, target: Complex): { arc: Complex[]; tangent: Complex } | undefined {
  const start = end.radialEnd;
  const toTarget = target.sub(start);
  const distance = toTarget.abs();
  if (distance < 1e-9) return undefined;
  const cross = end.out.re * toTarget.im - end.out.im * toTarget.re;
  const dot = end.out.re * toTarget.re + end.out.im * toTarget.im;
  const turn = Math.atan2(cross, dot); // how far the strand has to turn, signed (left positive)
  if (Math.abs(turn) < 1e-3) return { arc: [], tangent: start };
  const left = turn > 0;
  const rho = Math.min(end.nominal * (1.6 - (0.9 * Math.abs(turn)) / Math.PI), end.cap, distance * 0.4);
  if (rho <= 0) return undefined;
  const normal = left ? new Complex(-end.out.im, end.out.re) : new Complex(end.out.im, -end.out.re);
  const c = start.add(normal.scale(rho));
  const d = target.sub(c).abs();
  if (d <= rho * 1.001) return undefined;
  const beta = target.sub(c).arg();
  const alpha = Math.acos(rho / d);
  const thetaEnd = left ? beta - alpha : beta + alpha;
  const theta0 = start.sub(c).arg();
  const full = 2 * Math.PI;
  const sweep = left
    ? (((thetaEnd - theta0) % full) + full) % full
    : -((((theta0 - thetaEnd) % full) + full) % full);
  const n = Math.max(4, Math.ceil(Math.abs(sweep) / 0.08));
  const arc = Array.from({ length: n }, (_, i) =>
    c.add(Complex.fromPolar(rho, theta0 + (sweep * (i + 1)) / n)),
  );
  return { arc, tangent: arc.at(-1) as Complex };
}

/** The distance from p to the segment ab. */
function distanceToSegment(p: Complex, a: Complex, b: Complex): number {
  const ab = b.sub(a);
  const length2 = ab.abs2();
  const t =
    length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.re - a.re) * ab.re + (p.im - a.im) * ab.im) / length2));
  return p.sub(a.add(ab.scale(t))).abs();
}
