import { describe, expect, it } from "vitest";
import { cancellationLength, concatReduced, invertWord, isReduced, reduceWord } from "./words";

// Letters are one-character strings; the inverse of "a" is "A" and vice versa.
const inv = (x: string) => (x === x.toLowerCase() ? x.toUpperCase() : x.toLowerCase());
const w = (s: string) => [...s];
const str = (word: readonly string[]) => word.join("");

describe("invertWord", () => {
  it("reverses and inverts", () => {
    expect(str(invertWord(w("abC"), inv))).toBe("cBA");
  });

  it("is an involution", () => {
    expect(str(invertWord(invertWord(w("aBcd"), inv), inv))).toBe("aBcd");
  });
});

describe("concatReduced", () => {
  it("cancels fully, partially or not at all", () => {
    expect(concatReduced(w("ab"), w("BA"), inv)).toEqual({ word: [], cancelled: 2 });
    expect(concatReduced(w("abc"), w("Cd"), inv)).toEqual({ word: w("abd"), cancelled: 1 });
    expect(concatReduced(w("ab"), w("cd"), inv)).toEqual({ word: w("abcd"), cancelled: 0 });
  });

  it("u · u⁻¹ is empty", () => {
    const u = w("aBcDD");
    expect(concatReduced(u, invertWord(u, inv), inv).word).toEqual([]);
  });

  it("only cancels at the junction", () => {
    expect(str(concatReduced(w("aA"), w("b"), inv).word)).toBe("aAb");
    expect(cancellationLength(w("aA"), w("b"), inv)).toBe(0);
  });
});

describe("reduceWord / isReduced", () => {
  it("removes all cancelling pairs, repeatedly", () => {
    expect(str(reduceWord(w("abBAc"), inv))).toBe("c");
    expect(str(reduceWord(w("aAbB"), inv))).toBe("");
    expect(str(reduceWord(w("abc"), inv))).toBe("abc");
  });

  it("detects reduced words", () => {
    expect(isReduced(w("abc"), inv)).toBe(true);
    expect(isReduced(w("abBc"), inv)).toBe(false);
    expect(isReduced([], inv)).toBe(true);
  });
});
