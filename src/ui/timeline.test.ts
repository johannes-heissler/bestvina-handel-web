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
    const choice = session
      .suggestion()
      .options.flatMap((o) => variants(session.current.surface, o.move))
      .find((c) => plainText(c.label).includes("B A b"));
    expect(choice).toBeDefined();
    const preview = session.preview(choice!.move);
    const states = [preview.before, ...preview.steps.map((s) => s.after)];
    const motions = preview.steps.map((s) => s.motion);
    expect(motions.filter(Boolean)).toHaveLength(3); // across B, A and b
    for (let position = 0; position <= preview.steps.length; position += 0.25)
      expect(drawTimeline(session.current.model, states, motions, position, { size: 200 }).notes).toEqual([]);
  });
});
