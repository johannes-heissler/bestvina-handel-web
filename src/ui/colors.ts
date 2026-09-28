/**
 * The CSS colours of strip names on a fibred surface (both orientations), for coloured text.
 *
 * @module
 */
import type { Color } from "../math/color";
import type { FibredSurface } from "../fibred/fibred-surface";

export function cssColor(color: Color): string {
  const channel = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return `rgb(${channel(color.r)},${channel(color.g)},${channel(color.b)})`;
}

const cache = new WeakMap<FibredSurface, Map<string, string>>();

/** The colour of each strip name ("a" and "A") on the surface. */
export function stripColors(surface: FibredSurface | undefined): ReadonlyMap<string, string> {
  if (surface === undefined) return new Map();
  let colors = cache.get(surface);
  if (colors === undefined) {
    colors = new Map();
    for (const e of surface.graph.edges) {
      colors.set(e.name, cssColor(e.color));
      colors.set(e.backward.name, cssColor(e.color));
    }
    cache.set(surface, colors);
  }
  return colors;
}
