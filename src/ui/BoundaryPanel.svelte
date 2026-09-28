<!--
  The gates at each junction in cyclic order; the punctures (boundary words B₀, B₁, … of G) with the number of
  infinitesimal branches of τ at each turn, written between the letters, and how g permutes them; the singularities;
  the layers of the pre-periphery (collapsible).
-->
<script lang="ts">
  import type { Text } from "../fibred/suggestions";
  import { boundaryInfo, gatesInfo, peripheryInfo } from "../session/analysis";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  let open = $state(false);
  const info = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    if (!open || !surface) return undefined;
    return { boundary: boundaryInfo(surface), gates: gatesInfo(surface), periphery: peripheryInfo(surface) };
  });

  const names = (edges: readonly { name: string }[]): Text =>
    edges.length === 0 ? ["—"] : edges.flatMap((e, i) => (i === 0 ? [{ strip: e.name }] : [", ", { strip: e.name }]));
  const kindTitle = { smooth: "smooth", cusp: "cusp (angle π)", multicusp: "multicusp" } as const;
</script>

<details class="panel" bind:open>
  <summary><h2>Gates, punctures, periphery</h2></summary>
  {#if info}
    <h3>Gates (in the cyclic order at each junction)</h3>
    <ul class="gates">
      {#each info.gates as { junction, gates } (junction.id)}
        <li>
          <span class="junction-name">{junction.name}</span>:
          {#each gates as gate, i (i)}({#each gate as x, j (j)}<TextView text={[{ strip: x.name }]} />{j < gate.length - 1
                ? " "
                : ""}{/each}){i < gates.length - 1 ? " " : ""}{/each}
        </li>
      {/each}
    </ul>

    <h3>Punctures: boundary words of G</h3>
    <p class="hint">
      Below each word, between two letters: the number k of infinitesimal branches of τ at that turn (k = 1 smooth,
      k = 0 or 2 a cusp with angle π, k ≥ 3 a multicusp with angle (k − 1)π); the last number is the turn from the last
      letter back to the first.
    </p>
    {#each info.boundary.words as w, i (i)}
      <div class="boundary-word">
        <span class="word-name">B<sub>{i}</sub></span>
        <div class="word-grid" style:grid-template-columns={`repeat(${2 * w.word.length}, auto)`}>
          {#each w.word as x, j (j)}
            <span class="letter" style:grid-column={2 * j + 1} style:grid-row="1"><TextView text={[{ strip: x.name }]} /></span>
            {#if w.turns?.[j]}
              {@const t = w.turns[j]}
              <span
                class={`turn ${t.kind}`}
                style:grid-column={2 * j + 2}
                style:grid-row="2"
                title={`${t.from.name} → ${t.to.name}: ${kindTitle[t.kind]}`}>{t.infinitesimal}</span
              >
            {/if}
          {/each}
        </div>
        <div class="hint">
          g: B<sub>{i}</sub> ↦ {#if w.image >= 0}B<sub>{w.image}</sub>{:else}no boundary word (g is not geometric){/if}
          {#if w.turns}{@const n = w.turns.filter((t) => t.kind === "cusp").length}; {n} {n === 1 ? "cusp" : "cusps"}{#each w.turns.filter((t) => t.kind === "multicusp") as t, k (k)}, a
              multicusp with angle {t.infinitesimal - 1}π{/each}
          {/if}
        </div>
      </div>
    {/each}
    {#if info.boundary.problem}<p class="note">τ: {info.boundary.problem}</p>{/if}

    {#if info.boundary.singularities.length}
      <h3>Singularities (infinitesimal polygons of τ)</h3>
      <p>
        {#each info.boundary.singularities as s, i (i)}<span class="junction-name">{s.junction.name}</span>: {s.prongs}
          prongs{i < info.boundary.singularities.length - 1 ? "; " : ""}{/each}
      </p>
    {/if}

    <h3>Periphery</h3>
    <p class="hint">P₀ = P; Pᵢ are the strips that g maps into P₀ ∪ ⋯ ∪ Pᵢ₋₁.</p>
    <ul class="gates">
      {#each info.periphery.layers as layer, i (i)}
        {#if i === 0 || layer.length > 0}<li>P<sub>{i}</sub>: <TextView text={names(layer)} /></li>{/if}
      {/each}
    </ul>
  {/if}
</details>
