/**
 * Reducing a reducible map (the thesis, Move "Reducing reducible maps"; C# `FibredSurfaceReduction.cs`).
 *
 * An invariant subgraph K determines a reduction system Γ, the boundary of a convex core of the subsurface around K.
 * The complementary regions of Γ are the pieces the algorithm continues on. The thesis builds a graph G′ for all of them
 * at once:
 *
 * - K′ = K itself, with g′ = g on it (the pieces inside Γ);
 * - the complement: G ∖ K, plus two parallel copies of every strip of K (one on each side), plus one new junction per
 *   sector of a junction of K (a sector lies between two consecutive strips of K in the cyclic order). The copies form
 *   one circle for each boundary word of K, and these circles become peripheral.
 *
 * The user then chooses one piece (a component of G′ with χ < 0), and g is replaced by its first-return map there.
 * "Reduce to subgraph" and "reduce to the complement" are the two kinds of pieces of this one move.
 *
 * @module
 */
import { EdgePath } from "../../graph/edge-path";
import type { Edge, OrientedEdge, Vertex } from "../../graph/ribbon-graph";
import type { FibredSurface } from "../fibred-surface";
import { componentOrbits, replaceByPower, restrictTo } from "./reducibility";

/** One complementary region of the reduction system: a component of G′ with negative Euler characteristic. */
export interface ReductionPiece {
  /** "invariant subgraph": a component of K′. "complement": a component of the rest of G′. */
  readonly kind: "invariant subgraph" | "complement";
  readonly edges: Set<Edge>;
  /** The number of pieces in its orbit under g; g is replaced by g^period on the chosen piece. */
  readonly period: number;
}

/**
 * Reduces along the invariant subgraph `preserved`: builds G′ (see the module comment), lets `choose` pick a piece,
 * restricts to it with the first-return map, and records the new reduction curves. For a piece of the complement,
 * the copies of the strips of K become its peripheral circles; absorbing into the periphery (the next step of the
 * algorithm) then makes g an automorphism on them.
 *
 * @throws Error if g can't be lifted to G′ (the images cross the convex core of K; see port note 16).
 */
export function reduce(
  fs: FibredSurface,
  preserved: ReadonlySet<Edge>,
  choose: (pieces: readonly ReductionPiece[]) => ReductionPiece = (pieces) => pieces[0] as ReductionPiece,
): void {
  // Trees that retract to K are not collapsed first (unlike C#'s `PrepareReduction`): they stay strips of the
  // complement, and collapsing a tree that leads to P would join P's circles to the copies of K.
  const K = new Set(preserved);
  splitAlong(fs, K);
  const piece = choose(reductionPieces(fs, K));
  if (piece.period > 1) replaceByPower(fs.g, piece.period); // before deleting the pieces that g maps it to
  restrictTo(fs, piece.edges);
  for (const word of fs.graph.boundaryWords()) fs.addReductionCurve(fs.mu.imageOfPath(word));
}

/** The components of G′ with χ < 0, with their periods under g. `K` tells the pieces of K′ from the complement. */
function reductionPieces(fs: FibredSurface, K: ReadonlySet<Edge>): ReductionPiece[] {
  const orbits = componentOrbits(fs, new Set(fs.graph.edges));
  return orbits.flatMap((orbit) =>
    orbit
      .filter((edges) => new Set([...edges].flatMap((e) => [e.source, e.target])).size < edges.size) // χ < 0
      .map((edges) => ({
        kind: [...edges].every((e) => K.has(e)) ? ("invariant subgraph" as const) : ("complement" as const),
        edges,
        period: orbit.length,
      })),
  );
}

/**
 * A sector of a junction v of K, named by the strip x of K (leaving v) at its clockwise end: it lies between x and
 * σ_K(x), the next strip of K in the cyclic order at v.
 */
type Sector = OrientedEdge;

/** Where a lifted path is: in a sector of a junction of K, or (`null`) at a junction outside K. */
type State = Sector | null;

/** The two copies of a strip of K: on its right and on its left side. */
type Side = "right" | "left";

/**
 * Builds G′ in place (see the module comment): creates the sector junctions and the copies of the strips of K, moves
 * the strips of St(K) to their sectors, and lifts g and μ to the complement. K and its junctions stay as they are.
 */
