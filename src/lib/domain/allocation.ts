import { matchesFilter } from "./filters";
import type { CatalogueCourse, GroupDef, ProgramDef } from "./types";

export interface AllocItem {
  code: string;
  units: number;
  eligible: string[];
  pinned: string | null;
}

export interface AllocGroup {
  id: string;
  parentId: string | null;
  order: number;
  unitsRequired: number;
  unitsMax: number | null;
}

export interface Allocation {
  byCourse: Record<string, string | null>;
  unitsByGroup: Record<string, number>;
}

export class IneligiblePinError extends Error {}

// Reward is concentrated at the top level (overview §4.1): a unit should
// count once per degree requirement, however deep its leaf sits, and this
// tree nests at most two inner-group hops (spec -> thcs -> thcs-a). The
// per-order spacing (1000) must exceed the largest possible sum of inner
// hop bonuses (2 * 10 = 20), or a deeper path can still outbid a shallower
// top-level requirement it should lose to (verified against `compulsory`
// vs `thcs-a` for COMP3630 — see plans/2026-09-26-degree-planner-05-*).
const TOP_REQUIRED_BASE = 1_000_000;
const TOP_ORDER_STEP = 1000;
const TOP_SURPLUS_COST = -1;
const INNER_REQUIRED_COST = -10;
const INNER_SURPLUS_COST = 0;

const MAX_BIG_ITEM_PRODUCT = 256;

