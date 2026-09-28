/**
 * Drawing a laid-out fibred surface as SVG (the 2D views; port note 20). Headless: returns a string, so it runs in
 * Node for tests and exports, and the UI puts it into the page.
 *
 * Views (your description of D3):
 * - **standard**: the strips, ending at the switches of their gates on a small opaque disk around each junction (the
 *   train track τ with the junctions closed);
 * - **tau**: the same with transparent disks, showing the infinitesimal branches of τ between the switches;
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

export type ViewKind = "standard" | "tau" | "striped";
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
  const view = options.view ?? "standard";
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

  // Junction disks and the switches of the gates (larger in the τ view, to show the infinitesimal branches).
  const junctionPixels = view === "tau" ? Math.max(10, size / 40) : Math.max(5, size / 110);
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

  /** Moves the ends of the strips at junctions onto the switch points of their gates. */
  const attachToSwitches = (
    lines: Map<Edge, Complex[][]>,
    junctionAt: (v: Vertex) => Complex,
    radiusOf: (v: Vertex) => number,
    switchAt: (x: OrientedEdge) => Complex,
  ): Map<Vertex, Map<Vertex, Complex>> => {
    const switchPoints = new Map<Vertex, Map<Vertex, Complex>>();
    for (const v of fs.graph.vertices) {
      const center = junctionAt(v);
      const junctionRadius = radiusOf(v);
      const { switchOf } = gatesOf(v);
      // Each switch lies on the circle in the direction of its gate's node in the layout.
      const direction = new Map<Vertex, Complex>();
      for (const x of fs.graph.star(v)) {
        const s = switchOf.get(x) as Vertex;
        const d = switchAt(x).sub(center);
        direction.set(s, (direction.get(s) ?? Complex.ZERO).add(d.scale(1 / (d.abs() || 1))));
      }
      const points = new Map<Vertex, Complex>();
      for (const [s, d] of direction) points.set(s, center.add(d.scale(junctionRadius / (d.abs() || 1))));
      switchPoints.set(v, points);
      // The strips of a gate leave their switch side by side, perpendicular to the circle (like the branches of a
      // train track), and only then bend into their paths (the C# AdjustStartVector, done with a Bézier curve).
      const members = new Map<Vertex, { x: OrientedEdge; angle: number }[]>();
      for (const x of fs.graph.star(v)) {
        const s = switchOf.get(x) as Vertex;
        const { line, atStart } = endAt(lines, x);
        const ordered = atStart ? line : line.toReversed();
        const far =
          ordered.find((p) => p.sub(center).abs() > junctionRadius * 2.5) ?? (ordered.at(-1) as Complex);
        const switchAngle = (points.get(s) as Complex).sub(center).arg();
        const angle = normalizeAngle(far.sub(center).arg() - switchAngle);
        members.set(s, [...(members.get(s) ?? []), { x, angle }]);
      }
      for (const [s, list] of members) {
        const switchPoint = points.get(s) as Complex;
        const out = switchPoint.sub(center).scale(1 / (switchPoint.sub(center).abs() || 1));
        const left = new Complex(-out.im, out.re);
        const gap = Math.min(junctionRadius * 0.35, junctionRadius / Math.max(1, list.length)); // the gate is at most ~R wide
        const length = junctionRadius * 0.9;
        list.sort((a, b) => a.angle - b.angle); // counterclockwise = from right to left, looking outwards
        list.forEach(({ x, angle }, j) => {
          const shift = left.scale((j - (list.length - 1) / 2) * gap);
          const radialStart = switchPoint.add(out.scale(junctionRadius * 0.2)).add(shift);
          const radialEnd = switchPoint.add(out.scale(length)).add(shift);
          const { line, atStart } = endAt(lines, x);
          const path = atStart ? [...line] : line.toReversed();
          // At least ~30 px, and longer for strands that turn far away from the direction of their gate.
          const bendLength =
            Math.max(length * 1.4, (30 * junctionRadius) / junctionPixels) *
            (1 + (2 * Math.abs(angle)) / Math.PI);
          // Bend towards the first point beyond the bend length (or, on a short piece, towards its end).
          const found = path.findIndex((p) => p.sub(center).abs() > junctionRadius + bendLength);
          const q = found === -1 ? path.length - 1 : found;
          let result: Complex[];
          if (q <= 0 || (path[q] as Complex).sub(center).abs() < junctionRadius + length) {
            // Too short to bend: drop the points inside the disk and start at the switch.
            const rest = path.filter((p) => p.sub(center).abs() >= junctionRadius);
            result = [switchPoint, ...(rest.length > 0 ? rest : [path.at(-1) as Complex])];
          } else {
            const target = path[q] as Complex;
            const after = (path[q + 1] ?? target).sub(target);
            const tangent =
              after.abs() > 0
                ? after.scale(1 / after.abs())
                : target.sub(radialEnd).scale(1 / (target.sub(radialEnd).abs() || 1));
            const h = target.sub(radialEnd).abs() * 0.5;
            const [c1, c2] = [radialEnd.add(out.scale(h)), target.sub(tangent.scale(h))];
            const bend = Array.from({ length: 12 }, (_, i) => cubic(radialEnd, c1, c2, target, (i + 1) / 12));
            result = [switchPoint, radialStart, radialEnd, ...bend, ...path.slice(q + 1)];
          }
          line.splice(0, line.length, ...(atStart ? result : result.toReversed()));
        });
      }
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
    const switchPoints = attachToSwitches(
      lines,
      junctionAt,
      (v) => junctionRadius * localScale(layout.junctions.get(v) as Complex),
      (x) =>
        toDisplay(
          transform ? transform(layout.switches.get(x) as Complex) : (layout.switches.get(x) as Complex),
        ),
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
      for (const e of fs.graph.edges)
        for (const line of lines.get(e) ?? [])
          group.push(
            `<path data-edge="${escape(e.name)}" d="${path(line)}" stroke="${css(e.color)}" stroke-width="${fmt(strokeWidth(e))}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
          );
    }

    for (const v of fs.graph.vertices) {
      const center = junctionAt(v);
      const points = switchPoints.get(v) as Map<Vertex, Complex>;
      const transparent = view === "tau";
      const radius = junctionRadius * scale * localScale(layout.junctions.get(v) as Complex);
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

/** The angle in (−π, π]. */
function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a <= -Math.PI) a += 2 * Math.PI;
  if (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** A point on the cubic Bézier curve with control points p0, p1, p2, p3. */
function cubic(p0: Complex, p1: Complex, p2: Complex, p3: Complex, t: number): Complex {
  const s = 1 - t;
  return p0
    .scale(s * s * s)
    .add(p1.scale(3 * s * s * t))
    .add(p2.scale(3 * s * t * t))
    .add(p3.scale(t * t * t));
}
