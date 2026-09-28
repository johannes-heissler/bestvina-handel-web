/**
 * Drawing a history node: the chart of its model (cached per spine), the layout and the SVG.
 *
 * @module
 */
import type { RibbonGraph } from "../graph/ribbon-graph";
import { spineOfGraph, type SurfaceModel } from "../examples/models";
import { type Chart, chartOf } from "../embedding/chart";
import { layout } from "../embedding/layout";
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
}

/** The SVG of a surface in a model; errors become a note instead of an exception. */
export function draw(model: SurfaceModel, surface: FibredSurface, options: DrawOptions = {}): Rendered {
  try {
    const chart = chartFor(model, surface);
    return renderSvg(surface, layout(surface, chart, { widthExponent: options.widthExponent ?? 0 }), options);
  } catch (e) {
    return {
      svg: "",
      echo: () => [],
      notes: [`This state can't be drawn: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}
