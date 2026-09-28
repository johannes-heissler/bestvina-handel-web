<!--
  The punctures (boundary words of G) with how g permutes them and their cusps in τ, the singularities, the periphery,
  and the gates at each junction in cyclic order (collapsible).
-->
<script lang="ts">
  import type { Text } from "../fibred/suggestions";
  import type { OrientedEdge } from "../graph/ribbon-graph";
  import { boundaryInfo, gatesInfo, peripheryInfo, type Turn } from "../session/analysis";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  let open = $state(false);
  const info = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    if (!open || !surface) return undefined;
    return { boundary: boundaryInfo(surface), gates: gatesInfo(surface), periphery: peripheryInfo(surface) };
  });

  const word = (letters: readonly OrientedEdge[]): Text =>
    letters.flatMap((x, i) => (i === 0 ? [{ strip: x.name }] : [" ", { strip: x.name }]));
  const names = (edges: readonly { name: string }[]): Text =>
    edges.length === 0 ? ["none"] : edges.flatMap((e, i) => (i === 0 ? [{ strip: e.name }] : [", ", { strip: e.name }]));
  const cusps = (turns: readonly Turn[] | undefined): string => {
    if (!turns) return "";
    const ordinary = turns.filter((t) => t.kind === "cusp").length;
    const multi = turns.filter((t) => t.kind === "multicusp").map((t) => `${t.infinitesimal - 1}π`);
    return [
      `${ordinary} ${ordinary === 1 ? "cusp" : "cusps"}`,
      ...(multi.length ? [`multicusps with angles ${multi.join(", ")}`] : []),
    ].join("; ");
  };
</script>

<details class="panel" bind:open>
  <summary><h2>Punctures, cusps, gates</h2></summary>
  {#if info}
    <h3>Boundary words of G</h3>
    <p class="hint">
      One per puncture. At a turn, the boundary of τ passes k infinitesimal branches: k = 1 is smooth, k = 0 or 2 a cusp
      (interior angle π), k ≥ 3 a multicusp (interior angle (k − 1)π).
    </p>
    <ol class="words" start="0">
      {#each info.boundary.words as w, i (i)}
        <li>
          <TextView text={word(w.word)} />
          <span class="hint">↦ {w.image >= 0 ? `word ${w.image}` : "no boundary word (g is not geometric)"}; {cusps(w.turns)}</span>
          {#if w.turns}
            <span class="turns"
              >{#each w.turns as t, j (j)}<span class={t.kind} title={`${t.from.name} → ${t.to.name}: ${t.infinitesimal} infinitesimal`}
                  >{t.infinitesimal}</span
                >{/each}</span
            >
          {/if}
        </li>
      {/each}
    </ol>
    {#if info.boundary.problem}<p class="note">τ: {info.boundary.problem}</p>{/if}
    {#if info.boundary.singularities.length}
      <h3>Singularities (infinitesimal polygons of τ)</h3>
      <p>
        {#each info.boundary.singularities as s, i (i)}<span class="junction-name">{s.junction.name}</span>: {s.prongs}
          prongs{i < info.boundary.singularities.length - 1 ? "; " : ""}{/each}
      </p>
    {/if}
    <h3>Periphery</h3>
    <p>P: <TextView text={names(info.periphery.peripheral)} /></p>
    <p>pre-P ∖ P: <TextView text={names(info.periphery.prePeripheral)} /></p>
    <h3>Gates (in the cyclic order at each junction)</h3>
    <ul class="gates">
      {#each info.gates as { junction, gates } (junction.id)}
        <li>
          <span class="junction-name">{junction.name}</span>:
          {#each gates as gate, i (i)}({#each gate as x, j (j)}<TextView text={[{ strip: x.name }]} />{j < gate.length - 1
                ? " "
                : ""}{/each}){i < gates.length - 1 ? " " : ""}{/each}
        </li>
      {/each}
    </ul>
  {/if}
</details>
