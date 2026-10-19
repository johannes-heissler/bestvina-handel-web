import { describe, expect, it } from "vitest";
import { FibredSurface } from "../fibred-surface";
import { narrated } from "../narration";
import { plainText } from "../suggestions";
import {
  mergeValenceTwoLine,
  removeValenceOneJunction,
  removeValenceTwoJunction,
  valenceOneJunctions,
  valenceTwoJunctions,
  valenceTwoLines,
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
    expect(valenceTwoLines(fs)).toEqual([]);
  });
});

describe("valence-2 lines (port note 28)", () => {
  // The torus rose with a = x y z subdivided twice, and a ↦ ab, b ↦ bab: g(x) = x, g(y) = y z, g(z) = b.
  const make = () =>
    FibredSurface.fromText(
      [["x", "y", "z", "b", "Z", "Y", "X", "B"]],
      "x -> x, y -> y z, z -> b, b -> b x y z b",
    );
  const lineOf = (fs: FibredSurface) => {
    const [line, ...others] = valenceTwoLines(fs);
    expect(others).toEqual([]);
    return line!;
  };

  it("finds the line through both subdivision junctions", () => {
    const fs = make();
    expect(fs.checkIntegrity()).toEqual([]);
    const line = lineOf(fs);
    expect([
      ["x", "y", "z"],
      ["Z", "Y", "X"],
    ]).toContainEqual(line.strips.map((x) => x.name));
    expect(new Set(line.inner)).toEqual(new Set(valenceTwoJunctions(fs)));
  });

  it("merges it into the kept strip, as removing its junctions one by one does", () => {
    const merged = make();
    const { steps } = narrated(() => mergeValenceTwoLine(merged, lineOf(merged), edge(merged, "y")));
    expect(steps.map(plainText)).toEqual([
      expect.stringMatching(
        /^Merge the valence-2 line (x y z|Z Y X) from p to p into one strip y: its image is /,
      ),
    ]);
    const single = make();
    const [m1, m2] = [edge(single, "x").target, edge(single, "y").target];
    removeValenceTwoJunction(single, m1, edge(single, "x").backward);
    removeValenceTwoJunction(single, m2, edge(single, "z").forward);
    for (const fs of [merged, single]) {
      expect(fs.graph.edges.map(String)).toEqual(["y", "b"]);
      expect(images(fs)).toBe("y:y b, b:b y b");
      expect(images(fs, "mu")).toBe("y:x y z, b:b");
      expect(fs.checkIntegrity()).toEqual([]);
    }
    expect(merged.graph.boundaryWords().map(String)).toEqual(single.graph.boundaryWords().map(String));
  });

  it("keeps the narrowest strip by default", () => {
    const fs = make();
    mergeValenceTwoLine(fs, lineOf(fs));
    expect(fs.graph.edgeCount).toBe(2);
    expect(valenceTwoLines(fs)).toEqual([]);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("says where the junction images inside the line go", () => {
    // The same map, conjugated by the path x y: g maps the junction p to the junction between y and z.
    const fs = FibredSurface.fromText(
      [["x", "y", "z", "b", "Z", "Y", "X", "B"]],
      "x -> z, y -> b, z -> x y, b -> Y X b x y z b x y",
    );
    expect(fs.checkIntegrity()).toEqual([]);
    const { steps } = narrated(() => mergeValenceTwoLine(fs, lineOf(fs), edge(fs, "z")));
    expect(steps.map(plainText)[0]).toMatch(
      /The junction images inside go to the ends: g\(\w+\) moves from \w+ to p\.$/,
    );
    expect(fs.checkIntegrity()).toEqual([]);
  });
});
