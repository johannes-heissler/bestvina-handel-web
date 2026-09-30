import { describe, expect, it } from "vitest";
import { plainText, type SuggestionKind } from "../fibred/suggestions";
import { Session } from "./session";
import { decodeSession } from "./share";

// A state with an inefficiency of order 2 whose first fold creates a junction of valence 2 (the Case 2 of the thesis).
const LINK =
  "s=5VjLbuIwFP2V6KxNVeioC--gXcwntEIsTHJTPDVOZJsIBkXqP_QP-yWVA1UfGXDbKS1yZCkkhJx7HjdG9hp5YebCgWNK1lVSi95M6IxUz5K1stBgqMg0Z7zPYJ0wDnyNW6kzcJSGLDmwpxOO0Rbn4e7-d4OU0FLMS0XJ-UkfNYMzRB4hnUmVGdLg4zXmRUUvYPNCZfDVjCwt-BgjMFxiwiCa6s0NcAgwSJ3REvxXXbO9mOVCqcTJm5lD4Jet6r7MFAzDH2OwbPQzXIDB3xm1mWTPTAZfx8SQ_yKphCKdUm-Q_Fno1MlC2w9rCDt4dkAHvXur3e6tDuJei8Ww6aRv6qLPZ5cWSonSUiJ1JYwU2iV2Mc0LQ9a9yXTyPhJSU57LVJJOvdWv5S9ftoCHJ48OodQRSPz7XolhEpN6M1i4Ua68Sf12p7yxqnmOr_30m5Mx5LH8oyk4EOqkL3y3j4ruB2z2V8P9vPs7eGdb3v5zUyYs4Z_1LwLlDzcbXW3_VVaB4H7-JQzPM7vFDaJWdxa3usjDizy96OOLPb_4A4w-wQ5EGH-GXQixAyl2IsYu5BhFkMe6NdMy_7pZav_XKrmFudlJPczK-2kD4lgGQ7owhrQDH5-yfWPgj5P6EQ";

const bookkeeping = new Set<SuggestionKind>([
  "collapse invariant subforest",
  "pull tight",
  "move vertices",
  "absorb into periphery",
  "remove valence-2 junctions",
]);

describe("folding step by step with the automatic steps in between", () => {
  it("doesn't undo a fold by removing the junction of valence 2 it created, and finishes", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    let steps = 0;
    for (; steps < 20 && session.suggestion().kind !== "finished"; steps++) {
      session.apply(session.suggestion().options[0]!.move);
      session.runAutopilot({ automatic: bookkeeping });
    }
    expect(session.suggestion().classification).toMatchObject({ kind: "pseudo-Anosov" });
    expect(steps).toBeLessThan(10);
  });

  it("explains the fold step by step, including the Case 2", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    session.disabled = new Set(["move vertices"]); // (these tests are about folds and the bookkeeping steps)
    const node = session.apply(session.suggestion().options[0]!.move);
    const text = (node.steps ?? []).map(plainText);
    expect(text[0]).toMatch(/of order 2/);
    expect(text.some((t) => t.startsWith("Case 2 of the thesis"))).toBe(true);
    expect(text.some((t) => t.startsWith("Subdivide"))).toBe(true);
    expect(text.some((t) => t.startsWith("Fold the initial segments"))).toBe(true);
    expect(text.at(-1)).toMatch(/order 1/);
  });
});
