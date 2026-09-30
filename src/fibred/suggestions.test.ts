import { describe, expect, it } from "vitest";
import { closedGenus2OneCusp, conjugatedTorusAnosov } from "../examples/maps";
import { buildPreset, PRESETS } from "../examples/presets";
import { FibredSurface } from "./fibred-surface";
import { applyMove, type Move } from "./move";
import { perronFrobenius } from "./perron-frobenius";
import { autopilot, combine, nextSuggestion, plainText, variants } from "./suggestions";

const φ = (1 + Math.sqrt(5)) / 2;
const growth = (fs: FibredSurface) => perronFrobenius(fs, { essentialOnly: true }).growth;

/** (These tests are about the other steps.) */
const NO_VERTEX_MOVES = { disabled: new Set(["move vertices" as const]) };

describe("nextSuggestion", () => {
  it("suggests pulling tight, with 'all' first and one option per turning strip", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b B b, b -> b a b");
    const s = nextSuggestion(fs, NO_VERTEX_MOVES);
    expect(s.kind).toBe("pull tight");
    expect(s.multiple).toBe(true);
    expect(s.options[0]!.move).toEqual({ kind: "pull tight" });
    expect(s.options.slice(1).map((o) => plainText(o.label))).toEqual(["Tighten at B", "Tighten at b"]); // a b B b has two backtracks
  });

  it("lists folds by the order of the inefficiencies behind them, as moves that refer to strips by name", () => {
    const s = nextSuggestion(conjugatedTorusAnosov(), NO_VERTEX_MOVES);
    expect(s.kind).toBe("fold");
    expect(plainText(s.options[0]!.label)).toMatch(/^Fold .* at .*: order \d+, \d+ places?/);
    const ratings = s.options.map((o) => o.rating!);
    expect(ratings).toEqual(ratings.toSorted((x, y) => x - y));
    expect(JSON.parse(JSON.stringify(s.options[0]!.move))).toEqual(s.options[0]!.move);
  });

  it("offers the reductions and 'ignore' at a reducible map", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B", "c", "d", "C", "D"]], "a -> a b, b -> b a b");
    const s = nextSuggestion(fs, NO_VERTEX_MOVES);
    expect(s.kind).toBe("reducible");
    expect(s.classification?.kind).toBe("reducible");
    const regular = s.options.filter((o) => !o.discouraged); // (splitting along τ and ignoring are greyed out)
    expect(regular.length).toBeGreaterThan(0);
    expect(regular.every((o) => o.move.kind === "reduce")).toBe(true);
    const ignore = s.options.find((o) => o.move.kind === "ignore reducibility");
    expect(ignore?.discouraged).toBe(true);
    expect(ignore?.warning).toMatch(/not guaranteed/);
  });

  it("reports the result when finished", () => {
    const s = nextSuggestion(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> a b, b -> b a b"));
    expect(s.kind).toBe("finished");
    expect(s.options).toEqual([]);
    expect(s.classification).toMatchObject({ kind: "pseudo-Anosov" });
    expect(
      nextSuggestion(FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b, b -> A")).classification,
    ).toEqual({
      kind: "finite order",
      order: 4,
    });
  });

  it("asks for the closed-surface move only on a closed surface", () => {
    const closed = closedGenus2OneCusp();
    const s = nextSuggestion(closed);
    expect(s.kind).toBe("closed surface");
    const ratings = s.options
      .filter((o) => o.move.kind === "cut along a singular leaf")
      .map((o) => o.rating!);
    expect(ratings).toEqual(ratings.toSorted((x, y) => x - y)); // by period
    closed.isClosed = false;
    expect(nextSuggestion(closed).kind).toBe("finished"); // a genuine puncture may have one prong
  });
});

describe("applyMove", () => {
  it("applies a move to a copy by names, leaving the original unchanged", () => {
    const fs = conjugatedTorusAnosov();
    const before = fs.toString();
    const copy = fs.copy();
    applyMove(copy, nextSuggestion(fs, NO_VERTEX_MOVES).options[0]!.move);
    expect(fs.toString()).toBe(before);
    expect(copy.checkIntegrity()).toEqual([]);
    expect(copy.toString()).not.toBe(before);
  });

  it("throws for unknown names", () => {
    expect(() => applyMove(conjugatedTorusAnosov(), { kind: "pull tight", at: ["z"] })).toThrow(/no strip z/);
  });
});

describe("combine", () => {
  it("merges selected options of the same kind", () => {
    expect(
      combine([
        { kind: "pull tight", at: ["a"] },
        { kind: "pull tight", at: ["B", "a"] },
      ]),
    ).toEqual({ kind: "pull tight", at: ["a", "B"] });
    expect(combine([{ kind: "pull tight", at: ["a"] }, { kind: "pull tight" }])).toEqual({
      kind: "pull tight",
    });
    expect(() => combine([{ kind: "absorb into periphery" }, { kind: "absorb into periphery" }])).toThrow();
  });
});

