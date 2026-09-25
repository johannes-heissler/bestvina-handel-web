import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp, torusAnosov } from "../examples/maps";
import type { Edge } from "../graph/ribbon-graph";
import { arcOffsets, strands } from "./strands";
import { trainTrack } from "./train-track";

describe("image strands", () => {
  const tt = trainTrack(closedGenus2OneCusp());

  it("has an arc offset for every switch", () => {
    expect(arcOffsets(tt).size).toBe(tt.graph.vertexCount);
  });

  it("traces every strand along g_τ of its branch", () => {
    expect(() => strands(tt)).not.toThrow();
  });

  it("tiles every branch with the strands passing through it, without gaps or overlaps", () => {
    const all = strands(tt);
    const pieces = new Map<Edge, [number, number][]>(tt.graph.edges.map((e) => [e, []]));
    for (const strand of all.values())
      strand.path.forEach((x, i) => {
        const w = tt.widths!.get(x.edge)!;
        const o = strand.offsets[i]!;
        // Heights along the forward orientation of the branch.
        pieces.get(x.edge)!.push(x.isForward ? [o, o + strand.width] : [w - o - strand.width, w - o]);
      });
    for (const [branch, intervals] of pieces) {
      const sorted = intervals.sort((a, b) => a[0] - b[0]);
      let height = 0;
      for (const [bottom, top] of sorted) {
        expect(bottom).toBeCloseTo(height, 9);
        height = top;
      }
      expect(height).toBeCloseTo(tt.widths!.get(branch)!, 9);
    }
  });

  it("gives lengths with l(g_τ(e)) = λ l(e)", () => {
    for (const branch of tt.graph.edges) {
      const image = tt.gTau
        .image(branch.forward)
        .letters.reduce((sum, x) => sum + tt.lengths.get(x.edge)!, 0);
      expect(image).toBeCloseTo(tt.growth * tt.lengths.get(branch)!, 9);
    }
  });

  it("needs prong corners, which the torus map doesn't have", () => {
    expect(() => arcOffsets(trainTrack(torusAnosov()))).toThrow(/not connected to a prong/);
  });
});
