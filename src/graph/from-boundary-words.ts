/**
 * Building a ribbon graph from its boundary words (the C# `SurfaceGenerator.GraphFromBoundaryWords`).
 *
 * @module
 */
import { invertName, isForwardName } from "./names";
import { RibbonGraph, type OrientedEdge, type Vertex } from "./ribbon-graph";

/**
 * The ribbon graph whose boundary words are the given ones. Each word is a list of oriented edge names:
 * "a" is the edge a, "A" its inverse. Every oriented edge must occur exactly once in all words together.
 *
 * The cyclic orders are determined by σ(ēᵢ) = eᵢ₊₁ for consecutive letters (cyclically) of each word; the
 * vertices are the orbits of σ. The C# version closed each word with the *unoriented* first edge, which
 * was wrong for words starting with an inverse edge.
 *
 * @example `fromBoundaryWords([["a", "b", "A", "B"]])` is the rose with two petals of a once-punctured torus.
 * @throws Error if an oriented edge is missing or occurs twice.
 */
export function fromBoundaryWords(words: readonly (readonly string[])[]): RibbonGraph {
  // σ on oriented edge names.
  const sigma = new Map<string, string>();
  for (const word of words)
    word.forEach((name, i) => {
      const key = invertName(name);
      if (sigma.has(key)) throw new Error(`The oriented edge ${name} occurs more than once`);
      sigma.set(key, word[(i + 1) % word.length] as string);
    });
  for (const name of sigma.keys())
    if (!sigma.has(invertName(name)))
      throw new Error(`The oriented edge ${invertName(name)} occurs in no boundary word`);

  // The vertices are the orbits of σ; each orbit, in order, is the star of its vertex.
  const graph = new RibbonGraph();
  const orbits = new Map<Vertex, string[]>();
  const vertexOf = new Map<string, Vertex>();
  for (const start of sigma.keys()) {
    if (vertexOf.has(start)) continue;
    const vertex = graph.addVertex();
    const orbit: string[] = [];
    for (let name = start; !vertexOf.has(name); name = sigma.get(name) as string) {
      vertexOf.set(name, vertex);
      orbit.push(name);
    }
    orbits.set(vertex, orbit);
  }

  const oriented = new Map<string, OrientedEdge>();
  for (const name of sigma.keys()) {
    if (!isForwardName(name)) continue;
    const edge = graph.addEdge(vertexOf.get(name) as Vertex, vertexOf.get(invertName(name)) as Vertex, {
      name,
    });
    oriented.set(name, edge.forward);
    oriented.set(invertName(name), edge.backward);
  }
  for (const [vertex, orbit] of orbits)
    graph.setStar(
      vertex,
      orbit.map((name) => oriented.get(name) as OrientedEdge),
    );
  return graph;
}
