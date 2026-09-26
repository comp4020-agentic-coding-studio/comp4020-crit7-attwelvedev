import type { ReqExpr } from "../lib/domain/types";
import type { PlanView } from "../lib/domain/view";

export interface DropTarget {
  term: number;
  allowed: boolean;
  reason: string | null;
}

// `hardBlockedOverride` is for a course that isn't (yet) in `view.courses` at
// all — a search result outside the plan's tree — where falling back to `{}`
// would wrongly show every term as allowed instead of the code's own,
// already-computed hardBlocked map.
export function dropTargets(view: PlanView, code: string, hardBlockedOverride?: Record<number, string>): DropTarget[] {
  const hardBlocked = hardBlockedOverride ?? view.courses[code]?.hardBlocked ?? {};
  return view.terms.map((term) => {
    if (view.plan.readOnly) {
      return { term: term.index, allowed: false, reason: "This plan is read-only" };
    }
    const reason = hardBlocked[term.index] ?? null;
    return { term: term.index, allowed: reason === null, reason };
  });
}

export interface ProgressSegments {
  completedPct: number;
  plannedPct: number;
}

export function progressSegments(completed: number, planned: number, required: number): ProgressSegments {
  if (required <= 0) return { completedPct: 0, plannedPct: 0 };
  const completedPct = Math.min(100, (completed / required) * 100);
  const plannedPct = Math.min(100 - completedPct, (planned / required) * 100);
  return { completedPct, plannedPct };
}

function collectPrereqLeaves(expr: ReqExpr | null, out: { code: string; concurrent: boolean }[]): void {
  if (expr === null) return;
  if (expr.kind === "and" || expr.kind === "or") {
    for (const item of expr.items) collectPrereqLeaves(item, out);
  } else if (expr.kind === "course") {
    out.push({ code: expr.code, concurrent: expr.concurrent });
  }
}

export interface OverlayEdge {
  from: string;
  to: string;
}

// Only an edge from a prereq placed in an earlier term (or the same term,
// for a concurrent leaf) — matching what actually satisfies the requisite,
// not just "placed somewhere" (view.placements[].placedPrereqs is looser).
export function overlayEdges(view: PlanView, code: string): OverlayEdge[] {
  const placement = view.placements.find((p) => p.code === code);
  const course = view.courses[code];
  if (!placement || !course?.prereq) return [];

  const leaves: { code: string; concurrent: boolean }[] = [];
  collectPrereqLeaves(course.prereq, leaves);

  const edges: OverlayEdge[] = [];
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf.code)) continue;
    const leafPlacement = view.placements.find((p) => p.code === leaf.code);
    if (!leafPlacement) continue;
    const earlier = leafPlacement.term < placement.term;
    const sameTermConcurrent = leaf.concurrent && leafPlacement.term === placement.term;
    if (earlier || sameTermConcurrent) {
      edges.push({ from: leaf.code, to: code });
      seen.add(leaf.code);
    }
  }
  return edges;
}

export function unplacedCount(view: PlanView, code: string): number {
  return view.placements.find((p) => p.code === code)?.unplacedPrereqs.length ?? 0;
}

export function groupLabel(view: PlanView, groupId: string): string {
  function search(groups: PlanView["groups"]): string | null {
    for (const group of groups) {
      if (group.id === groupId) return group.label;
      const found = search(group.children);
      if (found) return found;
    }
    return null;
  }
  return search(view.groups) ?? groupId;
}
