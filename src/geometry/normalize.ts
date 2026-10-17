/**
 * Fitting point sets into the unit disk, for charts (port notes 20, 22).
 *
 * @module
 */
import { Complex } from "../math/complex";

/** Scales and centres points into the disk of radius `size` (by their bounding box). */
export function normalize(points: readonly Complex[], size = 0.9): Complex[] {
  const pairs = points.map((q) => [q.re, q.im] as const);
  return points.map((p) => normalizeLike(pairs, p, size));
}

/** Applies to `p` the normalization that {@link normalize} applies to `points`. */
export function normalizeLike(
  points: readonly (readonly [number, number])[],
  p: Complex,
  size: number,
): Complex {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const c = new Complex((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return p.sub(c).scale((2 * size) / extent);
}

/** The inverse of {@link normalizeLike}: the point whose normalization is `q`. */
export function denormalizeLike(
  points: readonly (readonly [number, number])[],
  q: Complex,
  size: number,
): Complex {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const c = new Complex((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return q.scale(extent / (2 * size)).add(c);
}
