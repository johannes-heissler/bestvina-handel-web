# 24 — Marking a once-punctured surface as closed

**Source:** not in the C# code. Builds on the closed-surface moves (port notes 15 and 22).
**Target:** `src/fibred/suggestions.ts`, `src/fibred/move.ts` (the move), `src/examples/models.ts` (the closed model),
`src/session/session.ts` (the model of the new node)
**Status:** ✅ approved

## The problem

Some examples are given on a surface with one puncture but are really about the closed surface (e.g. "Point push").
When the algorithm finishes there with a pseudo-Anosov g and τ has **one cusp** at that puncture (`hasOneCuspPuncture`),
the finished suggestion offers the closed-surface moves right away: the cut along a singular leaf and the shortcut.

They then run on a surface that is not marked as closed, in an **ideal** polygon. `remarkClosedSurface` only works in a
closed polygon without interior points, so it gives up: the cut runs in one go (3 steps instead of one per branch), μ is
reset, and the result switches to the ribbon model.

## Proposal

1. **The finished suggestion** (pseudo-Anosov, one cusp, surface not closed) offers **one option** instead of the
   closed-surface moves: _Mark the surface as closed_. The description says why: the puncture has one cusp, so if it
   is not a real puncture, f on the closed surface is not pseudo-Anosov with this τ, and the algorithm continues there.
   The autopilot doesn't take it (it is a statement about the surface, the user's choice).
2. **The move** `{ kind: "mark as closed" }` sets `fs.isClosed = true`. G₀, g, μ, the strips and their names stay the
   same. Narration: "The puncture p is artificial: the surface is closed. G₀, g and μ stay the same." After it, the
   existing "closed surface" suggestion appears (`fs.isClosed && oneCusp`), with the cut and the shortcut.
3. **The model** of the new node, `closedModel(model)` in `models.ts` (headless), drawn on **the same G₀**
   (`spineOfGraph` already maps a model onto an existing G₀):
   - an ideal hyperbolic polygon without interior points → the **compact** polygon with the same word, `closed: true`
     (a single puncture means a single vertex class, so the compact polygon exists);
   - a flat polygon without interior points → the same vertices, `closed: true`;
   - a ribbon model → the same words, `closed: true`;
   - otherwise (a polygon with interior points, the plane): undefined, and the node gets the closed ribbon model of
     G₀ (`ribbonModelOf`). The surface is still closed then, only the cut is not shown branch by branch.

   `Session.addChild` picks it when the surface became closed (`surface.isClosed && !parent.surface.isClosed`), so it
   also works when a saved session is replayed. The name of the model gets " (closed)" appended.

4. Then the cut runs with the remarking in the compact polygon: shown branch by branch, the new punctures Q inside the
   polygon, as for "Closed genus 2".

## Decisions (author, 2026-10-19)

1. **Only at the end**, at the finished state.
2. The cut and the shortcut are offered **only after marking** (and updating the model).
3. The label is "Mark the surface as closed (the puncture is artificial)".
4. **Polygons with interior points** keep the fallback (the closed ribbon model). The case is rare: one puncture in
   all means no ideal vertex class, so it is a compact polygon (`closed: true`) with exactly one interior point.
   Marking it closed would remove that point, which merges cells and changes G₀.
5. The timeline fix for a new G₀ without a model of its own (drawn as a ribbon graph, like the history) is part of
   the same change.

## Tests

- "Point push" after the autopilot: the finished suggestion has exactly the one option; after it, the suggestion is
  "closed surface", the node's model is the compact polygon "a b A B c d C D", and μ is unchanged.
- The cut after it shows one state per cut branch (more than 3 steps), and every moment of the timeline draws without a
  note.
- `closedModel` for each kind (ideal, flat, ribbon; undefined with interior points), and the replay of a saved session
  with the move gives the same model.
- The existing test "offers cutting along a singular leaf; for the point push…" (`suggestions.test.ts`) goes through
  the new move.
