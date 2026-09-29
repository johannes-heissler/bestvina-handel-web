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
import type { Port } from "../embedding/chart";
import type { Motion } from "../fibred/narration";
import type { Complex } from "../math/complex";
import type { Edge, Vertex } from "../graph/ribbon-graph";
import type { FibredSurface } from "../fibred/fibred-surface";
import { type Rendered, renderSvg, type RenderOptions } from "../render/svg";

const charts = new WeakMap<RibbonGraph, Map<SurfaceModel, Chart>>();

/** The chart of a model on the spine of a surface, computed once per spine. */
export function chartFor(model: SurfaceModel, surface: FibredSurface): Chart {
  let byModel = charts.get(surface.spine0);
  if (byModel === undefined) charts.set(surface.spine0, (byModel = new Map()));
  let chart = byModel.get(model);
  if (chart === undefined)
    byModel.set(model, (chart = chartOf(model, {}, spineOfGraph(model, surface.spine0))));
  return chart;
}

export interface DrawOptions extends RenderOptions {
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
 * The SVG of a moment between two consecutive states of a move (0 ≤ t ≤ 1), for its timeline:
 *
 * - a junction crossing a side (`motion`): until t = ½ it slides in the layout of `from` to the port of the side it
 *   crosses; from t = ½ on it comes from the partner port on the other side to its place in the layout of `to`
 *   (μ changes at t = ½);
 * - the same strips with the same μ (e.g. a new Tutte layout): every point of the layout is interpolated;
 * - otherwise (a subdivision, a fold, …): `from` until t = ½, then `to`.
 */
export function drawBetween(
  model: SurfaceModel,
  from: FibredSurface,
  to: FibredSurface,
  t: number,
  motion: Motion | undefined,
  options: DrawOptions = {},
): Rendered {
  try {
    const chart = chartFor(model, from);
    const layoutOf = (surface: FibredSurface) => layoutFor(model, surface, chart, options);
    const [a, b] = [layoutOf(from), layoutOf(to)];
    if (motion !== undefined) {
      const early = t < 0.5;
      const [surface, base] = early ? [from, a] : [to, b];
      const port = [...chart.ports.entries()].find(([x]) => x.name === motion.side);
      const v = surface.graph.vertices.find((u) => u.name === motion.junction);
      if (port !== undefined && v !== undefined) {
        const [side, leaving] = port;
        const entering = chart.ports.get(side.reversed) ?? leaving;
        const middle = (p: Port) => p.left.add(p.right).scale(0.5);
        const at = base.junctions.get(v) as Complex;
        const position = early
          ? at.add(
              middle(leaving)
                .sub(at)
                .scale(2 * t),
            )
          : middle(entering).add(at.sub(middle(entering)).scale(2 * t - 1));
        return renderSvg(surface, withJunctionAt(surface, base, v, position), options);
      }
    }
    const blended = interpolated(from, to, a, b, t);
    if (blended !== undefined) return renderSvg(to, blended, options);
    return t < 0.5 ? renderSvg(from, a, options) : renderSvg(to, b, options);
  } catch (e) {
    return {
      svg: "",
      echo: () => [],
      notes: [`This state can't be drawn: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

/** The layout of a surface, cached (see {@link draw}). */
function layoutFor(model: SurfaceModel, surface: FibredSurface, chart: Chart, options: DrawOptions): Layout {
  const layoutOptions: LayoutOptions = {
    widthExponent: options.widthExponent ?? 0,
    smoothing: options.straightening ?? 0,
  };
  return layouts.get(surface, JSON.stringify([modelId(model), layoutOptions]), () =>
    layout(surface, chart, layoutOptions),
  );
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
    const chart = chartFor(model, surface);
    const layoutOptions: LayoutOptions = {
      widthExponent: options.widthExponent ?? 0,
      smoothing: options.straightening ?? 0,
    };
    const id = modelId(model);
    return renders.get(surface, JSON.stringify([id, options]), () =>
      renderSvg(
        surface,
        layouts.get(surface, JSON.stringify([id, layoutOptions]), () =>
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
