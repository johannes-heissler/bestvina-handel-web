import { describe, expect, it } from "vitest";
import { orderedWithGaps } from "./layout";

describe("keeping strands in order on a side", () => {
  it("fits increasing values with gaps, least squares, within bounds", () => {
    // Already fine: unchanged.
    expect(orderedWithGaps([-0.5, 0, 0.5], [0.2, 0.2], -0.9, 0.9)).toEqual([-0.5, 0, 0.5]);
    // Two strands in the wrong order meet in the middle, the gap apart.
    const swapped = orderedWithGaps([0.3, -0.1], [0.2], -0.9, 0.9);
    expect(swapped[0]).toBeCloseTo(0, 12);
    expect(swapped[1]).toBeCloseTo(0.2, 12);
    // Pushed against the bounds.
    const clamped = orderedWithGaps([1.5, 2, 3], [0.1, 0.1], -0.9, 0.9);
    expect(clamped.map((x) => Number(x.toFixed(12)))).toEqual([0.7, 0.8, 0.9]);
  });
});
