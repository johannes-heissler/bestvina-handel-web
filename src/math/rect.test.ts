import { describe, expect, it } from "vitest";
import { Rect, type RectCutMode } from "./rect";

const MODES: RectCutMode[] = ["corners", "horizontal", "vertical"];

/** Deterministic pseudo-random numbers (mulberry32), so that failures are reproducible. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRect(rand: () => number): Rect {
  return new Rect(rand() * 10 - 5, rand() * 10 - 5, rand() * 8, rand() * 8);
}

describe("Rect basics", () => {
  const r = Rect.fromBounds(0, 1, 4, 3);

  it("has bounds, area and containment", () => {
    expect([r.xMax, r.yMax, r.width, r.height, r.area]).toEqual([4, 3, 4, 2, 8]);
    expect(r.contains(2, 2)).toBe(true);
    expect(r.contains(4, 3)).toBe(true);
    expect(r.contains(5, 2)).toBe(false);
  });

  it("intersects", () => {
    expect(r.intersect(Rect.fromBounds(2, 0, 6, 2))).toEqual(Rect.fromBounds(2, 1, 4, 2));
    expect(r.intersect(Rect.fromBounds(5, 0, 6, 2))).toBeUndefined();
  });
});

describe("Rect.minus", () => {
  const A = Rect.fromBounds(0, 0, 3, 3);
  const hole = Rect.fromBounds(1, 1, 2, 2);

  it("cuts a centred hole into 8, 4 or 4 pieces", () => {
    expect(A.minus(hole, "corners")).toHaveLength(8);
    expect(A.minus(hole, "horizontal")).toHaveLength(4);
    expect(A.minus(hole, "vertical")).toHaveLength(4);
  });

  it("uses full-width strips in horizontal mode", () => {
    const pieces = A.minus(hole, "horizontal");
    expect(pieces.filter((p) => p.width === 3)).toHaveLength(2);
  });

  it("returns nothing when B covers A", () => {
    for (const mode of MODES) expect(A.minus(Rect.fromBounds(-1, -1, 4, 4), mode)).toEqual([]);
  });

  it("partitions A ∖ B for random rectangles: pieces lie in A, avoid B, don't overlap, and fill the area", () => {
    const rand = random(42);
    for (let trial = 0; trial < 500; trial++) {
      const a = randomRect(rand);
      const b = randomRect(rand);
      const holeArea = a.intersect(b)?.area ?? 0;
      for (const mode of MODES) {
        const pieces = a.minus(b, mode);
        for (const [i, p] of pieces.entries()) {
          expect(a.intersect(p)?.area).toBeCloseTo(p.area, 9);
          expect(b.intersect(p)).toBeUndefined();
          for (const q of pieces.slice(i + 1)) expect(p.intersect(q)).toBeUndefined();
        }
        const total = pieces.reduce((sum, p) => sum + p.area, 0);
        expect(total).toBeCloseTo(a.area - holeArea, 9);
      }
    }
  });
});
