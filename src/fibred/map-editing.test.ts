import { describe, expect, it } from "vitest";
import { FibredSurface } from "./fibred-surface";
import { composeMapNames, invertStrip, renameJunction, renameStrip, updateMap } from "./map-editing";
import { applyMove } from "./move";

const torus = (map = "") => FibredSurface.fromText([["a", "b", "A", "B"]], map);
const images = (fs: FibredSurface) =>
  fs.graph.edges.map((e) => `${e.name}↦${fs.g.image(e.forward)}`).join(", ");
const edge = (fs: FibredSurface, name: string) => fs.graph.edges.find((e) => e.name === name)!;

describe("the name of g", () => {
  it("composes names; the identity drops out, and names with spaces get parentheses", () => {
    expect(composeMapNames("D_a", "h")).toBe("D_a ∘ h");
    expect(composeMapNames("id", "h")).toBe("h");
    expect(composeMapNames("D_b ∘ D_a", "h")).toBe("D_b ∘ D_a ∘ h");
    expect(composeMapNames("D_a", "Anosov map")).toBe("D_a ∘ (Anosov map)");
  });

  it("follows editing the map; a map without a name makes g unnamed", () => {
    const fs = torus("a -> a b");
    updateMap(fs, "a -> a b", "replace", "f");
    updateMap(fs, "b -> b a", "postcompose", "t");
    expect(fs.mapName).toBe("t ∘ f");
    updateMap(fs, "b -> b A", "precompose", "t⁻¹");
    expect(fs.mapName).toBe("t ∘ f ∘ t⁻¹");
    updateMap(fs, "b -> b a", "postcompose");
    expect(fs.mapName).toBeUndefined();
    updateMap(fs, "b -> b a", "postcompose", "t"); // still unknown
    expect(fs.mapName).toBeUndefined();
  });

  it("can be renamed by a move, and copies keep it", () => {
    const fs = torus("a -> a b");
    applyMove(fs, { kind: "rename map", name: "f" });
    expect(fs.copy().mapName).toBe("f");
    applyMove(fs, { kind: "rename map" });
    expect(fs.mapName).toBeUndefined();
  });
});

describe("updateMap", () => {
  it("replaces g; unmentioned strips are fixed", () => {
    const fs = torus("a -> a b, b -> b a b");
    updateMap(fs, "a -> a b");
    expect(images(fs)).toBe("a↦a b, b↦b");
  });

  it("composes after and before g", () => {
    const post = torus("a -> a b");
    updateMap(post, "b -> b a", "postcompose"); // h ∘ g: a ↦ h(a b) = a b a
    expect(images(post)).toBe("a↦a b a, b↦b a");
    const pre = torus("a -> a b");
    updateMap(pre, "b -> b a", "precompose"); // g ∘ h: b ↦ g(b a) = b a b
    expect(images(pre)).toBe("a↦a b, b↦b a b");
    expect(post.checkIntegrity()).toEqual([]);
    expect(pre.checkIntegrity()).toEqual([]);
  });

  it("understands named paths and conjugation", () => {
    const fs = torus();
    updateMap(fs, "x := a b\na -> x a X");
    expect(images(fs)).toBe("a↦a b a B A, b↦b");
  });
});

describe("renaming and inverting", () => {
  it("inverts a strip, rewriting every image and μ", () => {
    const fs = torus("a -> a b, b -> b a b");
    invertStrip(fs, edge(fs, "a"));
    expect(images(fs)).toBe("a↦B a, b↦b A b"); // the old a is the new A
    expect(String(fs.mu.image(edge(fs, "a").forward))).toBe("A");
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("renames, and an uppercase name inverts", () => {
    const fs = torus("a -> a b, b -> b a b");
    renameStrip(fs, edge(fs, "b"), "x");
    expect(images(fs)).toBe("a↦a x, x↦x a x");
    renameStrip(fs, edge(fs, "x"), "Y");
    expect(images(fs)).toBe("a↦a Y, y↦y A y");
    expect(() => renameStrip(fs, edge(fs, "y"), "A")).toThrow(/already/);
    expect(fs.checkIntegrity()).toEqual([]);
  });

  it("renames junctions", () => {
    const fs = torus();
    renameJunction(fs, fs.graph.vertices[0]!, "o");
    expect(fs.graph.vertices[0]!.name).toBe("o");
  });
});
