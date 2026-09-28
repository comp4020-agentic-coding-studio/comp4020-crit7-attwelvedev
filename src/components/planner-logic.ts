import { matchesFilter } from "../lib/domain/filters";
import { termSpanLabel } from "../lib/domain/terms";
import type { CourseFilter, Family, ReqExpr } from "../lib/domain/types";
import { NORMAL_TERM_UNITS, type GroupView, type PlacementView, type PlanView } from "../lib/domain/view";

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

export interface MenuTarget extends DropTarget {
  label: string;
}

export interface MenuTargets {
  targets: MenuTarget[];
  blockedReasons: string[];
}

// What a "Place in…" or "Move to" list offers: only terms a drop would
// also accept, never the one the course already sits in, and when nothing
// is left, why, deduplicated since several terms often share one reason
// (e.g. "not offered this semester").
export function menuTargets(
  view: PlanView,
  code: string,
  options: { currentTerm?: number; hardBlockedOverride?: Record<number, string>; twoSemester?: boolean } = {},
): MenuTargets {
  const allTargets = dropTargets(view, code, options.hardBlockedOverride).filter(
    (target) => target.term !== options.currentTerm,
  );
  // A two-semester course's option names both semesters it will take up,
  // so choosing S1 2028 doesn't hide that S2 2028 goes with it.
  const span = (options.twoSemester ?? view.courses[code]?.twoSemester ?? false) ? 2 : 1;
  const targets = allTargets
    .filter((target) => target.allowed)
    .map((target) => ({ ...target, label: termSpanLabel(target.term, span) }));
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

export interface ProgressBarNumbers {
  valueNow: number;
  valueMax: number;
  text: string;
}

export function progressBarNumbers(
  completed: number,
  planned: number,
  required: number,
  bound: "min" | "max",
): ProgressBarNumbers {
  const over = completed + planned - required;
  const overNote =
    required > 0 && over > 0
      ? bound === "max"
        ? ` — ${over} unit${over === 1 ? "" : "s"} over the ${required}-unit limit`
        : ` — ${over} unit${over === 1 ? "" : "s"} more than the ${required}-unit minimum, already covered`
      : "";
  return {
    // ARIA requires aria-valuenow to sit within [valuemin, valuemax]; the
    // true total, and by how much it's over, lives in the text instead.
    valueNow: Math.min(completed + planned, required),
    valueMax: required,
    text: `${completed} completed, ${planned} planned of ${bound === "max" ? "up to " : ""}${required}${overNote}`,
  };
}

// A cap-only group ("(max 12)", unitsRequired 0) has nothing to reach, only
// a limit, so its bar measures toward the cap rather than against 0.
export function groupBarTarget(
  group: Pick<GroupView, "unitsRequired" | "unitsMax">,
): { required: number; bound: "min" | "max" } {
  if (group.unitsRequired === 0 && group.unitsMax !== null) return { required: group.unitsMax, bound: "max" };
  return { required: group.unitsRequired, bound: "min" };
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

// Where a "What's left" item jumps to, read off the id outstandingItems
// gave it; null for anything without a row to show.
export function outstandingTarget(id: string): { kind: "group" | "check"; id: string } | null {
  for (const [prefix, kind] of [
    ["group-", "group"],
    ["choice-", "group"],
    ["check-", "check"],
  ] as const) {
    if (id.startsWith(prefix)) return { kind, id: id.slice(prefix.length) };
  }
  return null;
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

// The chain from a top-level group down to `groupId`, so a jump knows which
// sidebar section to expand before it can reach a nested group. Empty when
// the group isn't in the tree.
export function groupPath(view: PlanView, groupId: string): GroupView[] {
  function search(groups: GroupView[]): GroupView[] | null {
    for (const group of groups) {
      if (group.id === groupId) return [group];
      const found = search(group.children);
      if (found) return [group, ...found];
    }
    return null;
  }
  return search(view.groups) ?? [];
}

// The ids of a group and every group nested under it: what a course's
// countsToward (always a leaf) has to be in to count toward that group.
export function groupLeafIds(view: PlanView, groupId: string): Set<string> {
  const ids = new Set<string>();
  function collect(group: GroupView) {
    ids.add(group.id);
    for (const child of group.children) collect(child);
  }
  const target = groupPath(view, groupId).at(-1);
  if (target) collect(target);
  return ids;
}

// Legend order for the per-term bar and anything else that lists families.
export const FAMILY_ORDER: readonly Family[] = ["foundations", "specialisation", "advanced", "ict", "capstone", "neutral"];
export const FAMILY_LABELS: Record<Family, string> = {
  foundations: "Foundations",
  specialisation: "Specialisation",
  advanced: "3000/4000-level COMP",
  ict: "ICT",
  capstone: "Capstone",
  neutral: "Electives",
};

// A group's colour family, found the way groupLabel finds its label. No
// group (a course counting toward nothing) or an unknown one is neutral.
export function familyOf(view: PlanView, groupId: string | null): Family {
  function search(groups: PlanView["groups"]): Family | null {
    for (const group of groups) {
      if (group.id === groupId) return group.family;
      const found = search(group.children);
      if (found) return found;
    }
    return null;
  }
  return (groupId !== null && search(view.groups)) || "neutral";
}

// "none" is a course counting toward nothing (e.g. an incompatibility's
// loser) — kept apart from neutral so the bar's text can say so.
export type TermSegmentKey = Family | "none";
export interface TermSegment {
  key: TermSegmentKey;
  units: number;
}

// A term's units by family, counting each course once per term it occupies
// so the segments always sum to TermView.units.
export function termFamilyUnits(view: PlanView, term: number): TermSegment[] {
  const units = new Map<TermSegmentKey, number>();
  for (const p of view.placements) {
    if (p.term > term || term > p.lastTerm) continue;
    const key: TermSegmentKey = p.countsToward ? familyOf(view, p.countsToward) : "none";
    units.set(key, (units.get(key) ?? 0) + (view.courses[p.code]?.units ?? 0));
  }
  return [...FAMILY_ORDER, "none" as const]
    .map((key) => ({ key, units: units.get(key) ?? 0 }))
    .filter((s) => s.units > 0);
}

// Percent widths against a normal term, so unused capacity shows as empty
// track; an overloaded term scales to its own total instead of spilling.
export function termBarWidths(segments: readonly { units: number }[], termUnits: number): number[] {
  const scale = Math.max(NORMAL_TERM_UNITS, termUnits);
  return segments.map((s) => (s.units / scale) * 100);
}

export function termBarLabel(segments: readonly TermSegment[]): string {
  if (segments.length === 0) return "No units planned";
  return segments
    .map((s) => `${s.units} units ${s.key === "none" ? "not counting" : FAMILY_LABELS[s.key]}`)
    .join(", ");
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
  termLabel: string; // the locate button's text: "S1 2028" or "S1 2028 – S2 2028"
  rest: string | null; // straddle only: "· planned S2 2028"
  spoken: string; // "planned for S1 2028" / "completed in S1 2028 and planned for S2 2028"
}

// A placed row's status, per part, from the same `completedParts` the
// progress numbers use, so a row never disagrees with its group's bar. A
// two-semester course straddling the cutoff says so, rather than rounding
// its completed first half to "Planned".
export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus {
  const first = view.terms[placement.term].label;
  const second = placement.span === 2 ? (view.terms[placement.lastTerm]?.label ?? null) : null;
  if (second && placement.completedParts > 0 && !placement.completed) {
    return {
      word: "Completed",
      termLabel: first,
      rest: `· planned ${second}`,
      spoken: `completed in ${first} and planned for ${second}`,
    };
  }
  // With no second term (a one-semester course, or a two-semester one in
  // the final term), the single part decides.
  const done = second ? placement.completed : placement.completedParts > 0;
  const verb = done ? "completed in" : "planned for";
  return {
    word: done ? "Completed" : "Planned",
    termLabel: second ? termSpanLabel(placement.term, 2) : first,
    rest: null,
    spoken: second ? `${verb} ${first} to ${second}` : `${verb} ${first}`,
  };
}

// The line under a two-semester card's title naming where part 2 is; a
// course left in the final term (hard-blocked) has no part 2 term.
export function partOneMarker(view: PlanView, placement: PlacementView): string | null {
  if (placement.span !== 2) return null;
  const next = view.terms[placement.lastTerm];
  return next ? `Part 1 of 2 · continues in ${next.label}` : "Part 1 of 2";
}

// The completed-semesters menu's options: nothing, then each term by label,
// with the last term as "All semesters" since completing it completes them all.
export function cutoffOptions(terms: readonly { label: string }[]): { value: number; label: string }[] {
  return [
    { value: 0, label: "Nothing yet" },
    ...terms.map((term, i) => ({ value: i + 1, label: i === terms.length - 1 ? "All semesters" : term.label })),
  ];
}

export interface CompletedReadout {
  short: string;
  full: string;
}

// The short form is the completed-semesters menu's visible label (or plain
// text on a read-only plan); the full sentence is its description, so it also
// says where planning starts and names the gold line.
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
