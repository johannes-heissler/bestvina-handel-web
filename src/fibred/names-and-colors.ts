/**
 * Colours for new junctions and strips (the C# `FibredSurfaceNamesAndColors`), and the names as before session
 * format 4. The names themselves are in `graph/names` (port note 25).
 *
 * @module
 */
import { EDGE_NAMES, VERTEX_NAMES } from "../graph/names";
import { Color } from "../math/color";
import { argMin } from "../util/iter";

/** {@link EDGE_NAMES} as before session format 4, with the fallbacks e1, e2, …. */
export const LEGACY_EDGE_NAMES: readonly string[] = EDGE_NAMES.map((name) => name.replace(/^e_/, "e"));

/** {@link VERTEX_NAMES} as before session format 4, with the fallbacks v1, v2, …. */
export const LEGACY_VERTEX_NAMES: readonly string[] = VERTEX_NAMES.map((name) => name.replace(/^v_/, "v"));

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
  // More colours, so that as far as possible every strip has its own.
  Color.fromBytes(0, 137, 123),
  Color.fromBytes(141, 85, 58),
  Color.fromBytes(211, 47, 47),
  Color.fromBytes(0, 172, 236),
  Color.fromBytes(124, 150, 0),
  Color.fromBytes(94, 53, 177),
  Color.fromBytes(240, 98, 146),
  Color.fromBytes(0, 83, 150),
];

/** Colours for vertices. */
export const VERTEX_COLORS: readonly Color[] = [
  Color.BLACK,
  Color.fromBytes(26, 105, 58),
  Color.fromBytes(122, 36, 0),
  new Color(0.3, 0.3, 0.3),
  Color.fromBytes(50, 6, 99),
];

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
