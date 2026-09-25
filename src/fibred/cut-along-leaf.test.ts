import { EigenvalueDecomposition, Matrix } from "ml-matrix";
import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../examples/maps";
import { cut, slitsForProng, type CutTrack } from "./cut-along-leaf";
import { prongs } from "./singular-leaves";
import { trainTrack } from "./train-track";

function growthOf(ct: CutTrack): number {
  const M = new Matrix(ct.gPrime.transitionMatrix().entries.map((row) => [...row]));
  return Math.max(...new EigenvalueDecomposition(M).realEigenvalues);
}

/** For each switch: total width on the right minus total width on the left (the switch equation says 0). */
function switchDefects(ct: CutTrack): number[] {
  return ct.graph.vertices.map((v) =>
    ct.graph
      .star(v)
      .reduce((sum, e) => sum + (ct.side.get(e) === "right" ? 1 : -1) * ct.widths.get(e.edge)!, 0),
  );
}

describe("cutting along a singular leaf", () => {
  const tt = trainTrack(closedGenus2OneCusp());

  it("gives a consistent track with a carrying map of the same growth, for every prong and length", () => {
    for (const prong of prongs(tt))
      for (const count of [1, 2, 3]) {
        const slits = slitsForProng(tt, prong, count);
        const ct = cut(tt, slits);
        expect(ct.gPrime.checkContinuity()).toEqual([]);
        expect(growthOf(ct)).toBeCloseTo(tt.growth, 6);
        for (const defect of switchDefects(ct)) expect(Math.abs(defect)).toBeLessThan(1e-9);
      }
  });
});
