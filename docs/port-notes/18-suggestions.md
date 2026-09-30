# 18 — The suggestion system and the autopilot

**C# source:** `FibredSurfaceAlgorithmSuggestionSystem.cs` (388 lines: `AlgorithmSuggestion`, `NextSuggestion`,
`ApplySuggestion`, `BestvinaHandelAlgorithm`)
**Target:** `src/fibred/move.ts` (`Move`, `applyMove`), `src/fibred/suggestions.ts` (`nextSuggestion`, `variants`,
`combine`, `autopilot`), `src/fibred/algorithm.ts` (now a thin layer on top)
**Status:** 🔍 ported, as proposed in port note 07

## What the C# code does

A suggestion is a description, a list of options `(object, string)`, and a list of button strings. `ApplySuggestion`
`switch`es over the button text and casts the option objects back to what the move needs (strip names, a serialized
`EdgePoint`, a QuikGraph subgraph). Moves "in steps" are `IEnumerator`s that pause at inner suggestions and read the
user's answer from two side-channel fields; while one runs, the surface can't be copied.

## The port

**`Move`** (`move.ts`): a discriminated union, one case per move, holding every choice **by name**:

| kind                              | fields                                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| `collapse invariant subforest`    | `strips`, optional `centers`                                                |
| `pull tight`                      | optional `at` (turning strips; all if omitted)                              |
| `remove valence-1 junction`       | `junctions`                                                                 |
| `absorb into periphery`           | —                                                                           |
| `reduce`                          | `preserved`, optional `piece`                                               |
| `ignore reducibility`             | —                                                                           |
| `remove valence-2 junctions`      | optional `junctions` (all if omitted), optional `removed`                   |
| `fold peripheral inefficiency`    | `strips`, optional `fold`                                                   |
| `remove inefficiency`             | `at` (strip + index), `steps: "one" \| "all"`, optional `fold` (first step) |
| `cut along a singular leaf`       | `junction` (q), optional `prong` and `realBranches`                         |
| `replace puncture by singularity` | `junction` (the shortcut of port note 15)                                   |

A move is JSON, so it can be applied to a copy (the history keeps every state) and stored on the edges of the history
graph. `applyMove(fs, move)` is one typed `switch`. It returns the surface: the same object for in-place moves, a new one
for the two closed-surface moves (with `isClosed` carried over). Unknown names throw.

**`nextSuggestion(fs)`** follows the C# priority order:

1. collapse invariant subforests;
2. pull tight;
3. valence-1 junctions;
4. absorb into the periphery;
5. finite order (finished);
6. reducible (unless ignored);
7. valence-2 junctions;
8. peripheral inefficiencies;
9. inefficiencies;
10. **the closed-surface move**;
11. finished.

