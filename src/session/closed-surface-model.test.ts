import { describe, expect, it } from "vitest";
import { chartOf } from "../embedding/chart";
import { layout } from "../embedding/layout";
import { modelOfSpine } from "../embedding/remark";
import { withTightMarking } from "../embedding/image";
import { type PolygonModel, spineOfGraph, type SurfaceModel } from "../examples/models";
import { DEFAULT_AUTOMATIC, plainText, type Text } from "../fibred/suggestions";
import type { FibredSurface } from "../fibred/fibred-surface";
import type { Move } from "../fibred/move";
import { Session } from "./session";

/** The closed genus-2 example, run until the algorithm asks for the closed-surface move. */
function atClosedSurfaceMove(): { session: Session; moves: Move[] } {
  const session = Session.create({ kind: "preset", preset: "Closed genus 2" });
  for (let i = 0; i < 10; i++) {
    const moves = session
      .suggestion()
      .options.map((o) => o.move)
      .filter((m) => m.kind === "cut along a singular leaf" || m.kind === "replace puncture by singularity");
    if (moves.length > 0) return { session, moves };
    session.runAutopilot({ maxSteps: 200 });
  }
  throw new Error("The closed-surface move wasn't suggested");
}

/** Lays out a state in its model, as the views do (the model of a new G₀ from the registry). */
function drawable(state: FibredSurface, model: SurfaceModel) {
  const m = modelOfSpine(state.spine0) ?? model;
  const chart = chartOf(m, {}, spineOfGraph(m, state.spine0));
  let result;
  try {
    result = layout(state, chart);
  } catch {
    result = layout(withTightMarking(state), chart); // as the views do
  }
  for (const pieces of result.strips.values())
    for (const piece of pieces) for (const p of piece) expect(Number.isFinite(p.re + p.im)).toBe(true);
}

/**
 * The junctions at which μ isn't tight: all strips leaving it start across the same side of G₀ (the drawing would put
 * the junction on that side, with the strips crossing each other).
 */
function looseJunctions(state: FibredSurface): string[] {
  return state.graph.vertices
    .filter((v) => {
      const firsts = state.graph.star(v).map((e) => state.mu.image(e).first);
      return firsts.length > 0 && firsts[0] !== undefined && firsts.every((x) => x === firsts[0]);
    })
    .map((v) => v.name);
}

describe("closed-surface moves in the original polygon", () => {
  const { session, moves } = atClosedSurfaceMove();
  const before = session.current;

  it.each(moves.map((m) => [JSON.stringify(m), m] as const))(
    "keeps the model: %s",
    (_, move) => {
      const preview = session.preview(move);
      expect(preview.error).toBeUndefined();
      const result = preview.surface!;
      expect(result.checkIntegrity()).toEqual([]);
      const singlePoint = modelOfSpine(result.spine0) === undefined;
      if (singlePoint)
        expect(result.spine0).toBe(before.surface.spine0); // q moved to p's place: G₀ unchanged
      else {
        // One point of Q slid into p's corner, the others are inside, and no wall is left (port note 27).
        const model = modelOfSpine(result.spine0)!;
        expect(model).toMatchObject({ kind: "polygon", closed: false });
        expect((model as PolygonModel).points?.length).toBeGreaterThan(0);
        expect((model as PolygonModel).cells).toBeDefined();
      }
      // The state with p filled in and the wall comes before the slide, as a step of its own.
      const walled = preview.steps.map((step) => modelOfSpine(step.after.spine0));
      expect(walled.some((m) => m?.kind === "polygon" && m.closed && (m.points ?? []).length > 0)).toBe(true);
      // The slide comes last, except for merging the valence-2 lines that are left (port note 28) and renaming the strips.
      expect(lastBeforeTidying(preview.steps)).toMatch(/^Slide the new puncture/);
      // Every state of the narration can be drawn, and the cut shows several of them.
      for (const step of preview.steps) drawable(step.after, before.model);
      // … with μ tight at every junction (the slits split switches, whose parts may all lie across one chord).
      for (const step of preview.steps) expect(looseJunctions(step.after)).toEqual([]);
      if (move.kind === "cut along a singular leaf") expect(preview.steps.length).toBeGreaterThan(5);
      // Only the junctions of Q are blown up (port note 22, § 6): the first state is G with the polygons of Q, as in the
      // shortcut; the other junctions stay junctions.
      const blownUp = preview.steps[0]!.after;
      const junction = (move as { junction: string }).junction;
      const shortcut = session.preview({ kind: "replace puncture by singularity", junction });
      expect(blownUp.graph.edgeCount).toBe(shortcut.steps[0]!.after.graph.edgeCount);
      expect(blownUp.graph.vertexCount).toBe(shortcut.steps[0]!.after.graph.vertexCount);
      expect(blownUp.graph.edgeCount).toBeGreaterThan(before.surface.graph.edgeCount);
    },
    120_000,
  );
});

