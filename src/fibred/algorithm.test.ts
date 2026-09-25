import { describe, expect, it } from "vitest";
import { runAlgorithm } from "./algorithm";
import { FibredSurface } from "./fibred-surface";
import { inefficiencies } from "./moves/inefficiency";
import { perronFrobenius } from "./perron-frobenius";

const φ = (1 + Math.sqrt(5)) / 2;
const growth = (fs: FibredSurface) => perronFrobenius(fs, { essentialOnly: false }).growth;

describe("runAlgorithm", () => {
  it("does nothing for an efficient map", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");
    expect(runAlgorithm(fs)).toEqual([]);
  });

  it("finds the efficient representative of a conjugated Anosov map, with growth φ²", () => {
    // a ↦ a b a, b ↦ b a, conjugated by a (growth (3 + √13)/2 ≈ 3.30 before).
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a a, b -> A b a a");
    const errors: string[] = [];
    fs.onError = (message) => errors.push(message);
    const log = runAlgorithm(fs);
    expect(errors).toEqual([]);
    expect(log).toContain("remove inefficiency");
    expect(inefficiencies(fs)).toEqual([]);
    expect(growth(fs)).toBeCloseTo(φ * φ, 8);
  });

  it("pulls a conjugation tight", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a b a B, b -> b b a B");
    runAlgorithm(fs);
    expect(growth(fs)).toBeCloseTo(φ * φ, 8); // conjugation of a ↦ a b a, b ↦ b a by b
  });

  it("works on a genus-2 surface", () => {
    // A composition of Dehn twists on the once-punctured genus-2 surface (the rose a b A B c d C D).
    const fs = FibredSurface.fromText(
      [["a", "b", "A", "B", "c", "d", "C", "D"]],
      "a -> a b, b -> b, c -> c d, d -> d",
    );
    const before = growth(fs);
    runAlgorithm(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(growth(fs)).toBeLessThanOrEqual(before + 1e-9);
  });
});
