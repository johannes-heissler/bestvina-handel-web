<!--
  The boundary words B₀, B₁, … of G (the punctures) with the number of infinitesimal branches of τ at each turn, written
  between the letters, and how g permutes them; the singularities; the pretrivial strips; the layers of the
  pre-periphery (collapsible). The last two only when there are any.
-->
<script lang="ts">
  import type { Text } from "../fibred/suggestions";
  import { boundaryInfo, peripheryInfo } from "../session/analysis";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  let open = $state(false);
  const info = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    if (!open || !surface) return undefined;
    return { boundary: boundaryInfo(surface), periphery: peripheryInfo(surface) };
  });

  const names = (edges: readonly { name: string }[]): Text =>
    edges.length === 0 ? ["—"] : edges.flatMap((e, i) => (i === 0 ? [{ strip: e.name }] : [", ", { strip: e.name }]));
  /** The interior angle at a turn with k infinitesimal branches: kπ, and 2π for k = 0 (a cusp, like k = 2). */
  const angle = (k: number) => (k === 0 ? "2π" : k === 1 ? "π" : `${k}π`);
  const kindTitle = { smooth: "smooth", cusp: "cusp", multicusp: "multicusp" } as const;
</script>

<details class="panel" bind:open>
  <summary><h2>Boundary words</h2></summary>
  {#if info}
    <p
      class="hint"
      title="The interior angle at a turn with k branches is kπ: k = 1 is smooth, k = 0 or 2 a cusp (angle 2π), k ≥ 3 a multicusp. The last number is the turn from the last letter back to the first."
    >
      Between the letters: the number of infinitesimal branches of τ at each turn.
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
                title={`${t.from.name} → ${t.to.name}: ${kindTitle[t.kind]}, interior angle ${angle(t.infinitesimal)}`}>{t.infinitesimal}</span
              >
            {/if}
          {/each}
        </div>
        <div class="hint">
          g: B<sub>{i}</sub> ↦ {#if w.image >= 0}B<sub>{w.image}</sub>{:else}no boundary word (g is not geometric){/if}
          {#if w.turns}{@const n = w.turns.filter((t) => t.kind === "cusp").length}; {n} {n === 1 ? "cusp" : "cusps"}{#each w.turns.filter((t) => t.kind === "multicusp") as t, k (k)}, a
              multicusp with interior angle {angle(t.infinitesimal)}{/each}
          {/if}
        </div>
      </div>
    {/each}
    {#if info.boundary.problem}<p class="note">τ: {info.boundary.problem}</p>{/if}

    {#if info.boundary.singularities.length}
      <h3>Singularities (infinitesimal polygons of τ)</h3>
      <p>
        {#each info.boundary.singularities as s, i (i)}<TextView text={[{ junction: s.junction.name }]} />: {s.prongs}
          prongs{i < info.boundary.singularities.length - 1 ? "; " : ""}{/each}
      </p>
    {/if}

    {#if info.periphery.pretrivial.length}
      <h3 title="Some power of g maps them to a trivial path.">Pretrivial strips</h3>
      <p><TextView text={names(info.periphery.pretrivial)} /></p>
    {/if}

    {#if info.periphery.layers[0]?.length}
      <h3 title="P₀ = P; Pᵢ are the other strips that g maps into P₀ ∪ ⋯ ∪ Pᵢ₋₁ (pretrivial strips aside).">Periphery</h3>
      <ul class="gates">
        {#each info.periphery.layers as layer, i (i)}
          <li>P<sub>{i}</sub>: <TextView text={names(layer)} /></li>
        {/each}
      </ul>
    {/if}
  {/if}
</details>
