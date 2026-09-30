import { describe, expect, it } from "vitest";
import { updateMap } from "../fibred/map-editing";
import { GENUS_2_GENERATORS, TORUS_2_GENERATORS } from "./generators";
import { initialFibredSurface } from "./models";
import { buildPreset, presetNamed, PRESETS, randomTorus2 } from "./presets";

describe("the generating sets", () => {
  for (const [presetName, set] of [
    ["Random mapping class in genus 2", GENUS_2_GENERATORS],
    ["Random mapping class of the twice-punctured torus", TORUS_2_GENERATORS],
  ] as const)
    describe(presetName, () => {
      const preset = presetNamed(presetName)!;
      const start = () => initialFibredSurface(preset.model, preset.options);
      for (const generator of set.generators)
        it(`${generator.name} is geometric, and its inverse is inverse to it`, () => {
          for (const [first, second] of [
            [generator.map, generator.inverse],
            [generator.inverse, generator.map],
          ]) {
            const fs = start();
            updateMap(fs, first!, "replace");
            expect(fs.checkIntegrity()).toEqual([]);
            updateMap(fs, second!, "postcompose");
            for (const e of fs.graph.edges) expect(String(fs.g.image(e.forward).reduced())).toBe(e.name);
          }
        });
    });

  it("the random presets draw from them, and the half twist can still be started by name", () => {
    expect(PRESETS.map((p) => p.name)).toContain("Random mapping class of the twice-punctured torus");
    expect(PRESETS.map((p) => p.name)).not.toContain("Half twist");
    expect(buildPreset(randomTorus2(3)).checkIntegrity()).toEqual([]);
    expect(buildPreset(presetNamed("Half twist")!).checkIntegrity()).toEqual([]);
    expect(presetNamed("Bestvina–Handel example 6.1")?.generators).toBe(GENUS_2_GENERATORS);
  });
});
