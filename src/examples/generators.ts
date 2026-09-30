/**
 * Generating sets of mapping class groups, as maps of the strips of an example's starting graph, suggested in the map
 * editor. Each generator is stored with its inverse (both as text for the map editor).
 *
 * @module
 */

/** A generator of the mapping class group, as a map of the strips (unmentioned strips are fixed). */
export interface Generator {
  /** E.g. "D_a" for the Dehn twist around a, or "h" for a half twist. */
  readonly name: string;
  readonly description: string;
  readonly map: string;
  readonly inverse: string;
}

export interface GeneratingSet {
  readonly description: string;
  readonly generators: readonly Generator[];
}

/**
 * The genus-2 surface with one puncture, in the setup of Bestvina–Handel's example 6.1 (the polygon a b A B c d C D
 * with c and d reversed and swapped). These Dehn twists generate the mapping class group, i.e. exactly the geometric
 * automorphisms (up to the rotations around the puncture). Up to homeomorphism and free isotopy, the curves are the
 * Lickorish generators of the Primer, Theorem 4.13.
 */
export const GENUS_2_GENERATORS: GeneratingSet = {
  description:
    "Dehn twists generating the mapping class group of the once-punctured genus-2 surface: up to homeomorphism and free isotopy, the Lickorish generators (Primer, Theorem 4.13).",
  generators: [
    { name: "D_d", description: "Dehn twist along a₁ = d", map: "c -> c d", inverse: "c -> c D" },
    { name: "D_a", description: "Dehn twist along a₂ = a", map: "b -> a b", inverse: "b -> A b" },
    { name: "D_c", description: "Dehn twist along m₁ = c", map: "d -> C d", inverse: "d -> c d" },
    { name: "D_b", description: "Dehn twist along m₂ = b", map: "a -> a B", inverse: "a -> a b" },
    {
      name: "D_c₁",
      description: "Dehn twist along the curve c₁ that intersects a and d",
      map: "a -> c B a, d -> d C b",
      inverse: "a -> b C a, d -> d B c",
    },
  ],
};

/**
 * The torus with two punctures, in the setup of the half twist example (the polygon a c b C A B, b reversed): the half
 * twist exchanging the punctures and three Dehn twists.
 */
export const TORUS_2_GENERATORS: GeneratingSet = {
  description:
    "The half twist exchanging the two punctures and Dehn twists around a, c and b, generating the mapping class group of the twice-punctured torus.",
  generators: [
    {
      name: "h",
      description: "The half twist exchanging the two punctures",
      map: "a -> c A b c B",
      inverse: "a -> b c B A c",
    },
    // (b ↦ b A is not geometric in this setup, where b is reversed: the twist around a acts on the left of b.)
    { name: "D_a", description: "Dehn twist around a", map: "b -> A b", inverse: "b -> a b" },
    { name: "D_c", description: "Dehn twist around c", map: "b -> b C", inverse: "b -> b c" },
    {
      name: "D_b",
      description: "Dehn twist around b",
      map: "a -> a b, c -> c b",
      inverse: "a -> a B, c -> c B",
    },
  ],
};

/**
 * The maps of a generating set and their inverses with their names ("D_a", "D_a⁻¹"), in that order (the list a random
 * mapping class draws from).
 */
export function namedMapsAndInverses(set: GeneratingSet): { map: string; name: string }[] {
  return set.generators.flatMap((g) => [
    { map: g.map, name: g.name },
    { map: g.inverse, name: `${g.name}⁻¹` },
  ]);
}

/** The maps of a generating set and their inverses, in that order. */
export function mapsAndInverses(set: GeneratingSet): string[] {
  return namedMapsAndInverses(set).map((m) => m.map);
}
