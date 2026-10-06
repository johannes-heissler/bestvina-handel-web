import { describe, expect, it } from "vitest";
import { presetNamed } from "../examples/presets";
import { peripheryProblems } from "../fibred/periphery";
import { autopilot, plainText, type Suggestion } from "../fibred/suggestions";
import { Session } from "./session";

/** Applies the first option until the suggestion is of `kind` (or the algorithm stops). */
function runTo(session: Session, kind: string): Suggestion {
  for (let i = 0; i < 60; i++) {
    const s = session.suggestion();
    if (s.kind === kind || s.kind === "finished" || s.options.length === 0) return s;
    session.apply((s.autopilotMove ?? s.options[0]!.move)!);
  }
  return session.suggestion();
}

describe("the peripheral subgraph suggestion", () => {
  it("adds an invariant circle around a puncture to P when P is missing", () => {
    const stem = presetNamed("Twisted stem")!;
    const session = Session.create({ kind: "model", model: stem.model, map: stem.maps[0]!.text }); // without P
    expect(session.suggestion().kind).not.toBe("peripheral subgraph"); // P = ∅ is fine
    const s = runTo(session, "peripheral circles");
    expect(s.kind).toBe("peripheral circles");
    expect(s.options.map((o) => plainText(o.label))).toEqual(["Add to P: p"]);
    session.apply(s.options[0]!.move);
    expect([...session.current.surface.peripheral].map((e) => e.name)).toEqual(["p"]);
    expect(session.suggestion().kind).toBe("absorb into periphery");
  });

  it("leaves P empty while there is no invariant circle around a puncture", () => {
    const torus = presetNamed("Random mapping class of the twice-punctured torus")!;
    const session = Session.create({
      kind: "model",
      model: torus.model,
      options: torus.options!,
      map: "b -> A b",
    });
    // The rose: both boundary words pass its one junction, so they can't be peripheral circles.
    expect(peripheryProblems(session.current.surface)).toEqual([]);
    const { surface, moves, stoppedAt } = autopilot(session.current.surface);
    expect(stoppedAt.kind).toBe("reducible");
    expect(moves.map((m) => m.kind)).not.toContain("set peripheral subgraph");
    expect(surface.peripheral.size).toBe(0);
  });

  it("adds the circle around a puncture once a later graph has one", () => {
    // Found by brute force: this map fixes both punctures, and after a few folds the circle around one of them is
    // a strip of its own.
    const session = Session.create({
      kind: "preset",
      preset: "Random mapping class of the twice-punctured torus",
      seed: 38,
    });
    const s = runTo(session, "peripheral circles");
    expect(s.kind).toBe("peripheral circles");
    session.apply(s.options[0]!.move);
    expect(session.current.surface.peripheral.size).toBeGreaterThan(0);
    expect(peripheryProblems(session.current.surface)).toEqual([]);
    expect(runTo(session, "finished").classification?.kind).toBe("pseudo-Anosov");
  });

  it("offers P = ∅ first for an inconsistent P chosen at the start", () => {
    const stem = presetNamed("Twisted stem")!;
    const session = Session.create({
      kind: "model",
      model: stem.model,
      options: { peripheralStrips: ["s"] },
      map: stem.maps[0]!.text,
    });
    const s = session.suggestion();
    expect(s.kind).toBe("peripheral subgraph");
    expect(plainText(s.options[0]!.label)).toBe("P = ∅");
    session.apply(s.options[0]!.move);
    expect(session.current.surface.peripheral.size).toBe(0);
  });

  it("marks ignoring reducibility with the warning", () => {
    const session = Session.create({ kind: "preset", preset: "Reducible map" });
    const s = runTo(session, "reducible");
    const ignore = s.options.find((o) => o.move.kind === "ignore reducibility")!;
    expect(ignore.discouraged).toBe(true);
    expect(ignore.warning).toMatch(/not guaranteed/);
  });
});
