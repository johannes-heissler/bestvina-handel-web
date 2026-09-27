/**
 * The gallery: several model surfaces for the same genus and number of punctures (your request: different orders of the
 * sides, different places for the punctures, flat models like the L, the punctured plane). Not all of them are
 * isomorphic as ribbon graphs, so they give different G₀ and different starting points for the algorithm.
 *
 * @module
 */
import { topology, type Point2, type PolygonGeometry, type SurfaceModel } from "./models";

/** Side labels in order of use. */
const LABELS = "abcdefghijkmnopqrstuvwxyz".split("");

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
): SurfaceModel {
  return { kind: "polygon", name, description, word, geometry, closed };
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

/** The models for a surface of genus g with p punctures (p = 0: closed), each checked to have that topology. */
export function gallery(genus: number, punctures: number): SurfaceModel[] {
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
  }
  return models.filter((m) => {
    const t = topology(m);
    return t.genus === genus && t.punctures === punctures;
  });
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
