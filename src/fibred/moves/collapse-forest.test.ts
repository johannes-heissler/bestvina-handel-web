import { describe, expect, it } from "vitest";
import { FibredSurface } from "../fibred-surface";
import {
  candidateCenters,
  collapseSubforest,
  invariantSubforests,
  isPeripheryFriendlyForest,
  orbitOfEdge,
} from "./collapse-forest";

const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;
const images = (fs: FibredSurface, map: "g" | "mu" = "g") =>
  fs.graph.edges.map((e) => `${e}:${String(fs[map].image(e.forward))}`).join(", ");

// The torus rose with a = x y subdivided at the junction m (x: v → m, y: m → v).
const subdivided = (map: string, peripheral: string[] = []) =>
  FibredSurface.fromText([["x", "y", "b", "Y", "X", "B"]], map, peripheral);

describe("finding invariant subforests", () => {
  it("computes orbits of edges", () => {
    const fs = subdivided("x -> x y, y -> b, b -> b x y b");
    expect([...orbitOfEdge(fs, edge(fs, "y"))].map(String).sort()).toEqual(["b", "x", "y"]);
  });

  it("finds the invariant forest {y} when g(y) is a point", () => {
    // g(y) is empty and m ↦ v, so g(a) = g(x y) = x y.
    const fs = subdivided("x -> x y, y -> , b -> b x y b");
    expect(fs.checkIntegrity()).toEqual([]);
    expect(invariantSubforests(fs).map((f) => [...f].map(String))).toEqual([["y"]]);
  });

  it("finds none for the plain torus map", () => {
    expect(
      invariantSubforests(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b")),
    ).toEqual([]);
  });

  it("checks periphery-friendliness", () => {
    const fs = subdivided("x -> x y, y -> , b -> b x y b", ["b"]);
    const y = edge(fs, "y");
    expect(isPeripheryFriendlyForest(fs, [y])).toBe(true); // only v touches P = {b}
    expect(isPeripheryFriendlyForest(fs, [y], { touching: true })).toBe(true);
    expect(isPeripheryFriendlyForest(fs, [y], { periphery: new Set([edge(fs, "x")]) })).toBe(false); // x touches v and m
    expect(isPeripheryFriendlyForest(fs, [edge(fs, "b")])).toBe(false); // a loop is no forest
  });
});

describe("collapseSubforest", () => {
  it("collapses an invariant forest", () => {
    const fs = subdivided("x -> x y, y -> , b -> b x y b");
    const y = edge(fs, "y");
    const [v, m] = [y.target, y.source];
    expect(candidateCenters(fs, new Set([v, m]))).toEqual([v, m]);
    collapseSubforest(fs, new Set([y]));
    expect(fs.graph.vertices).toEqual([v]);
    expect(images(fs)).toBe("x:x, b:b x b");
    expect(images(fs, "mu")).toBe("x:x y, b:b"); // x now runs along x y = a
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("collapses towards a chosen centre", () => {
    const fs = subdivided("x -> x y, y -> , b -> b x y b");
    const y = edge(fs, "y");
    collapseSubforest(fs, new Set([y]), (candidates) => candidates[1]!); // towards m
    expect(fs.graph.vertices).toEqual([y.source]);
    expect(images(fs)).toBe("x:x, b:b x b");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("also collapses a non-invariant forest, like removing a valence-2 junction", () => {
    const fs = subdivided("x -> x y, y -> b, b -> b x y b");
    collapseSubforest(fs, new Set([edge(fs, "y")]));
    // The same result as removeValenceTwoJunction(y): a ↦ ab, b ↦ bab.
    expect(images(fs)).toBe("x:x b, b:b x b");
    expect(images(fs, "mu")).toBe("x:x y, b:b");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("rejects edges that are not a forest", () => {
    const fs = subdivided("x -> x y, y -> , b -> b x y b");
    expect(() => collapseSubforest(fs, new Set([edge(fs, "b")]))).toThrow(/don't form a forest/);
  });
});
