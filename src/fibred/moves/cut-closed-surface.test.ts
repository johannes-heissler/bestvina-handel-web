import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../../examples/maps";
import { runAlgorithm } from "../algorithm";
import { perronFrobenius } from "../perron-frobenius";
import { trainTrack } from "../train-track";
import { cutClosedSurface, prongsOfOrbit } from "./cut-closed-surface";
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
    const result = cutClosedSurface(tt, prongsOfOrbit(tt, v2));
    expect(result).toBeDefined();
    const { surface, realBranches } = result!;
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
});
