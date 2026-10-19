import { describe, expect, it } from "vitest";
import type { FibredSurface } from "../fibred/fibred-surface";
import { plainText } from "../fibred/suggestions";
import { trainTrack } from "../fibred/train-track";
import { Session } from "./session";
import { decodeSession } from "./share";

// Saved with format 1 (before the new names): fold, pull tight, … at Bestvina–Handel example 6.3.
const OLD_LINK =
  "s=zVLLasMwEPwVM-dNadLHQbekOfQTCsEH2d40ahXZSLIxGEP_oX_YLylyXAgNsVNaQ9mDVq-Z2d1psM3tXnoIJOx8pYyc7aTJWM8cO6dyA0LFtsvEnOC8tB6iwasyGQQKy4496CsRWPU4H2_vjx1SxLXcF5qj-6s5WoK3zAEh3SmdWTYQmwb7vOIj2G2uMwQ2qwoHscEKhDViguzYuwsISBCUybiGuG3p8E00QcyWreUAtQYh7dcDC9C2NEhflFpHXj3vPEZenghNQFgOCr05IzTphU6pLjThAYRwuhpROZ2KJQjJIPvd37FbDgdRJTWblGeL6KU0qVe5cWM_01xrWTiOlKmkVdL4yJXJNrfs_LeZxz9tgZyDUJ_2oD429HQTCLvlfHAEizM2zXqbZqM-PZ17KPpphHW6ouvO-L-p-b-XfLHX4_ayIKSltWw8xOaaLoi4_QQ";

describe("the names that folds give", () => {
  it("replays sessions saved before the new names completely, with the old names", async () => {
    const { skipped } = Session.fromFile((await decodeSession(OLD_LINK))!);
    expect(skipped).toBe(0);
  });

  it("keeps the name of the rest of a subdivided strip in new sessions", () => {
    const session = Session.create({ kind: "preset", preset: "Bestvina–Handel example 6.1" });
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const fold = session.suggestion().options.find((o) => o.move.kind === "fold")!;
    const texts = session.preview(fold.move).steps.map((s) => plainText(s.text));
    expect(
      texts.some((t) => /the rest keeps the name \w+, the initial segment is called \w+_1/.test(t)),
    ).toBe(true);
  });
});

/** The names of the junctions and strips of G and of the switches and branches of τ. */
function names(fs: FibredSurface): string[] {
  const tt = trainTrack(fs);
  return [...fs.graph.vertices, ...fs.graph.edges, ...tt.graph.vertices, ...tt.graph.edges].map(
    (x) => x.name,
  );
}

describe("default names (port note 25)", () => {
  // Through the closed-surface move (switches and infinitesimal branches become junctions and strips), and with
  // peripheral lassos and stems.
  const presets = ["Closed genus 2", "Bestvina–Handel example 6.2"];

  it("never put a digit right after a letter in new sessions", { timeout: 60_000 }, () => {
    for (const preset of presets) {
      const session = Session.create({ kind: "preset", preset });
      session.runAutopilot();
      for (const node of session.path())
        expect(names(node.surface).filter((name) => /\p{L}\d/u.test(name))).toEqual([]);
    }
  });

  it("replays sessions saved before format 4 with the old names", { timeout: 60_000 }, () => {
    for (const preset of presets) {
      const old = Session.create({ kind: "preset", preset }, true);
      old.runAutopilot();
      expect(old.root.surface.graph.vertices.map((v) => v.name)).toContain("v0");
      const file = { ...old.toFile(), version: 3 };
      const { session, skipped } = Session.fromFile(JSON.parse(JSON.stringify(file)));
      expect(skipped).toBe(0);
      expect(session.current.surface.toString()).toBe(old.current.surface.toString());
      expect(names(session.current.surface)).toEqual(names(old.current.surface));
    }
  });
});
