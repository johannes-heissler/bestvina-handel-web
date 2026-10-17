import { describe, expect, it } from "vitest";
import { canonicalName, displayName, freeName, nameKey } from "./names";

describe("indices in names", () => {
  it("are stored with underscores and shown as subscripts, several separated by commas", () => {
    expect(displayName("a_12")).toBe("a₁₂");
    expect(displayName("b_1_1")).toBe("b₁,₁");
    expect(displayName("v3_2 and D_a")).toBe("v3₂ and D_a");
    expect(canonicalName("a₁₂")).toBe("a_12");
    expect(nameKey("B₁")).toBe(nameKey("b_1"));
    expect(freeName(["b₁"], "b_1")).toBe("b_1_1");
  });
});
