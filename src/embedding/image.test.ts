import { describe, expect, it } from "vitest";
import { initialFibredSurface, spineOfGraph } from "../examples/models";
import { buildPreset, PRESETS } from "../examples/presets";
import { autopilot } from "../fibred/suggestions";
import { chartOf } from "./chart";
import { imageSurface } from "./image";
import { layout } from "./layout";

describe("the image f(G), embedded by μ ∘ g", () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))("%s: is an embedding and can be laid out", (_, preset) => {
    for (const fs of [buildPreset(preset), autopilot(buildPreset(preset), { maxSteps: 200 }).surface]) {
      const image = imageSurface(fs);
      expect(image.graph).toBe(fs.graph);
      expect(image.g).toBe(fs.g);
      // μ ∘ g up to isotopy: never longer than the reduced composition.
      const composed = fs.graph.edges.reduce(
        (n, e) => n + fs.mu.imageOfPath(fs.g.image(e.forward)).reduced().length,
        0,
      );
      expect(image.mu.totalLength()).toBeLessThanOrEqual(composed);
      expect(image.mu.checkContinuity()).toEqual([]);
      if (fs.reductionCurves.length === 0) expect(image.mu.preservesBoundaryWords()).toBe(true);
      const chart = chartOf(preset.model, {}, spineOfGraph(preset.model, fs.spine0));
      expect(layout(image, chart).strips.size).toBe(fs.graph.edgeCount);
    }
  });

  it("pulls a junction across a side that all its strips start across", () => {
    // After the autopilot on BH 6.1, μ ∘ g starts all strips at one junction across the same side (the strand order
    // then fails); the junction must be moved across it.
    const preset = PRESETS.find((p) => p.name === "Bestvina–Handel example 6.1")!;
    const fs = autopilot(buildPreset(preset), { maxSteps: 200 }).surface;
    const image = imageSurface(fs);
    for (const v of fs.graph.vertices) {
      const firsts = new Set(fs.graph.star(v).map((x) => image.mu.image(x).first));
      expect(firsts.size).toBeGreaterThan(1);
    }
  });

  it("is G itself for the identity map", () => {
    const fs = initialFibredSurface(PRESETS[0]!.model);
    const image = imageSurface(fs);
    for (const e of fs.graph.edges) expect(image.mu.image(e.forward).equals(fs.mu.image(e.forward))).toBe(true);
  });
});
