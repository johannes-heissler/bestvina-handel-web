import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../examples/maps";
import type { Edge } from "../graph/ribbon-graph";
import { type LeafPoint, leafPoints } from "./leaf-order";
import { traceLeaf } from "./singular-leaves";
import { trainTrack } from "./train-track";

describe("the order of the leaves across a branch", () => {
  const tt = trainTrack(closedGenus2OneCusp());
  const points = leafPoints(tt);

  it("agrees with the heights where those are reliable (closed genus 2: every pair of points of 30 branches)", () => {
    const byEdge = new Map<Edge, { p: LeafPoint; h: number }[]>();
    points.prongs.forEach((prong, i) => {
      const leaf = traceLeaf(tt, prong, 30);
      leaf.path.letters.forEach((x, k) => {
        const [w, y] = [tt.widths!.get(x.edge)!, leaf.positions[k]!];
        const list = byEdge.get(x.edge) ?? [];
        list.push({ p: { prong: i, index: k }, h: x.isForward ? y : w - y });
        byEdge.set(x.edge, list);
      });
    });
    let pairs = 0;
    for (const [e, list] of byEdge)
      for (const a of list)
        for (const b of list) {
          if (a === b || Math.abs(a.h - b.h) < 1e-9) continue;
          pairs++;
          expect(Math.sign(points.compare(a.p, b.p, e.forward))).toBe(Math.sign(a.h - b.h));
          expect(Math.sign(points.compare(a.p, b.p, e.backward))).toBe(-Math.sign(a.h - b.h));
        }
    expect(pairs).toBeGreaterThan(10_000);
  });

  it("maps a point into the leaf of the image prong, along g_τ of its branch", () => {
    points.prongs.forEach((_, prong) => {
      for (let index = 0; index < 20; index++) {
        const p = { prong, index };
        const image = tt.gTau.image(points.letter(p)).letters;
        image.forEach((x, n) => expect(points.letter(points.image(p, n))).toBe(x));
      }
    });
  });
});
