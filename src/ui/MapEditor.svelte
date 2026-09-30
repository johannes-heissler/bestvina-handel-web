<!--
  The graph map g, shown as coloured text. "Edit" opens the editor: the map as text with the modes replace, apply
  after, apply before (the C# map editor), a table of generators of the mapping class group (for some examples) to
  insert, and renaming or reversing strips.
-->
<script lang="ts">
  import { presetNamed } from "../examples/presets";
  import { type MapUpdateMode, updateMap } from "../fibred/map-editing";
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
  /** The name of the map entered (composed into the name of g). */
  let name = $state("");
  let strip = $state("");
  let newName = $state("");

  function edit() {
    changeMode();
    editing = true;
  }
  function changeMode() {
    text = mode === "replace" ? asText : "";
    name = mode === "replace" ? (surface?.mapName ?? "") : "";
  }
  function apply() {
    const trimmed = name.trim();
    app.apply({ kind: "edit map", text, mode, ...(trimmed && { name: trimmed }) });
    if (!app.error) editing = false;
  }
  // The generators of the example the session started from (written in the strips of its starting graph).
  const generators = $derived.by(() => {
    const start = app.session?.start;
    return start?.kind === "preset" ? presetNamed(start.preset, start.seed ?? 1)?.generators : undefined;
  });
  /** Whether a map can be read in the strips of the current graph (not after moves that renamed or removed them). */
  function readable(map: string): boolean {
    if (!surface) return false;
    try {
      updateMap(surface.copy(), map, "postcompose");
      return true;
    } catch {
      return false;
    }
  }
  const usable = $derived(
    editing && generators
      ? new Map(generators.generators.flatMap((g) => [g.map, g.inverse]).map((map) => [map, readable(map)]))
      : new Map<string, boolean>(),
  );
  function insert(map: string, mapName: string) {
    text = map;
    name = mapName;
  }
  /** "D_a" as D with the subscript a. */
  function nameParts(name: string): { base: string; subscript?: string } {
    const i = name.indexOf("_");
    return i < 0 ? { base: name } : { base: name.slice(0, i), subscript: name.slice(i + 1) };
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
    <div class="buttons">
      <input bind:value={name} placeholder="its name, e.g. D_a (optional)" size="24" aria-label="Name of the map" />
    </div>
    <p class="hint">
      One strip per line: <code>a -&gt; a b</code>, <code>a ↦ a b</code> or <code>g(a) = a b</code>. Named paths
      <code>ρ := a B</code> and conjugation <code>x°ρ</code> are allowed. Unmentioned strips are fixed. With a name,
      the name of g is composed (e.g. D<sub>a</sub> ∘ h); without one, g loses its name.
    </p>
    <div class="buttons">
      <button class="primary" onclick={apply}>Apply</button>
      <button onclick={() => (editing = false)}>Cancel</button>
    </div>
    {#if generators}
      <h3>Generators</h3>
      <p class="hint">
        {generators.description} Insert one (or its inverse) into the text above, then apply it after or before g.
      </p>
      <table class="generators">
        <tbody>
          {#each generators.generators as generator (generator.name)}
            {@const name = nameParts(generator.name)}
            <tr title={generator.description}>
              <th><span class="math">{name.base}</span>{#if name.subscript}<sub class="math">{name.subscript}</sub>{/if}</th>
              <td><code>{generator.map}</code></td>
              <td class="actions">
                <button
                  disabled={!usable.get(generator.map)}
                  title={usable.get(generator.map) ? `Insert ${generator.map}` : "Its strips are not those of the current graph"}
                  onclick={() => insert(generator.map, generator.name)}>Insert</button
                >
                <button
                  disabled={!usable.get(generator.inverse)}
                  title={usable.get(generator.inverse)
                    ? `Insert the inverse, ${generator.inverse}`
                    : "Its strips are not those of the current graph"}
                  onclick={() => insert(generator.inverse, `${generator.name}⁻¹`)}>Inverse</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if [...usable.values()].some((u) => !u)}
        <p class="note">
          Some generators are written in strips that the current graph no longer has (the moves renamed or removed them);
          they can be inserted at the start of the history.
        </p>
      {/if}
    {/if}
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
