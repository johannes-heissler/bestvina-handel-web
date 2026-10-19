/**
 * The gallery: several model surfaces for the same genus and number of punctures (your request: different orders of the
 * sides, different places for the punctures, flat models like the L, the punctured plane). Not all of them are
 * isomorphic as ribbon graphs, so they give different G₀ and different starting points for the algorithm.
 *
 * @module
 */
import { EDGE_NAMES } from "../graph/names";
import {
  polygonCorners,
  topology,
  type Point2,
  type PolygonGeometry,
  type PolygonModel,
  type SpineNames,
  type SurfaceModel,
} from "./models";

/** A model of the gallery, with the names and orientations of the edges of G₀ it starts with. */
export interface GalleryEntry {
  readonly model: SurfaceModel;
  readonly naming?: SpineNames;
}

/**
 * The twice-punctured torus of the examples (the half twist and the random mapping class): the polygon a c b C A B
 * with b reversed, the C# layout with a split side. The generators of its mapping class group are written in these
 * names.
 */
export const TWICE_PUNCTURED_TORUS: Required<GalleryEntry> = {
  model: polygon(
    "Split side (examples)",
    "The setup of the twice-punctured torus examples: the polygon a c b C A B with b reversed (the C# layout).",
    "a c b C A B".split(" "),
    false,
  ),
  naming: { reversed: ["b"] },
};

/** Side labels in order of use: the edge names (a b c d x y z u h …, never e, f, g; port note 25). */
const LABELS = EDGE_NAMES;

/** Builds a word from pairs given as "x" (the pair x … X) with a function that places them. */
function upper(label: string): string {
  return label.toUpperCase();
}

/** a₁ b₁ A₁ B₁ ⋯ a_g b_g A_g B_g, using the next 2g labels. */
function commutators(genus: number, labels: string[]): string[][] {
  return Array.from({ length: genus }, () => {
    const [a, b] = [labels.shift() as string, labels.shift() as string];
    return [a, b, upper(a), upper(b)];
  });
}

/** A pair "x X" for each extra puncture (the two sides meet at a vertex of its own). */
function puncturePairs(count: number, labels: string[]): string[][] {
  return Array.from({ length: count }, () => {
    const x = labels.shift() as string;
    return [x, upper(x)];
  });
}

function polygon(
  name: string,
  description: string,
  word: string[],
  closed: boolean,
  geometry: PolygonGeometry = closed ? { kind: "compact" } : { kind: "ideal" },
  points?: readonly Point2[],
): SurfaceModel {
  return { kind: "polygon", name, description, word, geometry, closed, ...(points && { points }) };
}

/**
 * k points inside a polygon, in its chart coordinates: the centre for one, else a small circle around it (turned a
 * little, so that no point lies on a diagonal of a regular polygon).
 */
function interiorPoints(model: PolygonModel, k: number): Point2[] {
  const { vertices } = polygonCorners(model);
  const inradius = Math.min(...vertices.map((v) => v.abs())) * Math.cos(Math.PI / vertices.length);
  // The flat vertices are normalized into the chart; place the points in the given coordinates.
  const flat = model.geometry.kind === "flat" ? model.geometry.vertices : undefined;
  const xs = flat?.map(([x]) => x) ?? [0];
  const ys = flat?.map(([, y]) => y) ?? [0];
  const center: Point2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const r =
    flat === undefined
      ? 0.4 * inradius
      : 0.2 * Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (k === 1) return [center];
  return Array.from({ length: k }, (_, i): Point2 => {
    const phi = (2 * Math.PI * i) / k + 0.3;
    return [center[0] + r * Math.cos(phi), center[1] + r * Math.sin(phi)];
  });
}

/** The polygon with these punctures inside (port note 22). */
function withPoints(model: SurfaceModel, k: number, name: string, description: string): SurfaceModel {
  if (model.kind !== "polygon") throw new Error("Only polygons have interior points");
  return { ...model, name, description, points: interiorPoints(model, k) };
}

/**
 * The sides of the C# standard polygon: for each handle a ⋯ b ⋯ A ⋯ B ⋯, where the extra punctures are distributed
 * over the sides a, b of the handles by splitting a side a into a a′ and its partner into A′ A (the new vertex between
 * them is a puncture). `perSide` decides how many extra punctures each side gets.
 */
