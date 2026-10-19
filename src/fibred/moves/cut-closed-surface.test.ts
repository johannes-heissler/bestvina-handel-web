import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../../examples/maps";
import { Color } from "../../math/color";
import { runAlgorithm } from "../algorithm";
import { cut, slitsForProng } from "../cut-along-leaf";
import { perronFrobenius } from "../perron-frobenius";
import { trainTrack } from "../train-track";
import {
  circleDefects,
  cutClosedSurface,
  cutOrbit,
  cutOptions,
  junctionPartName,
  prongsOfOrbit,
} from "./cut-closed-surface";
import { narrated } from "../narration";
import { plainText } from "../suggestions";
import { inefficiencies } from "./inefficiency";
import { valenceTwoJunctions } from "./valence";
import { pullTight } from "./pull-tight";

const growth = (fs: Parameters<typeof perronFrobenius>[0]) =>
  perronFrobenius(fs, { essentialOnly: false }).growth;

describe("closed surfaces: cutting along a singular leaf (the thesis's move)", () => {
  const original = closedGenus2OneCusp();
  const tt = trainTrack(original);
  const p = original.graph.vertices.find((v) => v.name === "p")!;

  it("lists the prongs of an orbit", () => {
    expect(prongsOfOrbit(tt, p)).toHaveLength(3); // p is fixed; its triangle has 3 prongs
  });

  it("prolongs L until the boundary of p is a circle attached at one switch, and removes it", () => {
    const [option] = cutOptions(tt, prongsOfOrbit(tt, p));
    expect(option).toBeDefined();
    const cutAt = (count: number) =>
      cut(tt, slitsForProng(tt, option!.prong, count), new Set(cutOrbit(tt, option!.prong)));
    expect(circleDefects(cutAt(option!.realBranches))).toHaveLength(1); // only the attachment junction
    expect(circleDefects(cutAt(option!.realBranches - 1))!.length).toBeGreaterThan(1);
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

  it("merges the valence-2 lines first, so that B is a pink loop when it is removed (port note 28)", () => {
    const [option] = cutOptions(tt, prongsOfOrbit(tt, p));
    const { result, narrated: steps } = narrated(() => cutClosedSurface(tt, option!), { states: true });
    const texts = steps.map((s) => plainText(s.text));
    const merge = texts.findIndex((t) => t.startsWith("The cut left valence-2 lines"));
    expect(merge).toBeGreaterThan(0);
    expect(texts[merge + 1]).toMatch(/^The boundary of p is now the loop \S+, attached only at/);
    const pink = (i: number) =>
      steps[i]!.before!.graph.edges.filter((e) => e.color.equals(Color.fromHex("#ff10f0")));
    expect(pink(merge)).toHaveLength(23); // B, contracted where it ran along the polygons outside Q
    expect(pink(merge + 1)).toHaveLength(1);
    const { surface } = result;
    expect(valenceTwoJunctions(surface)).toEqual([]);
    expect(surface.checkIntegrity()).toEqual([]);
    expect(surface.g.preservesBoundaryWords()).toBe(true);
    expect(surface.graph.vertices).toHaveLength(6);
  });

  it("reaches the same growth when cutting at the singularity q (period 2)", { timeout: 30_000 }, () => {
    const q = original.graph.vertices.find((v) => v.name === "q")!;
    const [option] = cutOptions(tt, prongsOfOrbit(tt, q));
    expect(option?.realBranches).toBe(18);
    const { surface } = cutClosedSurface(tt, option!);
    expect(surface.checkIntegrity()).toEqual([]);
    runAlgorithm(surface);
    expect(growth(surface)).toBeCloseTo(4.212077, 5);
  });

  it("letters the corners of Q like spreadsheet columns and numbers the other parts (port note 25)", () => {
    const parts = (inQ: boolean, count: number, legacy = false) => {
      const used = new Set<string>();
      return Array.from({ length: count }, () => junctionPartName(p, inQ, used, legacy));
    };
    expect(parts(true, 28).filter((_, i) => [0, 1, 25, 26, 27].includes(i))).toEqual([
      "p_a",
      "p_b",
      "p_z",
      "p_aa",
      "p_ab",
    ]);
    expect(parts(false, 3)).toEqual(["p", "p_2", "p_3"]);
    expect(parts(true, 28, true).filter((_, i) => [0, 25, 26, 27].includes(i))).toEqual([
      "pa",
      "pz",
      "pa2",
      "pb2",
    ]);
  });
});
