import type { Catalogue, Family, PlanState, ProgramDef } from "./types";
import { buildPlanView, type GroupView } from "./view";

export interface WhatIfGroupRef {
  id: string;
  label: string;
  family: Family;
}

export interface WhatIfView {
  groupId: string; // the selectable group, "spec"
  optionId: string; // "arin"
  completed: number; // the option's totals after the swap
  planned: number;
  required: number;
  // Placed courses counting toward the option after, with where each counts now (null: nothing).
  moves: { code: string; from: WhatIfGroupRef | null; to: WhatIfGroupRef }[];
  // Placed courses counting toward the current option (if another is chosen) now, and where they'd count after.
  leaving: { code: string; from: WhatIfGroupRef; to: WhatIfGroupRef | null }[];
  // Leaf groups outside both options, satisfied now but not after; figures are the after ones.
  shortfalls: { groupId: string; label: string; completed: number; planned: number; required: number }[];
  countsToward: Record<string, string | null>; // after, every placed course
  lists: { groupId: string; completed: number; planned: number; unitsMax: number | null }[]; // the option's children, after
}

function find(groups: GroupView[], id: string): GroupView | null {
  for (const group of groups) {
    if (group.id === id) return group;
    const found = find(group.children, id);
    if (found) return found;
  }
  return null;
}

function subtreeIds(group: GroupView | null): Set<string> {
  const ids = new Set<string>();
  const walk = (g: GroupView) => {
    ids.add(g.id);
    g.children.forEach(walk);
  };
  if (group) walk(group);
  return ids;
}

function leaves(groups: GroupView[]): GroupView[] {
  return groups.flatMap((g) => (g.children.length === 0 ? [g] : leaves(g.children)));
}

const ref = (g: GroupView): WhatIfGroupRef => ({ id: g.id, label: g.label, family: g.family });

// The plan re-evaluated as if `optionId` were chosen for `groupId`: the same
// allocation a real switch would produce, since setChoice's pin clearing is
// already how buildPlanView treats a pin that's no longer eligible.
export function whatIfChoice(
  cat: Catalogue,
  program: ProgramDef,
  plan: PlanState,
  groupId: string,
  optionId: string,
): WhatIfView {
  const before = buildPlanView(cat, program, plan);
  const after = buildPlanView(cat, program, { ...plan, choices: { ...plan.choices, [groupId]: optionId } });

  const option = find(after.groups, optionId);
  const optionIds = subtreeIds(option);
  const current = plan.choices[groupId];
  const currentIds = current && current !== optionId ? subtreeIds(find(before.groups, current)) : new Set<string>();

  const beforeOf = new Map(before.placements.map((p) => [p.code, p.countsToward]));
  const afterOf = new Map(after.placements.map((p) => [p.code, p.countsToward]));
  const refIn = (groups: GroupView[], id: string | null | undefined) => {
    const group = id ? find(groups, id) : null;
    return group ? ref(group) : null;
  };

  const moves = after.placements
    .filter((p) => p.countsToward !== null && optionIds.has(p.countsToward))
    .map((p) => ({ code: p.code, from: refIn(before.groups, beforeOf.get(p.code)), to: refIn(after.groups, p.countsToward)! }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const leaving = before.placements
    .filter((p) => p.countsToward !== null && currentIds.has(p.countsToward))
    .map((p) => ({ code: p.code, from: refIn(before.groups, p.countsToward)!, to: refIn(after.groups, afterOf.get(p.code)) }));

  const afterLeaves = new Map(leaves(after.groups).map((g) => [g.id, g]));
  const shortfalls = leaves(before.groups).flatMap((g) => {
    const then = afterLeaves.get(g.id);
    if (optionIds.has(g.id) || currentIds.has(g.id) || !g.satisfied || !then || then.satisfied) return [];
    return [{ groupId: g.id, label: then.label, completed: then.completed, planned: then.planned, required: then.unitsRequired }];
  });

  return {
    groupId,
    optionId,
    completed: option?.completed ?? 0,
    planned: option?.planned ?? 0,
    required: option?.unitsRequired ?? 0,
    moves,
    leaving,
    shortfalls,
    countsToward: Object.fromEntries(afterOf),
    lists: (option?.children ?? []).map((c) => ({
      groupId: c.id,
      completed: c.completed,
      planned: c.planned,
      unitsMax: c.unitsMax,
    })),
  };
}
