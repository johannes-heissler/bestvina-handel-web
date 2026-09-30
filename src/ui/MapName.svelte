<!-- The name of a map, with "X_y" shown as X with the subscript y (e.g. "D_a⁻¹ ∘ h"). -->
<script lang="ts">
  let { name }: { name: string } = $props();

  // split with a capturing group: text, subscript, text, subscript, …
  const parts = $derived(name.split(/_([^\s∘()⁻¹]+)/));
</script>

<span class="math">{#each parts as part, i (i)}{#if i % 2 === 0}{part}{:else}<sub>{part}</sub>{/if}{/each}</span>
