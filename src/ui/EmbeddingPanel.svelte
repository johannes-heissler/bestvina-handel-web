<!-- The embedding of G, recorded by the marking μ : G → G₀, in the colours of the edges of G₀ (collapsible). -->
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
    // The cyclic order at each vertex of G₀, in the colours of its edges.
    const stars = surface.spine0.vertices.map((w): Text =>
      surface.spine0.star(w).flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }])),
    );
    return { lines, palette, stars, polygon: node.model.kind === "polygon", total: surface.mu.totalLength() };
  });
</script>

<details class="panel" bind:open>
  <summary><h2>Embedding <span class="math">μ</span></h2></summary>
  {#if info}
    <p class="hint">
      G₀ is the fixed reference graph of the model{info.polygon
        ? ": the rose dual to the polygon, with one loop through each pair of sides"
        : ""}. μ : G → G₀ records how G lies in the surface: μ(e) is the path in G₀ that the strip e follows{info.polygon
        ? ", i.e. the sides it crosses, in their colours"
        : ""}.
    </p>
    <p class="hint">Cyclic order of G₀{info.stars.length > 1 ? " at each vertex" : ""} (counterclockwise):</p>
    <ul class="map">
      {#each info.stars as star, i (i)}<li>(<TextView text={star} palette={info.palette} />)</li>{/each}
    </ul>
    <p class="hint">μ:</p>
    <ul class="map">
      {#each info.lines as line, i (i)}
        <li><TextView text={line.strip} /> ↦ <TextView text={line.image} palette={info.palette} /></li>
      {/each}
    </ul>
    <p class="hint">{info.total} side crossings in total.</p>
  {/if}
</details>
