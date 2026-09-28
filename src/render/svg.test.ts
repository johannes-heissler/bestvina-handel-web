import { describe, expect, it } from "vitest";
import { spineOfGraph, type SurfaceModel } from "../examples/models";
import { buildPreset, PRESETS } from "../examples/presets";
import { chartOf } from "../embedding/chart";
import { layout } from "../embedding/layout";
import type { FibredSurface } from "../fibred/fibred-surface";
import { autopilot } from "../fibred/suggestions";
import { renderSvg } from "./svg";

const chartFor = (model: SurfaceModel, fs: FibredSurface) => ({
  chart: chartOf(model, {}, spineOfGraph(model, fs.spine0)),
});

describe("SVG", () => {
  const preset = PRESETS.find((p) => p.name === "Bestvina–Handel example 6.1")!;

  it("draws the views", () => {
    const surface = autopilot(buildPreset(preset)).surface;
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart);
    for (const view of ["trainTrack", "striped"] as const)
      for (const model of ["poincare", "klein", "halfplane"] as const) {
        const { svg, notes } = renderSvg(surface, result, { view, model, deckDepth: 1 });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).not.toContain("NaN");
        expect(notes).toEqual([]);
      }
  });

  it("explains why the striped view needs a tight map", () => {
    const fs = buildPreset(PRESETS.find((p) => p.name === "Point push")!);
    const { chart } = chartFor(pointPushModel(), fs);
    expect(renderSvg(fs, layout(fs, chart), { view: "striped" }).notes).toHaveLength(1);
  });
});

function pointPushModel(): SurfaceModel {
  return PRESETS.find((p) => p.name === "Point push")!.model;
}
