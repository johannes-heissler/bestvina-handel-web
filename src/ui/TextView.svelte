<!-- Structured text from the suggestion system: strip and junction names in their colours. -->
<script lang="ts">
  import type { Text } from "../fibred/suggestions";
  import { app } from "./state.svelte";

  let { text }: { text: Text } = $props();

  const colorOf = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    const colors = new Map<string, string>();
    for (const e of surface?.graph.edges ?? []) {
      const c = `rgb(${Math.round(e.color.r * 255)},${Math.round(e.color.g * 255)},${Math.round(e.color.b * 255)})`;
      colors.set(e.name, c);
      colors.set(e.backward.name, c);
    }
    return colors;
  });
</script>

{#each text as part, i (i)}{#if typeof part === "string"}{part}{:else if "strip" in part}<span
      class="strip-name"
      style:color={colorOf.get(part.strip)}
      onmouseenter={() => (app.hovered = part.strip)}
      onmouseleave={() => (app.hovered = undefined)}
      role="note">{part.strip}</span
    >{:else}<span class="junction-name">{part.junction}</span>{/if}{/each}
