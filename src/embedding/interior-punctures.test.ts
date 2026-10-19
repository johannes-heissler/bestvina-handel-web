import { describe, expect, it } from "vitest";
import { gallery } from "../examples/gallery";
import {
  initialFibredSurface,
  spineOf,
  spineOfGraph,
  topology,
  type PolygonModel,
  type SurfaceModel,
} from "../examples/models";
import { applyMove } from "../fibred/move";
import { updateMap } from "../fibred/map-editing";
import { autopilot } from "../fibred/suggestions";
import type { FibredSurface } from "../fibred/fibred-surface";
import { chartOf, type Port } from "./chart";
import { layout } from "./layout";
import { strandOrder } from "./strand-order";

const pointOn = (port: Port, u: number) => port.right.add(port.left.sub(port.right).scale((u + 1) / 2));

const withPoints = (g: number, p: number) =>
  gallery(g, p).filter((e) => e.model.kind === "polygon" && (e.model.points ?? []).length > 0);

/** The closed octagon with one puncture in the middle: G₀ has the cells a b A x D and B c d C X (y is the wall). */
const octagon: PolygonModel = {
  kind: "polygon",
  name: "",
  description: "",
  word: "a b A B c d C D".split(" "),
  geometry: { kind: "compact" },
  closed: true,
  points: [[0, 0]],
};

/**
 * The map of the rose `rose` (one loop per side pair) as a map of `cells`, a spine whose extra edges (chords) form a
 * tree: contracting them gives the rose. With P(v) the tree path from the first vertex to v, a loop e of the rose is
 * P(o(e)) e P(t(e))⁻¹, so g(e) = P(o(e))⁻¹ T(φ(e)) P(t(e)) with T(x) = P(o(x)) x P(t(x))⁻¹; the chords are fixed.
 */
function transported(rose: FibredSurface, cells: FibredSurface): string {
  const graph = cells.graph;
  const sides = new Set(rose.graph.edges.map((e) => e.name));
  const path = new Map([[graph.vertices[0]!, [] as string[]]]);
  for (let queue = [graph.vertices[0]!]; queue.length > 0;) {
    const v = queue.shift()!;
    for (const x of graph.star(v))
      if (!sides.has(x.edge.name) && !path.has(x.target)) {
        path.set(x.target, [...path.get(v)!, x.name]);
        queue.push(x.target);
      }
  }
  const named = new Map(graph.orientedEdges.map((x) => [x.name, x]));
  const invert = (word: string[]) => word.toReversed().map((n) => named.get(n)!.reversed.name);
  const reduce = (word: string[]) =>
    word.reduce<string[]>(
      (acc, n) =>
        acc.length > 0 && named.get(acc.at(-1)!)!.reversed.name === n ? acc.slice(0, -1) : [...acc, n],
      [],
    );
  const T = (n: string) => {
    const x = named.get(n)!;
    return [...path.get(x.source)!, n, ...invert(path.get(x.target)!)];
  };
  return rose.graph.edges
    .map((e) => {
      const x = named.get(e.name)!;
      const image = rose.g.image(e.forward).letters.flatMap((y) => T(y.name));
      const word = reduce([...invert(path.get(x.source)!), ...image, ...path.get(x.target)!]);
      return `${e.name} -> ${word.join(" ")}`;
    })
    .join(", ");
}

function checkLayout(model: SurfaceModel, fs: FibredSurface) {
  const chart = chartOf(model, {}, spineOfGraph(model, fs.spine0));
  strandOrder(fs.mu, fs.reductionCurves); // throws if μ doesn't come from an embedding
  const result = layout(fs, chart, { smoothing: 3 });
  for (const e of fs.graph.edges) {
    const gluings = fs.mu
      .image(e.forward)
      .letters.filter((x) => chart.bands.get(x.edge)?.kind === "glue").length;
    const pieces = result.strips.get(e) ?? [];
    expect(pieces.length).toBe(gluings + 1);
    for (const piece of pieces) for (const p of piece) expect(Number.isFinite(p.re + p.im)).toBe(true);
  }
  for (const p of result.junctions.values()) expect(p.abs()).toBeLessThan(1);
}