A suggestion has a `kind`, a `description` as **structured text** (strings and `{ strip }` / `{ junction }` references for
the UI's colours), `options` (the first is the default), `multiple` (whether several may be selected), and for "finished"
and "reducible" a `classification`.

**Second-level choices are computed on demand**, since some require trying the move on a copy. `variants(fs, move)`
returns:

- the fold options of an inefficiency step or a peripheral fold, with their ratings (the side crossings of all strips
  afterwards, shown as "7 side crossings"). Only options with at most two more crossings than the best are offered, so
  the list stays short. A fold also gets one "remove completely" choice per inefficiency point behind it, except for
  points of order 1, where that is the fold itself;
- the centres of a one-component collapse;
- the strip to remove at a valence-2 junction;
- the pieces of a reduction (kind, strips, period);
- the cuts of a closed surface (prong and length).

A variant's names are read **while choosing**: a fold may rename the kept strip afterwards (found by a test).

**`combine(moves)`** merges selected options for the kinds with `multiple` (the C# "tighten selected", "remove selected").

**Runs "in steps"** are stateless: after one step, the next suggestion is computed from the new state. For example,
`remove inefficiency` with `steps: "one"` lowers the order by one, and the followed inefficiency reappears among the next
options with a lower order. No generator side channel, and every intermediate state can be copied.

## The closed-surface flag

The algorithm needs to know that a puncture is artificial: on a genuinely once-punctured surface, a 1-pronged puncture is
allowed. So **`FibredSurface.isClosed`** is new (the example `closedGenus2OneCusp` sets it). The closed-surface suggestion
appears when `isClosed` and τ has one cusp at the only puncture. Its options are cutting (the thesis's move, the default,
as you decided) and the shortcut, for each singularity, sorted by period. By default, the cut length is the shortest cut
in q's orbit.

## Autopilot

`autopilot(fs, { automatic, maxSteps, onStep })` applies the default option while the suggestion's kind is in
`automatic`, checks the integrity after every move, and reports each move and resulting surface to `onStep` (for the
history). It stops at any other kind and returns that suggestion.

- The default `automatic` is everything except the reduction decision, so "run to the end" stops at a reduction.
- The semi-automatic mode you described is `automatic = { "pull tight", "remove valence-2 junctions", … }`: the UI shows
  a multi-select list of kinds, and the autopilot skips exactly those.
- The jump-ahead buttons are autopilot runs whose `onStep` adds every intermediate state to the history graph.

`nextStep`/`runAlgorithm` (`algorithm.ts`) are the in-place special case (no closed-surface move), used by the tests of the
moves. `classify` reads the classification of the "finished" suggestion.

## Changes compared to C#

- No "convert to train track" step (port note 14). The C# final suggestion "the graph map is a train track map" is the
  "finished" suggestion with the classification.
- "Absorb in steps" and "collapse in steps" are gone: absorbing is one computation (port note 17). A collapse "in steps"
  is a sequence of one-forest collapses with a chosen centre, and those are ordinary options and variants.
- The C# autopilot always pressed "Ignore and continue". The port stops at a reduction unless `reducible` is added to
  `automatic` (then it reduces to the first piece) or the user ignores it.
- The option `peripheralInefficiencyButton` was marked `todo!` in C#. The port folds the group with the chosen c.

## Tests

`src/fibred/suggestions.test.ts` (15 tests):

- the suggestion kinds and their default options for tightening, inefficiencies (sorted by order, JSON round trip), a
  reducible map ("ignore" last), finished maps (pseudo-Anosov, finite order), and the closed surface (only with
  `isClosed`; cuts sorted by period);
- applying a move to a copy leaves the original unchanged, and unknown names throw;
- `combine`;
- variants: every fold option of an inefficiency step can be applied, and its rating is μ's length afterwards; the pieces
  of a reduction; the choices at a valence-2 junction;
- the autopilot: to the end with `onStep`, semi-automatic with only "pull tight", stopping at a reduction, and on the
  closed genus-2 example cutting first and ending at λ ≈ 4.2121.

## Update: folds as pairs of strips, one step at a time (your proposal)

The suggestions "fold peripheral inefficiency" and "remove inefficiency" are merged into one kind, **fold**:

- **Options are folds, not inefficiencies.** Each option is a set of strip ends at a junction with the same Dg, whose
  initial segments are folded. `foldCandidates` groups every occurrence of an illegal turn in the images by the
  **first fold** of its removal (for an inefficiency (α, β) of order k, that fold is Dgᵏ⁻¹(α) and Dgᵏ⁻¹(β)). The
  label names the strips, in the C# wording: "Fold a and initial segments of b, c at v: **order k, n places**". k is
  the smallest order among them, and n is how many places in the images have an inefficiency of that order, i.e. where
  one could pull tight after the fold.
- **Peripheral folds are in the same list**, marked "peripheral: Dg = p is in the pre-periphery", even when no
  inefficiency leads to them. As in the C# priority order, they come first, then the lowest order.
- **Apply does one fold step** (the new move `fold`), as in the thesis. The followed inefficiency then appears with a
  lower order. _More choices…_ lists the choices of c (and the junction moves for loops), and also "remove the whole
  inefficiency at once".
- **The autopilot** still removes whole inefficiencies at once (`Suggestion.autopilotMove`). Recomputing all candidates
  after every single fold is too slow on the large graphs of the closed-surface cuts.

## Update: the natural next fold comes first

After a fold step, the step reports the inefficiency it followed (now of order k − 1) and the strips of its next fold
(`MoveHooks.followUp`). The session stores this hint at the new node and **passes it on through the automatic steps**
after the fold: pulling tight changes the images, but not the names of the strips to fold. The next suggestion puts
that fold first, marked "Next fold of the last inefficiency", with an accent bar in the UI.

## Update: checking the peripheral subgraph

`periphery.ts` checks P against its definition (the thesis, § "Periphery"): (1) its components are disjoint circle
graphs, each a boundary word of G; (2), weakened: g maps P into P, and the image of each circle, read around it and
cyclically reduced, is its image circle, once and with the same orientation (backtracking inside P is allowed; g need
not act as an automorphism); (3) the boundary words outside P form exactly one orbit under g. Absorbing into the
periphery now also runs when g maps P into P but not as an automorphism (e.g. p ↦ p P p), and restores that; it only
uses the signed lengths of the pieces in P, so backtracking there is fine (tested).

- The State panel shows a warning while P is inconsistent (also after it was ignored).
- A new suggestion **"peripheral subgraph"**, after the finite-order check and before the reducibility check, when P
  is inconsistent: the possible peripheral subgraphs (the thesis's remark under the definition: for each orbit of
  boundary words taken as essential, the boundary words of the other punctures, if they are disjoint circles that g
  maps into themselves), with the essential puncture or orbit, as moves "set peripheral subgraph"; if there is none, it
  says so. "Ignore and continue with P as it is" (move "ignore peripheral subgraph", flag `ignorePeriphery`) is greyed
  out with the warning that convergence and correctness are not guaranteed, as is "Ignore and continue" at a
  reducible map now. The autopilot stops at the suggestion.
- The summary of a move mentions when P changed.

## Update: moving vertices as a step; switching moves off; no valence-1 step

- **Moving vertices** is its own step (kind "move vertices"), directly after absorbing into the periphery: at every
  junction v not on P (moving those would change the images of P), for every first strip a of the images at v, the move
  g(v) ↦ end of a (images starting with a lose it, the others get ā in front), offered if λ after pulling tight is
  smaller, the smallest first. It is an automatic step by default (the autopilot takes the first option, the least λ).
- **Options** (formerly "Automatic steps"): besides the automatic kinds, the moves beyond the original algorithm can be
  switched off: cutting along a singular leaf, reductions (reducing and splitting junctions along τ), moving vertices.
  Switched off, their options are greyed out with a warning (`SuggestionContext.disabled`, `Session.disabled`), and
  the autopilot stops at a greyed-out default. The step of moving vertices is then skipped, and its moves are shown
  greyed out with the next suggestion.
- **The valence-1 step is gone.** Once there are no invariant forests and g is tight, G has no junction of valence 1
  (it would be extremal or its strip pretrivial). Checked on 1002 states of 90 runs: none. The move stays for old
  sessions.

### How much does moving vertices save? (all presets, 40 random mapping classes each of genus 2 and of the

twice-punctured torus, run to the end with the default automatic steps, with and without it)

|                                     | moves with / without             | single folds with / without | time with / without |
| ----------------------------------- | -------------------------------- | --------------------------- | ------------------- |
| BH 6.1                              | 17 / 20                          | 5 / 16                      | 58 / 55 ms          |
| Point push                          | 8 / 9                            | 6 / 7                       | 68 / 111 ms         |
| random genus 2 (mean)               | 7.9 / 6.8 (from −13 to +8 saved) | 3.2 / 4.8 (−1 to +9 saved)  | 15 / 16 ms          |
| random twice-punctured torus (mean) | 4.8 / 4.7 (−13 to +5 saved)      | 1.6 / 2.8 (0 to +9 saved)   | 5 / 7 ms            |

All runs end with the same result and λ. Moving vertices saves about a third of the folds, but greedily it takes many
small steps (e.g. λ 22.86 → 22.69 → 22.47 → …, where one fold goes from 21.2 to 17.5), so the number of moves is about
the same on average, and sometimes much larger (+13).
