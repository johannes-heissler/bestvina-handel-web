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
import { DiskIsometry, fromKlein, type HyperbolicModel, lengthFactor, toKlein } from "../geometry/hyperbolic";
import type { Chart, Decoration } from "../embedding/chart";
import type { Layout } from "../embedding/layout";
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
  /** How the sides of the polygon are drawn (with constant hyperbolic width, like the strips). */
  readonly sideStyle?: SideStyle;
}

export type SideStyle = "solid" | "dashed" | "dotted";

export interface Rendered {
  readonly svg: string;
  /** Remarks for the user, e.g. why the striped view isn't available. */
  readonly notes: readonly string[];
  /**
   * For a point of the SVG (in its pixel coordinates), the same point of the surface in the polygon and in each drawn
   * copy, with the radius of a dot of constant hyperbolic size there (the C# `Display(Point)`); empty outside.
   */
  readonly echo: (x: number, y: number) => { x: number; y: number; r: number }[];
}

const COPY_OPACITY = 0.35;
/** The dark green of the junctions (the C# `vertexColors[1]`). */
const JUNCTION_COLOR = "#1a693a";

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

  const parts: string[] = [];
  const copies = deckCopies(chart, options.deckDepth ?? 0, toDisplay);

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

  /** How much a deck copy shrinks the display near the chart point z (1 for the polygon itself). */
  const localScale = (z: Complex, transform: ((z: Complex) => Complex) | undefined) => {
    if (transform === undefined) return 1;
    const delta = new Complex(1e-4, 0);
    const before = toDisplay(z.add(delta)).sub(toDisplay(z)).abs();
    return before === 0
      ? 1
      : toDisplay(transform(z.add(delta)))
          .sub(toDisplay(transform(z)))
          .abs() / before;
  };
  /** The radius of a junction's disk in the display: fixed, but at most 0.3 of the distance to the nearest junction. */
  const radiusOf = (v: Vertex, transform?: (z: Complex) => Complex) => {
    const p = layout.junctions.get(v) as Complex;
    const toScreen = (z: Complex) => toDisplay(transform ? transform(z) : z);
    const d = nearest.get(v) as number;
    const nearestOnScreen = Number.isFinite(d)
      ? toScreen(p.add(new Complex(d, 0)))
          .sub(toScreen(p))
          .abs()
      : Infinity;
    return Math.min(junctionRadius * localScale(p, transform), nearestOnScreen * 0.3);
  };

  // Strip widths, constant in the hyperbolic metric for hyperbolic charts (so the strips get thinner towards the
  // boundary, and in the copies): thin and uniform, or to scale with their share of the ports, measured in pixels at
  // the centre of the model. To scale, all are scaled down so that the strands of each gate together are no wider than
  // the disk of its junction.
  const metric = (z: Complex, direction: Complex) => (hyperbolic ? lengthFactor(model, z, direction) : 1);
  const centreMetric = metric(toDisplay(Complex.ZERO), Complex.ONE);
  const portPixels = averagePortPixels(chart, toDisplay) * scale;
  const basePixels = (e: Edge) =>
    options.stripWidth === "toScale"
      ? Math.max(0.8, (layout.relativeWidth.get(e) ?? 0.2) * portPixels * 0.9)
      : 2.2;
  let shrink = 1;
  if (options.stripWidth === "toScale")
    for (const v of fs.graph.vertices) {
      // The strands of a gate leave side by side, so their widths add up (as the widths of a train track do).
      const at = toDisplay(layout.junctions.get(v) as Complex);
      const gateWidths = new Map<Vertex, number>();
      for (const [x, s] of gatesOf(v).switchOf)
        gateWidths.set(
          s,
          (gateWidths.get(s) ?? 0) + ((basePixels(x.edge) / scale) * centreMetric) / metric(at, Complex.ONE),
        );
      for (const width of gateWidths.values()) shrink = Math.min(shrink, (2 * radiusOf(v)) / width);
    }
  /** The width of the strip e in the hyperbolic metric (in display units for flat charts). */
  const trueWidth = (e: Edge) => ((basePixels(e) * shrink) / scale) * centreMetric;
  /** The width of e in display units at the display point z, across the unit direction n (at least 0.4 pixels). */
  const widthAt = (e: Edge, z: Complex, n: Complex) => Math.max(0.4 / scale, trueWidth(e) / metric(z, n));
  /** The region between the offsets from·w and to·w across a display polyline of e (w: the width of e there). */
  const band = (e: Edge, line: readonly Complex[], from: number, to: number): string =>
    bandPath(line, (z, n) => widthAt(e, z, n), from, to);
  /** The same for any width function (display units at a display point, across a unit direction). */
  const bandPath = (
    line: readonly Complex[],
    width: (z: Complex, n: Complex) => number,
    from: number,
    to: number,
  ): string => {
    const left: Complex[] = [];
    const right: Complex[] = [];
    line.forEach((p, i) => {
      const t = (line[Math.min(line.length - 1, i + 1)] as Complex).sub(line[Math.max(0, i - 1)] as Complex);
      const length = t.abs();
      if (length === 0) return;
      const normal = new Complex(-t.im / length, t.re / length);
      const w = width(p, normal);
      left.push(p.add(normal.scale(from * w)));
      right.push(p.add(normal.scale(to * w)));
    });
    return left.length < 2 ? "" : `M${[...left, ...right.toReversed()].map(px).join("L")}Z`;
  };

  // The sides of the polygon: 1.5 pixels wide at the centre, constant in the hyperbolic metric; solid, or dashes and
  // dots whose lengths are constant in the hyperbolic metric as well.
  const sideWidth = (1.5 / scale) * centreMetric;
  const sideWidthAt = (z: Complex, n: Complex) => Math.max(0.3 / scale, sideWidth / metric(z, n));
  /** The hyperbolic length of the display segment from a to b (display units for flat charts). */
  const lengthOf = (a: Complex, b: Complex) => {
    const step = b.sub(a);
    const length = step.abs();
    return length === 0 ? 0 : length * metric(a.add(b).scale(0.5), step.scale(1 / length));
  };
  const side = (line: readonly Complex[], color: string): string => {
    const style = options.sideStyle ?? "solid";
    const solid = (piece: readonly Complex[]) =>
      `<path d="${bandPath(piece, sideWidthAt, -0.5, 0.5)}" fill="${color}"/>`;
    if (style === "solid") return solid(line);
    const [on, off] = style === "dashed" ? [7 * sideWidth, 4 * sideWidth] : [0, 3.5 * sideWidth];
    // Towards an ideal vertex (and in the copies) the sides get arbitrarily long and thin; where they are thinner than
    // 0.6 pixels, dashes can't be seen (and there would be many of them), so they are drawn solid there.
    const visible = (p: Complex) => sideWidthAt(p, Complex.ONE) * scale >= 0.6;
    const runs: { visible: boolean; points: Complex[] }[] = [];
    for (const p of line) {
      const last = runs.at(-1);
      if (last && last.visible === visible(p)) last.points.push(p);
      else runs.push({ visible: visible(p), points: last ? [last.points.at(-1) as Complex, p] : [p] });
    }
    return runs
      .map((run) => {
        if (!run.visible) return solid(run.points);
        const pieces = dashes(run.points, lengthOf, on, off);
        if (style === "dashed") return pieces.map(solid).join("");
        return pieces
          .map((piece) => {
            const at = piece[0] as Complex;
            const [x, y] = px(at).split(",");
            return `<circle cx="${x}" cy="${y}" r="${fmt(sideWidthAt(at, Complex.ONE) * 0.6 * scale)}" fill="${color}"/>`;
          })
          .join("");
      })
      .join("");
  };

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
        psiInChartOf.set(s, (first + unrolled) / 2);
        lanesOf.set(s, inGate);
      }
      // Gates whose directions are almost equal would look like one gate (their infinitesimal branch vanishes): spread
      // them to a minimal angle, keeping their cyclic order.
      for (const [s, psi] of spreadAngles(psiInChartOf, Math.min(0.6, (1.2 * Math.PI) / psiInChartOf.size)))
        psiInChartOf.set(s, psi);
      for (const [s, psiInChart] of psiInChartOf) {
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
    for (const d of chart.decorations) {
      const toScreen = (z: Complex) => toDisplay(transform ? transform(z) : z);
      if (d.kind === "side") group.push(side(densify([d.from, d.to], 0.01).map(toScreen), css(d.color)));
      group.push(decoration(d, toScreen, px, scale, labels));
    }

    const lines = new Map<Edge, Complex[][]>(fs.graph.edges.map((e) => [e, stripLines(e, transform)]));
    const junctionAt = (v: Vertex) =>
      toDisplay(
        transform ? transform(layout.junctions.get(v) as Complex) : (layout.junctions.get(v) as Complex),
      );
    const switchPoints = attachToSwitches(
      lines,
      junctionAt,
      (v) => radiusOf(v, transform),
      (z) => toDisplay(transform ? transform(z) : z),
    );

    if (view === "striped") {
      let stripes: ReturnType<typeof strandOrder> | undefined;
      try {
        stripes = strandOrder(fs.g);
      } catch {
        if (!notes.includes(STRIPED_NOTE)) notes.push(STRIPED_NOTE);
      }
      // The ribbon is 2.2 times as wide as the strip in the other view; the stripes fill 80% of their share.
      for (const e of fs.graph.edges) {
        for (const line of lines.get(e) ?? [])
          group.push(
            `<path data-edge="${escape(e.name)}" d="${band(e, line, -1.1, 1.1)}" fill="${css(e.color)}" fill-opacity="0.18" stroke="${css(e.color)}" stroke-width="0"/>`,
          );
        const list = stripes?.along.get(e) ?? [];
        list.forEach((s, i) => {
          const [from, to] = [-1.1 + (2.2 * (i + 0.1)) / list.length, -1.1 + (2.2 * (i + 0.9)) / list.length];
          for (const line of lines.get(e) ?? [])
            group.push(`<path d="${band(e, line, from, to)}" fill="${css(s.strand.edge.color)}"/>`);
        });
      }
    } else {
      // A small arrow in the middle of each segment, in the direction of the strip.
      for (const e of fs.graph.edges)
        for (const line of lines.get(e) ?? []) {
          const middle = line[Math.floor(line.length / 2)] as Complex;
          const shrinking = centreMetric / metric(middle, Complex.ONE); // the arrows shrink like the strips
          const arrow = arrowAt(line, (4 / scale) * shrinking + widthAt(e, middle, Complex.ONE));
          if (arrow) group.push(`<path d="M${arrow.map(px).join("L")}Z" fill="${css(e.color)}"/>`);
        }
      for (const e of fs.graph.edges)
        for (const line of lines.get(e) ?? [])
          group.push(
            `<path data-edge="${escape(e.name)}" d="${band(e, line, -0.5, 0.5)}" fill="${css(e.color)}" stroke="${css(e.color)}" stroke-width="0"/>`,
          );
    }

    for (const v of fs.graph.vertices) {
      const center = junctionAt(v);
      const points = switchPoints.get(v) as Map<Vertex, Complex>;
      const transparent = view === "trainTrack";
      const radius = radiusOf(v, transform) * scale;
      if (radius < 0.3) continue;
      // In the copies, the outline, the branches and the switches shrink with the disk.
      const k = localScale(layout.junctions.get(v) as Complex, transform);
      group.push(
        `<circle cx="${px(center).split(",")[0]}" cy="${px(center).split(",")[1]}" r="${fmt(radius)}" fill="${transparent ? "#ffffff" : "#fafafa"}" fill-opacity="${transparent ? 0.35 : 1}" stroke="${JUNCTION_COLOR}" stroke-width="${fmt(k)}"/>`,
      );
      if (transparent)
        for (const [a, b] of gatesOf(v).infinitesimal) {
          const [p, q] = [points.get(a), points.get(b)];
          if (p && q)
            group.push(
              `<path d="M${px(p)}Q${px(center)} ${px(q)}" stroke="#555" stroke-width="${fmt(k)}" fill="none"/>`,
            );
        }
      for (const p of points.values())
        group.push(
          `<circle cx="${px(p).split(",")[0]}" cy="${px(p).split(",")[1]}" r="${fmt(1.6 * k)}" fill="#333"/>`,
        );
      if (labels)
        group.push(
          label(
            center.add(new Complex(junctionRadius * 1.3, junctionRadius * 1.3)),
            v.name,
            JUNCTION_COLOR,
            px,
            11,
            true,
          ),
        );
    }
    if (labels)
      for (const e of fs.graph.edges) {
        const line = lines.get(e)?.reduce((a, b) => (b.length > a.length ? b : a), []) ?? [];
        const i = Math.floor(line.length / 2);
        const mid = line[i];
        if (!mid) continue;
        // Beside the strip (on its left), not on it.
        const t = (line[Math.min(line.length - 1, i + 1)] as Complex).sub(
          line[Math.max(0, i - 1)] as Complex,
        );
        const normal = t.abs() === 0 ? Complex.I : new Complex(-t.im, t.re).scale(1 / t.abs());
        const at = mid.add(normal.scale(widthAt(e, mid, normal) / 2 + 8 / scale));
        group.push(label(at, e.name, css(e.color), px, 12, true));
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
  const polygon = chart.decorations.flatMap((d) => (d.kind === "polygon" ? [d.vertices] : []))[0];
  /** Whether a chart point is in the (convex, counterclockwise) polygon; true if there is none. */
  const inPolygon = (k: Complex) =>
    polygon === undefined ||
    polygon.every((a, i) => {
      const edge = (polygon[(i + 1) % polygon.length] as Complex).sub(a);
      const to = k.sub(a);
      return edge.re * to.im - edge.im * to.re >= -1e-9;
    });
  const identity = { applyKlein: (z: Complex) => z, inverseKlein: (z: Complex) => z };
  const echo = (x: number, y: number) => {
    const z = new Complex(x / scale + bounds.minX, bounds.maxY - y / scale);
    const k = hyperbolic ? toKlein(model, z) : z;
    if (hyperbolic && !(k.abs() < 1)) return [];
    const all = [identity, ...copies];
    const home = all.find((c) => inPolygon(c.inverseKlein(k)));
    if (home === undefined) return [];
    const q = home.inverseKlein(k);
    return all.flatMap((c) => {
      const d = toDisplay(c.applyKlein(q));
      const r = (4 * centreMetric) / metric(d, Complex.ONE); // pixels
      const [sx, sy] = [(d.re - bounds.minX) * scale, (bounds.maxY - d.im) * scale];
      return Number.isFinite(sx) && Number.isFinite(sy) && r > 0.3 ? [{ x: sx, y: sy, r }] : [];
    });
  };
  return { svg, notes, echo };
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
      return text; // the side itself is drawn by `renderSvg`, with its width in the hyperbolic metric
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
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.8" stroke-linejoin="round" paint-order="stroke"${italic ? ' font-style="italic"' : ""}>${escape(text)}</text>`;
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
): { applyKlein: (z: Complex) => Complex; inverseKlein: (z: Complex) => Complex }[] {
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
    return result.map((u) => ({
      applyKlein: (z: Complex) => z.add(u),
      inverseKlein: (z: Complex) => z.sub(u),
    }));
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
  return result.map((u) => {
    const inverse = u.inverse();
    return {
      applyKlein: (z: Complex) => u.applyKlein(z),
      inverseKlein: (z: Complex) => inverse.applyKlein(z),
    };
  });
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

/**
 * Moves the angles apart until consecutive ones (in their cyclic order) are at least `gap` apart, pushing each close
 * pair apart symmetrically. Needs gap · (number of angles) < 2π.
 */
function spreadAngles<K>(angles: ReadonlyMap<K, number>, gap: number): Map<K, number> {
  const full = 2 * Math.PI;
  const sorted = [...angles]
    .map(([k, a]) => [k, ((a % full) + full) % full] as [K, number])
    .sort((p, q) => p[1] - q[1]);
  const n = sorted.length;
  if (n < 2) return new Map(angles);
  const a = sorted.map((p) => p[1]);
  for (let round = 0; round < 200; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const d =
        j === 0 ? (a[0] as number) + full - (a[n - 1] as number) : (a[j] as number) - (a[i] as number);
      if (d < gap - 1e-9) {
        const push = (gap - d) / 2;
        a[i] = (a[i] as number) - push;
        a[j] = (a[j] as number) + push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(sorted.map(([k], i) => [k, a[i] as number]));
}

/**
 * Cuts a polyline into dashes of length `on` separated by gaps of length `off`, both measured with `lengthOf`. With
 * on = 0, each piece is a single dot (its first point is the position).
 */
function dashes(
  line: readonly Complex[],
  lengthOf: (a: Complex, b: Complex) => number,
  on: number,
  off: number,
): Complex[][] {
  const result: Complex[][] = [];
  if (line.length === 0 || off <= 0) return [[...line]];
  let drawing = true;
  let left = on; // what is left of the current dash or gap
  let current: Complex[] = [line[0] as Complex];
  for (let i = 1; i < line.length; i++) {
    let a = line[i - 1] as Complex;
    const b = line[i] as Complex;
    let segment = lengthOf(a, b);
    if (!(segment <= 64 * (on + off))) {
      // Far too long to cut (near an ideal point, where everything is thinner than a pixel): a gap.
      if (drawing && current.length > 1) result.push(current);
      [drawing, left, current] = [false, off, []];
      continue;
    }
    while (segment > 0 && segment >= left) {
      const p = a.add(b.sub(a).scale(left / segment));
      if (drawing) result.push([...current, p]);
      else current = [p];
      segment -= left;
      a = p;
      drawing = !drawing;
      left = drawing ? on : off;
    }
    left -= segment;
    if (drawing) current.push(b);
  }
  if (drawing && current.length > 1) result.push(current);
  return result;
}
