import { describe, expect, it } from "vitest";
import { EdgePath } from "./edge-path";
import { fromBoundaryWords } from "./from-boundary-words";
import { nameTable, ParseError, parseEdgePath, parseMap } from "./path-parser";

const rose = fromBoundaryWords([["a", "b", "A", "B"]]);
const parse = (text: string) => String(parseEdgePath(text, nameTable(rose)));

describe("parseEdgePath", () => {
  it("reads edge names with various separators", () => {
    expect(parse("a B")).toBe("a B");
    expect(parse("a*B·a  b")).toBe("a B a b");
    expect(parse("")).toBe("");
  });

  it("inverts with '", () => {
    expect(parse("a'")).toBe("A");
    expect(parse("(a b)'")).toBe("B A");
    expect(parse("a''")).toBe("a");
  });

  it("conjugates with ^ (w^u = u⁻¹ w u) and ° (u°w = u w u⁻¹)", () => {
    expect(parse("a^b")).toBe("B a b");
    expect(parse("b°a")).toBe("b a B");
    expect(parse("a^b'")).toBe("b a B"); // ' binds to the right operand
    expect(parse("a'^b")).toBe("B A b");
    expect(parse("a^b^a")).toBe("A B a b a"); // left grouping: (a^b)^a
    expect(parse("a^b a")).toBe("B a b a"); // conjugation binds tighter than concatenation
    expect(parse("(a b)^a")).toBe("A a b a");
  });

  it("uses definitions and their inverses", () => {
    const names = nameTable(rose, new Map([["x", parseEdgePath("a b", nameTable(rose))]]));
    expect(String(parseEdgePath("x a", names))).toBe("a b a");
    expect(String(parseEdgePath("X", names))).toBe("B A");
    expect(String(parseEdgePath("a^x", names))).toBe("B A a a b");
  });

  it("reports errors with positions", () => {
    const error = (text: string) => {
      try {
        parse(text);
      } catch (e) {
        return e as ParseError;
      }
      throw new Error(`"${text}" was accepted`);
    };
    expect(error("a c").position).toBe(2);
    expect(error("a c").message).toMatch(/Unknown edge or name "c"/);
    expect(error("ab").message).toMatch(/Separate edges/); // names need separators, as in C#
    expect(error("(a b").message).toMatch(/Unclosed parenthesis/);
    expect(error("a b)").message).toMatch(/Unmatched/);
    expect(error("' a").message).toMatch(/Unexpected "'"/);
    expect(error("a^").message).toMatch(/ended unexpectedly/);
  });

  it("parses what EdgePath.toString prints", () => {
    const letters = rose.orientedEdges;
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let trial = 0; trial < 100; trial++) {
      const path = EdgePath.from(
        Array.from({ length: Math.floor(random() * 12) }, () => letters[Math.floor(random() * 4)]!),
      );
      expect(parseEdgePath(String(path), nameTable(rose)).equals(path)).toBe(true);
    }
  });
});

describe("parseMap", () => {
  const images = (text: string) =>
    [...parseMap(text, rose).images].map(([e, path]) => `${e.name}:${String(path)}`).sort();

  it("accepts all entry formats", () => {
    expect(images("g(a) = a b, b -> b a b")).toEqual(["a:a b", "b:b a b"]);
    expect(images("a ↦ a b\nb = b a b")).toEqual(["a:a b", "b:b a b"]);
    expect(images("A -> B A")).toEqual(["A:B A"]);
    expect(images("")).toEqual([]);
  });

  it("uses definitions in the order given", () => {
    const parsed = parseMap("x := a b, a -> x, b -> X b", rose);
    expect(String(parsed.definitions.get("x"))).toBe("a b");
    expect(images("x := a b, y := x x, a -> y")).toEqual(["a:a b a b"]);
    expect(() => parseMap("y := x x, x := a b", rose)).toThrow(/Unknown edge or name "x"/);
  });

  it("rejects bad entries, giving the position in the whole text", () => {
    expect(() => parseMap("a -> a b, a -> b", rose)).toThrow(/given twice/);
    expect(() => parseMap("a -> a b, A -> b", rose)).toThrow(/given twice/);
    expect(() => parseMap("just text", rose)).toThrow(ParseError);
    try {
      parseMap("a -> a b, b -> b c", rose);
    } catch (e) {
      expect((e as ParseError).position).toBe("a -> a b, b -> b c".indexOf("c"));
    }
  });
});
