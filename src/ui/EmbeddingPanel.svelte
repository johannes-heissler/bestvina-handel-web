<!--
  The embedding of G, recorded by the marking μ : G → G₀, in the colours of the edges of G₀, and the boundary words of
  G₀ (collapsible).
-->
<script lang="ts">
  import type { Text } from "../fibred/suggestions";
  import { graphColors } from "./colors";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  let open = $state(false);
  const info = $derived.by(() => {
    void app.version;
    const node = app.session?.current;
    if (!open || !node) return undefined;
    const surface = node.surface;
    const palette = graphColors(surface.spine0);
    const lines = surface.graph.edges.map((e): { strip: Text; image: Text } => {
      const letters = surface.mu.image(e.forward).letters;
      return {
        strip: [{ strip: e.name }],
        image:
          letters.length === 0
            ? ["· (stays inside)"]
            : letters.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }])),
      };
    });
    // The boundary words of G₀ (its punctures), in the colours of its edges.
    const words = surface.spine0
      .boundaryWords()
      .map((w): Text => w.letters.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }])));
    return { lines, palette, words, total: surface.mu.totalLength() };
  });
</script>

<details class="panel" bind:open>
  <summary><h2>Embedding <span class="math">μ</span></h2></summary>
  {#if info}
    <ul class="map">
      {#each info.lines as line, i (i)}
        <li><TextView text={line.strip} /> ↦ <TextView text={line.image} palette={info.palette} /></li>
      {/each}
    </ul>
    <p class="hint">{info.total} side crossings in total.</p>
    <h3>Boundary words of G₀</h3>
    <ul class="map">
      {#each info.words as word, i (i)}<li>(<TextView text={word} palette={info.palette} />)</li>{/each}
    </ul>
  {/if}
</details>
