import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp, torusAnosov } from "../../examples/maps";
import { runAlgorithm } from "../algorithm";
import { inefficiencies } from "./inefficiency";
import { perronFrobenius } from "../perron-frobenius";
import { trainTrack } from "../train-track";
import {
  blowUpOrbit,
  fillPuncture,
  hasOneCuspPuncture,
  polygonSingularities,
  replacePunctureBySingularity,
} from "./fill-puncture";

const growth = (fs: Parameters<typeof perronFrobenius>[0]) =>
  perronFrobenius(fs, { essentialOnly: false }).growth;

describe("closed surfaces: replacing the puncture by a singularity", () => {
  it("recognizes the one-cusp case", () => {
    expect(hasOneCuspPuncture(closedGenus2OneCusp())).toBe(true);
    expect(hasOneCuspPuncture(torusAnosov())).toBe(false); // two cusps
  });

  it("lists the singularities with their orbits", () => {
    const singularities = polygonSingularities(closedGenus2OneCusp());
    expect(singularities).toHaveLength(5);
    const periods = singularities.map((s) => s.orbit.length);
    expect(periods).toEqual([...periods].sort((a, b) => a - b));
  });

  it("gives a spine of Σ ∖ Q with a consistent carrying map that preserves the boundary words", () => {
    const fs = closedGenus2OneCusp();
    for (const q of polygonSingularities(fs)) {
      const next = replacePunctureBySingularity(fs, q);
      expect(next.checkIntegrity()).toEqual([]);
      expect(next.g.preservesBoundaryWords()).toBe(true);
      // χ(Σ ∖ Q) = 2 − 2·2 − |Q|
      expect(next.graph.eulerCharacteristic).toBe(2 - 4 - q.orbit.length);
      expect(next.graph.boundaryWords()).toHaveLength(q.orbit.length);
    }
  });

  it("lowers the growth strictly after running the algorithm again", () => {
    const fs = closedGenus2OneCusp();
    const λ = growth(fs);
    const [q] = polygonSingularities(fs);
    const next = replacePunctureBySingularity(fs, q!);
    const errors: string[] = [];
    next.onError = (message) => errors.push(message);
    runAlgorithm(next);
    expect(errors).toEqual([]);
    const λ2 = growth(next);
    expect(λ2).toBeLessThan(λ - 1e-6);
    expect(λ2).toBeGreaterThan(1);
    expect(inefficiencies(next)).toEqual([]);
    expect(hasOneCuspPuncture(next, trainTrack(next))).toBe(false); // Q is no π-singularity
  });

  it("reaches the same growth for every choice of q and ε, although filling in p first raises it", () => {
    const fs = closedGenus2OneCusp();
    const results = new Set<string>();
    for (const q of polygonSingularities(fs))
      for (const epsilon of blowUpOrbit(fs, q).polygons.get(q.junction) ?? []) {
        const { surface, polygons } = blowUpOrbit(fs, q);
        const next = fillPuncture(
          surface,
          polygons.get(q.junction)!.find((e) => e.name === epsilon.name)!,
        );
        expect(next.checkIntegrity()).toEqual([]);
        expect(growth(next)).toBeGreaterThan(growth(fs)); // see docs/examples/closed-genus-2.md
        runAlgorithm(next);
        results.add(growth(next).toFixed(6));
      }
    expect([...results]).toEqual(["4.212077"]);
  });
});
