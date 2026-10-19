import { describe, expect, it } from "vitest";
import {
  canonicalName,
  displayName,
  EDGE_NAMES,
  freeName,
  greekIndex,
  letterIndex,
  nameKey,
  nameParts,
  PERIPHERAL_EDGE_NAMES,
  VERTEX_NAMES,
} from "./names";

describe("indices in names", () => {
  it("are stored with underscores and shown as subscripts, several separated by commas", () => {
    expect(displayName("a_12")).toBe("a₁₂");
    expect(displayName("b_1_1")).toBe("b₁,₁");
    expect(displayName("v3_2 and D_a")).toBe("v3₂ and Dₐ");
    // Letters without a Unicode subscript keep the underscore in plain text.
    expect(displayName("v_b and v_α")).toBe("v_b and v_α");
    expect(nameParts("v_b and v_a_1")).toEqual([
      { text: "v", subscript: false },
      { text: "b", subscript: true },
      { text: " and v", subscript: false },
      { text: "a,1", subscript: true },
    ]);
    expect(nameParts("a")).toEqual([{ text: "a", subscript: false }]);
    expect(canonicalName("a₁₂")).toBe("a_12");
    expect(nameKey("B₁")).toBe(nameKey("b_1"));
    expect(freeName(["b₁"], "b_1")).toBe("b_1_1");
  });

  it("count letter indices like spreadsheet columns", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(letterIndex)).toEqual([
      "a",
      "b",
      "z",
      "aa",
      "ab",
      "az",
      "ba",
      "zz",
      "aaa",
    ]);
    expect([0, 1, 23, 24].map(greekIndex)).toEqual(["α", "β", "ω", "αα"]);
  });
});

describe("lists of names", () => {
  it("never put a digit right after a letter", () => {
    for (const name of [...EDGE_NAMES, ...PERIPHERAL_EDGE_NAMES, ...VERTEX_NAMES])
      expect(name).not.toMatch(/\p{L}\d/u);
    expect(EDGE_NAMES.at(-1)).toBe("e_1000");
    expect(VERTEX_NAMES.slice(0, 8)).toEqual(["v", "w", "p", "q", "r", "s", "t", "v_1"]);
  });
});
