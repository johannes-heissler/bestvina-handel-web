import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp, torusAnosov } from "../examples/maps";
import { buildPreset, PRESETS } from "../examples/presets";
import { boundaryInfo, gatesInfo, matrixInfo, peripheryInfo } from "./analysis";

describe("analysis for the side panel", () => {
  it("gives the transition matrix with λ, widths and lengths", () => {
    const info = matrixInfo(torusAnosov());
    expect(info.entries.flat().reduce((a, b) => a + b, 0)).toBe(5); // a ↦ a b, b ↦ b a b
    expect(info.growth).toBeCloseTo(((1 + Math.sqrt(5)) / 2) ** 2, 9);
    expect(info.widths.size).toBe(2);
  });

  it("finds the one cusp of the closed genus-2 example and its singularities", () => {
    const info = boundaryInfo(closedGenus2OneCusp());
    expect(info.words).toHaveLength(1);
    const turns = info.words[0]!.turns!;
    expect(turns).toHaveLength(info.words[0]!.word.length);
    expect(turns.filter((t) => t.kind !== "smooth")).toHaveLength(1); // one cusp at the puncture
    expect(info.singularities).toHaveLength(5);
    expect(info.words[0]!.image).toBe(0);
  });

  it("finds the two cusps of the torus and lists gates in cyclic order", () => {
    const info = boundaryInfo(torusAnosov());
    expect(info.words[0]!.turns!.filter((t) => t.kind === "cusp")).toHaveLength(2);
    const gates = gatesInfo(torusAnosov());
    expect(gates[0]!.gates.flat()).toHaveLength(4);
  });

  it("separates P and the pre-periphery", () => {
    const fs = buildPreset(PRESETS.find((p) => p.name === "Bestvina–Handel example 6.2")!);
    expect(
      peripheryInfo(fs)
        .peripheral.map((e) => e.name)
        .sort(),
    ).toEqual(["α", "β", "γ"]);
  });
});
