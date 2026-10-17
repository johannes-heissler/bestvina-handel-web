import { describe, expect, it } from "vitest";
import { buildPreset, PRESETS } from "../../examples/presets";
import { applyMove } from "../move";
import { autopilot, DEFAULT_AUTOMATIC, nextSuggestion } from "../suggestions";
import { disconnectedJunctions, splitJunctions } from "./split-junctions";

const swappedHandles = () =>
  autopilot(buildPreset(PRESETS.find((p) => p.name === "Swapped handles")!)).surface;

describe("splitting junctions along a disconnected train track", () => {
  it("finds the disconnected gate graph of an efficient but reducible map", () => {
    const fs = swappedHandles();
    const [components] = [...disconnectedJunctions(fs).values()];
    expect(components?.map((c) => c.map((x) => x.name).join(" "))).toEqual(["A b a B", "c D C d"]);
    const suggestion = nextSuggestion(fs);
    expect(suggestion.kind).toBe("disconnected train track");
    expect(suggestion.classification).toMatchObject({ kind: "reducible", curves: ["a b A B", "c d C D"] });
    expect(suggestion.options).toHaveLength(3); // two pieces and "ignore"
  });

  it("splits, records the reduction curves and continues on a piece with the first-return map", () => {
    const fs = swappedHandles();
    let offered = 0;
    splitJunctions(fs, (pieces) => {
      offered = pieces.length;
      return pieces[0]!;
    });
    expect(offered).toBe(2);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.reductionCurves.map(String)).toEqual(["a b A B", "c d C D"]);
    expect(fs.graph.edges.map((e) => e.name).sort()).toEqual(["a", "b"]);
    const { stoppedAt } = autopilot(fs);
    expect(stoppedAt.classification).toMatchObject({ kind: "pseudo-Anosov" });
    expect((stoppedAt.classification as { growth: number }).growth).toBeCloseTo((3 + Math.sqrt(5)) / 2, 9);
  });

  it("is offered greyed out before the end, and applies as a move", () => {
    const fs = buildPreset(PRESETS.find((p) => p.name === "Reducible map")!);
    const { surface, stoppedAt } = autopilot(fs);
    const split = stoppedAt.options.find((o) => o.move.kind === "split junctions");
    expect(split?.discouraged).toBe(true);
    const after = applyMove(surface.copy(), split!.move);
    expect(after.checkIntegrity()).toEqual([]);
  });

  it("is not offered while some strip is pretrivial (before the invariant forests are collapsed)", () => {
    // Stopping at every collapse: once a strip is pretrivial, g doesn't respect the components of the gate graphs.
    const automatic = new Set(DEFAULT_AUTOMATIC);
    automatic.delete("collapse invariant subforest");
    let fs = buildPreset(PRESETS.find((p) => p.name === "Bestvina–Handel example 6.1")!);
    let pretrivialSeen = false;
    for (let step = 0; step < 10; step++) {
      const { surface, stoppedAt } = autopilot(fs, { automatic });
      if (stoppedAt.kind !== "collapse invariant subforest") break;
      if (surface.graph.edges.some((e) => surface.g.image(e.forward).length === 0)) {
        pretrivialSeen = true;
        expect(disconnectedJunctions(surface).size).toBe(0);
        expect(stoppedAt.options.map((o) => o.move.kind)).not.toContain("split junctions");
      }
      fs = applyMove(surface, stoppedAt.options[0]!.move);
    }
    expect(pretrivialSeen).toBe(true);
  });
});
