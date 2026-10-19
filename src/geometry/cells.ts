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
  return {
    corners,
    cells: canonicalOrder(cells, n, corners.length).map(({ cell, start }) => rotate(cell, start)),
  };
}

/**
 * The cells in canonical order, each with the position of its first side: the polygon side with the smallest index if
 * it has one, else the side from its smallest corner. Polygon sides come first. `index` is the cell's place in `cells`.
 */
function canonicalOrder(
  cells: readonly (readonly number[])[],
  n: number,
  cornerCount: number,
): { cell: readonly number[]; start: number; index: number }[] {
  return cells
    .map((cell, index) => {
      let [rank, start] = [Infinity, 0];
      cell.forEach((a, i) => {
        const b = cell[(i + 1) % cell.length] as number;
        const r = a < n && b === (a + 1) % n ? a : n + a * cornerCount + b;
        if (r < rank) [rank, start] = [r, i];
      });
      return { cell, start, index, rank };
    })
    .sort((x, y) => x.rank - y.rank);
}

/** The result of {@link slideIntoCorner}. */
export interface SlidDecomposition {
  /** The corners: the polygon's vertices, then the points that are left, at their new places. */
  readonly corners: readonly Complex[];
  /** For each point that is left (in order), its index among the old points. */
  readonly pointOf: readonly number[];
  /** The cells, counterclockwise, in the canonical order of {@link cellDecomposition}. */
  readonly cells: readonly (readonly number[])[];
  /**
   * For each cell and each of its sides (from corner i to corner i + 1), the side it was before: "a>b" with the old
   * corners at its ends, in the direction the old cell ran along it.
   */
  readonly was: readonly (readonly string[])[];
  /** For each old cell, the index of the new cell that contains it. */
  readonly cellOf: readonly number[];
}

/**
 * Slides the point `point` (a corner index ≥ n) along the chord from `corner` (a polygon vertex) into that corner (port
 * note 27); see {@link contractWalls}.
 */
export function slideIntoCorner(
  polygon: readonly Complex[],
  points: readonly Complex[],
  cells: readonly (readonly number[])[],
  point: number,
  corner: number,
): SlidDecomposition | undefined {
  return contractWalls(polygon, points, cells, [[point, corner]]);
}

/**
 * Contracts walls (port notes 26, 27): each `[from, to]` moves the corner `from` (a point, ≥ n) along the chord to
 * `to` (a polygon vertex, or another point) into it, in this order; a corner moved before stands for where it went.
 * The chord, a wall without an edge of G₀, shrinks to a point. Cells that become digons are merged with the cell across
 * their side that moved; the points that are left are placed anew by a Tutte layout (each at the average of its
 * neighbours along the chords, the polygon fixed); then cells are merged across chords, longest first, while the union
 * stays convex. Every merge contracts an edge of the dual graph. Undefined if the result isn't a decomposition into
 * convex cells (then the walls have to stay).
 */
