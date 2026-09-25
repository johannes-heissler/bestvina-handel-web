import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../../examples/maps";
import { runAlgorithm } from "../algorithm";
import { cut, slitsForProng } from "../cut-along-leaf";
import { perronFrobenius } from "../perron-frobenius";
import { trainTrack } from "../train-track";
import { circleDefects, cutClosedSurface, cutOptions, prongsOfOrbit } from "./cut-closed-surface";
import { inefficiencies } from "./inefficiency";
import { pullTight } from "./pull-tight";

const growth = (fs: Parameters<typeof perronFrobenius>[0]) =>
  perronFrobenius(fs, { essentialOnly: false }).growth;

describe("closed surfaces: cutting along a singular leaf (the thesis's move)", () => {
  const original = closedGenus2OneCusp();
  const tt = trainTrack(original);
  const v2 = original.graph.vertices.find((v) => v.name === "v2")!;

  it("lists the prongs of an orbit", () => {
    expect(prongsOfOrbit(tt, v2)).toHaveLength(3); // v2 is fixed; its triangle has 3 prongs
  });

  it("prolongs L until the boundary of p is a circle attached at one switch, and removes it", () => {
    const [option] = cutOptions(tt, prongsOfOrbit(tt, v2));
    expect(option).toBeDefined();
    expect(circleDefects(cut(tt, slitsForProng(tt, option!.prong, option!.realBranches)))).toHaveLength(1); // only the attachment switch
    expect(
      circleDefects(cut(tt, slitsForProng(tt, option!.prong, option!.realBranches - 1)))!.length,
    ).toBeGreaterThan(1);
    const { surface, realBranches } = cutClosedSurface(tt, option!);
    expect(realBranches).toBe(16);
    expect(surface.checkIntegrity()).toEqual([]);
    expect(surface.g.preservesBoundaryWords()).toBe(true);
    expect(surface.graph.eulerCharacteristic).toBe(2 - 2 * 2 - 1); // a spine of Σ ∖ {q}
    expect(surface.graph.boundaryWords()).toHaveLength(1);

    // Removing B already lowers the growth after pulling tight (the Lemma), and the algorithm then reaches the
    // same growth as the shortcut (fill-puncture.test.ts).
    pullTight(surface);
    expect(growth(surface)).toBeLessThan(tt.growth - 1e-6);
    runAlgorithm(surface);
    expect(inefficiencies(surface)).toEqual([]);
    expect(growth(surface)).toBeCloseTo(4.212077, 5);
  });

  it("reaches the same growth when cutting at the singularity v3 (period 2)", { timeout: 30_000 }, () => {
    const v3 = original.graph.vertices.find((v) => v.name === "v3")!;
    const [option] = cutOptions(tt, prongsOfOrbit(tt, v3));
    expect(option?.realBranches).toBe(18);
    const { surface } = cutClosedSurface(tt, option!);
    expect(surface.checkIntegrity()).toEqual([]);
    runAlgorithm(surface);
    expect(growth(surface)).toBeCloseTo(4.212077, 5);
  });
});