describe("variants", () => {
  it("lists the fold options of an inefficiency step, rated by side crossings, each applicable", () => {
    const fs = conjugatedTorusAnosov();
    const move = nextSuggestion(fs, NO_VERTEX_MOVES).options[0]!.move;
    const options = variants(fs, move).filter((o) => o.move.kind === "fold");
    expect(options.length).toBeGreaterThan(0);
    const ratings = options.map((o) => o.rating!);
    expect(ratings).toEqual(ratings.toSorted((x, y) => x - y));
    for (const option of options) {
      const copy = fs.copy();
      applyMove(copy, option.move);
      expect(copy.checkIntegrity()).toEqual([]);
      expect(copy.mu.totalLength()).toBe(option.rating);
    }
  });

  it("lists the pieces of a reduction", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B", "c", "d", "C", "D"]], "a -> a b, b -> b a b");
    const reduceAB = nextSuggestion(fs, NO_VERTEX_MOVES).options.find(
      (o) => o.move.kind === "reduce" && o.move.preserved.length === 2,
    )!.move;
    const pieces = variants(fs, reduceAB);
    expect(pieces.map((p) => plainText(p.label).split(":")[0])).toEqual(
      expect.arrayContaining(["The invariant subgraph", "The complement"]),
    );
    const complement = pieces.find((p) => plainText(p.label).startsWith("The complement"))!;
    const copy = fs.copy();
    applyMove(copy, complement.move);
    expect(copy.checkIntegrity()).toEqual([]);
    expect(copy.graph.edges.some((e) => e.name === "c")).toBe(true);
  });

  it("offers the centres of a collapse and the strip to remove at a valence-2 junction", () => {
    const fs = FibredSurface.fromText([["x", "y", "b", "Y", "X", "B"]], "x -> x y, y -> b, b -> b x y b");
    const valence2 = nextSuggestion(fs, NO_VERTEX_MOVES);
    expect(valence2.kind).toBe("remove valence-2 junctions");
    const single = valence2.options[1]!.move;
    expect(variants(fs, single)).toHaveLength(2);
  });
});

describe("autopilot", () => {
  it("runs to the end with the defaults and reports every step", () => {
    const fs = conjugatedTorusAnosov();
    const steps: Move[] = [];
    const { surface, moves, stoppedAt } = autopilot(fs, { onStep: (move) => steps.push(move) });
    expect(stoppedAt.kind).toBe("finished");
    expect(steps).toEqual(moves);
    expect(growth(surface)).toBeCloseTo(φ * φ, 8);
  });

  it("only applies the selected kinds (semi-automatic)", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B"]], "a -> b a b a B, b -> b b a B");
    const { moves, stoppedAt } = autopilot(fs, { automatic: new Set(["pull tight"]) });
    expect(moves.map((m) => m.kind)).toEqual(["pull tight"]);
    expect(stoppedAt.kind).not.toBe("pull tight");
  });

  it("stops at a reduction by default", () => {
    const fs = FibredSurface.fromText([["a", "b", "A", "B", "c", "d", "C", "D"]], "a -> a b B b, b -> b a b");
    expect(autopilot(fs).stoppedAt.kind).toBe("reducible");
  });

  it("cuts a closed surface and continues on the new surface", { timeout: 60_000 }, () => {
    const { surface, moves, stoppedAt } = autopilot(closedGenus2OneCusp());
    expect(moves[0]!.kind).toBe("cut along a singular leaf");
    expect(surface.isClosed).toBe(true);
    expect(stoppedAt.classification).toMatchObject({ kind: "pseudo-Anosov" });
    expect(growth(surface)).toBeCloseTo(4.2121, 3);
  });
});

describe("a finished result with a single cusp at the only puncture", () => {
  it("offers cutting along a singular leaf; for the point push, f relative to the singularity is reducible", () => {
    const { surface, stoppedAt } = autopilot(buildPreset(PRESETS.find((p) => p.name === "Point push")!));
    expect(stoppedAt.kind).toBe("finished");
    expect(stoppedAt.classification).toMatchObject({ kind: "pseudo-Anosov" });
    const cut = stoppedAt.options.find((o) => o.move.kind === "cut along a singular leaf" && o.rating === 1);
    expect(cut).toBeDefined();
    // On the closed surface the point push is isotopic to the identity; relative to the fixed singularity it is then
    // a point push of that point, which is reducible, with the identity on the first piece.
    const cutOpen = autopilot(applyMove(surface.copy(), cut!.move));
    expect(cutOpen.stoppedAt.kind).toBe("reducible");
    const reduced = autopilot(applyMove(cutOpen.surface.copy(), cutOpen.stoppedAt.options[0]!.move));
    expect(reduced.stoppedAt.classification).toMatchObject({ kind: "finite order", order: 1 });
  });
});
