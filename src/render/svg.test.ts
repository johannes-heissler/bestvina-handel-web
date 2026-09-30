import { describe, expect, it } from "vitest";
import { spineOfGraph, type SurfaceModel } from "../examples/models";
import { buildPreset, PRESETS } from "../examples/presets";
import { chartOf } from "../embedding/chart";
import { layout } from "../embedding/layout";
import type { FibredSurface } from "../fibred/fibred-surface";
import { autopilot } from "../fibred/suggestions";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { renderSvg } from "./svg";

const chartFor = (model: SurfaceModel, fs: FibredSurface) => ({
  chart: chartOf(model, {}, spineOfGraph(model, fs.spine0)),
});

describe("SVG", () => {
  const preset = PRESETS.find((p) => p.name === "Bestvina–Handel example 6.1")!;

  it("draws a highlighted fold and turn under the strips", () => {
    const surface = buildPreset(preset);
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart);
    const highlight = [
      { ends: ["a", "b"], kind: "fold" as const, fractions: [0.5, 0.5] },
      { ends: ["c", "d"], kind: "turn" as const },
    ];
    for (const view of ["trainTrack", "standard"] as const) {
      const { svg } = renderSvg(surface, result, { view, highlight });
      expect(svg).not.toContain("NaN");
      expect(svg).toContain('fill="#ff8c00"');
      expect(svg).toContain('fill="#00a0a0"');
      // Under the strips: before the first strip band.
      expect(svg.indexOf('fill="#ff8c00"')).toBeLessThan(svg.indexOf("data-edge="));
    }
  });

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

  it("shows the pointer only for points inside the model", () => {
    const surface = buildPreset(preset);
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart);
    for (const model of ["poincare", "klein"] as const) {
      const { echo } = renderSvg(surface, result, { model, size: 800 });
      expect(echo(400, 400).length).toBeGreaterThan(0); // the centre
      // A corner of the picture is outside the disk (the Poincaré point there used to be mirrored into the disk).
      expect(echo(5, 5)).toEqual([]);
    }
  });

  it("names every side of an ideal polygon, the names at one distance from the centre of one size", async () => {
    // The hexagon a b c C B A, whose vertex (−½, −√3/2) is ideal only up to rounding.
    const link =
      "s=jU9BasMwEPyKmLNSSgI97LGn_sH4IFvrWlSWxEoxKUbQP_SHfUmxmkBPTZnLsLszO7NhirKYAsLAuawumMNsgmV_yJyziwEaK0tjdNTIxUgBbXhzwYKQhDMX6BshPF99vj4-X5qT4otZkmf19HBE1SjCvDuMs_NWOIC6DUtc-ZetGXKUQblQokosLs0s77v4L9EUvcUeUVzKoA4jNAx6DdMitwWojV2wfAGdqv6R0bY3mFiE7fVkBAH1zs909l4V9zqXe-n-U6mvN2iMZxEOBdQ96oa-fgM";
    const { session } = Session.fromFile((await decodeSession(link))!);
    const { surface, model } = session.current;
    const { chart } = chartFor(model, surface);
    const result = layout(surface, chart);
    for (const view of ["poincare", "klein"] as const) {
      const { svg } = renderSvg(surface, result, { model: view, scaleNames: true, size: 800 });
      // The first name of each text: the sides are drawn before the strips (some strips have the names of sides).
      const sizes = new Map<string, number>();
      for (const m of svg.matchAll(/font-size="([^"]+)"[^>]*>([^<]*)<\/text>/g))
        if (!sizes.has(m[2] as string)) sizes.set(m[2] as string, Number(m[1]));
      const sides = ["a", "b", "c", "C", "B", "A"].map((name) => sizes.get(name));
      expect(sides.every((s) => s !== undefined && s > 3)).toBe(true);
      expect(Math.max(...(sides as number[])) - Math.min(...(sides as number[]))).toBeLessThan(0.2);
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
