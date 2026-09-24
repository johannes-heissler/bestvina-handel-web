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