function splitSides(genus: number, extra: number, perSide: (side: number) => number): string[] {
  const labels = [...LABELS];
  const word: string[] = [];
  let remaining = extra;
  for (let h = 0; h < genus; h++) {
    const sides = [0, 1].map((k) => {
      const n = Math.min(perSide(2 * h + k), remaining);
      remaining -= n;
      return Array.from({ length: n + 1 }, () => labels.shift() as string);
    });
    const [a, b] = sides as [string[], string[]];
    word.push(...a, ...b, ...a.toReversed().map(upper), ...b.toReversed().map(upper));
  }
  return word;
}

/**
 * The models for a surface of genus g with p punctures (p = 0: closed), each checked to have that topology. Models
 * with the same geometry and the same spine up to renaming and reorienting its edges are shown once (the first).
 */
export function gallery(genus: number, punctures: number): GalleryEntry[] {
  if (genus < 0 || punctures < 0) throw new Error("Genus and punctures can't be negative");
  if (2 - 2 * genus - Math.max(punctures, 1) >= 0)
    throw new Error("The algorithm needs χ < 0 (after puncturing a closed surface once)");
  const closed = punctures === 0;
  const extra = Math.max(punctures, 1) - 1; // punctures beyond the one where all polygon vertices meet
  const models: SurfaceModel[] = [];

  if (genus === 0) {
    const n = punctures - 1; // points in the plane; ∞ is the last puncture
    const line = Array.from({ length: n }, (_, i): Point2 => [i - (n - 1) / 2, 0]);
    const circle = Array.from({ length: n }, (_, i): Point2 => [
      Math.cos((2 * Math.PI * i) / n + Math.PI / 2),
      Math.sin((2 * Math.PI * i) / n + Math.PI / 2),
    ]);
    models.push(
      {
        kind: "plane",
        name: "Plane, points on a line",
        description: `${n} points in the plane on a line, with a lasso around each from a base point above them.`,
        points: line,
        spine: "rose",
        basePoint: [0, 1],
      },
      {
        kind: "plane",
        name: "Plane, points on a circle",
        description: `${n} points on a circle, with lassos from its centre.`,
        points: circle,
        spine: "rose",
        basePoint: [0, 0],
      },
      {
        kind: "plane",
        name: "Plane, comb",
        description: `${n} points on a line, each with its own base point above it; the base points are joined from left to right.`,
        points: line,
        spine: "comb",
        basePoint: [0, 1],
      },
    );
    const labels = [...LABELS].slice(0, n);
    models.push(
      polygon(
        "Ideal polygon",
        `A symmetric ideal ${2 * n}-gon, as in C#: the sides ${labels.join(" ")} on the right, their partners on the left.`,
        [...labels, ...labels.toReversed().map(upper)],
        false,
      ),
    );
  } else {
    const std = [...commutators(genus, [...LABELS])].flat();
    const withPairsAtEnd = [...std, ...puncturePairs(extra, [...LABELS].slice(2 * genus)).flat()];
    const perHandle = (() => {
      const labels = [...LABELS];
      const handles = commutators(genus, labels);
      const pairs = puncturePairs(extra, labels);
      return handles.flatMap((h, i) => [...h, ...pairs.filter((_, k) => k % genus === i).flat()]);
    })();
    if (!(closed && genus === 1))
      // a closed torus has no hyperbolic metric; it is the flat square below
      models.push(
        polygon(
          "Standard polygon",
          closed
            ? `The ${4 * genus}-gon a b A B ⋯ with one vertex class (a marked point).`
            : `The ${std.length + 2 * extra}-gon a b A B ⋯ with the ${extra} extra punctures as pairs of adjacent sides at the end.`,
          withPairsAtEnd,
          closed,
        ),
      );
    if (extra > 1 && genus > 1)
      models.push(
        polygon(
          "Punctures between handles",
          "The extra punctures are spread between the handles.",
          perHandle,
          false,
        ),
      );
    if (genus === 1 && extra === 1) models.push(TWICE_PUNCTURED_TORUS.model); // the split sides below repeat it
    if (extra > 0) {
      const spread = Math.ceil(extra / (2 * genus));
      models.push(
        polygon(
          "Split sides (C#)",
          "The C# layout: the extra punctures split the sides of the handles, spread evenly.",
          splitSides(genus, extra, () => spread),
          false,
        ),
        polygon(
          "One split side",
          "All extra punctures split the first side.",
          splitSides(genus, extra, (side) => (side === 0 ? extra : 0)),
          false,
        ),
      );
    }
    if (genus >= 2) {
      const labels = [...LABELS].slice(0, 2 * genus);
      const opposite = [...labels, ...labels.map(upper)];
      models.push(
        polygon(
          "Opposite sides",
          `The ${4 * genus}-gon whose opposite sides are glued.`,
          [...opposite, ...puncturePairs(extra, [...LABELS].slice(2 * genus)).flat()],
          closed,
        ),
      );
    }
    if (extra === 0) models.push(...flatModels(genus, closed));
    // Punctures inside the polygon (port note 22): the extra ones in the ideal standard polygon, or all of them in the
    // closed polygon, whose vertex is then filled in.
    if (extra > 0)
      models.push(
        withPoints(
          polygon("", "", std, false),
          extra,
          "Punctures inside",
          `The ideal ${4 * genus}-gon a b A B ⋯ (its vertex is one puncture) with the ${extra} other punctures inside, cut into convex cells.`,
        ),
      );
    if (punctures > 0) {
      const closedModel =
        genus === 1
          ? (flatModels(1, true)[0] as SurfaceModel)
          : polygon("", "", std, true, { kind: "compact" });
      models.push(
        withPoints(
          closedModel,
          punctures,
          "All punctures inside",
          `The closed ${genus === 1 ? "square torus" : `${4 * genus}-gon`} with its vertex filled in and the ${punctures === 1 ? "puncture" : `${punctures} punctures`} inside.`,
        ),
      );
    }
  }
  const seen = new Set<string>();
  const named = [TWICE_PUNCTURED_TORUS];
  const entries = models.map((model): GalleryEntry => named.find((e) => e.model === model) ?? { model });
  return entries.filter(({ model }) => {
    const t = topology(model);
    const key = modelKey(model);
    if (t.genus !== genus || t.punctures !== punctures || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** What makes two models different: the geometry, and for a polygon its word up to rotation and renaming the sides. */
function modelKey(model: SurfaceModel): string {
  if (model.kind !== "polygon") return JSON.stringify(model);
  return JSON.stringify([model.geometry, model.closed, canonicalWord(model.word), model.points ?? []]);
}

/**
 * The smallest of the words obtained by rotating the word and renaming its sides in order of appearance, each side
 * oriented so that it appears first in lower case (so it doesn't matter how the sides are named and oriented).
 */
export function canonicalWord(word: readonly string[]): string {
  const rotations = word.map((_, r) => {
    const names = new Map<string, { name: string; flip: boolean }>();
    return [...word.slice(r), ...word.slice(0, r)]
      .map((side) => {
        const label = side.toLowerCase();
        const isLower = side === label;
        if (!names.has(label)) names.set(label, { name: LABELS[names.size] as string, flip: !isLower });
        const { name, flip } = names.get(label) as { name: string; flip: boolean };
        return isLower !== flip ? name : upper(name);
      })
      .join(" ");
  });
  return rotations.reduce((a, b) => (b < a ? b : a));
}

/** Flat (Euclidean) models with a single vertex class: the square torus, the L, the regular octagon. */
function flatModels(genus: number, closed: boolean): SurfaceModel[] {
  const flat = (name: string, description: string, word: string, vertices: Point2[]): SurfaceModel =>
    polygon(name, description, word.split(" "), closed, { kind: "flat", vertices });
  if (genus === 1)
    return [
      flat("Square torus", "The unit square with opposite sides glued.", "a b A B", [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]),
    ];
  if (genus !== 2) return [];
  const octagon = Array.from({ length: 8 }, (_, i): Point2 => [
    Math.cos((Math.PI * (2 * i + 1)) / 8),
    Math.sin((Math.PI * (2 * i + 1)) / 8),
  ]);
  return [
    flat(
      "L-shaped surface",
      "Three unit squares in an L, glued by translations: the typical genus-2 translation surface (one cone point of angle 6π).",
      "a b c B d A D C",
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
        [1, 1],
        [1, 2],
        [0, 2],
        [0, 1],
      ],
    ),
    flat(
      "Regular octagon",
      "The regular octagon with opposite sides glued by translations.",
      "a b c d A B C D",
      octagon,
    ),
  ];
}
