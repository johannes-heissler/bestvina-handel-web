import { describe, expect, it } from "vitest";
import { plainText } from "../fibred/suggestions";
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
    const fold = session.suggestion().options.find((o) => o.move.kind === "fold")!;
    const texts = session.preview(fold.move).steps.map((s) => plainText(s.text));
    expect(texts.some((t) => /the rest keeps the name \w+, the initial segment is called \w+₁/.test(t))).toBe(
      true,
    );
  });
});