function splitAlong(fs: FibredSurface, K: ReadonlySet<Edge>): void {
  const { graph, g } = fs;
  const inK = (e: OrientedEdge) => K.has(e.edge);
  if ([...K].some((e) => !g.image(e.forward).letters.every(inK)))
    throw new Error("K is not invariant under g");
  const junctionsOfK = new Set([...K].flatMap((e) => [e.source, e.target]));

  // σ_K and the sectors.
  const nextInK = new Map<OrientedEdge, OrientedEdge>();
  const previousInK = new Map<OrientedEdge, OrientedEdge>();
  const sectorOf = new Map<OrientedEdge, Sector>(); // for the strips of St(K) at junctions of K
  const inSector = new Map<Sector, OrientedEdge[]>();
  for (const v of junctionsOfK) {
    const star = graph.star(v);
    const ends = star.filter(inK);
    ends.forEach((x, i) => {
      const y = ends[(i + 1) % ends.length] as OrientedEdge;
      nextInK.set(x, y);
      previousInK.set(y, x);
      inSector.set(x, []);
    });
    const start = star.indexOf(ends[0] as OrientedEdge);
    let current = ends[0] as OrientedEdge;
    for (let i = 1; i < star.length; i++) {
      const e = star[(start + i) % star.length] as OrientedEdge;
      if (inK(e)) current = e;
      else {
        sectorOf.set(e, current);
        (inSector.get(current) as OrientedEdge[]).push(e);
      }
    }
  }
  const next = (x: OrientedEdge) => nextInK.get(x) as OrientedEdge;
  const previous = (x: OrientedEdge) => previousInK.get(x) as OrientedEdge;
  const sectors = [...inSector.keys()];

  // The isotopy of the thesis (Lemma "preserving boundary components"): pull the image of each boundary circle of K
  // tight. The junction of each sector moves along the cancelled stretch γ(x) from its old image to the point where the
  // tight circle passes, and every image is conjugated accordingly: g(e) ↦ γ(start)⁻¹ g(e) γ(end), reduced. (Pulling
  // tight one turn at a time isn't enough: when a copy's image becomes empty, the next cancellation spans across it.)
  const gamma = new Map<Sector, readonly OrientedEdge[]>();
  for (const word of graph.boundaryWords(K)) {
    const factors = word.letters.map((x) => g.image(x).letters);
    const W = factors.flat();
    const factorStart = factors.map((_, i) => factors.slice(0, i).reduce((n, f) => n + f.length, 0));
    const survives = cyclicSurvivors(W);
    if (!survives.some(Boolean)) throw new Error(`g maps the boundary word ${word} of K to a trivial loop`);
    word.letters.forEach((x, i) => {
      // The sector between x_i and x_{i+1} is the sector after x̄_i; its junction is mapped to the start of factor i+1.
      const path: OrientedEdge[] = [];
      for (let k = factorStart[(i + 1) % factors.length] as number; !survives[k % W.length]; k++)
        path.push(W[k % W.length] as OrientedEdge);
      gamma.set(x.reversed, EdgePath.from(path).reduced().letters);
    });
  }
  const γ = (x: Sector) => gamma.get(x) as readonly OrientedEdge[];
  const trimmed = (e: OrientedEdge, atStart: Sector | undefined, atEnd: Sector | undefined): OrientedEdge[] =>
    EdgePath.from([
      ...(atStart === undefined
        ? []
        : γ(atStart)
            .toReversed()
            .map((l) => l.reversed)),
      ...g.image(e).letters,
      ...(atEnd === undefined ? [] : γ(atEnd)),
    ]).reduced().letters as OrientedEdge[];

  // The sector junctions, created now so that they can be used as nodes; their strips are added below.
  const sectorJunction = new Map(sectors.map((x) => [x, fs.addJunction()]));
  const junctionOf = (x: Sector) => sectorJunction.get(x) as Vertex;
  /** The G-junction that the new junction of the sector after x is mapped to, before choosing its sector there. */
  const imageBase = (x: Sector) => γ(x).at(-1)?.target ?? g.vertexImage(x.source);

  // The strips of the complement with their trimmed images in G. A copy of the strip e of K on the right side runs
  // from the sector before e to the sector after ē, the copy on the left from the sector after e to the sector before ē.
  interface Strip {
    readonly source: Vertex;
    readonly target: Vertex;
    readonly letters: OrientedEdge[];
    readonly set: (image: EdgePath) => void;
  }
  const endOf = (e: OrientedEdge): Vertex => {
    const s = sectorOf.get(e);
    return s === undefined ? e.source : junctionOf(s);
  };
  const strips: Strip[] = [];
  const copies = new Map<Edge, { right: Edge; left: Edge }>();
  for (const e of K) {
    const f = e.forward;
    const b = e.backward;
    const right = fs.addStrip(junctionOf(previous(f)), junctionOf(b), {
      name: copyName(fs, e, "r"),
      color: e.color,
    });
    const left = fs.addStrip(junctionOf(f), junctionOf(previous(b)), {
      name: copyName(fs, e, "l"),
      color: e.color,
    });
    copies.set(e, { right, left });
    strips.push({
      source: right.source,
      target: right.target,
      letters: trimmed(f, previous(f), b),
      set: (image) => g.setImage(right.forward, image),
    });
    strips.push({
      source: left.source,
      target: left.target,
      letters: trimmed(f, f, previous(b)),
      set: (image) => g.setImage(left.forward, image),
    });
  }
  const copyOf = (y: OrientedEdge, side: Side): OrientedEdge => {
    const { right, left } = copies.get(y.edge) as { right: Edge; left: Edge };
    if (y.isForward) return side === "right" ? right.forward : left.forward;
    return side === "right" ? left.backward : right.backward;
  };
  for (const e of graph.edges) {
    if (K.has(e) || isCopy(e)) continue;
    strips.push({
      source: endOf(e.forward),
      target: endOf(e.backward),
      letters: trimmed(e.forward, sectorOf.get(e.forward), sectorOf.get(e.backward)),
      set: (image) => g.setImage(e.forward, image),
    });
  }
  function isCopy(e: Edge): boolean {
    return [...copies.values()].some((c) => c.right === e || c.left === e);
  }

  // The lift: every letter of K becomes its copy on one side, so that consecutive letters meet in the same sector.
  const options = (l: OrientedEdge): { from: State; to: State; side: Side | null }[] => {
    if (!inK(l)) return [{ from: sectorOf.get(l) ?? null, to: sectorOf.get(l.reversed) ?? null, side: null }];
    return [
      { from: previous(l), to: l.reversed, side: "right" },
      { from: l, to: previous(l.reversed), side: "left" },
    ];
  };
  /** The states reachable after each letter, from the given start states. */
  const forward = (letters: readonly OrientedEdge[], starts: readonly State[]): Set<State>[] => {
    const sets = [new Set(starts)];
    for (const l of letters) {
      const last = sets.at(-1) as Set<State>;
      sets.push(
        new Set(
          options(l)
            .filter((o) => last.has(o.from))
            .map((o) => o.to),
        ),
      );
    }
    return sets;
  };
  /** The start and end states for which a lift exists. */
  const feasible = (letters: readonly OrientedEdge[], starts: readonly State[], ends: readonly State[]) => {
    const reach = forward(letters, starts);
    const endSet = new Set(ends.filter((s) => (reach.at(-1) as Set<State>).has(s)));
    let back = endSet;
    for (let i = letters.length - 1; i >= 0; i--) {
      const target = back;
      back = new Set(
        options(letters[i] as OrientedEdge)
          .filter((o) => (reach[i] as Set<State>).has(o.from) && target.has(o.to))
          .map((o) => o.from),
      );
    }
    return { starts: back, ends: endSet };
  };

  // The junction images: a sector of the image junction for every junction of the complement mapped into K.
  const domain = new Map<Vertex, State[]>();
  const sectorsAt = (u: Vertex): State[] => graph.star(u).filter((e) => inSector.has(e));
  for (const x of sectors) domain.set(junctionOf(x), sectorsAt(imageBase(x)));
  for (const v of graph.vertices)
    if (!junctionsOfK.has(v) && !domain.has(v))
      domain.set(v, junctionsOfK.has(g.vertexImage(v)) ? sectorsAt(g.vertexImage(v)) : [null]);
  const dom = (v: Vertex) => domain.get(v) as State[];
  const propagate = () => {
    for (let changed = true; changed;) {
      changed = false;
      for (const s of strips) {
        const { starts, ends } =
          s.source === s.target
            ? loopFeasible(s.letters, dom(s.source))
            : feasible(s.letters, dom(s.source), dom(s.target));
        for (const [v, allowed] of [
          [s.source, starts],
          [s.target, ends],
        ] as const) {
          const narrowed = dom(v).filter((x) => allowed.has(x));
          if (narrowed.length === 0)
            throw new Error(`g can't be lifted to the complement of K at the image of ${v}`);
          if (narrowed.length < dom(v).length) {
            domain.set(v, narrowed);
            changed = true;
          }
        }
      }
    }
  };
  function loopFeasible(letters: readonly OrientedEdge[], states: readonly State[]) {
    const ok = new Set(states.filter((x) => feasible(letters, [x], [x]).starts.size > 0));
    return { starts: ok, ends: ok };
  }
  propagate();
  for (const v of domain.keys())
    if (dom(v).length > 1) {
      domain.set(v, [dom(v)[0] as State]); // any consistent choice; the others differ by an isotopy along K's side
      propagate();
    }

  // New images under g: the lifted paths.
  const lift = (letters: readonly OrientedEdge[], start: State, end: State): OrientedEdge[] => {
    const reach = forward(letters, [start]);
    const result: OrientedEdge[] = [];
    let target = new Set([end]);
    const chosen: OrientedEdge[] = [];
    for (let i = letters.length - 1; i >= 0; i--) {
      const l = letters[i] as OrientedEdge;
      const o = options(l).find((o) => (reach[i] as Set<State>).has(o.from) && target.has(o.to));
      if (o === undefined) throw new Error("Lost the lift");
      chosen.push(o.side === null ? l : copyOf(l, o.side));
      target = new Set([o.from]);
    }
    result.push(...chosen.toReversed());
    return result;
  };
  const vertexImage = (v: Vertex): Vertex => {
    const state = dom(v)[0] as State;
    return state === null ? g.vertexImage(v) : junctionOf(state);
  };
  const newImages = strips.map((s) =>
    EdgePath.from(lift(s.letters, dom(s.source)[0] as State, dom(s.target)[0] as State)),
  );

  // μ: the sector junctions sit at their junction of K, the copies run along their strip.
  for (const x of sectors) fs.mu.setVertexImage(junctionOf(x), fs.mu.vertexImage(x.source));
  for (const [e, { right, left }] of copies) {
    fs.mu.setImage(right.forward, fs.mu.image(e.forward));
    fs.mu.setImage(left.forward, fs.mu.image(e.forward));
  }

  // The graph: move St(K) to the sectors, and set the cyclic orders there.
  for (const [e, x] of sectorOf) graph.reattach(e, junctionOf(x));
  for (const x of sectors)
    graph.setStar(junctionOf(x), [
      copyOf(x, "left"),
      ...(inSector.get(x) as OrientedEdge[]),
      copyOf(next(x), "right"),
    ]);

  // g on the complement.
  for (const v of domain.keys()) g.setVertexImage(v, vertexImage(v));
  strips.forEach((s, i) => s.set(newImages[i] as EdgePath));
  for (const { right, left } of copies.values()) {
    fs.peripheral.add(right);
    fs.peripheral.add(left);
  }
}

/** A name for the copy of `e` on one side, `e_r` or `e_l`, or the next free name if that is taken. */
function copyName(fs: FibredSurface, e: Edge, side: "r" | "l"): string {
  const name = `${e.name}_${side}`;
  return fs.graph.edges.some((f) => f.name.toLowerCase() === name.toLowerCase()) ? fs.nextEdgeName() : name;
}

/** Which letters of the cyclic word `W` survive its cyclic reduction (the survivors of each factor are consecutive). */
function cyclicSurvivors(W: readonly OrientedEdge[]): boolean[] {
  const stack: number[] = [];
  W.forEach((l, i) => {
    if (stack.length > 0 && W[stack.at(-1) as number] === l.reversed) stack.pop();
    else stack.push(i);
  });
  let [first, last] = [0, stack.length - 1];
  while (last > first && W[stack[first] as number] === (W[stack[last] as number] as OrientedEdge).reversed) {
    first++;
    last--;
  }
  const survives = W.map(() => false);
  for (const i of stack.slice(first, last + 1)) survives[i] = true;
  return survives;
}
