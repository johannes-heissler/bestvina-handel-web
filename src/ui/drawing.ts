/**
 * Drawing a history node: the chart of its model (cached per spine), the layout and the SVG (both cached per surface
 * and options, so that going back and forth in the history or switching an option back redraws nothing).
 *
 * The surfaces of the history are never changed in place (every move is applied to a copy), so they can be keys.
 *
 * @module
 */
import type { RibbonGraph } from "../graph/ribbon-graph";
import { spineOfGraph, type SurfaceModel } from "../examples/models";
import { type Chart, chartOf } from "../embedding/chart";
import { type Layout, layout, type LayoutOptions } from "../embedding/layout";
import type { Motion } from "../fibred/narration";
import { Complex } from "../math/complex";
import type { Edge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "../fibred/fibred-surface";
import { type Rendered, renderSvg, type RenderOptions } from "../render/svg";

const charts = new WeakMap<RibbonGraph, Map<string, Chart>>();

/** The chart of a model on the spine of a surface, computed once per spine (and part of the sides used). */
export function chartFor(model: SurfaceModel, surface: FibredSurface, sideFraction?: number): Chart {
  let byModel = charts.get(surface.spine0);
  if (byModel === undefined) charts.set(surface.spine0, (byModel = new Map()));
  const key = `${modelId(model)}|${sideFraction ?? ""}`;
  let chart = byModel.get(key);
  if (chart === undefined)
    byModel.set(
      key,
      (chart = chartOf(model, {}, spineOfGraph(model, surface.spine0), {
        ...(sideFraction !== undefined && { sideFraction }),
      })),
    );
  return chart;
}

export interface DrawOptions extends RenderOptions {
  /** The part of each polygon side that the strands may cross (see `ChartOptions.sideFraction`). */
  readonly sideFraction?: number;
  readonly widthExponent?: number;
  /** Rounds of straightening the strips through the glued sides (layout step 2′). */
  readonly straightening?: number;
}

/** A few recent results per surface and key (the oldest is dropped beyond `limit`). */
class PerSurface<T> {
  private readonly entries = new WeakMap<FibredSurface, Map<string, T>>();
  constructor(private readonly limit: number) {}
  get(surface: FibredSurface, key: string, compute: () => T): T {
    let byKey = this.entries.get(surface);
    if (byKey === undefined) this.entries.set(surface, (byKey = new Map()));
    const cached = byKey.get(key);
    if (cached !== undefined) return cached;
    const value = compute();
    byKey.set(key, value);
    if (byKey.size > this.limit) byKey.delete(byKey.keys().next().value as string);
    return value;
  }
}
const layouts = new PerSurface<Layout>(6);
const renders = new PerSurface<Rendered>(12);

/** A key for a model object (models are compared by identity, like the charts). */
const modelIds = new WeakMap<SurfaceModel, number>();
let nextModelId = 0;
const modelId = (model: SurfaceModel) => {
  if (!modelIds.has(model)) modelIds.set(model, nextModelId++);
  return modelIds.get(model) as number;
};

/**
 * The SVG of a moment of the timeline of a move: `states` are the surfaces before and after each step, `motions` the
 * junction crossing a side in each step (if any), and 0 ≤ `position` ≤ number of steps.
 *
 * - At a whole number, the state there (or, if it can't be laid out, the nearest earlier one that can).
 * - During an isotopy (consecutive steps moving the same junction across sides), the junction travels: from its place
 *   to the port of the side it leaves through, from the partner port on the other side on to the next port, and so on,
 *   to its place after the isotopy. Each moment is drawn with the state of that moment if it can be laid out
 *   (intermediate states of an isotopy need not be: strips can run parallel with the same μ), else with the state
 *   before the isotopy, with the junction moved.
 * - Between two states with the same strips and μ (e.g. a new Tutte layout), everything is interpolated; between
 *   other states (a subdivision, a fold, …) the earlier one is shown until halfway.
 */
export function drawTimeline(
  model: SurfaceModel,
  states: readonly FibredSurface[],
  motions: readonly (Motion | undefined)[],
  position: number,
  options: DrawOptions = {},
): Rendered {
  try {
    const chart = chartFor(model, states[0] as FibredSurface, options.sideFraction);
    const layoutOf = (surface: FibredSurface) => layoutFor(model, surface, chart, options);
    /** The latest state at or before index i that can be laid out. */
    const drawableAt = (i: number): number => {
      for (let j = Math.min(i, states.length - 1); j > 0; j--)
        if (layoutOf(states[j] as FibredSurface)) return j;
      return 0;
    };
    let k = Math.min(Math.floor(position), states.length - 1);
    let t = position - k;
    const plain = (i: number) => {
      const j = drawableAt(i);
      const surface = states[j] as FibredSurface;
      return renderSvg(surface, layoutOf(surface) as Layout, options);
    };
    // Right after a crossing, the junction is where the crossing left it (on its journey), not at its place in the layout.
    if (t < 1e-6 && k > 0 && motions[k - 1] !== undefined) [k, t] = [k - 1, 1];
    else if (t < 1e-6 || k >= states.length - 1) return plain(k);

    const motion = motions[k];
    if (motion !== undefined) {
      // The isotopy: the steps i..j moving the same junction.
      let [i, j] = [k, k];
      while (i > 0 && motions[i - 1]?.junction === motion.junction) i--;
      while (j < motions.length - 1 && motions[j + 1]?.junction === motion.junction) j++;
      const port = (name: string, leaving: boolean) => {
        const entry = [...chart.ports.entries()].find(([x]) => x.name === name);
        if (entry === undefined) return undefined;
        const p = leaving ? entry[1] : (chart.ports.get(entry[0].reversed) ?? entry[1]);
        return p.left.add(p.right).scale(0.5);
      };
      const place = (index: number): Complex | undefined => {
        const surface = states[index] as FibredSurface;
        const l = layoutOf(surface);
        const v = surface.graph.vertices.find((u) => u.name === motion.junction);
        return l && v ? l.junctions.get(v) : undefined;
      };
      const leave = port(motion.side, true);
      const enter = port(motion.side, false);
      // Alongside the strip it is folded with, if known and drawable.
      const early = t < 0.5;
      const index = early ? k : k + 1;
      const own = layoutOf(states[index] as FibredSurface);
      const surface = (own ? states[index] : states[drawableAt(i)]) as FibredSurface;
      const base = own ?? (layoutOf(surface) as Layout);
      const v = surface.graph.vertices.find((u) => u.name === motion.junction);
      const alongside =
        motion.along === undefined || v === undefined
          ? undefined
          : journey(
              surface,
              base,
              motion.along,
              v,
              states[i] as FibredSurface,
              layoutOf(states[i] as FibredSurface),
            );
      if (alongside !== undefined && v !== undefined) {
        // Step m of the isotopy: the first half runs to the exit of piece m, the second from the entry of piece m + 1.
        const m = k - i;
        const last = j - i;
        const f = m + t; // along the journey, measured in steps
        return renderSvg(
          surface,
          withJunctionAt(surface, base, v, alongside(f / (last + 1), m, last)),
          options,
        );
      }
      if (leave && enter) {
        // Start and end of this step: the junction's place (before the isotopy, or after it), else between the ports.
        const nextLeave = k < j ? port((motions[k + 1] as Motion).side, true) : undefined;
        const previousEnter = k > i ? port((motions[k - 1] as Motion).side, false) : undefined;
        const between = (p: Complex, q: Complex) => p.add(q).scale(0.5).scale(0.7); // pulled towards the centre
        const start = k === i ? place(i) : previousEnter && between(previousEnter, leave);
        const end = k === j ? place(j + 1) : nextLeave && between(enter, nextLeave);
        const position2 = early
          ? (start ?? leave).add(leave.sub(start ?? leave).scale(2 * t))
          : enter.add((end ?? enter).sub(enter).scale(2 * t - 1));
        // Draw with the state of this moment if possible, else with the state before the isotopy.
        if (v !== undefined) return renderSvg(surface, withJunctionAt(surface, base, v, position2), options);
      }
    }
    const [from, to] = [states[k] as FibredSurface, states[k + 1] as FibredSurface];
    const [a, b] = [layoutOf(from), layoutOf(to)];
    if (a && b) {
      const blended = interpolated(from, to, a, b, t);
      if (blended !== undefined) return renderSvg(to, blended, options);
    }
    // (At a whole position, a state that can't be laid out after a crossing keeps the junction where it was left.)
    return drawTimeline(model, states, motions, t < 0.5 ? k : k + 1, options);
  } catch (e) {
    return {
      svg: "",
      echo: () => [],
      notes: [`This state can't be drawn: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

/** The layout of a surface (cached, see {@link draw}), or undefined if it can't be laid out (cached as well). */
function layoutFor(
  model: SurfaceModel,
  surface: FibredSurface,
  chart: Chart,
  options: DrawOptions,
): Layout | undefined {
  const layoutOptions: LayoutOptions = {
    widthExponent: options.widthExponent ?? 0,
    smoothing: options.straightening ?? 0,
  };
  const result = attempts.get(
    surface,
    JSON.stringify([modelId(model), options.sideFraction, layoutOptions]),
    () => {
      try {
        return { layout: layout(surface, chart, layoutOptions) };
      } catch {
        return {};
      }
    },
  );
  return result.layout;
}
const attempts = new PerSurface<{ layout?: Layout }>(6);

/**
 * The journey of a junction moving alongside the strip end `along` (by name) of `surface`: returns, for a fraction
 * 0 ≤ f ≤ 1 of the whole isotopy (steps 0 … last), the point on a track parallel to that strip, on the side of the
 * moving junction's own strip, through the strip's pieces: first from the junction's place before the isotopy onto
 * the track, then along piece m in step m (its second half after the side crossing), ending next to the strip's end.
 * Undefined if the strip isn't found.
 */
function journey(
  surface: FibredSurface,
  base: Layout,
  along: string,
  v: Vertex,
  start: FibredSurface,
  startLayout: Layout | undefined,
): ((f: number, m: number, last: number) => Complex) | undefined {
  const partner = surface.graph.orientedEdges.find((x) => x.name === along);
  if (partner === undefined) return undefined;
  const raw = base.strips.get(partner.edge);
  if (raw === undefined) return undefined;
  const pieces = partner.isForward ? raw.map((p) => [...p]) : raw.toReversed().map((p) => p.toReversed());
  // The side: the moving junction's strip at the partner's junction is next to the partner in the cyclic order.
  const w = partner.source;
  const star = surface.graph.star(w);
  const i = star.indexOf(partner);
  const next = star[(i + 1) % star.length];
  const onLeft =
    next !== undefined &&
    (next.target === v || next.source === v || next.edge.source === v || next.edge.target === v);
  const width = 0.025 * (onLeft ? 1 : -1);
  const offsetLine = (line: readonly Complex[]) =>
    line.map((p, k) => {
      const a = line[Math.max(0, k - 1)] as Complex;
      const b = line[Math.min(line.length - 1, k + 1)] as Complex;
      const d = b.sub(a);
      const length = d.abs() || 1;
      return p.add(new Complex(-d.im / length, d.re / length).scale(width));
    });
  const tracks = pieces.map(offsetLine);
  // Where the junction starts: its place before the isotopy.
  const u = start.graph.vertices.find((x) => x.name === v.name);
  const from = (u && startLayout?.junctions.get(u)) ?? (tracks[0]?.[0] as Complex);
  return (f, m, last) => {
    const steps = last + 1;
    const position = Math.min(steps, Math.max(0, f * steps)); // in steps
    const step = Math.min(last, Math.floor(position));
    const t = position - step;
    const track = (n: number) => tracks[Math.min(n, tracks.length - 1)] as Complex[];
    if (t < 0.5) {
      // The first half of step `step`: along piece `step` from its middle (from the start: from the junction's place,
      // onto the track) to its end.
      const line = step === 0 ? [from, ...track(0)] : track(step).slice(Math.floor(track(step).length / 2));
      return pointAlong(line, 2 * t);
    }
    // The second half: along piece `step + 1` from its start to its middle (at the last step: to its end).
    const line = track(step + 1);
    const part = step === last ? line : line.slice(0, Math.ceil(line.length / 2));
    void m;
    return pointAlong(part, 2 * t - 1);
  };
}

/** The point at the fraction f (by length) of a polyline. */
function pointAlong(line: readonly Complex[], f: number): Complex {
  if (line.length === 0) return new Complex(0, 0);
  const lengths = line.slice(1).map((p, i) => p.sub(line[i] as Complex).abs());
  const total = lengths.reduce((a, b) => a + b, 0);
  let rest = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i] as number;
    if (rest <= l && l > 0)
      return (line[i] as Complex).add((line[i + 1] as Complex).sub(line[i] as Complex).scale(rest / l));
    rest -= l;
  }
  return line.at(-1) as Complex;
}

/** The layout with the junction v moved to `position`, and the ends of its strips with it. */
function withJunctionAt(surface: FibredSurface, base: Layout, v: Vertex, position: Complex): Layout {
  const junctions = new Map(base.junctions);
  junctions.set(v, position);
  const strips = new Map(base.strips);
  for (const e of surface.graph.edges) {
    if (e.source !== v && e.target !== v) continue;
    const pieces = (base.strips.get(e) ?? []).map((piece) => [...piece]);
    if (e.source === v && pieces[0]) pieces[0][0] = position;
    const last = pieces.at(-1);
    if (e.target === v && last) last[last.length - 1] = position;
    strips.set(e, pieces);
  }
  return { ...base, junctions, strips };
}

/**
 * The layouts a (of `from`) and b (of `to`) interpolated at t, if both surfaces have the same junctions and strips
 * (by name) and every strip has the same pieces in both; keyed by the objects of `to`.
 */
function interpolated(
  from: FibredSurface,
  to: FibredSurface,
  a: Layout,
  b: Layout,
  t: number,
): Layout | undefined {
  const lerp = (p: Complex, q: Complex) => p.add(q.sub(p).scale(t));
  const junctions = new Map<Vertex, Complex>();
  for (const v of to.graph.vertices) {
    const u = from.graph.vertices.find((w) => w.name === v.name);
    const [p, q] = [u && a.junctions.get(u), b.junctions.get(v)];
    if (!p || !q) return undefined;
    junctions.set(v, lerp(p, q));
  }
  if (from.graph.vertexCount !== to.graph.vertexCount || from.graph.edgeCount !== to.graph.edgeCount)
    return undefined;
  const strips = new Map<Edge, Complex[][]>();
  for (const e of to.graph.edges) {
    const d = from.graph.edges.find((x) => x.name === e.name);
    const [ps, qs] = [d && a.strips.get(d), b.strips.get(e)];
    if (
      !ps ||
      !qs ||
      ps.length !== qs.length ||
      ps.some((piece, i) => piece.length !== (qs[i] as readonly Complex[]).length)
    )
      return undefined;
    strips.set(
      e,
      qs.map((piece, i) => piece.map((q, j) => lerp((ps[i] as readonly Complex[])[j] as Complex, q))),
    );
  }
  return { ...b, junctions, strips };
}

/** The SVG of a surface in a model; errors become a note instead of an exception. */
export function draw(model: SurfaceModel, surface: FibredSurface, options: DrawOptions = {}): Rendered {
  try {
    const chart = chartFor(model, surface, options.sideFraction);
    const layoutOptions: LayoutOptions = {
      widthExponent: options.widthExponent ?? 0,
      smoothing: options.straightening ?? 0,
    };
    const id = modelId(model);
    return renders.get(surface, JSON.stringify([id, options]), () =>
      renderSvg(
        surface,
        layouts.get(surface, JSON.stringify([id, options.sideFraction, layoutOptions]), () =>
          layout(surface, chart, layoutOptions),
        ),
        options,
      ),
    );
  } catch (e) {
    return {
      svg: "",
      echo: () => [],
      notes: [`This state can't be drawn: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}
