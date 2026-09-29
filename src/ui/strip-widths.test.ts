import { describe, expect, it } from "vitest";
import { layout } from "../embedding/layout";
import { perronFrobenius } from "../fibred/perron-frobenius";
import { Session } from "../session/session";
import { decodeSession } from "../session/share";
import { chartFor } from "./drawing";

// Strips with Perron–Frobenius widths from 1.47 (d₁) to 24.8 (c); z and d₁ each cross a side alone.
const LINK =
  "s=zZPBasMwDIZfxfxnF7aUwfBj7Fp6UG2l1ebIwXLCRsm7jxQGO5TBRgtDFyHEp1_60Rl9qQM1BBzY2ixKmxNp4rwxNpOi8Ji5XrKw9bBGtSGc8SaaEDBWNm7wX0nAC2kqgxtoHEWPLmYyc6LuyDqZ6-BhzAmhe148WmVeafEkOVVWhN0ZQ5n5-4gpZ9fkeGpY_I-dldeCE-W-lyis8QMedNFrrcqIgAQP0cTvCNtl3YdHQwDlfGN69yf6TJk18qZzr5PGJkXtxroe_6mup7u6cV_6L28aS8402sqfqQppczYd-lLZ1le6DDCEHRL2t7Jnv1wPjzjVytoQdg_-SuyXTw";

describe("the strip widths drawn to scale", () => {
  it("are equal for c = 0, proportional to the widths for c = 1, and in their order in between", async () => {
    const { session } = Session.fromFile((await decodeSession(LINK))!);
    const { surface, model } = session.current;
    const widths = perronFrobenius(surface, { essentialOnly: false }).widths;
    const edges = surface.graph.edges;
    const relative = (c: number) =>
      layout(surface, chartFor(model, surface), { widthExponent: c }).relativeWidth;

    const equal = relative(0);
    for (const e of edges) expect(equal.get(e)).toBeCloseTo(equal.get(edges[0]!)!, 12);

    const exact = relative(1);
    const ratio = exact.get(edges[0]!)! / widths.get(edges[0]!)!;
    for (const e of edges) expect(exact.get(e)! / widths.get(e)!).toBeCloseTo(ratio, 9);

    const between = relative(0.5);
    const byWidth = [...edges].sort((e, f) => widths.get(e)! - widths.get(f)!);
    for (let i = 1; i < byWidth.length; i++)
      expect(between.get(byWidth[i]!)!).toBeGreaterThanOrEqual(between.get(byWidth[i - 1]!)!);
  });
});
