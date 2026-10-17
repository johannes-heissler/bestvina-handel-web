import { describe, expect, it } from "vitest";
import { FibredSurface } from "../fibred/fibred-surface";
import { perronFrobenius } from "../fibred/perron-frobenius";
import { applyMove, type FollowUp } from "../fibred/move";
import { autopilot, DEFAULT_AUTOMATIC, nextSuggestion } from "../fibred/suggestions";
import { canonicalWord, gallery } from "./gallery";
import { initialFibredSurface, spineOf, topology, type SurfaceModel } from "./models";
import { buildPreset, presetNamed, PRESETS, randomGenus2, randomTorus2 } from "./presets";

const growth = (fs: FibredSurface) => perronFrobenius(fs, { essentialOnly: true }).growth;
const polygon = (word: string, closed = false): SurfaceModel => ({
  kind: "polygon",
  name: word,
  description: "",
  word: word.split(" "),
  geometry: { kind: "ideal" },
  closed,
});

describe("names of the maps", () => {
  it("every preset names its map", () => {
    for (const preset of PRESETS) expect(buildPreset(preset).mapName, preset.name).toBeTruthy();
  });

  it("names a random mapping class by its composition, the first map applied rightmost", () => {
    const preset = randomTorus2(1, 3);
    const names = preset.maps.map((m) => m.name);
    expect(buildPreset(preset).mapName).toBe(names.reverse().join(" ∘ "));
    expect(names.every((n) => /^(h|D_[abc])(⁻¹)?$/.test(n ?? ""))).toBe(true);
  });

  it("names the point push composition", () => {
    const preset = presetNamed("Point push as a composition");
    expect(preset && buildPreset(preset).mapName).toBe("P_δ ∘ P_β̄ ∘ P_γ ∘ P_α");
  });
});

describe("models", () => {
  it("reads genus and punctures off G₀", () => {
    expect(topology(polygon("a b A B"))).toEqual({ genus: 1, punctures: 1 });
    expect(topology(polygon("a b A B c d C D", true))).toEqual({ genus: 2, punctures: 0 });
    expect(topology(polygon("a c b C A B"))).toEqual({ genus: 1, punctures: 2 }); // a split side
    expect(topology(polygon("a b c B d A D C"))).toEqual({ genus: 2, punctures: 1 }); // the L
    expect(
      topology({
        kind: "plane",
        name: "",
        description: "",
        points: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        spine: "comb",
        basePoint: [0, -1],
      }),
    ).toEqual({ genus: 0, punctures: 4 });
  });

  it("has the polygon word as the star of the dual rose, one side per edge end", () => {
    const spine = spineOf(polygon("a b A B"));
    expect(spine.graph.vertexCount).toBe(1);
    expect(spine.graph.star(spine.graph.vertices[0]!).map(String)).toEqual(["a", "b", "A", "B"]);
    expect(spine.sides!.map(String)).toEqual(["a", "b", "A", "B"]);
  });

  it("renames and reverses edges of G₀ (as for the names of a paper)", () => {
    const spine = spineOf(polygon("a b A B c d C D"), { reversed: ["c", "d"], names: { c: "d", d: "c" } });
    expect(spine.graph.star(spine.graph.vertices[0]!).map(String)).toEqual([
      "a",
      "b",
      "A",
      "B",
      "D",
      "C",
      "d",
      "c",
    ]);
    expect(() => spineOf(polygon("a b A B"), { names: { a: "b" } })).toThrow(/same name/);
  });

  it("adds peripheral lassos with a trivial stem and a loop around the puncture", () => {
    for (const model of [polygon("a b c C B A"), polygon("a b A B c C"), polygon("a c b C A B")])
      for (let P = 1; P < topology(model).punctures; P++) {
        const fs = initialFibredSurface(model, { peripheral: P });
        expect(fs.checkIntegrity()).toEqual([]);
        expect(fs.peripheral.size).toBe(P);
        expect(fs.graph.edgeCount).toBe(spineOf(model).graph.edgeCount + P); // each lasso: one strip less, stem and loop more
      }
  });

  it("marks closed surfaces", () => {
    expect(initialFibredSurface(polygon("a b A B c d C D", true)).isClosed).toBe(true);
    expect(() => initialFibredSurface(polygon("a b A B c d C D", true), { peripheral: 1 })).toThrow();
  });
});