function gcdTwo(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function gcdAll(nums: number[]): number {
  const positive = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (positive.length === 0) return 1;
  return positive.reduce((acc, n) => gcdTwo(acc, n), positive[0]!);
}

function courseMatchesGroup(course: CatalogueCourse, group: GroupDef, tdp: Set<string> | null): boolean {
  if (group.courses?.includes(course.code)) return true;
  if (group.filter && matchesFilter(course, group.filter, tdp)) return true;
  return false;
}

// Only active subtrees take part (overview §4.1): a selectable group with a
// recorded choice descends into just that child; passing `choices` as {}
// (no choice recorded anywhere) makes every option count, which is what a
// general "what could this course count toward" query (courseCard) wants.
export function eligibleLeaves(
  program: ProgramDef,
  choices: Record<string, string>,
  course: CatalogueCourse,
  tdp: Set<string> | null,
): string[] {
  const out: string[] = [];
  function walk(group: GroupDef): void {
    const children = group.children;
    if (!children || children.length === 0) {
      if (courseMatchesGroup(course, group, tdp)) out.push(group.id);
      return;
    }
    if (group.selectable) {
      const chosen = choices[group.id];
      if (chosen !== undefined) {
        const child = children.find((c) => c.id === chosen);
        if (child) walk(child);
        return;
      }
    }
    for (const child of children) walk(child);
  }
  for (const group of program.groups) walk(group);
  return out;
}

// What a *placed* course can count toward, and so be pinned to: only leaves
// in active subtrees. Unlike eligibleLeaves({}), a selectable group with no
// choice yet contributes nothing (FR25), so a new plan's Pin to list and pin
// check never offer a capstone option the student hasn't picked.
export function activeEligibleLeaves(
  program: ProgramDef,
  choices: Record<string, string>,
  course: CatalogueCourse,
  tdp: Set<string> | null,
): string[] {
  const active = new Set(activeGroups(program, choices).map((g) => g.id));
  return eligibleLeaves(program, choices, course, tdp).filter((id) => active.has(id));
}

// Builds the flow graph's group nodes: every active group (leaf, inner or
// top-level). A selectable group with no recorded choice contributes only
// itself, not its children — the whole subtree stays inactive (FR25: an
// unchosen selectable group counts as unmet).
export function activeGroups(program: ProgramDef, choices: Record<string, string>): AllocGroup[] {
  const out: AllocGroup[] = [];
  function walk(group: GroupDef, parentId: string | null, order: number): void {
    const unitsMax = group.unitsMax ?? (group.ruleType === "ALL" ? group.unitsRequired : null);
    out.push({ id: group.id, parentId, order, unitsRequired: group.unitsRequired, unitsMax });

    const children = group.children;
    if (!children || children.length === 0) return;
    if (group.selectable) {
      const chosen = choices[group.id];
      if (chosen === undefined) return;
      const child = children.find((c) => c.id === chosen);
      if (child) walk(child, group.id, order);
      return;
    }
    for (const child of children) walk(child, group.id, order);
  }
  program.groups.forEach((group, index) => walk(group, null, index));
  return out;
}

// ---- a tiny min-cost flow solver over a string-keyed graph ----

interface Edge {
  to: string;
  cap: number;
  cost: number;
  flow: number;
}

class FlowGraph {
  private edges: Edge[] = [];
  private adj = new Map<string, number[]>();

  private link(node: string, idx: number): void {
    const list = this.adj.get(node);
    if (list) list.push(idx);
    else this.adj.set(node, [idx]);
  }

  addEdge(from: string, to: string, cap: number, cost: number): void {
    this.link(from, this.edges.length);
    this.edges.push({ to, cap, cost, flow: 0 });
    this.link(to, this.edges.length);
    this.edges.push({ to: from, cap: 0, cost: -cost, flow: 0 });
  }

  // Bellman-Ford shortest path from source to sink over the residual graph.
  // Costs can be negative (rewards), but the underlying graph is a DAG, so
  // no negative cycle can ever appear in the residual graph either.
  private shortestPath(source: string, sink: string): { path: number[]; cost: number } | null {
    const dist = new Map<string, number>([[source, 0]]);
    const prevEdge = new Map<string, number>();
    for (let iter = 0; iter < this.adj.size; iter++) {
      let updated = false;
      for (const [node, idxs] of this.adj) {
        const d = dist.get(node);
        if (d === undefined) continue;
        for (const idx of idxs) {
          const e = this.edges[idx]!;
          if (e.cap - e.flow <= 0) continue;
          const nd = d + e.cost;
          if (nd < (dist.get(e.to) ?? Infinity)) {
            dist.set(e.to, nd);
            prevEdge.set(e.to, idx);
            updated = true;
          }
        }
      }
      if (!updated) break;
    }
    const sinkDist = dist.get(sink);
    if (sinkDist === undefined || sinkDist >= 0) return null;

    const path: number[] = [];
    let node = sink;
    while (node !== source) {
      const idx = prevEdge.get(node);
      if (idx === undefined) return null;
      path.push(idx);
      node = this.edges[idx ^ 1]!.to;
    }
    path.reverse();
    return { path, cost: sinkDist };
  }

  // Augments along successive shortest (most negative) paths until none
  // remain, i.e. until residual capacity toward the sink is exhausted.
  // Every complete path costs strictly less than zero here (every path
  // ends on a top-level -> sink arc, cost -1 or lower), so this is
  // equivalent to plain max-flow with minimum cost.
  solve(source: string, sink: string): number {
    let totalCost = 0;
    for (;;) {
      const found = this.shortestPath(source, sink);
      if (!found) break;
      let bottleneck = Infinity;
      for (const idx of found.path) bottleneck = Math.min(bottleneck, this.edges[idx]!.cap - this.edges[idx]!.flow);
      for (const idx of found.path) {
        this.edges[idx]!.flow += bottleneck;
        this.edges[idx ^ 1]!.flow -= bottleneck;
      }
      totalCost += bottleneck * found.cost;
    }
    return totalCost;
  }

  flowInto(node: string): number {
    let total = 0;
    for (let i = 0; i < this.edges.length; i += 2) {
      const e = this.edges[i]!;
      if (e.to === node) total += Math.max(0, e.flow);
    }
    return total;
  }

  flowOn(from: string, to: string): number {
    let total = 0;
    for (const idx of this.adj.get(from) ?? []) {
      if (idx % 2 !== 0) continue;
      const e = this.edges[idx]!;
      if (e.to === to) total += Math.max(0, e.flow);
    }
    return total;
  }
}

function existingEligible(item: AllocItem, groupById: Map<string, AllocGroup>): string[] {
  if (item.pinned !== null) return [item.pinned];
  return item.eligible.filter((id) => groupById.has(id));
}

function effectiveCap(group: AllocGroup, groupById: Map<string, AllocGroup>): number {
  if (group.unitsMax !== null) return group.unitsMax;
  if (group.parentId === null) return Infinity;
  const parent = groupById.get(group.parentId);
  return parent ? effectiveCap(parent, groupById) : Infinity;
}

function buildGraph(
  groups: AllocGroup[],
  groupById: Map<string, AllocGroup>,
  items: AllocItem[],
  s: number,
  fixedLeaf: Map<string, string | null>,
): FlowGraph {
  const graph = new FlowGraph();
  const SOURCE = "SOURCE";
  const SINK = "SINK";

  for (const item of items) {
    const itemNode = `item:${item.code}`;
    const cap = item.units / s;
    graph.addEdge(SOURCE, itemNode, cap, 0);
    if (fixedLeaf.has(item.code)) {
      const leaf = fixedLeaf.get(item.code)!;
      if (leaf !== null) graph.addEdge(itemNode, `group:${leaf}`, cap, 0);
    } else {
      for (const leafId of existingEligible(item, groupById)) {
        graph.addEdge(itemNode, `group:${leafId}`, cap, 0);
      }
    }
  }

  for (const group of groups) {
    const node = `group:${group.id}`;
    const cap = effectiveCap(group, groupById);
    const reqCap = group.unitsRequired / s;
    const surplusCap = cap === Infinity ? Infinity : Math.max(0, cap - group.unitsRequired) / s;
    if (group.parentId === null) {
      const reqCost = -(TOP_REQUIRED_BASE - group.order * TOP_ORDER_STEP);
      graph.addEdge(node, SINK, reqCap, reqCost);
      graph.addEdge(node, SINK, surplusCap, TOP_SURPLUS_COST);
    } else {
      const parentNode = `group:${group.parentId}`;
      graph.addEdge(node, parentNode, reqCap, INNER_REQUIRED_COST);
      graph.addEdge(node, parentNode, surplusCap, INNER_SURPLUS_COST);
    }
  }

  return graph;
}

function extractAllocation(
  groups: AllocGroup[],
  groupById: Map<string, AllocGroup>,
  items: AllocItem[],
  s: number,
  graph: FlowGraph,
): Allocation {
  const byCourse: Record<string, string | null> = {};
  for (const item of items) {
    let assigned: string | null = null;
    for (const leafId of existingEligible(item, groupById)) {
      if (graph.flowOn(`item:${item.code}`, `group:${leafId}`) > 0) {
        assigned = leafId;
        break;
      }
    }
    byCourse[item.code] = assigned;
  }

  const unitsByGroup: Record<string, number> = {};
  for (const group of groups) {
    unitsByGroup[group.id] = graph.flowInto(`group:${group.id}`) * s;
  }

  return { byCourse, unitsByGroup };
}

export function allocate(groups: AllocGroup[], items: AllocItem[]): Allocation {
  for (const item of items) {
    if (item.pinned !== null && !item.eligible.includes(item.pinned)) {
      throw new IneligiblePinError(`${item.code} cannot be pinned to ${item.pinned}: not an eligible group`);
    }
  }

  if (items.length === 0) return { byCourse: {}, unitsByGroup: {} };

  const groupById = new Map(groups.map((g) => [g.id, g] as const));

  const scaleNums: number[] = [];
  for (const item of items) scaleNums.push(item.units);
  for (const group of groups) {
    scaleNums.push(group.unitsRequired);
    if (group.unitsMax !== null) scaleNums.push(group.unitsMax);
  }
  const s = gcdAll(scaleNums);

  const bigItems = items.filter((item) => item.units / s > 1);

  function solveWith(fixedLeaf: Map<string, string | null>): { graph: FlowGraph; cost: number } {
    const graph = buildGraph(groups, groupById, items, s, fixedLeaf);
    const cost = graph.solve("SOURCE", "SINK");
    return { graph, cost };
  }

  let winner: FlowGraph;
  if (bigItems.length === 0) {
    winner = solveWith(new Map()).graph;
  } else {
    const candidateLists: (string | null)[][] = bigItems.map((item) =>
      item.pinned !== null ? [item.pinned] : [...existingEligible(item, groupById), null],
    );
    const productSize = candidateLists.reduce((acc, list) => acc * list.length, 1);

    if (productSize <= MAX_BIG_ITEM_PRODUCT) {
      let best: { graph: FlowGraph; cost: number } | null = null;
      for (let n = 0; n < productSize; n++) {
        const fixedLeaf = new Map<string, string | null>();
        let rem = n;
        for (let i = 0; i < bigItems.length; i++) {
          const list = candidateLists[i]!;
          const idx = rem % list.length;
          rem = Math.floor(rem / list.length);
          fixedLeaf.set(bigItems[i]!.code, list[idx]!);
        }
        const result = solveWith(fixedLeaf);
        if (!best || result.cost < best.cost) best = result;
      }
      winner = best!.graph;
    } else {
      // Too many combinations to enumerate: assign each big item, in
      // order, to the first eligible leaf with remaining capacity, then
      // solve the (now atomic) remainder normally.
      const used = new Map<string, number>();
      const fixedLeaf = new Map<string, string | null>();
      for (const item of bigItems) {
        const candidates = item.pinned !== null ? [item.pinned] : existingEligible(item, groupById);
        let chosen: string | null = null;
        for (const id of candidates) {
          const group = groupById.get(id)!;
          const cap = group.unitsMax ?? Infinity;
          const already = used.get(id) ?? 0;
          if (already + item.units / s <= cap) {
            chosen = id;
            used.set(id, already + item.units / s);
            break;
          }
        }
        fixedLeaf.set(item.code, chosen);
      }
      winner = solveWith(fixedLeaf).graph;
    }
  }

  return extractAllocation(groups, groupById, items, s, winner);
}