describe("marking a once-punctured surface as closed", () => {
  it("is the only option at the end of the point push, and makes the polygon compact on the same G₀", () => {
    const session = Session.create({ kind: "preset", preset: "Point push" });
    session.runAutopilot();
    const before = session.current;
    expect(session.suggestion().options.map((o) => o.move)).toEqual([{ kind: "mark as closed" }]);
    const node = session.apply({ kind: "mark as closed" });
    expect(node.surface.isClosed).toBe(true);
    expect(node.surface.spine0).toBe(before.surface.spine0);
    expect(node.model).toMatchObject({
      kind: "polygon",
      word: ["a", "b", "A", "B", "c", "d", "C", "D"],
      geometry: { kind: "compact" },
      closed: true,
    });
    drawable(node.surface, node.model);
    expect(session.suggestion().kind).toBe("closed surface");

    // A saved session gets the same model back.
    const { session: replayed } = Session.fromFile(session.toFile());
    expect(replayed.current.model).toMatchObject({
      kind: "polygon",
      geometry: { kind: "compact" },
      closed: true,
    });
  });
});

describe("cutting again (port note 26)", () => {
  // A point push composed with Dehn twists, found by a search: after the first closed-surface move, both new punctures
  // have one cusp, so the move is needed again, with the orbit P of two punctures.
  const automatic = new Set([...DEFAULT_AUTOMATIC].filter((k) => k !== "closed surface"));

  it("fills in an orbit of punctures in the polygon, and contracts the walls", () => {
    const session = Session.create({ kind: "preset", preset: "Point push with Dehn twists" });
    session.runAutopilot({ automatic });
    session.apply({ kind: "mark as closed" });
    const first = session.suggestion().options.find((o) => o.move.kind === "cut along a singular leaf")!;
    session.commit(session.preview(first.move));
    session.runAutopilot({ automatic });

    // Both punctures have one cusp: the closed-surface move again, not "pseudo-Anosov".
    const again = session.suggestion();
    expect(again.kind).toBe("closed surface");
    expect(plainText(again.description)).toContain("each of the 2 artificial punctures");
    const before = session.current;
    expect((before.model as PolygonModel).points).toHaveLength(1); // the other new puncture is in the vertex

    const cut = again.options.find((o) => o.move.kind === "cut along a singular leaf")!;
    const preview = session.preview(cut.move);
    expect(preview.error).toBeUndefined();
    expect(preview.surface!.checkIntegrity()).toEqual([]);
    expect(preview.steps.length).toBeGreaterThan(5); // cut branch by branch
    for (const step of preview.steps) drawable(step.after, before.model);
    // The walled state: P filled in (the vertex and the point), then the walls contracted.
    const models = preview.steps.map((step) => modelOfSpine(step.after.spine0) as PolygonModel | undefined);
    expect(models.some((m) => m?.closed && m.filled?.length === 1)).toBe(true);
    expect(lastBeforeTidying(preview.steps)).toMatch(/^Contract the walls/);
    const result = modelOfSpine(preview.surface!.spine0) as PolygonModel;
    expect(result).toMatchObject({ kind: "polygon", closed: false });
    expect(result.filled).toBeUndefined();
  }, 300_000);

  it("contracts the walls on later moves too, choosing other walls if needed", () => {
    // On the third move, the first choice of walls leaves a new puncture between a side of the polygon and a chord with
    // the same ends, which convex cells can't draw; another choice can be.
    const session = Session.create({ kind: "preset", preset: "Point push with Dehn twists" });
    session.runAutopilot({ automatic });
    session.apply({ kind: "mark as closed" });
    for (let k = 0; k < 4; k++) {
      session.runAutopilot({ automatic });
      const suggestion = session.suggestion();
      expect(suggestion.kind).toBe("closed surface");
      session.apply((suggestion.options[0] as (typeof suggestion.options)[number]).move);
      const model = session.current.model as PolygonModel;
      expect(model).toMatchObject({ kind: "polygon", closed: false });
      expect(model.filled).toBeUndefined();
    }
  }, 300_000);
});

/** The text of the last step that neither merges valence-2 lines nor renames the strips. */
function lastBeforeTidying(steps: readonly { readonly text: Text }[]): string {
  const texts = steps.map((step) => plainText(step.text));
  return texts.findLast((t) => !/^(Merge the (\d+ )?valence-2 lines? |Rename the strips: )/.test(t)) ?? "";
}
