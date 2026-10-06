import { describe, expect, it } from "vitest";
import { buildPreset, presetNamed } from "../examples/presets";
import { initialFibredSurface } from "../examples/models";
import { updateMap } from "./map-editing";
import { reductionCandidates } from "./moves/reducibility";
import { invariantPunctureCircles, peripheryCandidates, peripheryProblems } from "./periphery";

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

  it("may leave several orbits of punctures essential, even where no peripheral subgraph exists", () => {
    // A Dehn twist of the twice-punctured torus fixes both punctures, and P is empty; the spine has one junction, so
    // neither boundary word is a circle.
    const preset = presetNamed("Random mapping class of the twice-punctured torus")!;
    const fs = initialFibredSurface(preset.model, preset.options);
    updateMap(fs, "b -> A b", "replace");
    expect(fs.checkIntegrity()).toEqual([]);
    expect(peripheryProblems(fs)).toEqual([]);
    expect(peripheryCandidates(fs)).toEqual([]);
  });

  it("offers the circles around the other punctures", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    fs.peripheral.clear();
    expect(peripheryProblems(fs)).toEqual([]);
    const candidates = peripheryCandidates(fs);
    expect(candidates.map((c) => [...c.edges].map((e) => e.name))).toEqual([["p"]]);
    expect(String(candidates[0]!.essential[0])).toBe("a b A B s p S");
  });

  it("finds the invariant circles around punctures, but not other invariant circles", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    fs.peripheral.clear();
    const circles = reductionCandidates(fs).flatMap((c) => invariantPunctureCircles(fs, c.preserved) ?? []);
    expect(circles.map((c) => [...c].map((e) => e.name))).toEqual([["p"]]);
    // Once p is peripheral, it is not found again.
    fs.peripheral.add(fs.graph.edges.find((e) => e.name === "p")!);
    expect(reductionCandidates(fs).map((c) => invariantPunctureCircles(fs, c.preserved))).not.toContainEqual(
      expect.anything(),
    );

    // A Dehn twist: the loops a and c are invariant, but they are no boundary words.
    const preset = presetNamed("Random mapping class of the twice-punctured torus")!;
    const twist = initialFibredSurface(preset.model, preset.options);
    updateMap(twist, "b -> A b", "replace");
    expect(twist.checkIntegrity()).toEqual([]);
    const found = reductionCandidates(twist);
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((c) => invariantPunctureCircles(twist, c.preserved))).toEqual(
      found.map(() => undefined),
    );
  });

  it("must leave an orbit of punctures essential", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    for (const e of fs.graph.edges) fs.peripheral.add(e);
    expect(peripheryProblems(fs).join(" ")).toMatch(/Every boundary word is peripheral/);
  });

  it("must consist of circles that are boundary words, mapped into P", () => {
    const fs = buildPreset(presetNamed("Twisted stem")!);
    const s = fs.graph.edges.find((e) => e.name === "s")!;
    fs.peripheral.add(s);
    expect(peripheryProblems(fs).join(" ")).toMatch(/strips s don't form a circle/);
  });
});
