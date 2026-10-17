/**
 * Cell decompositions of a convex polygon with points inside it (port note 22): the polygon is cut along straight chords
 * between its vertices and the points into convex cells whose corners are exactly the vertices and the points. In Klein
 * coordinates the chords are geodesics and the cells hyperbolically convex.
 *
 * @module
 */
import { Complex } from "../math/complex";

export interface CellDecomposition {
  /** The corners: the polygon's vertices (0, …, n − 1), then the points (n, …). */
  readonly corners: readonly Complex[];
  /**
   * The cells, each as its corners counterclockwise (indices into `corners`), starting with its first side: the polygon
   * side with the smallest index if it has one, else the side from its smallest corner. The cells are sorted by their
   * first side, polygon sides first.
   */
  readonly cells: readonly (readonly number[])[];
}

const EPS = 1e-9;

/** cross(b − a, c − a): positive if a, b, c turn counterclockwise. */
function orient(a: Complex, b: Complex, c: Complex): number {
  const [u, v] = [b.sub(a), c.sub(a)];
  return u.re * v.im - u.im * v.re;
}

/** Positive if d lies inside the circumcircle of the counterclockwise triangle a, b, c. */
function inCircle(a: Complex, b: Complex, c: Complex, d: Complex): number {
  const [p, q, r] = [a.sub(d), b.sub(d), c.sub(d)];
  const [lp, lq, lr] = [p, q, r].map((z) => z.re * z.re + z.im * z.im) as [number, number, number];
  return p.re * (q.im * lr - lq * r.im) - p.im * (q.re * lr - lq * r.re) + lp * (q.re * r.im - q.im * r.re);
}

/** The interior angle at position i of a counterclockwise polygon, in (0, 2π). */
function angleAt(cell: readonly number[], i: number, corners: readonly Complex[]): number {
  const n = cell.length;
  const c = corners[cell[i] as number] as Complex;
  const next = (corners[cell[(i + 1) % n] as number] as Complex).sub(c);
  const prev = (corners[cell[(i - 1 + n) % n] as number] as Complex).sub(c);
  const angle = Math.atan2(next.re * prev.im - next.im * prev.re, next.re * prev.re + next.im * prev.im);
  return angle < -EPS ? angle + 2 * Math.PI : Math.abs(angle) <= EPS ? 0 : angle;
}

/**
 * The cell decomposition of the convex polygon `polygon` (counterclockwise) with the given points strictly inside: a
 * triangulation (inserting the points, then Lawson flips towards a Delaunay triangulation), whose cells are merged across
 * chords, longest first, as long as the union stays convex (an angle of π at a point is allowed). Without points, the
 * polygon is the only cell.
 *
 * @throws Error if a point is not strictly inside the polygon, or two points coincide.
 */