describe("polygons with interior punctures", () => {
  it("are in the gallery with the right topology", () => {
    for (const [g, p] of [
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
      [2, 2],
      [3, 2],
    ] as const) {
      const entries = withPoints(g, p);
      expect(entries.length).toBeGreaterThan(0);
      for (const { model } of entries) expect(topology(model)).toEqual({ genus: g, punctures: p });
    }
  });

  it("leave G₀ of a polygon without points unchanged", () => {
    const rose = spineOf({ ...octagon, points: [] });
    expect(rose.graph.vertexCount).toBe(1);
    expect(rose.graph.star(rose.graph.vertices[0]!).map((x) => x.name)).toEqual(octagon.word);
  });

  it("cut the octagon along a diagonal through its middle point, with a wall", () => {
    const spine = spineOf(octagon);
    expect(
      spine.graph.vertices.map((v) =>
        spine.graph
          .star(v)
          .map((x) => x.name)
          .join(" "),
      ),
    ).toEqual(["a b A x D", "B c d C X"]);
    // The wall, seen from both cells; it is named last (y), so the chord that stays is x.
    expect(spine.cells?.flatMap((c) => c.exits).filter((x) => x === undefined)).toHaveLength(2);
    expect(spine.graph.edges.map((e) => e.name)).not.toContain("y");
  });

  it("labels each chord once with its edge of G₀, and not the wall (port note 25)", () => {
    const chords = chartOf(octagon).decorations.flatMap((d) => (d.kind === "chord" ? [d] : []));
    expect(chords.filter((d) => d.wall).map((d) => d.label)).toEqual([undefined]);
    expect(chords.filter((d) => !d.wall).map((d) => d.label)).toEqual(["x"]);
  });

  it("have charts with a region per cell, chords glued by the identity, and the wall without a port", () => {
    for (const { model, naming } of [...withPoints(1, 2), ...withPoints(2, 1), ...withPoints(2, 2)]) {
      const fs = initialFibredSurface(model, naming);
      const chart = chartOf(model, {}, spineOfGraph(model, fs.spine0));
      expect(chart.ports.size).toBe(2 * fs.spine0.edgeCount);
      expect(chart.regions.size).toBe(fs.spine0.vertexCount);
      const deck = chart.deck!;
      for (const [x, port] of chart.ports) {
        const partner = chart.ports.get(x.reversed)!;
        const map = deck.generators.get(x);
        for (const u of [-0.7, 0, 0.4]) {
          const p = pointOn(partner, u);
          const image =
            map === undefined
              ? p
              : deck.kind === "hyperbolic"
                ? (map as never as { applyKlein: (z: typeof p) => typeof p }).applyKlein(p)
                : p.add(map as typeof p);
          expect(image.sub(pointOn(port, -u)).abs()).toBeLessThan(1e-9);
        }
      }
      const points = (model as PolygonModel).points ?? [];
      expect(chart.decorations.filter((d) => d.kind === "puncture")).toHaveLength(points.length);
      const walls = chart.decorations.filter((d) => d.kind === "chord" && d.wall);
      expect(walls).toHaveLength((model as PolygonModel).closed ? 1 : 0);
      checkLayout(model, fs);
    }
  });

  it("keep μ an embedding through the algorithm (BH 6.1 transported from the rose)", () => {
    const naming = { reversed: ["c", "d"], names: { c: "d", d: "c" } }; // the BH 6.1 setup
    const rose = initialFibredSurface({ ...octagon, points: [] }, naming);
    updateMap(rose, "a -> a B A b D C A, b -> a c d B a b c d B, c -> c c d B, d -> b c d B");
    const fs = initialFibredSurface(octagon, naming);
    updateMap(fs, transported(rose, fs));
    expect(fs.checkIntegrity()).toEqual([]);
    const { moves } = autopilot(fs.copy(), { maxSteps: 80 });
    expect(moves.length).toBeGreaterThan(3);
    let surface = fs;
    for (const move of moves) {
      surface = applyMove(surface, move);
      expect(surface.checkIntegrity()).toEqual([]);
      checkLayout(octagon, surface);
    }
  }, 60_000);
});
