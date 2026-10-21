import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp, torusAnosov } from "../../examples/maps";
import { runAlgorithm } from "../algorithm";
import { inefficiencies } from "./inefficiency";
import { perronFrobenius } from "../perron-frobenius";
import { entriesInto, trainTrack } from "../train-track";
import { awayFromQ, entersQ } from "./closed-surface-fixtures";
import { plainText } from "../suggestions";
import {
  blowUpOrbit,
  fillings,
  fillPuncture,
  hasOneCuspPuncture,
  polygonSingularities,
  ratedFillings,
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
  }, 30_000); // about 7 s when all test files run in parallel

  it("maps a junction that g maps into Q to a corner, the strips of its other gate taking a side first", () => {
    const fs = entersQ();
    const q = polygonSingularities(fs).find((s) => s.junction.name === "v")!;
    expect(q.orbit.map((v) => v.name)).toEqual(["v"]);
    const entries = [...entriesInto(trainTrack(fs), new Set(q.orbit)).values()];
    expect(entries.map((e) => [e.junction.name, e.sides.size])).toEqual([["q", 1]]);
    const { surface } = blowUpOrbit(fs, q);
    expect(surface.g.checkContinuity()).toEqual([]);
    const next = replacePunctureBySingularity(fs, q);
    expect(next.checkIntegrity()).toEqual([]);
    expect(next.g.preservesBoundaryWords()).toBe(true);
  });

  it("offers every side of Q next to p for a single puncture, rated by the growth after pulling tight", () => {
    const fs = closedGenus2OneCusp();
    const [q] = polygonSingularities(fs);
    const { surface, polygons } = blowUpOrbit(fs, q!);
    const sides = [...polygons.values()].flat();
    expect(fillings(surface).map((f) => f.map((x) => x.edge))).toEqual(sides.map((e) => [e]));
    const rated = ratedFillings(fs, q!);
    expect(rated).toHaveLength(sides.length);
    expect(rated.map((r) => r.growth)).toEqual(rated.map((r) => r.growth).toSorted((a, b) => a - b));
    expect(plainText(rated[0]!.label)).toMatch(/^Delete the side \S+ of \S+ \(between \S+ and \S+\)$/);
    for (const r of rated)
      expect(replacePunctureBySingularity(fs, q!, undefined, undefined, r.letters).checkIntegrity()).toEqual(
        [],
      );
  });

  it("fills in punctures of P that don't border Q across real strips to other punctures", () => {
    const fs = awayFromQ();
    const q = polygonSingularities(fs).find((s) => s.junction.name === "w")!;
    const { surface } = blowUpOrbit(fs, q);
    const ways = fillings(surface);
    expect(ways.length).toBeGreaterThan(1);
    // Each way deletes one strip per puncture of P (3), at least one of them a real strip.
    for (const way of ways) {
      expect(way).toHaveLength(3);
      expect(way.some((x) => !surface.peripheral.has(x.edge))).toBe(true);
    }
    const rated = ratedFillings(fs, q);
    expect(rated.length).toBeGreaterThan(0);
    const next = replacePunctureBySingularity(fs, q, undefined, undefined, rated[0]!.letters);
    expect(next.checkIntegrity()).toEqual([]);
    expect(next.graph.boundaryWords()).toHaveLength(1); // only the puncture of Q is left
  });

  it("rejects a strip that doesn't fill in one puncture of P", () => {
    const fs = awayFromQ();
    const q = polygonSingularities(fs).find((s) => s.junction.name === "w")!;
    const { surface } = blowUpOrbit(fs, q);
    const [way] = fillings(surface);
    // The side of Q taken from the polygon's face would fill in the puncture of Q.
    const wrong = way!.map((x) => (surface.peripheral.has(x.edge) ? x.reversed : x).name);
    expect(() => replacePunctureBySingularity(fs, q, undefined, undefined, wrong)).toThrow(/doesn't fill in/);
  });
});
