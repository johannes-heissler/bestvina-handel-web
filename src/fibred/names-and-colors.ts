/**
 * Default names and colours for new junctions and strips (the C# `FibredSurfaceNamesAndColors`).
 *
 * @module
 */
import { Color } from "../math/color";
import { argMin } from "../util/iter";

/**
 * Names for new edges, in order of preference. As in C#, e, f and g are left out (they denote edges and
 * maps in the text). Unlike C#, μ, σ and λ are left out as well, since they denote the inverse marking, the
 * cyclic order and the growth rate.
 */
export const EDGE_NAMES: readonly string[] = [
  ..."abcdxyzuhijklmno",
  ..."αβγδεζθκξπρτφψω",
  ...Array.from({ length: 1000 }, (_, i) => `e${i + 1}`),
];

/** Names for new vertices, in order of preference. */
export const VERTEX_NAMES: readonly string[] = [
  ..."vwpqrst",
  ...Array.from({ length: 1000 }, (_, i) => `v${i + 1}`),
];

/** Colours for edges (the C# `Curve.colors`). */
export const EDGE_COLORS: readonly Color[] = [
  Color.fromBytes(20, 71, 255),
  Color.fromBytes(233, 30, 99),
  Color.fromBytes(255, 193, 7),
  Color.fromBytes(174, 51, 255),
  Color.fromBytes(89, 128, 212),
  Color.fromBytes(255, 123, 0),
  Color.fromBytes(108, 108, 108),
  Color.fromBytes(47, 196, 107),
];

/** Colours for vertices. */
export const VERTEX_COLORS: readonly Color[] = [
  Color.BLACK,
  Color.fromBytes(26, 105, 58),
  Color.fromBytes(122, 36, 0),
  new Color(0.3, 0.3, 0.3),
  Color.fromBytes(50, 6, 99),
];

/** The first name in `names` that is not in `used`. */
export function firstUnusedName(names: readonly string[], used: ReadonlySet<string>): string {
  const name = names.find((n) => !used.has(n));
  if (name === undefined) throw new Error("Ran out of names");
  return name;
}

/**
 * The colour of `palette` that occurs least often among `used` (the first one in case of a tie).
 * Colours are compared by value.
 */
export function leastUsedColor(palette: readonly Color[], used: Iterable<Color>): Color {
  const counts = new Map<string, number>(palette.map((c) => [c.toHex(), 0]));
  for (const c of used) {
    const key = c.toHex();
    if (counts.has(key)) counts.set(key, (counts.get(key) as number) + 1);
  }
  return (argMin(palette, (c) => counts.get(c.toHex()) as number)?.item ?? Color.BLACK) as Color;
}
