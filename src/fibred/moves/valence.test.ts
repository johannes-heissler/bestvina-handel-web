import { describe, expect, it } from "vitest";
import { FibredSurface } from "../fibred-surface";
import {
  removeValenceOneJunction,
  removeValenceTwoJunction,
  valenceOneJunctions,
  valenceTwoJunctions,
} from "./valence";

const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;
const images = (fs: FibredSurface, map: "g" | "mu" = "g") =>
  fs.graph.edges.map((e) => `${e}:${String(fs[map].image(e.forward))}`).join(", ");

describe("removeValenceOneJunction", () => {
  // The once-punctured torus with a pendant strip s; g(a) = a s S b backtracks into s.
  const make = () => FibredSurface.fromText([["a", "b", "A", "B", "s", "S"]], "a -> a s S b, b -> b");

  it("finds the valence-1 junction", () => {
    const fs = make();
    expect(fs.checkIntegrity()).toEqual([]);
    expect(valenceOneJunctions(fs)).toEqual([edge(fs, "s").target]);
  });

  it("collapses the pendant strip and deletes it from the images", () => {
    const fs = make();
    removeValenceOneJunction(fs, valenceOneJunctions(fs)[0]!);
    expect(fs.graph.vertexCount).toBe(1);
    expect(images(fs)).toBe("a:a b, b:b");
    expect(images(fs, "mu")).toBe("a:a, b:b"); // μ is unchanged
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("rejects junctions of other valence", () => {
    const fs = make();
    expect(() => removeValenceOneJunction(fs, edge(fs, "a").source)).toThrow(/valence 5/);
  });
});

describe("removeValenceTwoJunction", () => {
  // The torus rose with a = x y subdivided at the junction m, and the Anosov map a ↦ ab, b ↦ bab:
  // g(x) = x y, g(y) = b, g(b) = b x y b, with m mapped to the main junction.
  const make = () =>
    FibredSurface.fromText([["x", "y", "b", "Y", "X", "B"]], "x -> x y, y -> b, b -> b x y b");

  it("finds the subdivision junction", () => {
    const fs = make();
    expect(fs.checkIntegrity()).toEqual([]);
    expect(valenceTwoJunctions(fs)).toEqual([edge(fs, "x").target]);
  });

  it("merges x and y back into one strip, updating g and μ", () => {
    const fs = make();
    const m = valenceTwoJunctions(fs)[0]!;
    removeValenceTwoJunction(fs, m, edge(fs, "y").forward);
    // x now runs along x y = a, and g is a ↦ a b, b ↦ b a b again.
    expect(fs.graph.edges.map(String)).toEqual(["x", "b"]);
    expect(images(fs)).toBe("x:x b, b:b x b");
    expect(images(fs, "mu")).toBe("x:x y, b:b"); // μ(x′) = μ(x y), in the letters of G₀
    expect(fs.checkIntegrity()).toEqual([]);
    expect(fs.graph.vertexCount).toBe(1);
  });

  it("can remove the other strip instead", () => {
    const fs = make();
    removeValenceTwoJunction(fs, valenceTwoJunctions(fs)[0]!, edge(fs, "x").backward);
    expect(fs.graph.edges.map(String)).toEqual(["y", "b"]);
    expect(images(fs, "mu")).toBe("y:x y, b:b");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("chooses a strip by itself", () => {
    const fs = make();
    removeValenceTwoJunction(fs, valenceTwoJunctions(fs)[0]!);
    expect(fs.graph.edgeCount).toBe(2);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("keeps a peripheral strip peripheral (C# replaced it by a new strip outside P)", () => {
    const fs = FibredSurface.fromText([["x", "y", "b", "Y", "X", "B"]], "x -> x y, y -> b, b -> b x y b", [
      "x",
    ]);
    removeValenceTwoJunction(fs, valenceTwoJunctions(fs)[0]!, edge(fs, "y").forward);
    expect([...fs.peripheral].map(String)).toEqual(["x"]);
  });

  it("rejects a junction that only has a loop", () => {
    const fs = FibredSurface.fromText([["a"], ["A"]], "a -> a"); // an annulus: one loop
    expect(() => removeValenceTwoJunction(fs, fs.graph.vertices[0]!)).toThrow(/only has the loop/);
    expect(valenceTwoJunctions(fs)).toEqual([]);
  });
});
