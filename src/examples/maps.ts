/**
 * Example fibred surfaces for tests and the UI (the start of the port of `SurfaceGenerator`'s presets).
 *
 * @module
 */
import { FibredSurface } from "../fibred/fibred-surface";

/** The Anosov map a ↦ a b, b ↦ b a b on the rose of the once-punctured torus (growth φ²). */
export const torusAnosov = () => FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b");

/**
 * The Anosov map a ↦ a b a, b ↦ b a conjugated by a: g(a) = b a a, g(b) = A b a a. Not efficient (growth
 * (3 + √13)/2 ≈ 3.30); the algorithm brings it to growth φ².
 */
export const conjugatedTorusAnosov = () =>
  FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a a, b -> A b a a");

/**
 * A pseudo-Anosov map of the closed genus-2 surface, given on the surface punctured once (growth ≈ 4.3152).
 * g is already a train-track map, but the boundary word of τ at the puncture has only one cusp, i.e. filling
 * in the puncture gives a singularity of angle π: the case of the thesis, § "Closed surfaces and cutting".
 * Example by the author.
 */
export const closedGenus2OneCusp = () => {
  const fs = FibredSurface.fromText(
    ["c x B y k a z Y K Z d C X D A b".split(" ")],
    "b -> K Y b X C B y Z d x c, z -> Z d C X D, x -> B y Z d, d -> Y b X C, c -> x c x, k -> z Y, y -> a, a -> K",
  );
  fs.isClosed = true;
  return fs;
};
