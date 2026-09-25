# 09 — Removing junctions of valence 1 and 2

**C# source:** `FibredSurfaceValence1and2Junctions.cs` (122 lines)
**Target:** `src/fibred/moves/valence.ts`
**Status:** 🔍 ported (the suggestions themselves come with the suggestion system)

## What the moves do

Both are homotopy equivalences h : G → G′ that collapse one strip. The graph map becomes g′ = h ∘ g ∘ h⁻¹.

**Valence 1.** A junction v with a single strip e from v to w. h collapses e into w (v ↦ w). So g′ deletes all
letters e, ē from the images and maps the junctions that went to v to w. Images that enter v must leave it
right away (ē e), so they stay continuous. The C# code does exactly this; its suggestion text still reads
"WHAT THE HECK?".

**Valence 2.** A junction v with two strip ends r and k (not the two ends of one loop). r is removed and k is
extended across v: k′ runs along r̄ k from the other end u of r. h collapses r into u (v ↦ u) and maps k to k′:

- g(k′) = g(r)⁻¹ g(k), then r is deleted from all images, and junctions mapped to v are mapped to u;
- the name of k is kept, unless it starts with the name of r (then r's name is used, which undoes a subdivision
  that named its parts `a`, `a1`, …);
- by default, the removed strip is one in the pre-periphery, or else the one with the **larger** Perron–Frobenius width
  (as in C#; the comment there says so too).

## Changes in the port

- **μ is updated** (new): for valence 1, μ doesn't change (G′ ⊂ G, h⁻¹ is the inclusion). For valence 2,
  μ(k′) = μ(r)⁻¹ μ(k), reduced; nothing else changes. The integrity check (μ preserves the boundary words)
  confirms it in the tests.
- **The kept strip stays the same `Edge` object.** Its start is moved from v to u with
  `reattach(k, u, { after: r̄ })`, so it takes the place of r̄ in the cyclic order at u (as the C#
  `orderIndexStart: removeStrip.OrderIndexEnd` does). The images of other strips that contain k don't need a
  substitution.
- **Bug fixed:** C# replaces the kept strip by a _new_ strip object, which isn't added to the peripheral subgraph
  P. So a peripheral strip silently dropped out of P. Keeping the object fixes this, and a test checks it.
- Where C# accesses `widths[…]` directly, the port returns width 0 for strips outside the essential subgraph,
  so the lookup can't fail.

## Tests

`src/fibred/moves/valence.test.ts` (9 tests):

- **Valence 1:** the torus with a pendant strip s and g(a) = a s S b becomes g(a) = a b, with μ unchanged.
- **Valence 2:** the torus with a = x y subdivided and the Anosov map (g(x) = x y, g(y) = b, g(b) = b x y b) merges
  back to x ↦ x b, b ↦ b x b, i.e. a ↦ ab, b ↦ bab, with μ(x′) = x y. Also: removing the other strip, the automatic
  choice, keeping P, and rejecting a junction that only has a loop.
- All results pass `checkIntegrity()`, including the boundary words under μ.
