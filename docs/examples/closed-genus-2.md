# Trace: the closed genus-2 example

The author's example `closedGenus2OneCusp` (`src/examples/maps.ts`): a pseudo-Anosov map of the closed genus-2 surface Σ, given on
Σ ∖ {p}, whose train track has only one cusp at p. Traced on 2026-09-25 with `blowUpOrbit` and `fillPuncture`
(`src/fibred/moves/fill-puncture.ts`, port note 15), for **every** choice of the singularity q and of the deleted infinitesimal
branch ε of its polygon. After filling in p, the algorithm (`nextStep` until nothing applies) runs again.

## Observations

- **λ increases when p is filled in**, to between 4.48 and 13.18 depending on ε, and then **decreases through the algorithm**, in all
  15 cases to the same **λ ≈ 4.2121** < 4.3152.
- **g₀(ε) ≠ ε in every case:** the polygon at v2 is rotated by g₀ (ε2 ↦ ε12 ↦ ε15 ↦ ε2), and the other singularities have
  period 2. The construction doesn't need ε to be fixed, and every intermediate result is consistent (`checkIntegrity`, boundary words
  preserved).
- The new punctures Q get 2, 3 or 4 cusps, never 1, so no new π-singularities.
- That the final growth doesn't depend on the choice of q and ε fits the expectation that it is the stretch factor of the
  pseudo-Anosov class on Σ itself, since the singularities of that structure at Q can be filled in.

## Output

Notation: `x: s → t ↦ g(x)` lists each strip with its ends and its image. Junctions named `v2.0`, `v2.1`, … are the switches of the
blown-up junction v2. Capital letters are the inverse strips.

