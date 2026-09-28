<!-- The transition matrix of g with the Perron–Frobenius widths and lengths (collapsible). -->
<script lang="ts">
  import { matrixInfo } from "../session/analysis";
  import { stripColors } from "./colors";
  import { app } from "./state.svelte";

  let open = $state(false);
  const info = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    return open && surface ? { data: matrixInfo(surface), colors: stripColors(surface) } : undefined;
  });
  const fmt = (x: number | undefined) => (x === undefined ? "—" : x.toFixed(3));
</script>

<details class="panel" bind:open>
  <summary><h2>Transition matrix, widths, lengths</h2></summary>
  {#if info}
    <p class="hint">
      Column e counts the strips in g(e). λ = {fmt(info.data.growth)}; the widths w satisfy M w = λ w, the lengths ℓ
      satisfy ℓ M = λ ℓ.
    </p>
    <div class="table-scroll">
      <table class="matrix">
        <thead>
          <tr>
            <th></th>
            {#each info.data.strips as e (e.id)}<th style:color={info.colors.get(e.name)}>{e.name}</th>{/each}
            <th class="weight">width</th>
          </tr>
        </thead>
        <tbody>
          {#each info.data.strips as row, i (row.id)}
            <tr>
              <th style:color={info.colors.get(row.name)}>{row.name}</th>
              {#each info.data.entries[i] ?? [] as entry, j (j)}<td class:zero={entry === 0}>{entry}</td>{/each}
              <td class="weight">{fmt(info.data.widths.get(row))}</td>
            </tr>
          {/each}
          <tr>
            <th class="weight">length</th>
            {#each info.data.strips as e (e.id)}<td class="weight">{fmt(info.data.lengths.get(e))}</td>{/each}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  {/if}
</details>
