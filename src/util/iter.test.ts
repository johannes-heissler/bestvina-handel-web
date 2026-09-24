import { describe, expect, it } from "vitest";
import {
  argMax,
  argMin,
  cartesianProduct,
  cycle,
  firstDuplicate,
  range,
  rotate,
  rotateTo,
  sharedPrefix,
  sharedPrefixLength,
} from "./iter";

describe("argMin / argMax", () => {
  it("returns the first extremal element with index and value", () => {
    const words = ["ccc", "a", "bb", "d"];
    expect(argMin(words, (w) => w.length)).toEqual({ item: "a", index: 1, value: 1 });
    expect(argMax(words, (w) => w.length)).toEqual({ item: "ccc", index: 0, value: 3 });
  });

  it("returns undefined for empty input", () => {
    expect(argMin([], () => 0)).toBeUndefined();
    expect(argMax([], () => 0)).toBeUndefined();
  });

  it("ignores NaN keys", () => {
    expect(argMin([1, 2, 3], (x) => (x === 1 ? NaN : x))?.item).toBe(2);
  });

  it("keeps full double precision (the C# version rounded to float)", () => {
    expect(argMax([1.000000001, 1.000000002], (x) => x)?.value).toBe(1.000000002);
  });
});

describe("rotate", () => {
  const abc = ["a", "b", "c"];

  it("rotates by any offset, modulo the length", () => {
    expect(rotate(abc, 0)).toEqual(["a", "b", "c"]);
    expect(rotate(abc, 1)).toEqual(["b", "c", "a"]);
    expect(rotate(abc, 3)).toEqual(["a", "b", "c"]);
    expect(rotate(abc, 4)).toEqual(["b", "c", "a"]); // C#: unchanged
    expect(rotate(abc, -1)).toEqual(["c", "a", "b"]); // C#: exception
  });

  it("handles empty input and does not modify its argument", () => {
    expect(rotate([], 5)).toEqual([]);
    rotate(abc, 1);
    expect(abc).toEqual(["a", "b", "c"]);
  });

  it("rotateTo starts at the first match, or leaves the order unchanged", () => {
    expect(rotateTo(abc, (x) => x === "c")).toEqual(["c", "a", "b"]);
    expect(rotateTo(abc, (x) => x === "z")).toEqual(["a", "b", "c"]);
  });
});

describe("cycle, range, cartesianProduct", () => {
  it("cycles lazily", () => {
    expect(cycle([1, 2]).take(5).toArray()).toEqual([1, 2, 1, 2, 1]);
    expect([...cycle([])]).toEqual([]);
  });

  it("builds ranges and products", () => {
    expect(range(3)).toEqual([0, 1, 2]);
    expect([...cartesianProduct([1, 2], ["x", "y"])]).toEqual([
      [1, "x"],
      [1, "y"],
      [2, "x"],
      [2, "y"],
    ]);
  });
});

describe("firstDuplicate", () => {
  it("finds the first repeated key", () => {
    expect(firstDuplicate([1, 2, 3, 2, 1])).toBe(2);
    expect(firstDuplicate([1, 2, 3])).toBeUndefined();
    const edges = [{ name: "a" }, { name: "b" }, { name: "a" }];
    expect(firstDuplicate(edges, (e) => e.name)).toBe(edges[2]);
  });
});

describe("shared prefixes", () => {
  it("computes the shared prefix length", () => {
    expect(sharedPrefixLength("abcd", "abxd")).toBe(2);
    expect(sharedPrefixLength("ab", "abc")).toBe(2);
    expect(sharedPrefixLength("", "abc")).toBe(0);
  });

  it("supports a custom equality", () => {
    expect(sharedPrefixLength("aBc", "Abd", (x, y) => x.toLowerCase() === y.toLowerCase())).toBe(2);
  });

  it("computes the shared prefix of several lists", () => {
    expect(
      sharedPrefix([
        [1, 2, 3],
        [1, 2, 4],
        [1, 2],
      ]),
    ).toEqual([1, 2]);
    expect(sharedPrefix([[1, 2, 3]])).toEqual([1, 2, 3]);
    expect(sharedPrefix([[1], [2]])).toEqual([]);
  });

  it("throws for an empty list of lists (the C# version crashed)", () => {
    expect(() => sharedPrefix([])).toThrow(RangeError);
  });
});
