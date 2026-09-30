/**
 * The example presets (the C# `MainMenu.InitializeExample`), as data: a model surface, how to name its spine, moves
 * to set up the graph, and the map. `buildPreset` turns one into a fibred surface.
 *
 * @module
 */
import type { FibredSurface } from "../fibred/fibred-surface";
import { renameStrip, updateMap, type MapUpdateMode } from "../fibred/map-editing";
import { applyMove, type Move } from "../fibred/move";
import {
  type GeneratingSet,
  GENUS_2_GENERATORS,
  mapsAndInverses,
  namedMapsAndInverses,
  TORUS_2_GENERATORS,
} from "./generators";
import { type FibredSurfaceOptions, initialFibredSurface, type SurfaceModel } from "./models";

export interface Preset {
  readonly name: string;
  readonly description: string;
  readonly model: SurfaceModel;
  readonly options?: FibredSurfaceOptions;
  /** Moves applied before the map is set (e.g. collapsing a stem, as the paper's graph has none). */
  readonly setup?: readonly Move[];
  /** Strip names changed after the setup (applied at once, so swaps work). */
  readonly renames?: Readonly<Record<string, string>>;
  /** The map, as one or several texts applied in order, each with its name (composed into the name of g). */
  readonly maps: readonly { readonly text: string; readonly mode: MapUpdateMode; readonly name?: string }[];
  /** Generators of the mapping class group in the strips of the starting graph, suggested in the map editor. */
  readonly generators?: GeneratingSet;
}

/** Builds the fibred surface of a preset. */
export function buildPreset(preset: Preset): FibredSurface {
  const fs = initialFibredSurface(preset.model, preset.options);
  for (const move of preset.setup ?? []) applyMove(fs, move);
  const renames = Object.entries(preset.renames ?? {});
  const edges = renames.map(([from]) => {
    const e = fs.graph.edges.find((x) => x.name === from);
    if (e === undefined) throw new Error(`The preset renames ${from}, which doesn't exist`);
    return e;
  });
  edges.forEach((e, i) => (e.name = `__${i}`)); // free the names first
  edges.forEach((e, i) => renameStrip(fs, e, (renames[i] as [string, string])[1]));
  for (const { text, mode, name } of preset.maps) updateMap(fs, text, mode, name);
  return fs;
}

const polygon = (word: string, closed = false): SurfaceModel => ({
  kind: "polygon",
  name: word,
  description: `The polygon ${word}`,
  word: word.split(" "),
  geometry: closed ? { kind: "compact" } : { kind: "ideal" },
  closed,
});
const replace = (text: string, name: string) => [{ text, mode: "replace" as const, name }];

/** The genus-2 setup of Bestvina–Handel's example 6.1 (c and d reversed and swapped, as in the paper). */
const bh61Options: FibredSurfaceOptions = { reversed: ["c", "d"], names: { c: "d", d: "c" } };

/** Dehn twists of the genus-2 surface in the names of the BH 6.1 setup and their inverses (the C# list). */
export const GENUS_2_TWISTS = mapsAndInverses(GENUS_2_GENERATORS);

/** A random composition of `count` of the {@link GENUS_2_TWISTS}, reproducible from `seed`. */
export function randomGenus2(seed: number, count = 10): Preset {
  return randomComposition(
    {
      name: "Random mapping class in genus 2",
      description: `A composition of ${count} Dehn twists (seed ${seed}).`,
      model: polygon("a b A B c d C D"),
      options: bh61Options,
      generators: GENUS_2_GENERATORS,
    },
    seed,
    count,
  );
}

/** The twice-punctured torus of the half twist (the polygon a c b C A B with a split side, b reversed). */
const twicePuncturedTorus = (): Pick<Preset, "model" | "options"> => ({
  model: polygon("a c b C A B"),
  options: { reversed: ["b"] },
});

/** A random composition of `count` of the {@link TORUS_2_GENERATORS} and their inverses, reproducible from `seed`. */
export function randomTorus2(seed: number, count = 10): Preset {
  return randomComposition(
    {
      name: "Random mapping class of the twice-punctured torus",
      description: `A composition of ${count} of the half twist h, the Dehn twists D_a, D_c, D_b and their inverses (seed ${seed}).`,
      ...twicePuncturedTorus(),
      generators: TORUS_2_GENERATORS,
    },
    seed,
    count,
  );
}

/** The presets drawn at random, by name: they take a seed. */
export const RANDOM_PRESETS: Readonly<Record<string, (seed: number) => Preset>> = {
  "Random mapping class in genus 2": randomGenus2,
  "Random mapping class of the twice-punctured torus": randomTorus2,
};

/** A preset composing `count` maps (or inverses) drawn from its generators; g is named by the composition. */
function randomComposition(preset: Omit<Preset, "maps">, seed: number, count: number): Preset {
  const random = mulberry32(seed);
  const maps = namedMapsAndInverses(preset.generators as GeneratingSet);
  return {
    ...preset,
    maps: Array.from({ length: count }, () => {
      const { map, name } = maps[Math.floor(random() * maps.length)] as { map: string; name: string };
      return { text: map, mode: "postcompose" as const, name };
    }),
  };
}

