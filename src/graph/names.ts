/**
 * Names of vertices and edges: the convention for oriented edges (the inverse of the edge "a" is "A", and vice versa),
 * indices, and the lists that new names are taken from (port note 25).
 *
 * @module
 */

/**
 * The name of the inverse edge: lowercase if the first letter of `name` is uppercase, otherwise
 * uppercase. The C# `ReverseUpper`, which crashed for names without a letter.
 *
 * @throws Error if `name` contains no letter, since its inverse couldn't be told apart from it.
 */
export function invertName(name: string): string {
  const firstLetter = [...name].find((c) => c.toLowerCase() !== c.toUpperCase());
  if (firstLetter === undefined) throw new Error(`The edge name "${name}" contains no letter`);
  return firstLetter === firstLetter.toUpperCase() ? name.toLowerCase() : name.toUpperCase();
}

/** Whether `name` denotes a forward orientation, i.e. its first letter is lowercase. */
export function isForwardName(name: string): boolean {
  return invertName(name) !== name.toLowerCase();
}

/*
 * Indices: names are stored with an underscore ("a_1", "v_a", "v_α"), which can be typed, and shown as subscripts
 * ("a₁", "vₐ"), like LaTeX without the braces. Several indices in a row are separated by commas ("b_1_1" → b₁,₁).
 */

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
/** The letters that Unicode has as subscripts. */
const SUBSCRIPT_LETTERS: Readonly<Record<string, string>> = {
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

/** Indices: an underscore and letters or digits, several in a row. */
const INDICES = /(?:_[\p{L}\p{N}]+)+/gu;

/** A piece of a shown name: plain text, or its indices (shown as a subscript, separated by commas). */
export interface NamePart {
  readonly text: string;
  readonly subscript: boolean;
}

/** The name (or a text containing names) split into plain text and indices: "v_a_1" → "v", subscript "a,1". */
export function nameParts(name: string): NamePart[] {
  const parts: NamePart[] = [];
  let last = 0;
  for (const match of name.matchAll(INDICES)) {
    if (match.index > last) parts.push({ text: name.slice(last, match.index), subscript: false });
    parts.push({ text: match[0].slice(1).split("_").join(","), subscript: true });
    last = match.index + match[0].length;
  }
  if (last < name.length) parts.push({ text: name.slice(last), subscript: false });
  return parts;
}

/**
 * The name as text, where no markup is possible (tooltips, menus): its indices in Unicode subscripts if they all exist
 * ("a_12" → "a₁₂", "v_a" → "vₐ", "b_1_1" → "b₁,₁"), otherwise as stored ("v_b").
 */
export function displayName(name: string): string {
  return name.replace(INDICES, (indices: string) => {
    const shown = indices
      .slice(1)
      .split("_")
      .map((index) =>
        [...index].map((c) => (/\d/.test(c) ? SUBSCRIPT_DIGITS[Number(c)] : SUBSCRIPT_LETTERS[c])),
      );
    return shown.every((index) => index.every((c) => c !== undefined))
      ? shown.map((index) => index.join("")).join(",")
      : indices;
  });
}

/**
 * The name as stored: subscript digits written with an underscore ("a₁₂" → "a_12"). Names are looked up in this form,
 * so that subscripts (typed, or in older saved sessions) and underscores mean the same.
 */
export function canonicalName(name: string): string {
  return name.replace(
    /[₀-₉]+/g,
    (digits) => `_${[...digits].map((d) => SUBSCRIPT_DIGITS.indexOf(d)).join("")}`,
  );
}

/** The key under which names are compared: stored form, ignoring case (an edge and its inverse share it). */
export function nameKey(name: string): string {
  return canonicalName(name).toLowerCase();
}

/** The k-th index (from 0), counted like spreadsheet columns: a, b, …, z, aa, ab, … (base 26 with the digits a … z). */
export function letterIndex(k: number): string {
  return bijectiveBase(k, "abcdefghijklmnopqrstuvwxyz");
}

/** The k-th Greek index (from 0), counted like {@link letterIndex}: α, β, …, ω, αα, αβ, …. */
export function greekIndex(k: number): string {
  return bijectiveBase(k, "αβγδεζηθικλμνξοπρστυφχψω");
}

function bijectiveBase(k: number, digits: string): string {
  const base = digits.length;
  let result = "";
  for (let n = k + 1; n > 0; n = Math.floor((n - 1) / base))
    result = (digits[(n - 1) % base] as string) + result;
  return result;
}

// ─── Lists of names ─────────────────────────────────────────────────────────────────────────

/**
 * Names for new edges, in order of preference. As in C#, e, f and g are left out (they denote edges and maps in the
 * text). Unlike C#, μ, σ and λ are left out as well, since they denote the inverse marking, the cyclic order and the
 * growth rate. Then e_1, e_2, … (shown as e₁, e₂): general edges.
 */
export const EDGE_NAMES: readonly string[] = [
  ..."abcdxyzuhijklmno",
  ..."αβγδεζθκξπρτφψω",
  ...Array.from({ length: 1000 }, (_, i) => `e_${i + 1}`),
];

/**
 * Names for new peripheral strips: Greek letters, first those whose capitals (the inverses) don't look like Latin
 * capitals (Γ Δ Θ Ξ Π Φ Ψ Ω, then Σ and Λ, which also denote the cyclic order and the growth), then the others;
 * never μ (the inverse marking), nor υ (Υ looks like Y). Then with indices (γ_1, shown as γ₁).
 */
export const PERIPHERAL_EDGE_NAMES: readonly string[] = (() => {
  const letters = [..."γδθξπφψωσλ", ..."αβεζηικνορτχ"];
  return [
    ...letters,
    ...Array.from({ length: 9 }, (_, k) => k + 1).flatMap((k) => letters.map((x) => `${x}_${k}`)),
  ];
})();

/** Names for new vertices, in order of preference; then v_1, v_2, … (shown as v₁, v₂): general vertices. */
export const VERTEX_NAMES: readonly string[] = [
  ..."vwpqrst",
  ...Array.from({ length: 1000 }, (_, i) => `v_${i + 1}`),
];

/** The first name in `names` that is not in `used`. */
export function firstUnusedName(names: readonly string[], used: ReadonlySet<string>): string {
  const name = names.find((n) => !used.has(n));
  if (name === undefined) throw new Error("Ran out of names");
  return name;
}

/** `name`, or with "_1" appended (repeatedly) while one of `existing` has the same {@link nameKey}. */
export function freeName(existing: Iterable<string>, name: string): string {
  const used = new Set([...existing].map(nameKey));
  let candidate = name;
  while (used.has(nameKey(candidate))) candidate += "_1";
  return candidate;
}
