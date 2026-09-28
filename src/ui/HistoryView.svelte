<!--
  The history as a tree from the start (top) downwards: λ at each state, the move between the levels. Click a state
  to go there.
-->
<script lang="ts">
  import { perronFrobenius } from "../fibred/perron-frobenius";
  import { describeMove } from "../session/describe";
  import type { HistoryNode } from "../session/session";
  import { stripColors } from "./colors";
  import { app } from "./state.svelte";

  const STEP_X = 190;
  const STEP_Y = 64;
  const MAX_LABEL = 34;

  const growthCache = new WeakMap<HistoryNode, string>();
  function growth(node: HistoryNode): string {
    let text = growthCache.get(node);
    if (text === undefined) {
      try {
        text = `λ = ${perronFrobenius(node.surface, { essentialOnly: true }).growth.toFixed(4)}`;
      } catch {
        text = "";
      }
      growthCache.set(node, text);
    }
    return text;
  }

  /** The move of a node as coloured pieces, shortened to about MAX_LABEL characters. */
  function moveLabel(node: HistoryNode): { text: string; color: string | undefined }[] {
    if (!node.move || !node.parent) return [];
    const colors = stripColors(node.parent.surface);
    const pieces: { text: string; color: string | undefined }[] = [];
    let length = 0;
    for (const part of describeMove(node.move)) {
      const text = typeof part === "string" ? part : "strip" in part ? part.strip : part.junction;
      const color = typeof part !== "string" && "strip" in part ? colors.get(part.strip) : undefined;
      if (length + text.length > MAX_LABEL) {
        pieces.push({ text: `${text.slice(0, Math.max(0, MAX_LABEL - length))}…`, color });
        break;
      }
      pieces.push({ text, color });
      length += text.length;
    }
    return pieces;
  }

  const tree = $derived.by(() => {
    void app.version;
    const session = app.session;
    if (!session) return undefined;
    const positions = new Map<HistoryNode, { x: number; y: number }>();
    let leaf = 0;
    const place = (node: HistoryNode, depth: number): number => {
      const xs = node.children.map((c) => place(c, depth + 1));
      const x = xs.length === 0 ? leaf++ : (Math.min(...xs) + Math.max(...xs)) / 2;
      positions.set(node, { x, y: depth });
      return x;
    };
    place(session.root, 0);
    const onPath = new Set(session.path());
    const nodes = [...positions].map(([node, p]) => ({ node, x: 30 + p.x * STEP_X, y: 24 + p.y * STEP_Y }));
    const at = new Map(nodes.map((n) => [n.node, n]));
    const edges = nodes
      .filter((n) => n.node.parent)
      .map((n) => ({ from: at.get(n.node.parent as HistoryNode)!, to: n, active: onPath.has(n.node) }));
    return {
      nodes,
      edges,
      width: Math.max(...nodes.map((n) => n.x)) + STEP_X,
      height: Math.max(...nodes.map((n) => n.y)) + 40,
      current: session.current,
    };
  });

  let container = $state<HTMLDivElement | undefined>(undefined);
  $effect(() => {
    void tree;
    container?.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
</script>

<section class="panel history">
  <h2>History</h2>
  {#if tree}
    <div class="scroll" bind:this={container}>
      <svg width={tree.width} height={tree.height} role="tree" aria-label="The history of moves">
        {#each tree.edges as e (e.to.node.id)}
          <line x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} class:active={e.active} />
          <text class="move" x={(e.from.x + e.to.x) / 2 + 8} y={(e.from.y + e.to.y) / 2 + 4}
            >{#each moveLabel(e.to.node) as piece, i (i)}<tspan fill={piece.color}>{piece.text}</tspan>{/each}</text
          >
        {/each}
        {#each tree.nodes as n (n.node.id)}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.node === tree.current ? 7 : 5}
            class:current={n.node === tree.current}
            onclick={() => app.select(n.node)}
            onkeydown={(event) => event.key === "Enter" && app.select(n.node)}
            role="treeitem"
            aria-selected={n.node === tree.current}
            tabindex="0"
          />
          <text class="growth" x={n.x + 11} y={n.y + 4}>{growth(n.node)}</text>
        {/each}
      </svg>
    </div>
  {/if}
</section>
