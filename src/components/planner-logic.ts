import type { PlanView } from "../lib/domain/view";

export interface DropTarget {
  term: number;
  allowed: boolean;
  reason: string | null;
}

export function dropTargets(view: PlanView, code: string): DropTarget[] {
  const hardBlocked = view.courses[code]?.hardBlocked ?? {};
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
