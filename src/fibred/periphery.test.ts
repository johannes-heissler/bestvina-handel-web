import { describe, expect, it } from "vitest";
import { buildPreset, presetNamed } from "../examples/presets";
import { initialFibredSurface } from "../examples/models";
import { updateMap } from "./map-editing";
import { peripheryCandidates, peripheryProblems } from "./periphery";

describe("the peripheral subgraph", () => {
  it("is fine in the examples", () => {
    for (const name of [
      "Bestvina–Handel example 6.2",
      "Twisted stem",
      "Half twist",
      "Bestvina–Handel example 6.1",
    ])
      expect(peripheryProblems(buildPreset(presetNamed(name)!))).toEqual([]);
  });

  it("is missing when two orbits of punctures have none, and then there may be no possible choice", () => {
    // A Dehn twist of the twice-punctured torus fixes both punctures, but P is empty; the spine has one junction, so
    // neither boundary word is a circle.
    const preset = presetNamed("Random mapping class of the twice-punctured torus")!;
    const fs = initialFibredSurface(preset.model, preset.options);
    updateMap(fs, "b -> A b", "replace");
    expect(fs.checkIntegrity()).toEqual([]);
    expect(peripheryProblems(fs).join(" ")).toMatch(/form 2 orbits/);
    expect(peripheryCandidates(fs)).toEqual([]);
  });

  it("offers the circles around the other punctures", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    fs.peripheral.clear();
    expect(peripheryProblems(fs).join(" ")).toMatch(/form 2 orbits/);
    const candidates = peripheryCandidates(fs);
    expect(candidates.map((c) => [...c.edges].map((e) => e.name))).toEqual([["p"]]);
    expect(String(candidates[0]!.essential[0])).toBe("a b A B s p S");
  });

  it("must consist of circles that are boundary words, mapped into P", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    const s = fs.graph.edges.find((e) => e.name === "s")!;
    fs.peripheral.add(s);
    expect(peripheryProblems(fs).join(" ")).toMatch(/strips s don't form a circle/);
  });
});
