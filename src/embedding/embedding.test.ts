import { describe, expect, it } from "vitest";
import { gallery } from "../examples/gallery";
import { initialFibredSurface, spineOfGraph, type SurfaceModel } from "../examples/models";
import { buildPreset, PRESETS } from "../examples/presets";
import { autopilot } from "../fibred/suggestions";
import { chartOf, type Port } from "./chart";
import { layout } from "./layout";

const pointOn = (port: Port, u: number) => port.right.add(port.left.sub(port.right).scale((u + 1) / 2));
const chartFor = (model: SurfaceModel, fs = initialFibredSurface(model)) =>
  ({ fs, chart: chartOf(model, {}, spineOfGraph(model, fs.spine0)) }) as const;

describe("charts", () => {
  it("glues each side to its partner by the deck transformation, u ↦ −u", () => {
    for (const model of [...gallery(2, 1), ...gallery(2, 0)]) {
      const { chart } = chartFor(model);
      const deck = chart.deck!;
      for (const [x, port] of chart.ports) {
        const partner = chart.ports.get(x.reversed)!;
        for (const u of [-0.7, 0, 0.4]) {
          const p = pointOn(partner, u);
          const image =
            deck.kind === "hyperbolic"
              ? deck.generators.get(x)!.applyKlein(p)
              : p.add(deck.generators.get(x)!);
          expect(image.sub(pointOn(port, -u)).abs()).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("has a port for every oriented edge of G₀ and a region for every vertex", () => {
    for (const model of [...gallery(0, 4), ...gallery(1, 2), ...gallery(2, 3)]) {
      const { fs, chart } = chartFor(model);
      expect(chart.ports.size).toBe(2 * fs.spine0.edgeCount);
      expect(chart.regions.size).toBe(fs.spine0.vertexCount);
    }
  });
});

describe("layout", () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))(
    "lays out %s after the algorithm",
    (_, preset) => {
      const surface = autopilot(buildPreset(preset), { maxSteps: 200 }).surface;
      const { chart } = chartFor(preset.model, surface);
      const result = layout(surface, chart, { widthExponent: 0.5 });
      for (const e of surface.graph.edges) {
        const pieces = result.strips.get(e)!;
        const gluings = surface.mu
          .image(e.forward)
          .letters.filter((x) => chart.bands.get(x.edge)?.kind === "glue").length;
        expect(pieces.length).toBe(gluings + 1);
        for (const piece of pieces)
          for (const p of piece) expect(Number.isFinite(p.re) && Number.isFinite(p.im)).toBe(true);
      }
      if (chart.geometry === "hyperbolic")
        for (const p of result.junctions.values()) expect(p.abs()).toBeLessThan(1);
    },
    30_000,
  );
});
