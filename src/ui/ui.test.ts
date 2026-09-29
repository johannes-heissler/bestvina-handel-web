// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import InfoPanel from "./InfoPanel.svelte";
import { app } from "./state.svelte";
import HistoryView from "./HistoryView.svelte";
import SuggestionPanel from "./SuggestionPanel.svelte";

describe("components", () => {
  it("shows the result of a finished example", () => {
    app.start({ kind: "preset", preset: "Anosov map of the torus" });
    render(InfoPanel);
    expect(screen.getByText(/pseudo-Anosov, λ = 2\.618034/)).toBeTruthy();
  });

  it("applies the selected option of the next step and records it in the history", async () => {
    app.start({ kind: "preset", preset: "Point push" });
    render(SuggestionPanel);
    render(HistoryView);
    expect(screen.getAllByText(/g is not tight|invariant|inefficien/).length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    flushSync();
    expect(app.session?.current.parent).toBe(app.session?.root);
    expect(screen.getByRole("button", { name: /↑ Back:/ })).toBeTruthy();
  });
});