```
G: 5 junctions, 8 strips, λ = 4.3152
boundary word: b c x B y k a z Y K Z d C X D A
junction images: v0↦v1, v1↦v0, v2↦v2, v3↦v4, v4↦v3
g_τ on infinitesimal branches: ε1↦ε11, ε2↦ε12, ε3↦Ε10, ε4↦ε3, ε5↦ε4, ε6↦ε13, ε7↦Ε6, ε8↦ε5, ε9↦ε8, ε10↦Ε9, ε11↦ε14, ε12↦ε15, ε13↦ε1, ε14↦Ε7, ε15↦ε2
=== q = v2, orbit v2 (period 1)
  G₀: 7 junctions, 11 strips, λ = 4.3152, integrity ok: true
  polygon at v2: ε2 ↦ ε12, ε12 ↦ ε15, ε15 ↦ ε2
      b: v2.2 → v1   ↦ K Y ε2 b X C B Ε2 y Z d x c
      y: v2.0 → v3   ↦ a
      k: v3 → v2.1   ↦ z Y
      z: v4 → v3   ↦ Z d C X D
      c: v1 → v0   ↦ x c x
      x: v0 → v1   ↦ B Ε2 y Z d
      d: v4 → v0   ↦ Y ε2 b X C
      a: v2.2 → v4   ↦ K
      ε2: v2.0 → v2.2   ↦ ε12
      ε12: v2.2 → v2.1   ↦ ε15
      ε15: v2.1 → v2.0   ↦ ε2
  ε = ε2 (g₀(ε) = ε12): λ right after filling 13.1802, consistent true; 22 steps → λ = 4.2121, 5 junctions, 8 strips; cusps at punctures 4; polygons 3,3
    right after filling p:
      b: v2.2 → v1   ↦ K Y y k Ε12 a z Y Ε15 K Z d C X D A b c x B b X C B b X C B a d x c D z k ε15 y Z A ε12 K Y y Z d x c
      y: v2.0 → v3   ↦ a
      k: v3 → v2.1   ↦ z Y
      z: v4 → v3   ↦ Z d C X D
      c: v1 → v0   ↦ x c x
      x: v0 → v1   ↦ B b X C B a d x c D z k ε15 y Z A ε12 K Y y Z d
      d: v4 → v0   ↦ Y y k Ε12 a z Y Ε15 K Z d C X D A b c x B b X C
      a: v2.2 → v4   ↦ K
      ε12: v2.2 → v2.1   ↦ ε15
      ε15: v2.1 → v2.0   ↦ y k Ε12 a z Y Ε15 K Z d C X D A b c x B
      pull tight (λ = 8.9245)
      remove valence-2 junctions (λ = 8.9244)
      remove inefficiency (λ = 8.9166)
      remove valence-2 junctions (λ = 8.9156)
      remove inefficiency (λ = 7.6967)
      remove inefficiency (λ = 6.1630)
      remove inefficiency (λ = 5.8187)
      remove inefficiency (λ = 5.8052)
      remove valence-2 junctions (λ = 5.6241)
      collapse invariant subforest (λ = 5.6241)
      remove inefficiency (λ = 5.1103)
      remove valence-2 junctions (λ = 5.0000)
      remove inefficiency (λ = 4.8574)
      remove inefficiency (λ = 4.8284)
      remove valence-2 junctions (λ = 4.8208)
      collapse invariant subforest (λ = 4.8208)
      remove inefficiency (λ = 4.6085)
      remove inefficiency (λ = 4.4597)
      remove inefficiency (λ = 4.2927)
      remove inefficiency (λ = 4.2498)
      remove inefficiency (λ = 4.2268)
      remove valence-2 junctions (λ = 4.2121)
    result:
      k: p → v2.1   ↦ d31- d41+ Z1- d2 D31- D42 D41+ D2 z1- d42
      z1-: v → q   ↦ K D42 Z1- d2 d41+ d42 d31-
      ε12: v → v2.1   ↦ ε151
      ε151: v2.1 → p   ↦ k Ε12 z1- d42 Ε151 K
      d2: v → r   ↦ Ε12 z1- d42 Ε151 K D42
      d31-: p → r   ↦ d31- d41+
      d42: q → p   ↦ d41+ d42
      d41+: r → q   ↦ Z1- d2
  ε = ε12 (g₀(ε) = ε15): λ right after filling 6.0383, consistent true; 7 steps → λ = 4.2121, 3 junctions, 6 strips; cusps at punctures 4; polygons 3,3
  ε = ε15 (g₀(ε) = ε2): λ right after filling 4.8091, consistent true; 18 steps → λ = 4.2121, 4 junctions, 7 strips; cusps at punctures 4; polygons 3,3
=== q = v3, orbit v3 → v4 (period 2)
  G₀: 9 junctions, 14 strips, λ = 4.3152, integrity ok: true
  polygon at v3: ε1 ↦ ε11, ε6 ↦ ε13, ε14 ↦ Ε7
  polygon at v4: ε7 ↦ Ε6, ε11 ↦ ε14, ε13 ↦ ε1
  ε = ε1 (g₀(ε) = ε11): λ right after filling 6.8440, consistent true; 8 steps → λ = 4.2121, 6 junctions, 10 strips; cusps at punctures 2,2; polygons 4,3,3
  ε = ε6 (g₀(ε) = ε13): λ right after filling 11.3346, consistent true; 31 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 2,2; polygons 4,3,3
  ε = ε14 (g₀(ε) = Ε7): λ right after filling 4.4787, consistent true; 12 steps → λ = 4.2121, 3 junctions, 7 strips; cusps at punctures 2,2; polygons 3,3,4
=== q = v1, orbit v1 → v0 (period 2)
  G₀: 9 junctions, 14 strips, λ = 4.3152, integrity ok: true
  polygon at v1: ε3 ↦ Ε10, ε5 ↦ ε4, ε9 ↦ ε8
  polygon at v0: ε4 ↦ ε3, ε8 ↦ ε5, ε10 ↦ Ε9
  ε = ε3 (g₀(ε) = Ε10): λ right after filling 9.4882, consistent true; 16 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 3,3; polygons 4
  ε = ε5 (g₀(ε) = ε4): λ right after filling 7.3817, consistent true; 7 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 3,3; polygons 4
  ε = ε9 (g₀(ε) = ε8): λ right after filling 11.1874, consistent true; 29 steps → λ = 4.2121, 2 junctions, 6 strips; cusps at punctures 3,3; polygons 4
=== q = v0, orbit v0 → v1 (period 2)
  G₀: 9 junctions, 14 strips, λ = 4.3152, integrity ok: true
  polygon at v0: ε4 ↦ ε3, ε8 ↦ ε5, ε10 ↦ Ε9
  polygon at v1: ε3 ↦ Ε10, ε5 ↦ ε4, ε9 ↦ ε8
  ε = ε4 (g₀(ε) = ε3): λ right after filling 11.2257, consistent true; 29 steps → λ = 4.2121, 2 junctions, 6 strips; cusps at punctures 3,3; polygons 4
  ε = ε8 (g₀(ε) = ε5): λ right after filling 9.4343, consistent true; 23 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 3,3; polygons 4
  ε = ε10 (g₀(ε) = Ε9): λ right after filling 7.2865, consistent true; 18 steps → λ = 4.2121, 4 junctions, 8 strips; cusps at punctures 3,3; polygons 4
=== q = v4, orbit v4 → v3 (period 2)
  G₀: 9 junctions, 14 strips, λ = 4.3152, integrity ok: true
  polygon at v4: ε7 ↦ Ε6, ε11 ↦ ε14, ε13 ↦ ε1
  polygon at v3: ε1 ↦ ε11, ε6 ↦ ε13, ε14 ↦ Ε7
  ε = ε7 (g₀(ε) = Ε6): λ right after filling 11.1703, consistent true; 15 steps → λ = 4.2121, 3 junctions, 7 strips; cusps at punctures 2,2; polygons 4,3,3
  ε = ε11 (g₀(ε) = ε14): λ right after filling 4.9296, consistent true; 11 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 2,2; polygons 3,3,4
  ε = ε13 (g₀(ε) = ε1): λ right after filling 5.7717, consistent true; 20 steps → λ = 4.2121, 5 junctions, 9 strips; cusps at punctures 2,2; polygons 3,3,4
```
