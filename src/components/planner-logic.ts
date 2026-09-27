import { matchesFilter } from "../lib/domain/filters";
import type { CourseFilter, ReqExpr } from "../lib/domain/types";
import type { GroupView, PlacementView, PlanView } from "../lib/domain/view";

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

export interface MenuTargets {
  targets: DropTarget[];
  blockedReasons: string[];
}

// What a "Place in…" or "Move to" list offers: only terms a drop would
// also accept, never the one the course already sits in, and when nothing
// is left, why, deduplicated since several terms often share one reason
// (e.g. "not offered this semester").
export function menuTargets(
  view: PlanView,
  code: string,
  options: { currentTerm?: number; hardBlockedOverride?: Record<number, string> } = {},
): MenuTargets {
  const allTargets = dropTargets(view, code, options.hardBlockedOverride).filter(
    (target) => target.term !== options.currentTerm,
  );
  const targets = allTargets.filter((target) => target.allowed);
  const blockedReasons = Array.from(
    new Set(allTargets.filter((target) => !target.allowed && target.reason).map((target) => target.reason as string)),
  );
  return { targets, blockedReasons };
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

// "required": a course named outright on an all-AND path — the dependent
// can't be taken without it. "option": one of several ways through — an OR
// branch, or a course counting toward an "N units of ..." pool — where
// another placed course could stand in for it.
export type OverlayEdgeKind = "required" | "option";

export interface OverlayEdge {
  from: string;
  to: string;
  kind: OverlayEdgeKind;
}

interface PrereqLeaf {
  code: string;
  concurrent: boolean;
  kind: OverlayEdgeKind;
}

// A units pool with no constraint at all ("72 units towards a degree")
// would link every earlier course — noise, not a dependency.
function isOpenFilter(f: CourseFilter): boolean {
  return !f.codes && !f.prefixes && f.minLevel === undefined && f.maxLevel === undefined && !f.tdp;
}

function collectPrereqLeaves(view: PlanView, expr: ReqExpr, optional: boolean, out: PrereqLeaf[]): void {
  switch (expr.kind) {
    case "and":
      for (const item of expr.items) collectPrereqLeaves(view, item, optional, out);
      return;
    case "or":
      for (const item of expr.items) collectPrereqLeaves(view, item, optional || expr.items.length > 1, out);
      return;
    case "course":
      out.push({ code: expr.code, concurrent: expr.concurrent, kind: optional ? "option" : "required" });
      return;
    case "units":
      if (isOpenFilter(expr.filter)) return;
      for (const p of view.placements) {
        const card = view.courses[p.code];
        if (card && matchesFilter(card, expr.filter, null)) out.push({ code: p.code, concurrent: false, kind: "option" });
      }
      return;
    default:
      return;
  }
}

// Only an edge from a prereq that actually counts toward the requisite —
// finished (its last term, for a two-semester course) before the dependent
// starts, or by then for a concurrent leaf, and not the losing side of an
// incompatible pair — the same timing evaluate.ts checks, not just "placed
// somewhere" (view.placements[].placedPrereqs is looser).
export function overlayEdges(view: PlanView, code: string): OverlayEdge[] {
  const placement = view.placements.find((p) => p.code === code);
  const course = view.courses[code];
  if (!placement || !course?.prereq) return [];

  const leaves: PrereqLeaf[] = [];
  collectPrereqLeaves(view, course.prereq, false, leaves);

  // A course reached both ways (named outright and also in a pool) is
  // drawn once, as required — the stronger of the two claims.
  const kinds = new Map<string, OverlayEdgeKind>();
  for (const leaf of leaves) {
    if (leaf.code === code) continue;
    const leafPlacement = view.placements.find((p) => p.code === leaf.code);
    if (!leafPlacement || leafPlacement.loser) continue;
    const counts = leaf.concurrent ? leafPlacement.lastTerm <= placement.term : leafPlacement.lastTerm < placement.term;
    if (!counts) continue;
    if (kinds.get(leaf.code) !== "required") kinds.set(leaf.code, leaf.kind);
  }
  return [...kinds].map(([from, kind]) => ({ from, to: code, kind }));
}

export function unplacedCount(view: PlanView, code: string): number {
  return view.placements.find((p) => p.code === code)?.prereqsToPlace ?? 0;
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
      // Deliberately never names group.missing here: for anything but an
      // ALL-rule group, satisfying the requirement only ever needs a
      // subset of its listed courses (e.g. "24 units from this list of
      // 12"), so naming the full missing list reads as "you need all of
      // these," which is wrong more often than it's right. The unit
      // shortfall is the one thing that's true regardless of rule type.
      const shortfall = group.unitsRequired - group.completed - group.planned;
      out.push({
        id: `group-${group.id}`,
        text:
          shortfall > 0
            ? `${group.label}: ${shortfall} more unit${shortfall === 1 ? "" : "s"} needed`
            : `${group.label}: not yet satisfied`,
      });
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

export interface UnitsLabel {
  short: string;
  full: string;
}

// The short form fits a card's first line; the full one is what assistive
// technology hears, since "6u" reads aloud as a letter. A two-semester
// course's `units` is per semester, so it shows as that amount twice.
export function unitsLabel(course: { units: number; twoSemester: boolean }): UnitsLabel {
  const u = course.units;
  const amount = course.twoSemester ? `${u}+${u}` : `${u}`;
  return {
    short: `${amount}u`,
    full: `${amount} unit${!course.twoSemester && u === 1 ? "" : "s"}`,
  };
}

// The card only counts what's left to confirm; Details lists each item.
export function verifyBadgeText(count: number): string {
  return `Verify on P&C: ${count} item${count === 1 ? "" : "s"}`;
}

export interface PlacedStatus {
  word: "Completed" | "Planned";
  termLabel: string;
}

// A placed row's status, from the same `completed` flag the progress numbers
// use, so a row never disagrees with its group's bar.
export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus {
  return {
    word: placement.completed ? "Completed" : "Planned",
    termLabel: view.terms[placement.term].label,
  };
}

export interface CompletedReadout {
  short: string;
  full: string;
}

// The short form is the completed-semesters control's visible label; the full
// sentence is what assistive technology hears, so it also names the gold line.
export function completedReadout(cutoff: number, terms: readonly { label: string }[]): CompletedReadout {
  const boundary = " The gold line on the timeline marks that boundary.";
  if (cutoff <= 0) {
    return { short: "Nothing completed yet", full: `Nothing on the timeline counts as completed yet.${boundary}` };
  }
  if (cutoff >= terms.length) {
    return { short: "All semesters completed", full: `Every semester on the timeline counts as completed.${boundary}` };
  }
  const last = terms[cutoff - 1].label;
  return {
    short: `Completed through ${last}`,
    full: `Completed through ${last} — planned from ${terms[cutoff].label} onward.${boundary}`,
  };
}
