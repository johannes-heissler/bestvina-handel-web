import { describe, expect, it } from "vitest";
import { formatSI, ordinal, truncateEnd, truncateMiddle } from "./strings";

describe("formatSI", () => {
  it("uses SI prefixes with three significant digits", () => {
    expect(formatSI(0)).toBe("0");
    expect(formatSI(999)).toBe("999");
    expect(formatSI(1000)).toBe("1k");
    expect(formatSI(1234)).toBe("1.23k");
    expect(formatSI(1.5e6)).toBe("1.5M");
    expect(formatSI(0.002)).toBe("2m");
    expect(formatSI(0.001)).toBe("1m");
    expect(formatSI(3.456e-7)).toBe("346n");
    expect(formatSI(-1234)).toBe("-1.23k");
  });

  it("shows non-finite values as ?", () => {
    expect(formatSI(NaN)).toBe("?");
    expect(formatSI(Infinity)).toBe("?");
  });
});

describe("ordinal", () => {
  it("handles 1–4, the teens and larger numbers", () => {
    expect([1, 2, 3, 4].map((n) => ordinal(n))).toEqual(["1st", "2nd", "3rd", "4th"]);
    expect([11, 12, 13].map((n) => ordinal(n))).toEqual(["11th", "12th", "13th"]);
    expect([21, 22, 101].map((n) => ordinal(n))).toEqual(["21st", "22nd", "101st"]);
    // The C# version returned "111st", "112nd", "113rd".
    expect([111, 112, 113].map((n) => ordinal(n))).toEqual(["111th", "112th", "113th"]);
  });
});

describe("truncation", () => {
  it("truncates at the end", () => {
    expect(truncateEnd("abcdefgh", 10)).toBe("abcdefgh");
    expect(truncateEnd("abcdefgh", 6)).toBe("abc...");
    expect(truncateEnd("abcdefgh", 2)).toBe(".."); // C#: exception
  });

  it("truncates in the middle", () => {
    expect(truncateMiddle("abcdefghij", 9)).toBe("abc...hij");
    expect(truncateMiddle("abcdefghij", 8, 1)).toBe("abcd...j");
    expect(truncateMiddle("abcdefghij", 8, 0)).toBe("abcde...");
    expect(truncateMiddle("abc", 8)).toBe("abc");
  });
});
