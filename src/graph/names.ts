/**
 * The naming convention for oriented edges: the inverse of the edge "a" is "A", and vice versa.
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
 * Indices: names are stored with an underscore ("a_1", "v3_2"), which can be typed, and shown with subscripts ("a₁",
 * "v3₂"), like LaTeX without the braces.
 */

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * The name as shown: each underscore followed by digits as those digits in subscript, several indices in a row separated
 * by commas ("a_12" → "a₁₂", "b_1_1" → "b₁,₁").
 */
export function displayName(name: string): string {
  return name.replace(/(?:_\d+)+/g, (indices: string) =>
    indices
      .slice(1)
      .split("_")
      .map((digits) => [...digits].map((d) => SUBSCRIPT_DIGITS[Number(d)]).join(""))
      .join(","),
  );
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

/** `name`, or with "_1" appended (repeatedly) while one of `existing` has the same {@link nameKey}. */
export function freeName(existing: Iterable<string>, name: string): string {
  const used = new Set([...existing].map(nameKey));
  let candidate = name;
  while (used.has(nameKey(candidate))) candidate += "_1";
  return candidate;
}
