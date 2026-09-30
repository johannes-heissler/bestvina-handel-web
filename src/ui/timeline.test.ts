import { describe, expect, it } from "vitest";
import { plainText, variants } from "../fibred/suggestions";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { drawTimeline } from "./drawing";

// A fold whose isotopy (moving the new junction along B A b) passes through states that can't be laid out: the
// strip runs parallel to another one with the same μ until they are folded.
const LINK =
  "s=zVLLasMwEPwVM-dNadLHQbekOfQTCsEH2d40ahXZSLIxGEP_oX_YLylyXAgNsVNaQ9mDVq-Z2d1psM3tXnoIJOx8pYyc7aTJWM8cO6dyA0LFtsvEnOC8tB6iwasyGQQKy4496CsRWPU4H2_vjx1SxLXcF5qj-6s5WoK3zAEh3SmdWTYQmwb7vOIj2G2uMwQ2qwoHscEKhDViguzYuwsISBCUybiGuG3p8E00QcyWreUAtQYh7dcDC9C2NEhflFpHXj3vPEZenghNQFgOCr05IzTphU6pLjThAYRwuhpROZ2KJQjJIPvd37FbDgdRJTWblGeL6KU0qVe5cWM_01xrWTiOlKmkVdL4yJXJNrfs_LeZxz9tgZyDUJ_2oD429HQTCLvlfHAEizM2zXqbZqM-PZ17KPpphHW6ouvO-L-p-b-XfLHX4_ayIKSltWw8xOaaLoi4_QQ";

describe("the timeline of a move", () => {
  it("draws every moment of an isotopy, also through states that can't be laid out", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const choice = session
      .suggestion()
      .options.flatMap((o) => variants(session.current.surface, o.move))
      .find((c) => plainText(c.label).includes("crosses B A b (its"));
    expect(choice).toBeDefined();
    const preview = session.preview(choice!.move);
    const states = [preview.before, ...preview.steps.map((s) => s.after)];
    const motions = preview.steps.map((s) => s.motion);
    expect(motions.filter(Boolean)).toHaveLength(3); // across B, A and b
    for (let position = 0; position <= preview.steps.length; position += 0.25)
      expect(drawTimeline(session.current.model, states, motions, position, { size: 200 }).notes).toEqual([]);
  });
});

describe("contracting strips as isotopies", () => {
  it("slides the junctions of a collapsed tree and of a removed valence-2 junction across the sides, drawably", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const found = new Set<string>();
    for (let i = 0; i < 40 && found.size < 2; i++) {
      const s = session.suggestion();
      if (s.kind === "finished") break;
      const move = s.autopilotMove ?? s.options[0]!.move;
      if (move.kind === "collapse invariant subforest" || move.kind === "remove valence-2 junctions") {
        const preview = session.preview(move, new Set());
        const motions = preview.steps.map((x) => x.motion);
        if (motions.some(Boolean)) {
          found.add(move.kind);
          const texts = preview.steps.map((x) => plainText(x.text));
          expect(texts.some((t) => t.startsWith("Isotopy: slide the junction"))).toBe(true);
          expect(
            texts.some((t) =>
              t.startsWith(move.kind === "remove valence-2 junctions" ? "Merge" : "Contract"),
            ),
          ).toBe(true);
          const states = [preview.before, ...preview.steps.map((x) => x.after)];
          for (let position = 0; position <= preview.steps.length; position += 0.25)
            expect(
              drawTimeline(session.current.model, states, motions, position, { size: 100 }).notes,
            ).toEqual([]);
        }
      }
      session.apply(move);
    }
    expect([...found].sort()).toEqual(["collapse invariant subforest", "remove valence-2 junctions"]);
  });
});

describe("the strand order with a hairpin", () => {
  it("lays out the states of an isotopy that moves a junction of valence 2 across sides", async () => {
    const { strandOrder } = await import("../embedding/strand-order");
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const choice = session
      .suggestion()
      .options.flatMap((o) => variants(session.current.surface, o.move))
      .find((c) => plainText(c.label).includes("crosses B A b (its"));
    const preview = session.preview(choice!.move);
    // Each state after crossing a side has the junction just beyond it, both of its strips crossing that side.
    for (const step of preview.steps.filter((s) => s.motion))
      expect(() => strandOrder(step.after.mu)).not.toThrow();
  });

  it("keeps the strips visible while the moved junctions wait for the fold", async () => {
    // Twice-punctured torus, seed 2: after the first isotopy the layout puts the moved junction right next to a strip,
    // which used to shrink every strip of the picture to nothing until the fold.
    const hash =
      "s=fY2xasQwEER_RUwtg0m6bfMHaY8rFGvPViKtjHblK4z_PfjATYowzcxjmNnxqK0EA-GL1bYkYViCRM6DsmqqAo-N28vRu4daaAba8ZMkgrA2Vjb4yxA-g8RaXAnrmmR2Uw6qrj6cLezsmSYe1i6T9cbRWW1d4aHMEfR2eFhjPuenJeXYWEC3HaVuL3h99pydpXkxHP7f5hnd93mXqrhUwszwuAAI2wiPkKvMIHz8mbsfpzym3hqLgW6jH-_HLw";
    const { session } = Session.fromFile((await decodeSession(hash))!);
    const preview = session.preview(session.suggestion().options[0]!.move);
    const states = [preview.before, ...preview.steps.map((s) => s.after)];
    const motions = preview.steps.map((s) => s.motion);
    const fold = preview.steps.findIndex((s) => plainText(s.text).startsWith("Fold")) + 1; // the state after it
    expect(motions.filter(Boolean).length).toBeGreaterThan(0);
    /** The widest strip of a moment (half its width in pixels, as the highlight on hovering uses it). */
    const widest = (position: number) => {
      const { svg } = drawTimeline(session.current.model, states, motions, position, { size: 800 });
      return Math.max(...[...svg.matchAll(/--grow:([0-9.]+)px/g)].map((m) => Number(m[1])));
    };
    const before = widest(0);
    for (let position = 0; position < fold; position += 0.5)
      expect(widest(position), `at ${position}`).toBeGreaterThan(before / 2);
  });
});
