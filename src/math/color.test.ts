import { describe, expect, it } from "vitest";
import { Color } from "./color";

describe("Color", () => {
  it("converts from bytes and to hex", () => {
    expect(Color.fromBytes(20, 71, 255).toHex()).toBe("#1447ff");
    expect(Color.fromBytes(20, 71, 255, 128).toHex()).toBe("#1447ff80");
  });

  it("parses hex strings", () => {
    expect(Color.fromHex("#1447ff").equals(Color.fromBytes(20, 71, 255))).toBe(true);
    expect(Color.fromHex("fff").equals(Color.WHITE)).toBe(true);
    expect(Color.fromHex("#00000080").a).toBeCloseTo(128 / 255);
    expect(() => Color.fromHex("#12345")).toThrow(SyntaxError);
  });

  it("round-trips through hex", () => {
    for (const hex of ["#000000", "#e91e63", "#1a693a", "#32066380"])
      expect(Color.fromHex(hex).toHex()).toBe(hex);
  });

  it("interpolates and changes opacity", () => {
    expect(Color.BLACK.lerp(Color.WHITE, 0.5).toHex()).toBe("#808080");
    expect(Color.WHITE.withAlpha(0).toHex()).toBe("#ffffff00");
  });
});
