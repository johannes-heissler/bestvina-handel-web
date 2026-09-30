<!-- What is known about the current state: the classification, λ, the surface, μ. -->
<script lang="ts">
  import { topology } from "../examples/models";
  import { perronFrobenius } from "../fibred/perron-frobenius";
  import { pieceTopology } from "../session/analysis";
  import { peripheryCandidates, peripheryProblems } from "../fibred/periphery";
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
      piece: pieceTopology(surface),
      periphery: peripheryProblems(surface),
      ignored: surface.ignorePeriphery,
      /** Whether some choice of P would fulfil the definition (then the algorithm suggests it, unless ignored). */
      possible: peripheryCandidates(surface).length > 0,
    };
  });
</script>

<section class="panel">
  <h2>State</h2>
  {#if info?.periphery.length}
    <div class="warning-box" role="alert">
      <strong>The peripheral subgraph P is inconsistent{info.ignored ? " (ignored)" : ""}.</strong>
      {info.periphery.join(" ")}
      {#if info.ignored}
        You chose to continue with P as it is: convergence and correctness of the algorithm are not guaranteed.
      {:else if !info.possible}
        No peripheral subgraph exists for this graph: for no choice of the essential orbit do the boundary words of the
        other punctures form disjoint circles that g maps into themselves. The algorithm continues with P as it is, so
        convergence and correctness are not guaranteed; as soon as a graph admits a peripheral subgraph, it is suggested.
      {/if}
    </div>
  {/if}
  {#if info}
    <dl>
      <dt>Result</dt>
      <dd>
        {#if info.classification?.kind === "pseudo-Anosov"}pseudo-Anosov, λ = {info.classification.growth.toFixed(6)}
        {:else if info.classification?.kind === "finite order"}finite order {info.classification.order}
        {:else if info.classification?.kind === "reducible"}reducible{#if info.classification.curves?.length}, reduction system {info.classification.curves.join(", ")}{/if}
        {:else}not yet known{/if}
      </dd>
      <dt>Growth of g</dt>
      <dd>{info.growth === undefined ? "—" : info.growth.toFixed(6)}</dd>
      <dt>Surface</dt>
      <dd>genus {info.genus}, {info.closed ? "closed" : `${info.punctures} punctures`}</dd>
      <dt title="The thickening of the graph G: χ = V − E = 2 − 2g − b, with b its boundary words. After a reduction, the piece the algorithm continues on.">Graph surface</dt>
      <dd>
        genus {info.piece.genus}, {info.piece.punctures}
        {info.piece.punctures === 1 ? "puncture" : "punctures"}{#if info.piece.cuts > 0}, {info.piece.cuts}
          {info.piece.cuts === 1 ? "cut" : "cuts"} (boundary along a reduction curve){/if}
      </dd>
      <dt>Graph</dt>
      <dd>{info.strips} strips, {info.junctions} junctions{info.peripheral.length ? `, peripheral: ${info.peripheral.join(", ")}` : ""}</dd>
      {#if info.curves.length}
        <dt>Reduction curves</dt>
        <dd>{info.curves.join("; ")}</dd>
      {/if}
    </dl>
  {/if}
</section>
