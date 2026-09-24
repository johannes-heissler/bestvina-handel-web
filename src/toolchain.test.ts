import { describe, expect, it } from "vitest";

// Temporary: checks the runtime features the port relies on. Remove once real tests exist.
describe("toolchain", () => {
  it("supports ES2025 iterator helpers on generators", () => {
    function* naturals() {
      for (let n = 0; ; n++) yield n;
    }
    const firstEvenSquares = naturals()
      .filter((n) => n % 2 === 0)
      .map((n) => n * n)
      .take(3)
      .toArray();
    expect(firstEvenSquares).toEqual([0, 4, 16]);
  });

  it("supports Map.groupBy", () => {
    const groups = Map.groupBy(["a", "B", "c", "D"], (s) => s === s.toUpperCase());
    expect(groups.get(true)).toEqual(["B", "D"]);
  });
});
