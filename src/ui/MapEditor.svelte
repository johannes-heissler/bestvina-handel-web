<!--
  The graph map g, shown as coloured text. "Edit" opens the editor: the map as text with the modes replace, apply
  after, apply before (the C# map editor), and renaming or reversing strips.
-->
<script lang="ts">
  import type { MapUpdateMode } from "../fibred/map-editing";
  import type { Text } from "../fibred/suggestions";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  const surface = $derived.by(() => {
    void app.version;
    return app.session?.current.surface;
  });
  const lines = $derived(
    surface?.graph.edges.map((e): Text => {
      const image = surface.g.image(e.forward).letters;
      return [
        { strip: e.name },
        " ↦ ",
        ...(image.length === 0 ? ["·"] : image.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }]))),
      ];
    }) ?? [],
  );
  const asText = $derived(
    surface?.graph.edges.map((e) => `${e.name} ↦ ${surface.g.image(e.forward).toString() || "·"}`).join("\n") ?? "",
  );

  let editing = $state(false);
  let text = $state("");
  let mode = $state<MapUpdateMode>("replace");
  let strip = $state("");
  let newName = $state("");

  function edit() {
    text = mode === "replace" ? asText : "";
    editing = true;
  }
  function changeMode() {
    text = mode === "replace" ? asText : "";
  }
  function apply() {
    app.apply({ kind: "edit map", text, mode });
    if (!app.error) editing = false;
  }
  function rename() {
    if (strip && newName) app.apply({ kind: "rename strip", strip, name: newName });
    newName = "";
  }
</script>

<section class="panel">
  <div class="heading">
    <h2>Graph map <span class="math">g</span></h2>
    {#if !editing}<button onclick={edit} disabled={!surface}>Edit</button>{/if}
  </div>
  {#if !editing}
    <ul class="map">
      {#each lines as line, i (i)}<li><TextView text={line} /></li>{/each}
    </ul>
  {:else}
    <div class="buttons">
      <select bind:value={mode} onchange={changeMode} aria-label="How to apply the map">
        <option value="replace">Edit g</option>
        <option value="postcompose">Apply a map after g</option>
        <option value="precompose">Apply a map before g</option>
      </select>
    </div>
    <textarea rows="8" spellcheck="false" bind:value={text} aria-label="The map"></textarea>
    <p class="hint">
      One strip per line: <code>a -&gt; a b</code>, <code>a ↦ a b</code> or <code>g(a) = a b</code>. Named paths
      <code>ρ := a B</code> and conjugation <code>x°ρ</code> are allowed. Unmentioned strips are fixed.
    </p>
    <div class="buttons">
      <button class="primary" onclick={apply}>Apply</button>
      <button onclick={() => (editing = false)}>Cancel</button>
    </div>
    <h3>Rename or reverse a strip</h3>
    <div class="buttons">
      <select bind:value={strip} aria-label="Strip">
        {#each surface?.graph.edges ?? [] as e (e.id)}<option value={e.name}>{e.name}</option>{/each}
      </select>
      <input bind:value={newName} placeholder="new name (uppercase: reversed)" size="18" />
      <button onclick={rename}>Rename</button>
    </div>
  {/if}
</section>