export function cellDecomposition(
  polygon: readonly Complex[],
  points: readonly Complex[],
): CellDecomposition {
  const n = polygon.length;
  const corners = [...polygon, ...points];
  if (points.length === 0) return { corners, cells: [polygon.map((_, i) => i)] };
  const scale = Math.max(...polygon.map((p) => p.abs()), 1);
  const tolerance = EPS * scale * scale;
  const isPolygonSide = (a: number, b: number) => a < n && b < n && ((a + 1) % n === b || (b + 1) % n === a);
  const at = (i: number) => corners[i] as Complex;

  // 1. Triangulate: a fan, then insert the points one by one.
  let triangles: [number, number, number][] = Array.from(
    { length: n - 2 },
    (_, i) => [0, i + 1, i + 2] as [number, number, number],
  );
  points.forEach((p, j) => {
    const index = n + j;
    const containing = triangles.findIndex(([a, b, c]) =>
      [orient(at(a), at(b), p), orient(at(b), at(c), p), orient(at(c), at(a), p)].every(
        (o) => o >= -tolerance,
      ),
    );
    if (containing < 0) throw new Error(`The point ${p} is not inside the polygon`);
    const t = triangles[containing] as [number, number, number];
    const sides: [number, number][] = [
      [t[0], t[1]],
      [t[1], t[2]],
      [t[2], t[0]],
    ];
    const on = sides.filter(([a, b]) => Math.abs(orient(at(a), at(b), p)) <= tolerance);
    if (on.length > 1) throw new Error(`The point ${p} coincides with a corner`);
    if (on.length === 0) {
      triangles.splice(containing, 1, [t[0], t[1], index], [t[1], t[2], index], [t[2], t[0], index]);
      return;
    }
    const [a, b] = on[0] as [number, number];
    if (isPolygonSide(a, b)) throw new Error(`The point ${p} lies on the boundary of the polygon`);
    const c = t.find((x) => x !== a && x !== b) as number;
    const other = triangles.findIndex((u, k) => k !== containing && u.includes(a) && u.includes(b));
    const d = (triangles[other] as number[]).find((x) => x !== a && x !== b) as number;
    triangles = triangles.filter((_, k) => k !== containing && k !== other);
    triangles.push([a, index, c], [index, b, c], [b, index, d], [index, a, d]);
  });

  // 2. Lawson flips: make the triangles well-shaped (in the chart's Euclidean metric).
  for (let round = 0, flipped = true; flipped && round < 1000; round++) {
    flipped = false;
    for (let i = 0; i < triangles.length && !flipped; i++)
      for (let s = 0; s < 3 && !flipped; s++) {
        const t = triangles[i] as [number, number, number];
        const [u, v, w] = [t[s], t[(s + 1) % 3], t[(s + 2) % 3]] as [number, number, number];
        if (isPolygonSide(u, v)) continue;
        const k = triangles.findIndex((x, m) => m !== i && x.includes(u) && x.includes(v));
        if (k < 0) continue;
        const x = (triangles[k] as number[]).find((y) => y !== u && y !== v) as number;
        // The quadrilateral u x v w must be strictly convex for the flip to u…w to x.
        const convex = orient(at(w), at(u), at(x)) > tolerance && orient(at(x), at(v), at(w)) > tolerance;
        if (!convex || inCircle(at(u), at(v), at(w), at(x)) <= 1e-7 * scale ** 4) continue;
        triangles[i] = [w, u, x];
        triangles[k] = [x, v, w];
        flipped = true;
      }
  }

  // 3. Merge across chords while convex.
  let cells: number[][] = triangles.map((t) => [...t]);
  const chords = new Map<string, [number, number]>();
  for (const cell of cells)
    cell.forEach((a, i) => {
      const b = cell[(i + 1) % cell.length] as number;
      if (!isPolygonSide(a, b)) chords.set(key(a, b), [Math.min(a, b), Math.max(a, b)]);
    });
  const byLength = [...chords.values()].sort(
    ([a, b], [c, d]) => at(d).sub(at(c)).abs() - at(b).sub(at(a)).abs() || a - c || b - d,
  );
  for (const [a, b] of byLength) {
    const first = cells.findIndex((cell) => hasSide(cell, a, b));
    const second = cells.findIndex((cell) => hasSide(cell, b, a));
    if (first < 0 || second < 0) continue;
    const [A, B] = [cells[first] as number[], cells[second] as number[]];
    const fits = [a, b].every(
      (corner) =>
        corner < n ||
        angleAt(A, A.indexOf(corner), corners) + angleAt(B, B.indexOf(corner), corners) <= Math.PI + 1e-9,
    );
    if (!fits) continue;
    // A runs a → b, B runs b → a: the union is A from b round to a, then B after a up to before b.
    const fromB = rotate(A, A.indexOf(b));
    const fromA = rotate(B, B.indexOf(a));
    const union = [...fromB, ...fromA.slice(1, -1)];
    cells = cells.filter((_, k) => k !== first && k !== second);
    cells.push(union);
  }

  // 4. A canonical order.
  const firstSide = (cell: readonly number[]): [number, number] => {
    let best: [number, number] = [Infinity, 0];
    cell.forEach((a, i) => {
      const b = cell[(i + 1) % cell.length] as number;
      const rank = a < n && b === (a + 1) % n ? a : n + a * corners.length + b;
      if (rank < best[0]) best = [rank, i];
    });
    return best;
  };
  const ordered = cells
    .map((cell) => {
      const [rank, i] = firstSide(cell);
      return { rank, cell: rotate(cell, i) };
    })
    .sort((x, y) => x.rank - y.rank)
    .map((x) => x.cell);
  return { corners, cells: ordered };
}

function key(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function hasSide(cell: readonly number[], a: number, b: number): boolean {
  const i = cell.indexOf(a);
  return i >= 0 && cell[(i + 1) % cell.length] === b;
}

function rotate<T>(list: readonly T[], start: number): T[] {
  return [...list.slice(start), ...list.slice(0, start)];
}
