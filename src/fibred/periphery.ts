/**
 * Checking the peripheral subgraph P against its definition (the thesis, § "Periphery"), and finding the possible
 * choices of P (the remark under the definition).
 *
 * The definition asks: (1) each component of P is a circle graph representing a boundary word of G; (2) g preserves P
 * and acts on it as a graph automorphism; (3) exactly one orbit of punctures (boundary words) under f has no component
 * of P. Condition (2) is weakened here: g must map P into P, and the image of each circle, read around it and cyclically
 * reduced (backtracking inside P is allowed), must be its image circle, once and with the same orientation. That g acts
 * on P as an automorphism is then restored by absorbing into the periphery, which only uses how far the images run
 * along the circles (their signed lengths).
 *
 * @module
 */
import type { EdgePath } from "../graph/edge-path";
import type { Edge } from "../graph/ribbon-graph";
import type { FibredSurface } from "./fibred-surface";

/** The boundary words of G, and the permutation g induces on them (−1 where an image is not a boundary word). */
function boundaryWordsAndImages(fs: FibredSurface): { words: EdgePath[]; image: number[] } {
  const report = fs.g.boundaryWordReport();
  return { words: report.map((r) => r.word), image: report.map((r) => r.matchedIndex) };
}

/** The orbits of the permutation `image` of 0 … n − 1 (undefined if it is not a permutation). */
function orbits(image: readonly number[]): number[][] | undefined {
  if (image.some((j) => j < 0) || new Set(image).size !== image.length) return undefined;
  const seen = new Set<number>();
  const result: number[][] = [];
  image.forEach((_, i) => {
    if (seen.has(i)) return;
    const orbit: number[] = [];
    for (let j = i; !seen.has(j); j = image[j] as number) {
      seen.add(j);
      orbit.push(j);
    }
    result.push(orbit);
  });
  return result;
}

/**
 * Why the boundary words `chosen` don't form a peripheral subgraph as circles: an empty list if they are disjoint
 * circle graphs (no junction twice, no junction or strip shared).
 */
function circleProblems(words: readonly EdgePath[]): string[] {
  const problems: string[] = [];
  const junctions = new Map<number, number>(); // junction id → how many words pass it
  const strips = new Map<number, number>();
  for (const word of words) {
    const here = word.letters.map((x) => x.source);
    if (new Set(here).size !== here.length)
      problems.push(`The boundary word ${word} passes a junction twice, so it is not a circle graph.`);
    for (const v of new Set(here)) junctions.set(v.id, (junctions.get(v.id) ?? 0) + 1);
    for (const x of word.letters) strips.set(x.edge.id, (strips.get(x.edge.id) ?? 0) + 1);
  }
  if ([...strips.values()].some((n) => n > 1))
    problems.push("Some strips lie in two of these boundary words (or run along one twice).");
  else if ([...junctions.values()].some((n) => n > 1))
    problems.push(
      `The boundary words ${words.join(", ")} share junctions, so they are not disjoint circles (when words of one orbit share junctions, f is usually reducible).`,
    );
  return problems;
}

/** Whether g maps the strips `P` into P. */
function mapsInto(fs: FibredSurface, P: ReadonlySet<Edge>): Edge | undefined {
  return [...P].find((e) => fs.g.image(e.forward).letters.some((x) => !P.has(x.edge)));
}

/**
 * What is wrong with the peripheral subgraph P, as sentences: empty if P fulfils the definition, with condition (2)
 * weakened (see the module comment). Nothing is reported if g doesn't permute the boundary words (the integrity check
 * reports that).
 */
export function peripheryProblems(fs: FibredSurface): string[] {
  const P = fs.peripheral;
  const { words, image } = boundaryWordsAndImages(fs);
  const orbitList = orbits(image);
  if (orbitList === undefined) return [];
  const problems: string[] = [];
  const peripheral = words.flatMap((w, i) =>
    w.letters.length > 0 && w.letters.every((x) => P.has(x.edge)) ? [i] : [],
  );
  // (1) P is a union of disjoint circles, each a boundary word.
  const covered = new Set(peripheral.flatMap((i) => (words[i] as EdgePath).letters.map((x) => x.edge)));
  const loose = [...P].filter((e) => !covered.has(e));
  if (loose.length > 0)
    problems.push(
      `The peripheral strips ${loose.map((e) => e.name).join(", ")} don't form a circle that is a boundary word of G (a circle around a puncture).`,
    );
  problems.push(...circleProblems(peripheral.map((i) => words[i] as EdgePath)));
  // (2), weakened: g maps P into P, and each circle once around its image circle.
  const leaving = mapsInto(fs, P);
  if (leaving !== undefined)
    problems.push(
      `g maps the peripheral strip ${leaving.name} to ${fs.g.image(leaving.forward)}, which leaves P: g doesn't preserve P.`,
    );
  else
    for (const i of peripheral)
      if (!peripheral.includes(image[i] as number))
        problems.push(
          `g maps the peripheral circle ${words[i]} to the boundary word ${words[image[i] as number]}, which is not peripheral.`,
        );
  // (3) Exactly one orbit of boundary words without P.
  const essentialOrbits = orbitList.filter((orbit) => orbit.some((i) => !peripheral.includes(i)));
  if (essentialOrbits.length === 0)
    problems.push(
      "Every boundary word is peripheral: exactly one orbit of punctures must be essential (not in P).",
    );
  else if (essentialOrbits.length > 1)
    problems.push(
      `The boundary words not in P form ${essentialOrbits.length} orbits under g (${essentialOrbits
        .map((orbit) => orbit.map((i) => `${words[i]}`).join(" → "))
        .join("; ")}): all but one orbit of punctures must be peripheral.`,
    );
  return problems;
}

/** A possible peripheral subgraph: the boundary words outside one orbit, which is then the essential one. */
export interface PeripheryCandidate {
  readonly edges: Set<Edge>;
  /** The boundary words of the essential orbit. */
  readonly essential: readonly EdgePath[];
}

/**
 * The possible peripheral subgraphs (the thesis's remark under the definition): choosing one orbit of boundary words
 * to be essential, P consists of the other boundary words, if they are disjoint circle graphs and g maps them into
 * themselves. Empty if g doesn't permute the boundary words.
 */
export function peripheryCandidates(fs: FibredSurface): PeripheryCandidate[] {
  const { words, image } = boundaryWordsAndImages(fs);
  const orbitList = orbits(image);
  if (orbitList === undefined) return [];
  return orbitList.flatMap((essential) => {
    const others = words.filter((_, i) => !essential.includes(i));
    if (circleProblems(others).length > 0) return [];
    const edges = new Set(others.flatMap((w) => w.letters.map((x) => x.edge)));
    if (mapsInto(fs, edges) !== undefined) return [];
    return [{ edges, essential: essential.map((i) => words[i] as EdgePath) }];
  });
}
