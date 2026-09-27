/**
 * The example presets (the C# `MainMenu.InitializeExample`), as data: a model surface, how to name its spine, moves
 * to set up the graph, and the map. `buildPreset` turns one into a fibred surface.
 *
 * @module
 */
import type { FibredSurface } from "../fibred/fibred-surface";
import { renameStrip, updateMap, type MapUpdateMode } from "../fibred/map-editing";
import { applyMove, type Move } from "../fibred/move";
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
  /** The map, as one or several texts applied in order. */
  readonly maps: readonly { readonly text: string; readonly mode: MapUpdateMode }[];
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
  for (const { text, mode } of preset.maps) updateMap(fs, text, mode);
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
const replace = (text: string) => [{ text, mode: "replace" as const }];

/** The genus-2 setup of Bestvina–Handel's example 6.1 (c and d reversed and swapped, as in the paper). */
const bh61Options: FibredSurfaceOptions = { reversed: ["c", "d"], names: { c: "d", d: "c" } };

/** Dehn twists of the genus-2 surface in the names of the BH 6.1 setup (the C# list). */
export const GENUS_2_TWISTS = [
  "c -> c d",
  "c -> c D",
  "b -> a b",
  "b -> A b",
  "d -> C d",
  "d -> c d",
  "a -> a B",
  "a -> a b",
  "a -> c B a, d -> d C b",
  "a -> b C a, d -> d B c",
];

/** A random composition of `count` of the {@link GENUS_2_TWISTS}, reproducible from `seed`. */
export function randomGenus2(seed: number, count = 10): Preset {
  const random = mulberry32(seed);
  return {
    name: "Random mapping class in genus 2",
    description: `A composition of ${count} Dehn twists (seed ${seed}).`,
    model: polygon("a b A B c d C D"),
    options: bh61Options,
    maps: Array.from({ length: count }, () => ({
      text: GENUS_2_TWISTS[Math.floor(random() * GENUS_2_TWISTS.length)] as string,
      mode: "postcompose" as const,
    })),
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
    maps: replace("a -> a b, b -> b a b"),
  },
  {
    name: "Half twist",
    description: "The half twist on the torus with two punctures (C# layout with a split side, b reversed).",
    model: polygon("a c b C A B"),
    options: { reversed: ["b"] },
    maps: replace("a -> c A b c B"),
  },
  {
    name: "Reducible map",
    description:
      "The Anosov map on one handle and a Dehn twist on the other: reducible along the curve between the handles.",
    model: polygon("a b A B c d C D"),
    options: bh61Options,
    maps: replace("a -> a b, b -> b a b, c -> c d"),
  },
  {
    name: "Bestvina–Handel example 6.1",
    description: "A pseudo-Anosov map of the once-punctured genus-2 surface, from Bestvina–Handel's paper.",
    model: polygon("a b A B c d C D"),
    options: bh61Options,
    maps: replace("a -> a B A b D C A, b -> a c d B a b c d B, c -> c c d B, d -> b c d B"),
  },
  {
    name: "Bestvina–Handel example 6.2",
    description:
      "A map of the sphere with four punctures, three of them peripheral (α, β, γ), from Bestvina–Handel's paper.",
    model: polygon("a b c C B A"),
    options: { peripheral: 3 },
    setup: [{ kind: "collapse invariant subforest", strips: ["a"] }],
    renames: { c: "a", b: "c", β: "α", α: "β" },
    maps: replace("a -> β c γ C a, c -> β c γ C a α A c Γ C β c γ C a α A c Γ"),
  },
  {
    name: "Bestvina–Handel example 6.3",
    description:
      "A map of the sphere with five punctures: four points in the plane, a ↦ b ↦ c ↦ d ↦ A D C B.",
    model: {
      kind: "plane",
      name: "Plane, points on a line",
      description: "Four points on a line with lassos from a base point below.",
      points: [
        [-1.5, 0],
        [-0.5, 0],
        [0.5, 0],
        [1.5, 0],
      ],
      spine: "rose",
      basePoint: [0, -1],
    },
    maps: replace("a -> b, b -> c, c -> d, d -> A D C B"),
  },
  {
    name: "Point push",
    description: "A point push on the genus-2 surface, written with a named path ρ and conjugations.",
    model: pointPushModel,
    options: { reversed: ["a", "b"] },
    maps: replace(
      "ρ := D C d A b a B c\nd ↦ d ρ\nb ↦ a°Ρ b\nc ↦ c (d ρ C a)°ρ\na ↦ a (Ρ D c d ρ (C a )°ρ d ρ C a)°ρ",
    ),
  },
  {
    name: "Point push as a composition",
    description: "The same kind of point push as a composition of four pushes along α, γ, β̄, δ.",
    model: pointPushModel,
    options: { reversed: ["a", "b"] },
    maps: ["a ↦ b a B c D C d", "c ↦ d A b a B c D", "b ↦ a D c d C b A", "d ↦ C d A b a B c"].map(
      (text) => ({
        text,
        mode: "postcompose" as const,
      }),
    ),
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
    maps: replace("a -> a b, b -> b a b, s -> a b A B s p"),
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
    maps: replace("a -> c, b -> d, c -> a b, d -> b a b, e -> E"),
  },
];
