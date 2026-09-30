import { describe, expect, it } from "vitest";
import { FibredSurface } from "../fibred-surface";
import { perronFrobenius } from "../perron-frobenius";
import { absorbIntoPeriphery, needsAbsorbing } from "./absorb-periphery";

const imageOf = (fs: FibredSurface, name: string) =>
  String(fs.g.image(fs.graph.edges.find((e) => e.name === name)!.forward));

describe("absorbIntoPeriphery", () => {
  // A twice-punctured torus: the rose a, b, a stem s to the peripheral loop p around one puncture (the face P).
  const stem = (map: string) =>
    FibredSurface.fromText([["a", "b", "A", "B", "s", "p", "S"], ["P"]], map, ["p"]);

  // A twist around the puncture, composed with pushing the rose's junction around the commutator (so that the stem
  // isn't part of an invariant forest).
  const twisted = "a -> a b, b -> b a b, s -> a b A B s p, p -> p";

  it("unwraps a stem that g twists around the puncture", () => {
    const fs = stem(twisted);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(needsAbsorbing(fs)).toBe(true);
    absorbIntoPeriphery(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(needsAbsorbing(fs)).toBe(false);
    expect(imageOf(fs, "s")).toBe("a b A B s");
    expect(fs.peripheral.size).toBe(1);
    const [circle] = fs.peripheral;
    expect(fs.g.image(circle!.forward).length).toBe(1);
  });

  it("does not change the growth", () => {
    const fs = stem(twisted);
    const before = perronFrobenius(fs, { essentialOnly: true }).growth;
    absorbIntoPeriphery(fs);
    expect(perronFrobenius(fs, { essentialOnly: true }).growth).toBeCloseTo(before, 9);
  });

  it("gives every gate its own junction (a collar twist with two strips at the circle)", () => {
    // The circle p1 p2 (counterclockwise) with the strips s (ending at its first junction) and t (leaving its second).
    const fs = FibredSurface.fromText(
      [
        ["a", "b", "A", "B", "s", "p1", "t"],
        ["T", "p2", "S"],
        ["P2", "P1"],
      ],
      "a -> a b, b -> b a b, s -> a b A B s p1 p2, t -> P1 P2 t b a B A, p1 -> p1, p2 -> p2",
      ["p1", "p2"],
    );
    expect(fs.checkIntegrity()).toEqual([]);
    absorbIntoPeriphery(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(needsAbsorbing(fs)).toBe(false);
    expect(imageOf(fs, "s")).toBe("a b A B s");
    expect(imageOf(fs, "t")).toBe("t b a B A");
    expect(fs.peripheral.size).toBe(2);
    for (const e of fs.peripheral) expect(String(fs.g.image(e.forward))).toBe(String(e.forward));
  });

  it("collapses a stem that is invariant and retracts to the periphery", () => {
    // g(s) = s p, so Q = P ∪ {s}: the rose's junction is pulled onto the circle and becomes the gate junction.
    const fs = stem("a -> a b, b -> b a b, s -> s p, p -> p");
    expect(needsAbsorbing(fs)).toBe(true);
    absorbIntoPeriphery(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.graph.edges.some((e) => e.name === "s")).toBe(false);
    expect(needsAbsorbing(fs)).toBe(false);
    // The four ends of a and b at the circle form three gates (Dg^∞: a, b and B, B), so the new circle has three
    // junctions, and g(a) walks along it between the gates of ā and b.
    expect(fs.peripheral.size).toBe(3);
    const a = fs.graph.edges.find((e) => e.name === "a")!;
    const outside = fs.g.image(a.forward).letters.filter((x) => !fs.peripheral.has(x.edge));
    expect(outside.map(String)).toEqual(["a", "b"]);
  });

  it("makes g an automorphism on P when it only wraps each circle once around its image", () => {
    // p ↦ p P p runs around the circle once in total (with backtracking): the weaker condition of periphery.ts.
    const fs = stem("a -> a b, b -> b a b, s -> a b A B s, p -> p P p");
    expect(fs.checkIntegrity()).toEqual([]);
    expect(needsAbsorbing(fs)).toBe(true);
    absorbIntoPeriphery(fs);
    expect(fs.checkIntegrity()).toEqual([]);
    for (const e of fs.peripheral) expect(fs.g.image(e.forward).length).toBe(1);
    expect(needsAbsorbing(fs)).toBe(false);
  });

  describe("names", () => {
    it("keeps the names, colours and orientations of a circle that keeps its junctions", () => {
      const fs = stem(twisted);
      const [before] = fs.peripheral;
      const { name, color } = before!;
      const junction = before!.source.name;
      absorbIntoPeriphery(fs);
      const [after] = fs.peripheral;
      expect([after!.name, after!.color, after!.source.name]).toEqual([name, color, junction]);

      const two = FibredSurface.fromText(
        [
          ["a", "b", "A", "B", "s", "p1", "t"],
          ["T", "p2", "S"],
          ["P2", "P1"],
        ],
        "a -> a b, b -> b a b, s -> a b A B s p1 p2, t -> P1 P2 t b a B A, p1 -> p1, p2 -> p2",
        ["p1", "p2"],
      );
      absorbIntoPeriphery(two);
      expect([...two.peripheral].map((e) => e.name).sort()).toEqual(["p1", "p2"]);
      expect(two.checkIntegrity()).toEqual([]);
    });

    it("gives a changed circle Greek names whose capitals don't look Latin", () => {
      const fs = stem("a -> a b, b -> b a b, s -> s p, p -> p"); // one junction on the circle becomes three
      absorbIntoPeriphery(fs);
      expect([...fs.peripheral].map((e) => e.name).sort()).toEqual(["γ", "δ", "θ"]);
    });
  });
});
