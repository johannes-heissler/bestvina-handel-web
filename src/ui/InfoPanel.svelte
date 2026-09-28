<!-- What is known about the current state: the classification, λ, the surface, μ. -->
<script lang="ts">
  import { topology } from "../examples/models";
  import { perronFrobenius } from "../fibred/perron-frobenius";
  import { app } from "./state.svelte";

  const info = $derived.by(() => {
    void app.version;
    const node = app.session?.current;
    if (!node) return undefined;
    const surface = node.surface;
    let growth: number | undefined;
    try {
      growth = perronFrobenius(surface, { essentialOnly: true }).growth;
    } catch {
      growth = undefined;
    }
    const suggestion = app.session?.suggestion();
    const classification = suggestion?.classification;
    const { genus, punctures } = topology(node.model);
    return {
      classification,
      growth,
      genus,
      punctures,
      strips: surface.graph.edgeCount,
      junctions: surface.graph.vertexCount,
      peripheral: [...surface.peripheral].map((e) => e.name),
      curves: surface.reductionCurves.map(String),
      closed: surface.isClosed,
    };
  });
</script>

<section class="panel">
  <h2>State</h2>
  {#if info}
    <dl>
      <dt>Result</dt>
      <dd>
        {#if info.classification?.kind === "pseudo-Anosov"}pseudo-Anosov, λ = {info.classification.growth.toFixed(6)}
        {:else if info.classification?.kind === "finite order"}finite order {info.classification.order}
        {:else if info.classification?.kind === "reducible"}reducible
        {:else}not yet known{/if}
      </dd>
      <dt>Growth of g</dt>
      <dd>{info.growth === undefined ? "—" : info.growth.toFixed(6)}</dd>
      <dt>Surface</dt>
      <dd>genus {info.genus}, {info.closed ? "closed" : `${info.punctures} punctures`}</dd>
      <dt>Graph</dt>
      <dd>{info.strips} strips, {info.junctions} junctions{info.peripheral.length ? `, peripheral: ${info.peripheral.join(", ")}` : ""}</dd>
      {#if info.curves.length}
        <dt>Reduction curves</dt>
        <dd>{info.curves.join("; ")}</dd>
      {/if}
    </dl>
  {/if}
</section>
