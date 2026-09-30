<!-- The gates at each junction in cyclic order (collapsible): they describe the graph, so they come before g. -->
<script lang="ts">
  import { gatesInfo } from "../session/analysis";
  import { app } from "./state.svelte";
  import TextView from "./TextView.svelte";

  let open = $state(true);
  const gates = $derived.by(() => {
    void app.version;
    const surface = app.session?.current.surface;
    return open && surface ? gatesInfo(surface) : undefined;
  });
</script>

<details class="panel" bind:open>
  <summary><h2>Gates and the cyclic order</h2></summary>
  {#if gates}
    <ul class="gates">
      {#each gates as { junction, gates: list } (junction.id)}
        <li>
          <TextView text={[{ junction: junction.name }]} />:
          {#each list as gate, i (i)}({#each gate as x, j (j)}<TextView text={[{ strip: x.name }]} />{j < gate.length - 1
                ? " "
                : ""}{/each}){i < list.length - 1 ? " " : ""}{/each}
        </li>
      {/each}
    </ul>
  {/if}
</details>