describe("gallery", () => {
  it.each([
    [1, 1],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 3],
    [1, 3],
    [3, 2],
    [0, 4],
    [0, 5],
  ])("offers several models of genus %i with %i punctures, all with that topology", (g, p) => {
    const models = gallery(g, p);
    expect(models.length).toBeGreaterThanOrEqual(g === 1 && p <= 1 ? 1 : 2);
    for (const { model, naming } of models) {
      expect(topology(model)).toEqual({ genus: g, punctures: p });
      expect(initialFibredSurface(model, naming).checkIntegrity()).toEqual([]);
    }
  });

  it.each([
    [1, 2],
    [2, 0],
    [2, 3],
    [3, 2],
    [0, 5],
  ])(
    "shows each polygon of genus %i with %i punctures once, up to renaming and reorienting its sides",
    (g, p) => {
      const keys = gallery(g, p).map(({ model }) =>
        model.kind === "polygon" ? `${model.geometry.kind} ${canonicalWord(model.word)}` : model.name,
      );
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it("compares polygon words up to rotation and renaming and reorienting the sides", () => {
    const same = (x: string, y: string) => canonicalWord(x.split(" ")) === canonicalWord(y.split(" "));
    expect(same("a c b C A B", "a b c B A C")).toBe(true); // b and c swapped
    expect(same("a b A B", "B a b A")).toBe(true); // rotated
    expect(same("a b A B", "a B A b")).toBe(true); // b reversed
    expect(same("a b A B c C", "a b c B A C")).toBe(false);
  });

  it("offers the twice-punctured torus of the examples, which the split sides would only repeat", () => {
    const models = gallery(1, 2);
    expect(models.map((m) => m.model.name)).toEqual([
      "Standard polygon",
      "Split side (examples)",
      "Punctures inside",
      "All punctures inside",
    ]);
    const examples = presetNamed("Half twist")!;
    expect(models[1]!.model).toBe(examples.model);
    expect(models[1]!.naming).toEqual(examples.options);
  });

  it("includes the L-shaped surface and the punctured plane", () => {
    expect(gallery(2, 1).map((m) => m.model.name)).toContain("L-shaped surface");
    expect(gallery(0, 4).filter((m) => m.model.kind === "plane")).toHaveLength(3);
  });

  it("refuses surfaces with χ ≥ 0", () => {
    expect(() => gallery(0, 2)).toThrow();
    expect(() => gallery(1, 0)).not.toThrow(); // punctured once for the algorithm
  });
});

describe("presets", () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))("%s is a valid fibred surface", (_, preset) => {
    expect(buildPreset(preset).checkIntegrity()).toEqual([]);
  });

  it("reproduces the growth rates of the examples", () => {
    const byName = (name: string) => buildPreset(PRESETS.find((p) => p.name === name)!);
    expect(growth(byName("Anosov map of the torus"))).toBeCloseTo(((1 + Math.sqrt(5)) / 2) ** 2, 9);
    expect(nextSuggestion(byName("Reducible map")).kind).not.toBe("finished");
  });

  it("gives the same result for both descriptions of the point push", () => {
    const [named, composed] = ["Point push", "Point push as a composition"].map(
      (name) => autopilot(buildPreset(PRESETS.find((p) => p.name === name)!)).surface,
    );
    expect(growth(named!)).toBeCloseTo(growth(composed!), 6);
    expect(growth(named!)).toBeCloseTo(22.5364, 3);
  });

  it("finds the half twist composition pseudo-Anosov, folding initial segments of a", () => {
    let fs = buildPreset(presetNamed("Pseudo-Anosov map of the twice-punctured torus")!);
    expect(fs.mapName).toBe("D_a⁻¹ ∘ D_b⁻¹ ∘ D_a⁻¹ ∘ D_a⁻¹ ∘ h");
    // Fold by fold (the default options), as in the panel, recording the strip ends of each fold.
    const folded: string[][] = [];
    let followUp: FollowUp | undefined;
    let suggestion = nextSuggestion(fs);
    while (DEFAULT_AUTOMATIC.has(suggestion.kind)) {
      const move = suggestion.options[0]!.move;
      if (move.kind === "fold") folded.push([...move.strips]);
      fs = applyMove(fs, move, { followUp: (point) => (followUp = point) });
      suggestion = nextSuggestion(fs, { followUp });
    }
    expect(suggestion.classification).toMatchObject({ kind: "pseudo-Anosov" });
    expect(growth(fs)).toBeCloseTo(((1 + Math.sqrt(5)) / 2) ** 2, 9);
    expect(folded).toHaveLength(2);
    expect(folded.every((strips) => strips[0] === "a")).toBe(true);
  });

  it("builds random genus-2 maps reproducibly", () => {
    const a = buildPreset(randomGenus2(7));
    expect(a.checkIntegrity()).toEqual([]);
    expect(a.toString()).toBe(buildPreset(randomGenus2(7)).toString());
  });
});
