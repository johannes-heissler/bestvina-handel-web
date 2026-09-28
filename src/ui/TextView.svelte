<!-- Structured text: strip names in their colours (hovering one highlights it in the views), junction names in dark green, as mathematical symbols. -->
<script lang="ts">
  import type { FibredSurface } from "../fibred/fibred-surface";
  import { invertName, isForwardName } from "../graph/names";
  import type { Text } from "../fibred/suggestions";
  import { stripColors } from "./colors";
  import { app } from "./state.svelte";

  let {
    text,
    surface,
    palette,
  }: {
    text: Text;
    surface?: FibredSurface | undefined;
    /** Colours by strip name, instead of those of the surface (e.g. for the edges of G₀). */
    palette?: ReadonlyMap<string, string> | undefined;
  } = $props();

  const colors = $derived.by(() => {
    void app.version;
    return palette ?? stripColors(surface ?? app.session?.current.surface);
  });
</script>

{#each text as part, i (i)}{#if typeof part === "string"}{part}{:else if "strip" in part}<span
      class="strip-name"
      style:color={colors.get(part.strip)}
      onmouseenter={() => (app.hovered = isForwardName(part.strip) ? part.strip : invertName(part.strip))}
      onmouseleave={() => (app.hovered = undefined)}
      role="note">{part.strip}</span
    >{:else}<span class="junction-name">{part.junction}</span>{/if}{/each}