export function contractWalls(
  polygon: readonly Complex[],
  points: readonly Complex[],
  cells: readonly (readonly number[])[],
  contractions: readonly (readonly [number, number])[],
): SlidDecomposition | undefined {
  const n = polygon.length;
  const position = [...polygon, ...points];
  const at = (i: number) => position[i] as Complex;
  const scale = Math.max(...polygon.map((p) => p.abs()), 1);
  const tolerance = EPS * scale * scale;
  const ends = (side: string) => side.split(">").map(Number) as [number, number];
  const reverse = (side: string) => {
    const [a, b] = ends(side);
    return `${b}>${a}`;
  };
  interface Work {
    corners: number[];
    was: string[];
    members: number[];
  }
  let work: Work[] = cells.map((cell, k) => ({
    corners: [...cell],
    was: cell.map((a, i) => `${a}>${cell[(i + 1) % cell.length]}`),
    members: [k],
  }));
  // Where each moved corner went, and the old corners each corner stands for now.
  const movedTo = new Map<number, number>();
  const now = (x: number): number => (movedTo.has(x) ? now(movedTo.get(x) as number) : x);
  const standsFor = new Map<number, Set<number>>();
  const originals = (x: number) => standsFor.get(x) ?? new Set([x]);

  for (const [from, to] of contractions) {
    const [a, b] = [now(from), now(to)];
    if (a === b) continue;
    if (a < n) return undefined; // a polygon vertex doesn't move
    const moving = originals(a);
    movedTo.set(a, b);
    standsFor.set(b, new Set([...originals(b), ...moving]));
    for (const w of work) w.corners = w.corners.map((x) => (x === a ? b : x));

    // 1. The wall shrinks to a point: drop the sides that start and end at the same corner.
    for (const w of work)
      for (let i = w.corners.length - 1; i >= 0; i--)
        if (w.corners.length > 1 && w.corners[i] === w.corners[(i + 1) % w.corners.length]) {
          w.corners.splice(i, 1);
          w.was.splice(i, 1);
        }

    // 2. Digons: their two sides now lie on each other. Each is merged with the cell across its side that moved,
    // which then runs along the digon's other side instead.
    for (
      let digon = work.find((w) => w.corners.length < 3);
      digon;
      digon = work.find((w) => w.corners.length < 3)
    ) {
      if (digon.corners.length !== 2) return undefined;
      const s = digon.was.findIndex((side) => ends(side).some((x) => moving.has(x)));
      if (s < 0) return undefined;
      const across = reverse(digon.was[s] as string);
      const neighbour = work.find((w) => w !== digon && w.was.includes(across));
      if (neighbour === undefined) return undefined;
      neighbour.was[neighbour.was.indexOf(across)] = digon.was[1 - s] as string;
      neighbour.members.push(...digon.members);
      work = work.filter((w) => w !== digon);
    }
  }

  // 3. The Tutte layout of the points that are left.
  const movable = points.map((_, j) => n + j).filter((x) => !movedTo.has(x));
  const neighbours = new Map<number, Set<number>>(movable.map((x) => [x, new Set()]));
  for (const w of work)
    w.corners.forEach((a, i) => {
      const b = w.corners[(i + 1) % w.corners.length] as number;
      neighbours.get(a)?.add(b);
      neighbours.get(b)?.add(a);
    });
  for (let round = 0; round < 10_000; round++) {
    let change = 0;
    for (const x of movable) {
      const around = [...(neighbours.get(x) as Set<number>)];
      if (around.length === 0) return undefined;
      const average = around.reduce((sum, y) => sum.add(at(y)), Complex.ZERO).scale(1 / around.length);
      change = Math.max(change, average.sub(at(x)).abs());
      position[x] = average;
    }
    if (change < 1e-14 * scale) break;
  }
  if (
    !tiles(
      work.map((w) => w.corners),
      position,
      polygon,
      tolerance,
    )
  )
    return undefined;

  // 4. Merge across chords, longest first, while the union stays convex (as in cellDecomposition).
  const chords = work
    .flatMap((w) =>
      w.was.map((side, i) => ({
        side,
        a: w.corners[i] as number,
        b: w.corners[(i + 1) % w.corners.length] as number,
      })),
    )
    .filter(({ side, a, b }) => !(a < n && b === (a + 1) % n) && ends(side)[0] < ends(side)[1])
    .sort((x, y) => at(y.b).sub(at(y.a)).abs() - at(x.b).sub(at(x.a)).abs() || x.side.localeCompare(y.side));
  for (const { side } of chords) {
    const A = work.find((w) => w.was.includes(side));
    const B = work.find((w) => w.was.includes(reverse(side)));
    if (A === undefined || B === undefined || A === B) continue;
    const [i, j] = [A.was.indexOf(side), B.was.indexOf(reverse(side))];
    const [a, b] = [A.corners[i] as number, A.corners[(i + 1) % A.corners.length] as number];
    const fits = [a, b].every(
      (x) =>
        x < n ||
        angleAt(A.corners, A.corners.indexOf(x), position) +
          angleAt(B.corners, B.corners.indexOf(x), position) <=
          Math.PI + 1e-9,
    );
    if (!fits) continue;
    // A runs a → b at i, B runs b → a at j: the union is A from b round to a, then B from a round to b.
    const union: Work = {
      corners: [...rotate(A.corners, i + 1), ...rotate(B.corners, j + 1).slice(1, -1)],
      was: [...rotate(A.was, i + 1).slice(0, -1), ...rotate(B.was, j + 1).slice(0, -1)],
      members: [...A.members, ...B.members],
    };
    work = [...work.filter((w) => w !== A && w !== B), union];
  }
  if (
    !tiles(
      work.map((w) => w.corners),
      position,
      polygon,
      tolerance,
    )
  )
    return undefined;

  // 5. Renumber the points that are left, and order the cells canonically.
  const renumber = new Map<number, number>(polygon.map((_, i) => [i, i]));
  movable.forEach((x, k) => renumber.set(x, n + k));
  const ordered = canonicalOrder(
    work.map((w) => w.corners.map((x) => renumber.get(x) as number)),
    n,
    n + movable.length,
  );
  const cellOf: number[] = cells.map(() => -1);
  ordered.forEach(({ index }, k) => {
    for (const member of (work[index] as Work).members) cellOf[member] = k;
  });
  return {
    corners: [...polygon, ...movable.map(at)],
    pointOf: movable.map((x) => x - n),
    cells: ordered.map(({ cell, start }) => rotate(cell, start)),
    was: ordered.map(({ index, start }) => rotate((work[index] as Work).was, start)),
    cellOf,
  };
}

/**
 * Whether the cells (lists of corners) are convex and counterclockwise, with distinct corners, and tile the polygon
 * (their areas add up to its area).
 */
function tiles(
  cells: readonly (readonly number[])[],
  position: readonly Complex[],
  polygon: readonly Complex[],
  tolerance: number,
): boolean {
  const area = (ps: readonly Complex[]) =>
    ps.reduce((sum, p, i) => {
      const q = ps[(i + 1) % ps.length] as Complex;
      return sum + (p.re * q.im - p.im * q.re) / 2;
    }, 0);
  let total = 0;
  for (const cell of cells) {
    if (cell.length < 3 || new Set(cell).size !== cell.length) return false;
    const ps = cell.map((x) => position[x] as Complex);
    const a = area(ps);
    if (a <= tolerance) return false;
    const turns = ps.map((p, i) =>
      orient(p, ps[(i + 1) % ps.length] as Complex, ps[(i + 2) % ps.length] as Complex),
    );
    if (turns.some((t) => t < -tolerance)) return false;
    total += a;
  }
  return Math.abs(total - area(polygon)) <= 1e-7 * Math.abs(area(polygon));
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
