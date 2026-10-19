import { EigenvalueDecomposition, Matrix } from "ml-matrix";
import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp } from "../examples/maps";
import type { Edge, OrientedEdge, Vertex } from "../graph/ribbon-graph";
import { cut, slitsForProng, type CutTrack, type Piece } from "./cut-along-leaf";
import { FibredSurface } from "./fibred-surface";
import { collapseUncut, cutOptions, cutOrbit, prongsOfOrbit } from "./moves/cut-closed-surface";
import { prongs } from "./singular-leaves";
import { trainTrack } from "./train-track";

function growthOf(ct: CutTrack): number {
  const M = new Matrix(ct.gPrime.transitionMatrix().entries.map((row) => [...row]));
  return Math.max(...new EigenvalueDecomposition(M).realEigenvalues);
}

/** For each switch: total width on the right minus total width on the left (the switch equation says 0). */
function switchDefects(ct: CutTrack): number[] {
  return ct.graph.vertices.map((v) =>
    ct.graph
      .star(v)
      .reduce((sum, e) => sum + (ct.side.get(e) === "right" ? 1 : -1) * ct.widths.get(e.edge)!, 0),
  );
}

describe("cutting along a singular leaf", () => {
  const tt = trainTrack(closedGenus2OneCusp());

  it("gives a consistent track with a carrying map of the same growth, for every prong and length", () => {
    for (const prong of prongs(tt))
      for (const count of [1, 2, 3]) {
        const slits = slitsForProng(tt, prong, count);
        const ct = cut(tt, slits);
        expect(ct.gPrime.checkContinuity()).toEqual([]);
        expect(growthOf(ct)).toBeCloseTo(tt.growth, 6);
        for (const defect of switchDefects(ct)) expect(Math.abs(defect)).toBeLessThan(1e-9);
      }
  });

  // Port note 29: blowing up only the junctions of Q gives what cutting all of TS(τ) and then contracting the other
  // polygons gave. The pieces of the real branches are matched by their place in τ.
  for (const name of ["p", "q"])
    it(
      `gives the same as contracting the polygons outside Q afterwards (cut at ${name})`,
      { timeout: 30_000 },
      () => {
        const junction = tt.graph.vertices.map((s) => tt.junctionOf.get(s)!).find((v) => v.name === name)!;
        const [option] = cutOptions(tt, prongsOfOrbit(tt, junction));
        const slits = slitsForProng(tt, option!.prong, option!.realBranches);
        const inQ = new Set(cutOrbit(tt, option!.prong));

        const all = cut(tt, slits);
        const branchOf = (e: Edge) => all.pieces.get(e)!.branch;
        const uncut = all.graph.edges.filter(
          (e) =>
            tt.kind.get(branchOf(e)) === "infinitesimal" &&
            !inQ.has(tt.junctionOf.get(branchOf(e).source) as Vertex),
        );
        const contracted = new FibredSurface({ graph: all.graph, g: all.gPrime });
        collapseUncut(contracted, new Set(uncut), () => undefined, inQ);
        const onG = cut(tt, slits, { blownUp: inQ });
        expect(onG.gPrime.checkContinuity()).toEqual([]);
        expect(onG.junctionParts.size).toBeGreaterThan(0);

        const place = (ct: CutTrack, x: OrientedEdge) => {
          const p = ct.pieces.get(x.edge) as Piece;
          return `${p.branch.name}|${p.bottom.toFixed(9)}|${p.start.toFixed(9)}${x.isForward ? "+" : "-"}`;
        };
        /** The stars as cyclic words of places, each rotated to its least form. */
        const stars = (ct: CutTrack, graph: CutTrack["graph"]) =>
          graph.vertices
            .map((v) => {
              const word = graph.star(v).map((x) => place(ct, x));
              return word.map((_, i) => [...word.slice(i), ...word.slice(0, i)].join(" ")).sort()[0];
            })
            .sort();
        const images = (ct: CutTrack, fs: { graph: CutTrack["graph"]; g: CutTrack["gPrime"] }) =>
          fs.graph.edges
            .map(
              (e) =>
                `${place(ct, e.forward)} ↦ ${fs.g
                  .image(e.forward)
                  .letters.map((x) => place(ct, x))
                  .join(" ")}`,
            )
            .sort();
        expect(stars(onG, onG.graph)).toEqual(stars(all, contracted.graph));
        expect(images(onG, { graph: onG.graph, g: onG.gPrime })).toEqual(images(all, contracted));
      },
    );
});
