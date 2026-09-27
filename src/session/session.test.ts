import { describe, expect, it } from "vitest";
import { Session } from "./session";
import { decodeSession, encodeSession } from "./share";

describe("Session", () => {
  it("applies moves to copies and keeps the history as a tree", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
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
    const stopped = session.runAutopilot();
    expect(stopped.kind).toBe("finished");
    const conjugated = Session.create({
      kind: "model",
      model: modelTorus(),
      map: "a -> b a a, b -> A b a a",
    });
    conjugated.runAutopilot();
    expect(conjugated.path().length).toBeGreaterThan(2);
  });

  it("rejects a move that fails, without changing the history", () => {
    const session = Session.create({ kind: "preset", preset: "Anosov map of the torus" });
    expect(() => session.apply({ kind: "edit map", text: "a -> a a", mode: "replace" })).toThrow();
    expect(session.root.children).toEqual([]);
  });

  it("saves and replays, also through a link", async () => {
    const session = Session.create({ kind: "model", model: modelTorus(), map: "a -> b a a, b -> A b a a" });
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
