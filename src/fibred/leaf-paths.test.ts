import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../examples/maps";
import type { OrientedEdge } from "../graph/ribbon-graph";
import { falseCorner } from "./moves/closed-surface-fixtures";
import { firstBranch, leafPath, leafThroughRealBranches, prongPeriod } from "./leaf-paths";
import { prongs, traceLeaf } from "./singular-leaves";
import { trainTrack, type TrainTrack } from "./train-track";

/** A train path: consecutive branches meet, real and infinitesimal alternate, starting and ending with a real one. */
function expectTrainPath(tt: TrainTrack, path: readonly OrientedEdge[]) {
  path.forEach((x, i) => {
    expect(tt.kind.get(x.edge)).toBe(i % 2 === 0 ? "real" : "infinitesimal");
    if (i > 0) expect(path[i - 1]!.target).toBe(x.source);
  });
  expect(path.length % 2).toBe(1);
}

describe("the leaves of the prongs, combinatorially", () => {
  it("agrees with tracing the heights where that is reliable (closed genus 2)", () => {
    const tt = trainTrack(closedGenus2OneCusp());
    for (const prong of prongs(tt)) {
      const path = leafThroughRealBranches(tt, prong, 60)!;
      expectTrainPath(tt, path);
      expect(path[0]!.source).toBe(prong.atSwitch);
      const traced = traceLeaf(tt, prong, 60);
      expect(traced.singular).toBe(false);
      expect(path.map(String)).toEqual(traced.path.letters.map(String));
    }
  });

  it("is extended by g_τ^P", () => {
    const tt = trainTrack(closedGenus2OneCusp());
    for (const prong of prongs(tt)) {
      const P = prongPeriod(tt, prong);
      const path = leafThroughRealBranches(tt, prong, 20)!;
      let image: OrientedEdge[] = path;
      for (let i = 0; i < P; i++) image = image.flatMap((x) => tt.gTau.image(x).letters);
      expect(image.slice(0, path.length)).toEqual(path);
      expect(image.length).toBeGreaterThan(path.length);
    }
  });

  it("continues where tracing the heights runs into a corner by rounding", () => {
    const fs = falseCorner();
    const tt = trainTrack(fs);
    const prong = prongs(tt).find((p) => p.atSwitch.name === "v_1_c" && prongPeriod(tt, p) === 18)!;
    expect(prong).toBeDefined();
    expect(traceLeaf(tt, prong, 100).singular).toBe(true);
    expect(firstBranch(tt, prong)).toBeDefined();
    const path = leafPath(tt, prong, (p) => p.length >= 199)!;
    expectTrainPath(tt, path);
  });
});
