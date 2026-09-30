import { describe, expect, it } from "vitest";
import { plainText } from "../fibred/suggestions";
import { Session } from "./session";
import { decodeSession, encodeSession } from "./share";

describe("Session", () => {
  it("applies moves to copies and keeps the history as a tree", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const before = session.current.surface.toString();
    const first = session.suggestion().options[0]!.move;
    const a = session.apply(first);
    expect(session.root.surface.toString()).toBe(before); // the root is unchanged
    session.select(session.root);
    expect(session.apply(first)).toBe(a); // the same move reuses the child
    session.select(session.root);
    const other = session.suggestion().options[1]?.move;
    if (other) {
      session.apply(other);
      expect(session.root.children).toHaveLength(2);
    }
  });

  it("records every autopilot step as a node", () => {
    const session = Session.create({ kind: "preset", preset: "Anosov map of the torus" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const stopped = session.runAutopilot();
    expect(stopped.kind).toBe("finished");
    const conjugated = Session.create({
      kind: "model",
      model: modelTorus(),
      map: "a -> b a a, b -> A b a a",
    });
    conjugated.disabled = new Set(["move vertices"]); // (with it, one move undoes the conjugation)
    conjugated.runAutopilot();
    expect(conjugated.path().length).toBeGreaterThan(2);
  });

  it("rejects a move that fails, without changing the history", () => {
    const session = Session.create({ kind: "preset", preset: "Anosov map of the torus" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    expect(() => session.apply({ kind: "edit map", text: "a -> a a", mode: "replace" })).toThrow();
    expect(session.root.children).toEqual([]);
  });

  it("saves and replays, also through a link", async () => {
    const session = Session.create({ kind: "model", model: modelTorus(), map: "a -> b a a, b -> A b a a" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    session.runAutopilot();
    session.select(session.path()[2]!);
    const file = session.toFile();
    const { session: again, skipped } = Session.fromFile(JSON.parse(JSON.stringify(file)));
    expect(skipped).toBe(0);
    expect(again.current.surface.toString()).toBe(session.current.surface.toString());
    const link = await encodeSession(file);
    expect(link.startsWith("s=")).toBe(true);
    expect(await decodeSession(`#${link}`)).toEqual(file);
    expect(await decodeSession("#nothing")).toBeUndefined();
  });

  it("switches to the ribbon model of the new spine after a closed-surface move", () => {
    const session = Session.create({ kind: "preset", preset: "Closed genus 2" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const cut = session.suggestion().options[0]!.move;
    const node = session.apply(cut);
    expect(node.model.kind).toBe("ribbon");
  }, 60_000);
});

function modelTorus() {
  return {
    kind: "polygon",
    name: "torus",
    description: "",
    word: ["a", "b", "A", "B"],
    geometry: { kind: "ideal" },
    closed: false,
  } as const;
}

describe("the next fold after a fold step", () => {
  it("is suggested first and marked", () => {
    // In BH 6.1, after three folds (with the bookkeeping in between) there is a fold of order 2.
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const bookkeeping = new Set([
      "pull tight",
      "collapse invariant subforest",
      "move vertices",
      "remove valence-2 junctions",
      "absorb into periphery",
    ] as const);
    let deep;
    for (let k = 0; k < 10 && !deep; k++) {
      session.runAutopilot({ automatic: bookkeeping });
      const suggestion = session.suggestion();
      deep = suggestion.options.find((o) => o.move.kind === "fold" && (o.rating ?? 0) >= 2);
      if (!deep) session.apply(suggestion.options[0]!.move);
    }
    expect(deep).toBeDefined();
    session.apply(deep!.move);
    expect(session.current.followUp).toBeDefined();
    const next = session.suggestion();
    expect(next.kind).toBe("fold");
    expect(plainText(next.options[0]!.label)).toMatch(/^Next fold of the last inefficiency: .*order 1/);
  });
});

describe("the hint for the next fold", () => {
  it("survives the automatic steps after the fold", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const bookkeeping = new Set([
      "pull tight",
      "collapse invariant subforest",
      "move vertices",
      "remove valence-2 junctions",
      "absorb into periphery",
    ] as const);
    let deep;
    for (let k = 0; k < 10 && !deep; k++) {
      session.runAutopilot({ automatic: bookkeeping });
      const suggestion = session.suggestion();
      deep = suggestion.options.find((o) => o.move.kind === "fold" && (o.rating ?? 0) >= 2);
      if (!deep) session.apply(suggestion.options[0]!.move);
    }
    session.apply(deep!.move);
    session.runAutopilot({ automatic: bookkeeping });
    const next = session.suggestion();
    if (next.kind === "fold")
      expect(plainText(next.options[0]!.label)).toMatch(/^Next fold of the last inefficiency/);
  });
});
