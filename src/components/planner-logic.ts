import type { ReqExpr } from "../lib/domain/types";
import type { GroupView, PlanView } from "../lib/domain/view";

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

export interface OutstandingItem {
  id: string;
  text: string;
}

// Leaf groups only: a parent group's own satisfied/unsatisfied state is
// just an aggregate of its children, so walking every depth would report
// "Major: not satisfied" and then each of its unsatisfied sub-groups too —
// the leaves are the only ones a student can actually act on directly.
function collectGroupItems(groups: GroupView[], out: OutstandingItem[]): void {
  for (const group of groups) {
    if (group.selectable && !group.chosenId) {
      out.push({ id: `choice-${group.id}`, text: `Choose your ${group.label}` });
    }
    if (group.children.length === 0 && !group.satisfied) {
      if (group.missing.length > 0) {
        const shown = group.missing.slice(0, 3).join(", ");
        const rest = group.missing.length > 3 ? `, +${group.missing.length - 3} more` : "";
        out.push({ id: `group-${group.id}`, text: `${group.label}: needs ${shown}${rest}` });
      } else {
        // A filter-based group (e.g. "any 3000/4000-level COMP") has no
        // fixed course list to name as missing, so fall back to the plain
        // unit shortfall — still the most useful thing to say about it.
        const shortfall = group.unitsRequired - group.completed - group.planned;
        out.push({
          id: `group-${group.id}`,
          text:
            shortfall > 0
              ? `${group.label}: ${shortfall} more unit${shortfall === 1 ? "" : "s"} needed`
              : `${group.label}: not yet satisfied`,
        });
      }
    }
    collectGroupItems(group.children, out);
  }
}

// A compact "what's actually left" rollup — the alternative to scanning
// every requirement group's own progress bar to work out whether the plan
// is actually done. Groups come in tree order (a still-open choice, e.g.
// "Choose your Specialisation", lands right next to that group's own unit
// shortfall rather than separated from it), with plan-wide checks (a
// 1000-level unit cap, say) last since they aren't about any one group.
export function outstandingItems(view: PlanView): OutstandingItem[] {
  const out: OutstandingItem[] = [];
  collectGroupItems(view.groups, out);
  for (const check of view.checks) {
    if (check.ok === false) {
      out.push({ id: `check-${check.id}`, text: `${check.label}: not yet satisfied` });
    } else if (check.ok === null) {
      out.push({ id: `check-${check.id}`, text: `${check.label} — not tracked, verify on P&C` });
    }
  }
  return out;
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
