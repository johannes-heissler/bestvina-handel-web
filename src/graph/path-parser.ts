/**
 * Parsing edge paths and graph maps from text (the C# `EdgePath.FromString` and `FibredSurface.ParseMap`).
 *
 * Syntax of an edge path:
 * - Edge names separated by spaces, `*` or `·`: `a B c`. The inverse of `a` is `A`.
 * - `'` inverts the preceding factor: `a'` = `A`, `(a b)'` = `B A`.
 * - Conjugation: `w^u` = u⁻¹ w u and `u°w` = u w u⁻¹. Both bind to single factors and group to the left:
 *   `a^b c` = (b⁻¹ a b) c, `a^b'` = a^(b⁻¹), and `a^b^c` = (a^b)^c.
 * - Parentheses group: `(a b)^c`.
 * - Named paths defined earlier, e.g. with `x := a B A`; `X` is the inverse of `x`.
 *
 * Named paths and conjugations are expanded right away; the result is a flat {@link EdgePath}
 * (port note 06, decision C2).
 *
 * @module
 */
import { EdgePath } from "./edge-path";
import { invertName } from "./names";
import type { OrientedEdge, RibbonGraph } from "./ribbon-graph";

/** An error in the input, with the position (index into the parsed text) where it was detected. */
export class ParseError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

type Token =
  | { readonly kind: "name"; readonly text: string; readonly position: number }
  | { readonly kind: "(" | ")" | "'" | "^" | "°"; readonly position: number };

const SEPARATORS = new Set([" ", "\t", "\n", "\r", "*", "·"]);
const SYMBOLS = new Set(["(", ")", "'", "^", "°"]);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let name = "";
  let nameStart = 0;
  const endName = () => {
    if (name !== "") tokens.push({ kind: "name", text: name, position: nameStart });
    name = "";
  };
  [...text].forEach((c, i) => {
    if (SEPARATORS.has(c)) endName();
    else if (SYMBOLS.has(c)) {
      endName();
      tokens.push({ kind: c as "(" | ")" | "'" | "^" | "°", position: i });
    } else {
      if (name === "") nameStart = i;
      name += c;
    }
  });
  endName();
  return tokens;
}

/** Looks up names: oriented edges first, then named paths (and their inverses). */
export interface NameTable {
  readonly edges: ReadonlyMap<string, OrientedEdge>;
  readonly definitions: ReadonlyMap<string, EdgePath>;
}

/** The names of all oriented edges of `graph`, and no definitions. */
export function nameTable(
  graph: RibbonGraph,
  definitions: ReadonlyMap<string, EdgePath> = new Map(),
): NameTable {
  return { edges: new Map(graph.orientedEdges.map((e) => [e.name, e])), definitions };
}

/**
 * Parses an edge path; see the module documentation for the syntax.
 *
 * @throws ParseError for unknown names, unbalanced parentheses or misplaced symbols.
 */
