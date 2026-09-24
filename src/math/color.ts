/**
 * Colours of edges, vertices and polygon sides. Replaces Unity's `Color` / `Color32` in the core code.
 * The renderer converts them to three.js colours; the core never depends on three.js.
 *
 * @module
 */
import { clamp } from "../util/number";

/** An immutable RGBA colour with components in [0, 1] (sRGB, not premultiplied). */
export class Color {
  static readonly BLACK = new Color(0, 0, 0);
  static readonly WHITE = new Color(1, 1, 1);
  static readonly MAGENTA = new Color(1, 0, 1);

  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
    readonly a = 1,
  ) {}

  /** A colour from 8-bit components 0–255 (the C# `Color32`). */
  static fromBytes(r: number, g: number, b: number, a = 255): Color {
    return new Color(r / 255, g / 255, b / 255, a / 255);
  }

  /**
   * Parses `#rgb`, `#rrggbb` or `#rrggbbaa` (the leading `#` is optional).
   *
   * @throws SyntaxError for anything else.
   */
  static fromHex(hex: string): Color {
    let digits = hex.startsWith("#") ? hex.slice(1) : hex;
    if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(digits))
      throw new SyntaxError(`Not a colour: ${hex}`);
    if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
    const byte = (i: number) => parseInt(digits.slice(2 * i, 2 * i + 2), 16);
    return Color.fromBytes(byte(0), byte(1), byte(2), digits.length === 8 ? byte(3) : 255);
  }

  /** `#rrggbb`, or `#rrggbbaa` if the colour is not opaque. */
  toHex(): string {
    const hex = (x: number) =>
      Math.round(clamp(x, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${this.a < 1 ? hex(this.a) : ""}`;
  }

  /** The same colour with a different opacity. */
  withAlpha(a: number): Color {
    return new Color(this.r, this.g, this.b, a);
  }

  /** Linear interpolation of all four components: `this` at t = 0, `other` at t = 1. */
  lerp(other: Color, t: number): Color {
    const mix = (x: number, y: number) => x + (y - x) * t;
    return new Color(mix(this.r, other.r), mix(this.g, other.g), mix(this.b, other.b), mix(this.a, other.a));
  }

  equals(other: Color): boolean {
    return this.toHex() === other.toHex();
  }

  toString(): string {
    return this.toHex();
  }
}
