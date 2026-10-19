<!-- A name (or a text containing names) with its indices as subscripts: "v_a_1" as v with the subscript "a,1" (port note 25). -->
<script lang="ts">
  import { nameParts } from "../graph/names";

  let { name }: { name: string } = $props();

  const parts = $derived(nameParts(name));
</script>

{#each parts as part, i (i)}{#if part.subscript}<sub>{part.text}</sub>{:else}{part.text}{/if}{/each}
