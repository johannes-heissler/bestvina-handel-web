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

/** The SVG of a surface in a model; errors become a note instead of an exception. */
export function draw(model: SurfaceModel, surface: FibredSurface, options: DrawOptions = {}): Rendered {
  try {
    const chart = chartFor(model, surface);
    const layoutOptions: LayoutOptions = {
      widthExponent: options.widthExponent ?? 0,
      smoothing: options.straightening ?? 0,
      toScale: options.stripWidth === "toScale",
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
