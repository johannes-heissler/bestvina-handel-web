import { describe, expect, it } from "vitest";
import { initialFibredSurface, spineOfGraph, type SurfaceModel } from "../examples/models";
import { buildPreset, PRESETS } from "../examples/presets";
import { chartOf } from "../embedding/chart";
import { layout } from "../embedding/layout";
import type { FibredSurface } from "../fibred/fibred-surface";
import { autopilot } from "../fibred/suggestions";
import { trainTrack } from "../fibred/train-track";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { renderSvg, turnSide } from "./svg";
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";

const chartFor = (model: SurfaceModel, fs: FibredSurface) => ({
  chart: chartOf(model, {}, spineOfGraph(model, fs.spine0)),
});

describe("SVG", () => {
  const preset = PRESETS.find((p) => p.name === "Bestvina–Handel example 6.1")!;

  it("draws a highlighted fold and turn under the strips", () => {
    const surface = buildPreset(preset);
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart);
    // A turn inside a gate (only those are drawn): two ends with the same switch, the side between them decided.
    const tt = trainTrack(surface);
    const turn = surface.graph.vertices
      .flatMap((v) => {
        const star = surface.graph.star(v);
        const gates = {
          switchOf: tt.switchOf,
          ...(tt.singleGateOrder.has(v) && { singleOrder: tt.singleGateOrder.get(v)! }),
        };
        return star.flatMap((x) =>
          star
            .filter((y) => y !== x && turnSide(star, x, y, gates) !== undefined)
            .map((y) => [x.name, y.name]),
        );
      })
      .find(([x, y]) => ![x, y].includes("a") && ![x, y].includes("b"));
    expect(turn).toBeDefined();
    const highlight = [
      { ends: ["a", "b"], kind: "fold" as const, fractions: [0.5, 0.5] },
      { ends: turn!, kind: "turn" as const },
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

  it("draws the names of the chords and the indices of names as subscripts (port note 25)", () => {
    const model: SurfaceModel = {
      kind: "polygon",
      name: "",
      description: "",
      word: "a b A B c d C D".split(" "),
      geometry: { kind: "compact" },
      closed: true,
      points: [[0, 0]],
    };
    const surface = initialFibredSurface(model);
    (surface.graph.edges[0] as Edge).name = "a_b";
    const { chart } = chartFor(model, surface);
    const { svg } = renderSvg(surface, layout(surface, chart), { model: "poincare", view: "standard" });
    expect(svg).toMatch(/font-size="16(\.0+)?"[^>]*>x<\/text>/); // the chord x (the wall y has no name)
    expect(svg).not.toMatch(/>y<\/text>/);
    expect(svg).toMatch(/>a<tspan dy="[\d.]+" font-size="[\d.]+">b<\/tspan><\/text>/);
  });

  it("explains why the striped view needs a tight map", () => {
    const fs = buildPreset(PRESETS.find((p) => p.name === "Point push")!);
    const { chart } = chartFor(pointPushModel(), fs);
    expect(renderSvg(fs, layout(fs, chart), { view: "striped" }).notes).toHaveLength(1);
  });

  it("highlights a turn on the side inside its gate", () => {
    // Strip ends and switches stand in for the real ones: only their identities matter.
    const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map(
      (name) => ({ name }) as unknown as OrientedEdge,
    ) as [OrientedEdge, OrientedEdge, OrientedEdge, OrientedEdge, OrientedEdge];
    const [s, t] = [{}, {}] as [Vertex, Vertex];
    const star = [a, b, c, d, e];
    // Two gates {a, b, c} and {d, e}: the turn (c, a) lies on the side of b, i.e. from a counterclockwise to c.
    const gate = (x: OrientedEdge) => ([d, e].includes(x) ? t : s);
    const two = { switchOf: new Map(star.map((x) => [x, gate(x)] as const)) };
    expect(turnSide(star, a, c, two)).toBe("counterclockwise");
    expect(turnSide(star, c, a, two)).toBe("clockwise");
    expect(turnSide(star, a, d, two)).toBeUndefined(); // different gates
    // A single gate cut open between b and c (linear order c d e a b): the turn (b, d) doesn't cross the cut.
    const single = { switchOf: new Map(star.map((x) => [x, s] as const)), singleOrder: [c, d, e, a, b] };
    expect(turnSide(star, d, b, single)).toBe("counterclockwise");
    expect(turnSide(star, b, d, single)).toBe("clockwise");
    // Without a linear order the side is not decided, and the turn is not drawn.
    expect(turnSide(star, b, d, { switchOf: single.switchOf })).toBeUndefined();
  });

  it("scales the widths of the strips and the infinitesimal branches by the width factor", () => {
    const surface = autopilot(buildPreset(preset)).surface;
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart);
    const numbers = (svg: string, pattern: RegExp) => [...svg.matchAll(pattern)].map((m) => Number(m[1]));
    const [plain, wide] = [1, 2].map(
      (widthScale) => renderSvg(surface, result, { sideStyle: "solid", widthScale }).svg,
    ) as [string, string];
    // The strips (their highlight outline is half their width) and the infinitesimal branches.
    for (const pattern of [/--grow:([\d.]+)px/g, /stroke="#555" stroke-width="([\d.]+)"/g]) {
      const [before, after] = [numbers(plain, pattern), numbers(wide, pattern)];
      expect(before.length).toBeGreaterThan(0);
      after.forEach((x, i) => expect(x).toBeCloseTo(2 * (before[i] as number), 1));
    }
  });

  it("draws the infinitesimal branches to scale with the width equation", () => {
    const surface = autopilot(buildPreset(preset)).surface;
    const { chart } = chartFor(preset.model, surface);
    const result = layout(surface, chart, { widthExponent: 1 });
    const tt = trainTrack(surface);
    const branches = [...tt.kind.values()].filter((k) => k === "infinitesimal").length;
    const bands = (svg: string) => svg.match(/fill="#5980d4"/g)?.length ?? 0;
    const plain = renderSvg(surface, result, { view: "trainTrack" });
    const equation = renderSvg(surface, result, { view: "trainTrack", widthEquation: true });
    expect(bands(plain.svg)).toBe(0);
    expect(branches).toBeGreaterThan(0);
    expect(bands(equation.svg)).toBe(branches);
    expect(equation.svg).not.toContain("NaN");
    // The junction disks are larger (and fainter) than usual.
    const radii = (svg: string) =>
      [...svg.matchAll(/<circle [^>]*r="([\d.]+)"[^>]*stroke="#1a693a"/g)].map((m) => Number(m[1]));
    expect(Math.max(...radii(equation.svg))).toBeGreaterThan(Math.max(...radii(plain.svg)));
    expect(equation.svg).toContain('fill-opacity="0.15"');
    // Only the train track has a width equation.
    expect(renderSvg(surface, result, { view: "standard", widthEquation: true }).svg).toBe(
      renderSvg(surface, result, { view: "standard" }).svg,
    );
  });
});

function pointPushModel(): SurfaceModel {
  return PRESETS.find((p) => p.name === "Point push")!.model;
}