export function parseEdgePath(text: string, names: NameTable): EdgePath {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];

  const lookUp = (name: string, position: number): EdgePath => {
    const edge = names.edges.get(name);
    if (edge !== undefined) return EdgePath.of(edge);
    const definition = names.definitions.get(name);
    if (definition !== undefined) return definition;
    const inverseName = /\p{L}/u.test(name) ? invertName(name) : undefined;
    const inverse = inverseName === undefined ? undefined : names.definitions.get(inverseName);
    if (inverse !== undefined) return inverse.inverse;
    throw new ParseError(
      `Unknown edge or name "${name}" at position ${position}. Separate edges with spaces or *.`,
      position,
    );
  };

  // path := factor*
  const path = (): EdgePath => {
    const factors: EdgePath[] = [];
    for (let token = peek(); token !== undefined && token.kind !== ")"; token = peek())
      factors.push(factor());
    return EdgePath.concatAll(factors);
  };

  // factor := operand (("^" | "°") operand)*
  const factor = (): EdgePath => {
    let result = operand();
    for (let token = peek(); token?.kind === "^" || token?.kind === "°"; token = peek()) {
      i++;
      const other = operand();
      result =
        token.kind === "^"
          ? other.inverse.concat(result, other) // w^u = u⁻¹ w u (w = result, u = other)
          : result.concat(other, result.inverse); // u°w = u w u⁻¹ (u = result, w = other)
    }
    return result;
  };

  // operand := primary "'"*
  const operand = (): EdgePath => {
    let result = primary();
    while (peek()?.kind === "'") {
      i++;
      result = result.inverse;
    }
    return result;
  };

  // primary := NAME | "(" path ")"
  const primary = (): EdgePath => {
    const token = peek();
    if (token === undefined) throw new ParseError("The input ended unexpectedly", text.length);
    i++;
    if (token.kind === "name") return lookUp(token.text, token.position);
    if (token.kind === "(") {
      const inner = path();
      if (peek()?.kind !== ")")
        throw new ParseError(`Unclosed parenthesis at position ${token.position}`, token.position);
      i++;
      return inner;
    }
    throw new ParseError(`Unexpected "${token.kind}" at position ${token.position}`, token.position);
  };

  const result = path();
  const rest = peek();
  if (rest !== undefined) throw new ParseError(`Unmatched ")" at position ${rest.position}`, rest.position);
  return result;
}

/** The result of {@link parseMap}. */
export interface ParsedMap {
  /** The images of the oriented edges that were mentioned (at most one orientation per edge). */
  readonly images: Map<OrientedEdge, EdgePath>;
  /** The named paths defined in the input, in the order of definition. */
  readonly definitions: Map<string, EdgePath>;
}

const LINE_FORMATS = [
  /^g\s*\((.+)\)\s*=(.*)$/s,
  /^(.+?)->(.*)$/s,
  /^(.+?)↦(.*)$/s,
  /^(.+?):=(.*)$/s,
  /^(.+?)=(.*)$/s,
];

/**
 * Parses a graph map given as text. Entries are separated by commas or line breaks, and each has one of
 * the forms `g(a) = …`, `a -> …`, `a ↦ …`, `a := …` or `a = …`. If the left side names an oriented edge
 * of `graph`, the entry is its image; otherwise it defines a named path that later entries can use.
 * Edges that are not mentioned are not in `images` (callers usually map them to themselves).
 *
 * Changes from the C# `ParseMap`: definitions are processed in the order they appear (C# used an unordered
 * set, so a definition using another one could fail at random), and giving both `a` and `A` is an error.
 *
 * @throws ParseError with the position in `text`.
 */
export function parseMap(text: string, graph: RibbonGraph): ParsedMap {
  const edges = nameTable(graph).edges;
  const images = new Map<OrientedEdge, EdgePath>();
  const definitions = new Map<string, EdgePath>();
  let offset = 0;
  for (const entry of text.split(/[,\n]/)) {
    const entryStart = offset;
    offset += entry.length + 1;
    if (entry.trim() === "") continue;
    const match = LINE_FORMATS.map((format) => format.exec(entry.trim())).find((m) => m !== null);
    if (match === undefined)
      throw new ParseError(
        `Can't read "${entry.trim()}". Use the form "g(a) = a B A", "a -> a B A" or a definition "x := a B A".`,
        entryStart,
      );
    const name = (match[1] as string).trim();
    const imageText = match[2] as string;
    const at = entryStart + entry.indexOf(imageText, entry.indexOf(name) + name.length);
    let image: EdgePath;
    try {
      image = parseEdgePath(imageText, { edges, definitions });
    } catch (error) {
      if (error instanceof ParseError) throw new ParseError(error.message, at + error.position);
      throw error;
    }
    const edge = edges.get(name);
    if (edge === undefined) {
      if (!/\p{L}/u.test(name)) throw new ParseError(`The name "${name}" needs a letter`, entryStart);
      definitions.set(name, image);
    } else {
      if (images.has(edge) || images.has(edge.reversed))
        throw new ParseError(`The image of ${edge.edge} is given twice`, entryStart);
      images.set(edge, image);
    }
  }
  return { images, definitions };
}
