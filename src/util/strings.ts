/**
 * String formatting helpers for labels and messages.
 *
 * @module
 */

const ELLIPSIS = "...";

/** Shortens `s` to at most `maxLength` characters, ending in "..." if it was cut. */
export function truncateEnd(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s;
  if (maxLength <= ELLIPSIS.length) return ELLIPSIS.slice(0, Math.max(maxLength, 0));
  return s.slice(0, maxLength - ELLIPSIS.length) + ELLIPSIS;
}

/**
 * Shortens `s` to at most `maxLength` characters by replacing its middle with "...".
 * `tail` is the number of characters kept at the end; by default both ends are kept about equally.
 */
export function truncateMiddle(s: string, maxLength: number, tail?: number): string {
  if (s.length <= maxLength) return s;
  const available = maxLength - ELLIPSIS.length;
  if (available <= 0) return truncateEnd(s, maxLength);
  const tailLength = Math.min(tail ?? Math.floor(available / 2), available);
  const headLength = available - tailLength;
  return s.slice(0, headLength) + ELLIPSIS + (tailLength > 0 ? s.slice(-tailLength) : "");
}

const SI_PREFIXES: readonly (readonly [threshold: number, factor: number, suffix: string])[] = [
  [1e-9, 1e12, "p"],
  [1e-6, 1e9, "n"],
  [1e-3, 1e6, "μ"],
  [1, 1e3, "m"],
  [1e3, 1, ""],
  [1e6, 1e-3, "k"],
  [1e9, 1e-6, "M"],
  [1e12, 1e-9, "G"],
];

/**
 * A number with three significant digits and an SI prefix: `1234 → "1.23k"`, `0.002 → "2m"`.
 * Trailing zeros are dropped (`1.5`, not `1.50`). Non-finite values are shown as `"?"`.
 */
export function formatSI(x: number): string {
  if (!Number.isFinite(x)) return "?";
  if (x < 0) return "-" + formatSI(-x);
  if (x === 0) return "0";
  const threeDigits = (y: number) => String(Number(y.toPrecision(3)));
  for (const [threshold, factor, suffix] of SI_PREFIXES)
    if (x < threshold) return threeDigits(x * factor) + suffix;
  return threeDigits(x);
}

/** English ordinal: 1st, 2nd, 3rd, 4th, …, 11th, 12th, 13th, …, 21st, …, 111th. */
export function ordinal(n: number): string {
  const lastTwo = Math.abs(n) % 100;
  const last = Math.abs(n) % 10;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}
