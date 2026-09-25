import { describe, expect, it } from "vitest";
import {
  closedGenus2OneCusp as closedGenus2Example,
  conjugatedTorusAnosov,
  torusAnosov,
} from "../examples/maps";
import type { FibredSurface } from "./fibred-surface";
import { switchEquationDefects, trainTrack } from "./train-track";

const summary = (fs: FibredSurface) => {
  const tt = trainTrack(fs);
  const words = tt.boundaryWords();
  return {
    tt,
    switches: tt.graph.vertexCount,
    infinitesimal: [...tt.kind.values()].filter((k) => k === "infinitesimal").length,
    realWords: words.filter((w) => !w.infinitesimal).map((w) => w.cusps),
    polygons: words.filter((w) => w.infinitesimal).map((w) => w.cusps),
  };
};

describe("trainTrack", () => {
  it("builds τ for the Anosov map of the torus", () => {
    const { tt, switches, infinitesimal, realWords, polygons } = summary(torusAnosov());
    expect(switches).toBe(3); // gates {a}, {b}, {A, B}
    expect(infinitesimal).toBe(2); // a line graph: no infinitesimal polygon
    expect(polygons).toEqual([]);
    expect(realWords).toEqual([2]); // the puncture is a 2-pronged point
    expect(tt.gTau.checkContinuity()).toEqual([]);
  });

  it("satisfies the switch equation", () => {
    for (const fs of [torusAnosov(), closedGenus2Example()]) {
      const defects = switchEquationDefects(trainTrack(fs));
      expect(defects.size).toBe(trainTrack(fs).graph.vertexCount);
      for (const d of defects.values()) expect(Math.abs(d)).toBeLessThan(1e-9);
    }
  });

  it("finds the single cusp at the puncture of the closed-surface example", () => {
    const { tt, realWords, polygons } = summary(closedGenus2Example());
    expect(tt.growth).toBeCloseTo(4.3152, 3);
    expect(realWords).toEqual([1]); // a singularity of angle π after filling in the puncture
    expect(polygons).toEqual([3, 3, 3, 3, 3]); // an infinitesimal triangle in each of the 5 junctions
    expect(tt.gTau.checkContinuity()).toEqual([]);
    for (const w of tt.widths!.values()) expect(w).toBeGreaterThan(0);
  });

  it("also builds τ for a map that is not a train-track map yet", () => {
    const { tt } = summary(conjugatedTorusAnosov());
    expect(tt.gTau.checkContinuity()).toEqual([]);
  });
});
