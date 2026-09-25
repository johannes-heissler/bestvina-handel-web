import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../examples/maps";
import { imageProng, prongs, switchArc, traceLeaf } from "./singular-leaves";
import { trainTrack } from "./train-track";

describe("the geometry of TS(τ) for the closed-surface example", () => {
  const tt = trainTrack(closedGenus2OneCusp());

  it("stacks both sides of each switch arc to the same total width", () => {
    for (const s of tt.graph.vertices) {
      const arc = switchArc(tt, s);
      expect(arc.infinitesimal.at(-1)?.top).toBeCloseTo(arc.width, 9);
    }
  });

  it("has three prongs at each of the five triangles", () => {
    expect(prongs(tt)).toHaveLength(15);
  });

  it("traces prongs as train paths, alternating real and infinitesimal branches", () => {
    for (const prong of prongs(tt)) {
      const leaf = traceLeaf(tt, prong, 8);
      expect(leaf.singular).toBe(false);
      expect(leaf.path.isContinuous).toBe(true);
      leaf.path.letters.forEach((e, i) =>
        expect(tt.kind.get(e.edge)).toBe(i % 2 === 0 ? "real" : "infinitesimal"),
      );
      leaf.positions.forEach((y, i) => {
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(tt.widths!.get(leaf.path.at(i)!.edge)!);
      });
    }
  });

  it("is mapped by f to itself: g_τ of a prong's first branches starts the image prong", () => {
    for (const prong of prongs(tt)) {
      const leaf = traceLeaf(tt, prong, 3);
      const image = tt.gTau.imageOfPath(leaf.path); // the leaf ends with a real branch
      const imageLeaf = traceLeaf(tt, imageProng(tt, prong), 40);
      expect(imageLeaf.path.slice(0, image.length).equals(image)).toBe(true);
    }
  });
});
