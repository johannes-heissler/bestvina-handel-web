<!-- The history as a tree from the start (top) downwards; click a node to go there, hover to see the move. -->
<script lang="ts">
  import type { HistoryNode } from "../session/session";
  import { describeMove } from "../session/describe";
  import { app } from "./state.svelte";

  const STEP_X = 26;
  const STEP_Y = 34;

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
    const nodes = [...positions].map(([node, p]) => ({ node, x: 20 + p.x * STEP_X, y: 20 + p.y * STEP_Y }));
    const at = new Map(nodes.map((n) => [n.node, n]));
    const edges = nodes
      .filter((n) => n.node.parent)
      .map((n) => ({ from: at.get(n.node.parent as HistoryNode)!, to: n, active: onPath.has(n.node) }));
    const width = Math.max(...nodes.map((n) => n.x)) + 40;
    const height = Math.max(...nodes.map((n) => n.y)) + 40;
    return { nodes, edges, width, height, current: session.current };
  });
</script>

<section class="panel history">
  <h2>History</h2>
  {#if tree}
    <div class="scroll">
      <svg width={tree.width} height={tree.height} role="tree" aria-label="The history of moves">
        {#each tree.edges as e (e.to.node.id)}
          <line x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} class:active={e.active} />
        {/each}
        {#each tree.nodes as n (n.node.id)}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.node === tree.current ? 8 : 6}
            class:current={n.node === tree.current}
            onclick={() => app.select(n.node)}
            onkeydown={(event) => event.key === "Enter" && app.select(n.node)}
            role="treeitem"
            aria-selected={n.node === tree.current}
            tabindex="0"
          >
            <title>{n.node.move ? describeMove(n.node.move) : "Start"}</title>
          </circle>
        {/each}
      </svg>
    </div>
  {/if}
</section>
