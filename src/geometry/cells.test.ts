import { describe, expect, it } from "vitest";
import { Complex } from "../math/complex";
import { cellDecomposition } from "./cells";
import { regularPolygon } from "./hyperbolic";

/** The signed area of a polygon (positive if counterclockwise). */
function area(points: readonly Complex[]): number {
  return (
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length] as Complex;
      return sum + p.re * q.im - p.im * q.re;
    }, 0) / 2
  );
}

function checkDecomposition(polygon: readonly Complex[], points: readonly Complex[]) {
  const { corners, cells } = cellDecomposition(polygon, points);
  const n = polygon.length;
  // The cells are convex and counterclockwise, and tile the polygon.
  for (const cell of cells) {
    const ps = cell.map((i) => corners[i] as Complex);
    ps.forEach((a, i) => {
      const [b, c] = [ps[(i + 1) % ps.length] as Complex, ps[(i + 2) % ps.length] as Complex];
      const cross = b.sub(a).re * c.sub(b).im - b.sub(a).im * c.sub(b).re;
      expect(cross).toBeGreaterThanOrEqual(-1e-9);
    });
  }
  const total = cells.reduce((sum, cell) => sum + area(cell.map((i) => corners[i] as Complex)), 0);
  expect(total).toBeCloseTo(area(polygon), 9);
  // Euler characteristic of the disk: V − E + F = 1.
  const sides = new Set<string>();
  for (const cell of cells)
    cell.forEach((a, i) => {
      const b = cell[(i + 1) % cell.length] as number;
      sides.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    });
  expect(corners.length - sides.size + cells.length).toBe(1);
  // Every point is a corner of at least two cells.
  for (let j = 0; j < points.length; j++)
    expect(cells.filter((cell) => cell.includes(n + j)).length).toBeGreaterThanOrEqual(2);
  return cells;
}

describe("cellDecomposition", () => {
  const octagon = regularPolygon(8, "compact");

  it("keeps the polygon as one cell without points", () => {
    expect(cellDecomposition(octagon, []).cells).toEqual([[0, 1, 2, 3, 4, 5, 6, 7]]);
  });

  it("cuts along a single diagonal through a point in the middle", () => {
    const cells = checkDecomposition(octagon, [Complex.ZERO]);
    expect(cells).toHaveLength(2);
    expect(cells[0]?.[0]).toBe(0); // the first cell starts with side 0
  });

  it("decomposes with several points, in ideal, compact and flat polygons", () => {
    const random = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (const polygon of [regularPolygon(6, "ideal"), octagon, regularPolygon(4, "ideal")]) {
      const next = random(polygon.length);
      for (let k = 1; k <= 5; k++) {
        const points = Array.from({ length: k }, () => Complex.fromPolar(0.4 * next(), 2 * Math.PI * next()));
        checkDecomposition(polygon, points);
      }
    }
    const square = [new Complex(-1, -1), new Complex(1, -1), new Complex(1, 1), new Complex(-1, 1)];
    checkDecomposition(square, [new Complex(0, 0)]);
    checkDecomposition(square, [new Complex(-0.3, 0.1), new Complex(0.4, -0.2)]);
  });

  it("rejects points outside, on the boundary, or on top of each other", () => {
    expect(() => cellDecomposition(octagon, [new Complex(2, 0)])).toThrow(/not inside/);
    const midpoint = (octagon[0] as Complex).add(octagon[1] as Complex).scale(0.5);
    expect(() => cellDecomposition(octagon, [midpoint])).toThrow(/boundary/);
    expect(() => cellDecomposition(octagon, [new Complex(0.1, 0), new Complex(0.1, 0)])).toThrow(/corner/);
  });
});
