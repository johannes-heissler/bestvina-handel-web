import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../../examples/maps";
import { Color } from "../../math/color";
import { runAlgorithm } from "../algorithm";
import { cut, growingSlits, type Slit, slitsForProng, traceProngThroughBranches } from "../cut-along-leaf";
import { perronFrobenius } from "../perron-frobenius";
import { trainTrack } from "../train-track";
import {
  attachedCircles,
  circleDefects,
  cutClosedSurface,
  cutOrbit,
  cutOptions,
  junctionPartName,
  prongsOfOrbit,
  ringLetters,
  ringsCutOff,
} from "./cut-closed-surface";
import { narrated } from "../narration";
import { autopilot, DEFAULT_AUTOMATIC, plainText } from "../suggestions";
import { inefficiencies } from "./inefficiency";
import { valenceTwoJunctions } from "./valence";
import { pullTight } from "./pull-tight";
import type { FibredSurface } from "../fibred-surface";
import { applyMove } from "../move";
import { buildPreset, presetNamed } from "../../examples/presets";

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
    const { result, steps } = narrated(() => cutClosedSurface(tt, option!), { states: true });
    const texts = steps.map((s) => plainText(s.text));
    const intro = texts.findIndex((t) => t.startsWith("The cut left valence-2 lines"));
    expect(intro).toBeGreaterThan(0);
    expect(steps[intro]!.note).toBe(true);
    const merge = intro + 1; // (the step after the note)
    expect(texts[merge]).toMatch(/^Merge the (\d+ )?valence-2 lines? /);
    const removal = texts.findIndex((t) => t.startsWith("Remove the boundary loop"));
    expect(texts[removal]).toMatch(/^Remove the boundary loop \S+ of p: this fills in p\.$/);
    const pink = (i: number) =>
      steps[i]!.before!.graph.edges.filter((e) => e.color.equals(Color.fromHex("#ff10f0")));
    expect(pink(merge)).toHaveLength(23); // B, contracted where it ran along the polygons outside Q
    expect(pink(removal)).toHaveLength(1);
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

describe("the length of L from the slits, without cutting (port note 15, update 2026-10-20)", () => {
  /** For every prong of the orbits and every count up to `max`: the criterion against the full cut. */
  function compareWithCut(fs: FibredSurface, junctions: readonly string[], max: number): number {
    const tt = trainTrack(fs);
    const rings = ringLetters(tt);
    let successes = 0;
    for (const name of junctions) {
      const junction = fs.graph.vertices.find((v) => v.name === name)!;
      for (const prong of prongsOfOrbit(tt, junction)) {
        const slitsFor = growingSlits(tt, prong, max);
        const blownUp = new Set(cutOrbit(tt, prong));
        for (let count = 1; count <= max; count++) {
          const slits = slitsFor(count);
          if (slits === undefined) break;
          let truth: boolean;
          try {
            truth = attachedCircles(cut(tt, slits, blownUp), rings.length) !== undefined;
          } catch {
            continue;
          }
          expect(ringsCutOff(tt, rings, slits), `${name}, count ${count}`).toBe(truth);
          if (truth) successes++;
        }
      }
    }
    return successes;
  }

  it("grows the slits from one trace, as tracing each length separately does", () => {
    const original = closedGenus2OneCusp();
    const tt = trainTrack(original);
    const q = original.graph.vertices.find((v) => v.name === "q")!;
    const show = (s: Slit) => [s.path.map(String), s.heights, s.partialLength];
    for (const prong of prongsOfOrbit(tt, q)) {
      const slitsFor = growingSlits(tt, prong, 60);
      for (const count of [1, 2, 17, 18, 60]) {
        const [L, ...preimages] = slitsFor(count)!;
        expect(show(L!)).toEqual(show(traceProngThroughBranches(tt, prong, count)));
        // The preimages, traced only as far as this length needs.
        expect(preimages.map(show)).toEqual(growingSlits(tt, prong, count)(count)!.slice(1).map(show));
      }
    }
  });

  it("agrees with the cut at every length, in closed genus 2", () => {
    expect(compareWithCut(closedGenus2OneCusp(), ["p", "q"], 60)).toBeGreaterThan(20);
  });

  it(
    "agrees with the cut where two slits start at a polygon of Q next to p (closed by Q)",
    { timeout: 60_000 },
    () => {
      const automatic = new Set([...DEFAULT_AUTOMATIC].filter((k) => k !== "closed surface"));
      const start = buildPreset(presetNamed("Point push with Dehn twists")!);
      const surface = applyMove(autopilot(start, { maxSteps: 1000, automatic }).surface.copy(), {
        kind: "mark as closed",
      });
      // In the orbit of p, one prong's L starts right at the puncture; a preimage starting at the other corner of that
      // side of the polygon closes the ring after 22 real branches, long before L could come around once more.
      expect(compareWithCut(surface, ["p"], 60)).toBeGreaterThan(20);
      const tt = trainTrack(surface);
      const p = surface.graph.vertices.find((v) => v.name === "p")!;
      expect(cutOptions(tt, prongsOfOrbit(tt, p)).map((o) => o.realBranches)).toContain(22);
    },
  );
});