/** A small seeded pseudo-random generator. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pointPushModel = polygon("a b A B c d C D");

export const PRESETS: readonly Preset[] = [
  {
    name: "Anosov map of the torus",
    description: "a ↦ a b, b ↦ b a b on the once-punctured torus: pseudo-Anosov with λ = φ² ≈ 2.618.",
    model: polygon("a b A B"),
    maps: replace("a -> a b, b -> b a b", "Anosov map"),
  },
  randomTorus2(1),
  {
    name: "Reducible map",
    description:
      "The Anosov map on one handle and a Dehn twist on the other: reducible along the curve between the handles.",
    model: polygon("a b A B c d C D"),
    maps: replace("a -> a B, b -> b A b, c -> c d", "Anosov map ⊔ Dehn twist"),
  },
  {
    name: "Bestvina–Handel example 6.1",
    description: "A pseudo-Anosov map of the once-punctured genus-2 surface, from Bestvina–Handel's paper.",
    model: polygon("a b A B c d C D"),
    options: bh61Options,
    maps: replace("a -> a B A b D C A, b -> a c d B a b c d B, c -> c c d B, d -> b c d B", "BH 6.1"),
    generators: GENUS_2_GENERATORS,
  },
  {
    name: "Bestvina–Handel example 6.2",
    description:
      "A map of the sphere with four punctures, three of them peripheral (α, β, γ), from Bestvina–Handel's paper.",
    model: polygon("a b c C B A"),
    options: { peripheral: 3 },
    setup: [{ kind: "collapse invariant subforest", strips: ["a"] }],
    renames: { b: "a", γ: "α", α: "β", β: "γ" },
    maps: replace("a -> β c γ C a, c -> β c γ C a α A c Γ C β c γ C a α A c Γ", "BH 6.2"),
  },
  {
    name: "Bestvina–Handel example 6.3",
    description:
      "A map of the sphere with five punctures: four points in the plane, a ↦ b ↦ c ↦ d ↦ A D C B.",
    model: {
      kind: "plane",
      name: "Plane, points on a line",
      description: "Four points on a line with lassos from a base point above.",
      points: [
        [-1.5, 0],
        [-0.5, 0],
        [0.5, 0],
        [1.5, 0],
      ],
      spine: "rose",
      basePoint: [0, 1],
    },
    maps: replace("a -> b, b -> c, c -> d, d -> A D C B", "BH 6.3"),
  },
  {
    name: "Point push",
    description: "A point push on the genus-2 surface, written with a named path ρ and conjugations.",
    model: pointPushModel,
    options: { reversed: ["a", "b"] },
    maps: replace(
      "ρ := D C d A b a B c\nd ↦ d ρ\nb ↦ a°Ρ b\nc ↦ c (d ρ C a)°ρ\na ↦ a (Ρ D c d ρ (C a )°ρ d ρ C a)°ρ",
      "push along ρ",
    ),
  },
  {
    name: "Point push as a composition",
    description: "The same kind of point push as a composition of four pushes along α, γ, β̄, δ.",
    model: pointPushModel,
    options: { reversed: ["a", "b"] },
    maps: [
      { text: "a ↦ b a B c D C d", name: "P_α" },
      { text: "c ↦ d A b a B c D", name: "P_γ" },
      { text: "b ↦ a D c d C b A", name: "P_β̄" },
      { text: "d ↦ C d A b a B c", name: "P_δ" },
    ].map((map) => ({ ...map, mode: "postcompose" as const })),
  },
  randomGenus2(1),
  {
    name: "Closed genus 2",
    description:
      "A pseudo-Anosov map of the closed genus-2 surface, given on the surface punctured once; τ has one cusp at the puncture, so the closed-surface move is needed. Example by the author.",
    model: {
      kind: "ribbon",
      name: "Ribbon graph",
      description:
        "The fibred surface of the ribbon graph with boundary word c x B y k a z Y K Z d C X D A b.",
      boundaryWords: ["c x B y k a z Y K Z d C X D A b".split(" ")],
      closed: true,
    },
    maps: replace(
      "b -> K Y b X C B y Z d x c, z -> Z d C X D, x -> B y Z d, d -> Y b X C, c -> x c x, k -> z Y, y -> a, a -> K",
      "closed genus-2 map",
    ),
  },
  {
    name: "Twisted stem",
    description:
      "A twice-punctured torus with a peripheral loop p; the stem s winds around p, which absorbing into the periphery undoes.",
    model: {
      kind: "ribbon",
      name: "Ribbon graph",
      description: "A rose with a stem to a peripheral loop.",
      boundaryWords: ["a b A B s p S".split(" "), ["P"]],
    },
    options: { peripheralStrips: ["p"] },
    maps: replace("a -> a b, b -> b a b, s -> a b A B s p", "Anosov map, twisted stem"),
  },
  {
    name: "Swapped handles",
    description: "Two handles at the ends of a strip e, swapped by g; g² is the Anosov map on each handle.",
    model: {
      kind: "ribbon",
      name: "Ribbon graph",
      description: "Two roses joined by a strip.",
      boundaryWords: ["a b A B e c d C D E".split(" ")],
    },
    maps: replace("a -> c, b -> d, c -> a b, d -> b a b, e -> E", "handle swap"),
  },
];

/**
 * Presets that are no longer offered but can still be started by name (saved sessions and links refer to them).
 * The half twist is one of the generators of the random mapping class of the twice-punctured torus.
 */
export const LEGACY_PRESETS: readonly Preset[] = [
  {
    name: "Half twist",
    description: "The half twist on the torus with two punctures (C# layout with a split side, b reversed).",
    ...twicePuncturedTorus(),
    maps: replace("a -> c A b c B", "h"),
    generators: TORUS_2_GENERATORS,
  },
];

/** The preset a session starts from, by name (and seed for the random ones). */
export function presetNamed(name: string, seed = 1): Preset | undefined {
  const random = RANDOM_PRESETS[name];
  if (random !== undefined) return random(seed);
  return PRESETS.find((p) => p.name === name) ?? LEGACY_PRESETS.find((p) => p.name === name);
}
