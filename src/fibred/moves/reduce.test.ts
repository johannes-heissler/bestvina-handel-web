import { describe, expect, it } from "vitest";
import { runAlgorithm } from "../algorithm";
import { FibredSurface } from "../fibred-surface";
import { perronFrobenius } from "../perron-frobenius";
import { reduce, type ReductionPiece } from "./reduce";
import { finiteOrder } from "./reducibility";

const genus2 = (map: string) => FibredSurface.fromText([["a", "b", "A", "B", "c", "d", "C", "D"]], map);
const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;
const complement = (pieces: readonly ReductionPiece[]) => pieces.find((p) => p.kind === "complement")!;

describe("reduce", () => {
  // The Anosov map on the first handle, the identity on the second; K = the first handle.
  const make = () => {
    const fs = genus2("a -> a b, b -> b a b");
    return { fs, K: new Set([edge(fs, "a"), edge(fs, "b")]) };
  };

  it("offers the invariant subgraph and its complement", () => {
    const { fs, K } = make();
    let offered: readonly ReductionPiece[] = [];
    reduce(fs, K, (pieces) => ((offered = pieces), pieces[0]!));
    expect(offered.map((p) => [p.kind, p.period])).toEqual(
      expect.arrayContaining([
        ["invariant subgraph", 1],
        ["complement", 1],
      ]),
    );
    expect(offered).toHaveLength(2);
  });

  it("reduces to the invariant subgraph", () => {
    const { fs, K } = make();
    reduce(fs, K, (pieces) => pieces.find((p) => p.kind === "invariant subgraph")!);
    expect(fs.graph.edges.map((e) => e.name).sort()).toEqual(["a", "b"]);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(perronFrobenius(fs, { essentialOnly: false }).growth).toBeCloseTo(
      ((1 + Math.sqrt(5)) / 2) ** 2,
      9,
    );
  });

  it("reduces to the complement, a torus with a peripheral circle where the map is the identity", () => {
    const { fs, K } = make();
    reduce(fs, K, complement);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.reductionCurves.map(String)).toEqual(["A b a B"]); // a b A B, seen from the other side
    expect(fs.graph.edgeCount - fs.graph.vertices.length).toBe(2); // χ = −2: the twice-punctured torus
    expect(fs.peripheral.size).toBe(4); // the copies of a, b on both sides
    expect(String(fs.g.image(edge(fs, "c").forward))).toBe("c");
    expect(String(fs.g.image(edge(fs, "d").forward))).toBe("d");
    runAlgorithm(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(finiteOrder(fs)).toBe(1);
  });

  it("reduces to a pair of pants around the rose of a twice-punctured torus", () => {
    // The example of port note 17: after absorbing, {a, b} is invariant and its boundary encloses both punctures.
    const fs = FibredSurface.fromText(
      [["a", "b", "A", "B", "s", "p", "S"], ["P"]],
      "a -> a b, b -> b a b, s -> a b A B s p, p -> p",
      ["p"],
    );
    runAlgorithm(fs); // absorbs, then stops at the reduction
    reduce(fs, new Set([edge(fs, "a"), edge(fs, "b")]), complement);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.graph.edgeCount - fs.graph.vertices.length).toBe(1); // χ = −1
    runAlgorithm(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(finiteOrder(fs)).toBeDefined();
  });

  describe("two handles swapped by g (genus 2, the handles at the two ends of a strip e)", () => {
    const make3 = () => {
      const fs = FibredSurface.fromText(
        [["a", "b", "A", "B", "e", "c", "d", "C", "D", "E"]],
        "a -> c, b -> d, c -> a b, d -> b a b, e -> E",
      );
      expect(fs.checkIntegrity()).toEqual([]);
      return { fs, K: new Set(["a", "b", "c", "d"].map((n) => edge(fs, n))) };
    };

    it("offers the two handles as one orbit of period 2", () => {
      const { fs, K } = make3();
      let offered: readonly ReductionPiece[] = [];
      reduce(fs, K, (pieces) => ((offered = pieces), pieces[0]!));
      expect(offered.map((p) => [p.kind, p.period]).sort()).toEqual([
        ["complement", 1],
        ["invariant subgraph", 2],
        ["invariant subgraph", 2],
      ]);
    });

    it("gives the first-return map g² on a handle", () => {
      const { fs, K } = make3();
      reduce(fs, K, (pieces) => pieces.find((p) => [...p.edges].some((e) => e.name === "a"))!);
      expect(fs.checkIntegrity()).toEqual([]);
      expect(String(fs.g.image(edge(fs, "a").forward))).toBe("a b");
      expect(perronFrobenius(fs, { essentialOnly: false }).growth).toBeCloseTo(
        ((1 + Math.sqrt(5)) / 2) ** 2,
        9,
      );
    });

    it("gives a map of finite order on the complement (a pair of pants)", () => {
      const { fs, K } = make3();
      reduce(fs, K, complement);
      expect(fs.checkIntegrity()).toEqual([]);
      expect(fs.reductionCurves).toHaveLength(2);
      runAlgorithm(fs);
      expect(fs.checkIntegrity()).toEqual([]);
      expect(finiteOrder(fs)).toBeDefined();
    });
  });
});
