<!-- The graph map as text, editable (the C# map editor with its modes), and renaming or inverting strips. -->
<script lang="ts">
  import type { MapUpdateMode } from "../fibred/map-editing";
  import { app } from "./state.svelte";

  const surface = $derived.by(() => {
    void app.version;
    return app.session?.current.surface;
  });
  const current = $derived(
    surface?.graph.edges.map((e) => `${e.name} ↦ ${surface.g.image(e.forward).toString() || "·"}`).join("\n") ?? "",
  );

  let text = $state("");
  let mode = $state<MapUpdateMode>("replace");
  let editing = $state(false);
  let strip = $state("");
  let newName = $state("");

  $effect(() => {
    if (!editing) text = current;
  });

  function apply() {
    app.apply({ kind: "edit map", text, mode });
    editing = false;
  }
  function rename() {
    if (strip && newName) app.apply({ kind: "rename strip", strip, name: newName });
    newName = "";
  }
</script>

<section class="panel">
  <h2>Graph map g</h2>
  <textarea
    rows="8"
    spellcheck="false"
    bind:value={text}
    oninput={() => (editing = true)}
    aria-label="The graph map"
  ></textarea>
  <p class="hint">
    One strip per line: <code>a -&gt; a b</code>, <code>a ↦ a b</code> or <code>g(a) = a b</code>. Named paths
    <code>ρ := a B</code> and conjugation <code>x°ρ</code> are allowed. Unmentioned strips are fixed.
  </p>
  <div class="buttons">
    <select bind:value={mode} aria-label="How to apply the map">
      <option value="replace">Replace g</option>
      <option value="postcompose">Apply after g</option>
      <option value="precompose">Apply before g</option>
    </select>
    <button class="primary" onclick={apply} disabled={!editing && mode === "replace"}>Apply</button>
    <button onclick={() => ((editing = false), (text = current))} disabled={!editing}>Revert</button>
  </div>
  <h3>Rename a strip</h3>
  <div class="buttons">
    <select bind:value={strip} aria-label="Strip">
      {#each surface?.graph.edges ?? [] as e (e.id)}<option value={e.name}>{e.name}</option>{/each}
    </select>
    <input bind:value={newName} placeholder="new name (uppercase: reverse)" size="16" />
    <button onclick={rename}>Rename</button>
  </div>
</section>
