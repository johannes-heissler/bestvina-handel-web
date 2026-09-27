import { describe, expect, it } from "vitest";
import { EdgePath } from "../graph/edge-path";
import type { OrientedEdge } from "../graph/ribbon-graph";
import { buildPreset, PRESETS } from "../examples/presets";
import { FibredSurface } from "../fibred/fibred-surface";
import { autopilot } from "../fibred/suggestions";
import { cyclicReduction, strandKey, strandOrder } from "./strand-order";

const count = (order: ReturnType<typeof strandOrder>) =>
  [...order.along.values()].reduce((n, l) => n + l.length, 0);

describe("cyclicReduction", () => {
  it("pairs cancelling letters, also across the end", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "");
    const [a, b] = fs.graph.edges.map((e) => e.forward) as [OrientedEdge, OrientedEdge];
    const word = [a, b, b.reversed, a, a.reversed, a.reversed];
    const { pairs, survivors } = cyclicReduction(word);
    expect(pairs).toEqual([
      [1, 2],
      [3, 4],
      [0, 5], // a … A with nothing left in between
    ]);
    expect(survivors).toEqual([]);
  });
});

describe("strandOrder", () => {
  it("has one strand per edge of G₀ for μ = the identity", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");
    const order = strandOrder(fs.mu);
    expect([...order.along.values()].map((l) => l.length)).toEqual([1, 1]);
  });

  it.each(PRESETS.map((p) => [p.name, p] as const))(
    "orders the strands of μ (before and after the algorithm) and of g (after it) for %s",
    (_, preset) => {
      const fs = buildPreset(preset);
      fs.onError = () => {};
      const after = autopilot(fs.copy(), { maxSteps: 200 }).surface;
      // g is only realized by an embedding f(F) ⊆ F with exactly its images once it is tight, so its strands are
      // ordered after the algorithm.
      for (const [surface, map] of [
        [fs, fs.mu],
        [after, after.mu],
        [after, after.g],
      ] as const) {
        const order = strandOrder(map);
        const letters = surface.graph.edges.reduce((n, e) => n + map.image(e.forward).length, 0);
        expect(count(order)).toBe(letters);
        expect(new Set([...order.position.keys()]).size).toBe(letters);
      }
    },
    30_000,
  );

  it("puts parallel strands in the order of the ribbon structure", () => {
    // Subdividing a = a₁ a₂ gives no second strand; folding creates parallel ones. After the algorithm on the
    // conjugated Anosov map, μ of every strip is a path in the rose, and the first strip of the chain along an edge
    // is the one next to the puncture.
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a a, b -> A b a a");
    const { surface } = autopilot(fs);
    const order = strandOrder(surface.mu);
    for (const [, list] of order.along)
      for (const [i, s] of list.entries()) expect(order.position.get(strandKey(s.strand))).toBe(i);
  });

  it("rejects strands that don't form chains", () => {
    // μ(a) = a a for the torus rose: the two strands along a can't both be next to the puncture on the same side.
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "");
    const a = fs.graph.edges[0]!;
    fs.mu.setImage(a.forward, EdgePath.of(fs.spine0.edges[0]!.forward, fs.spine0.edges[0]!.forward));
    expect(() => strandOrder(fs.mu)).toThrow(/embedding/);
  });
});
