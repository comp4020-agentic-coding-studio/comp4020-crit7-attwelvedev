import { activeEligibleLeaves, activeGroups, allocate, type AllocItem } from "./allocation";
import { createFeasibility } from "./feasibility";
import { evaluatePlan, type PlacementEval } from "./evaluate";
import { filterLabel, matchesFilter } from "./filters";
import { offeredLabel, offeringStatus, TERMS } from "./terms";
import type {
  Catalogue,
  CatalogueCourse,
  Family,
  GroupDef,
  GroupKind,
  PlanState,
  ProgramCheckDef,
  ProgramDef,
  ReqExpr,
  RuleType,
} from "./types";

// A normal full-time semester's load, not a hard cap — a term can go over
// it (see TermView.overload), this is just the reference point both the
// overload flag and the UI's own "X/24 units" display are stated against.
export const NORMAL_TERM_UNITS = 24;

export interface TermView {
  index: number;
  label: string;
  units: number;
  overload: boolean;
}

export interface GroupView {
  id: string;
  label: string;
  kind: GroupKind;
  ruleType: RuleType;
  unitsRequired: number;
  unitsMax: number | null;
  selectable: boolean;
  chosenId: string | null;
  options: { id: string; label: string }[];
  completed: number;
  planned: number;
  satisfied: boolean;
  courses: string[];
  filterLabel: string | null;
  missing: string[];
  children: GroupView[];
  // The top-level group's colour family, inherited by every nested group.
  family: Family;
}

export interface CheckView {
  id: string;
  label: string;
  bound: "min" | "max";
  units: number;
  completed: number;
  planned: number;
  ok: boolean | null; // null = not tracked
}

export interface CourseCard {
  code: string;
  title: string;
  units: number;
  level: number;
  description: string;
  url: string;
  twoSemester: boolean;
  isStub: boolean;
  offeredLabel: string;
  offeringUnknown: boolean;
  verify: string[];
  otherPrograms: string[];
  incompatible: string[];
  requisiteRaw: string;
  prereq: ReqExpr | null;
  hardBlocked: Record<number, string>;
  projectedTerms: number[];
  eligibleGroups: string[];
}

export interface PlacementView extends PlacementEval {
  countsToward: string | null;
  pinned: boolean;
}

export interface PlanView {
  plan: { id: string; readOnly: boolean; cutoff: number };
  terms: TermView[];
  placements: PlacementView[];
  groups: GroupView[];
  checks: CheckView[];
  total: { required: number; completed: number; planned: number };
  courses: Record<string, CourseCard>;
}

// A two-semester course's `units` is its per-semester amount (COMP4550 is
// scraped as units:12, "12+12"), but it contributes double that toward
// every requirement, matching evaluate.ts's per-term termUnits sum.
function totalUnitsOf(course: CatalogueCourse): number {
  return course.twoSemester ? course.units * 2 : course.units;
}

// Each part of a two-semester course is completed or planned by its own
// term, so a course straddling the cutoff counts one semester's units on
// each side rather than all of them as planned.
function unitsSplit(course: CatalogueCourse, placement: PlacementEval): { completed: number; planned: number } {
  const completed = course.units * placement.completedParts;
  return { completed, planned: totalUnitsOf(course) - completed };
}

function tdpSetOf(program: ProgramDef): Set<string> | null {
  return program.tdpCourses ? new Set(program.tdpCourses) : null;
}

function collectGroupCourses(group: GroupDef, out: Set<string>): void {
  for (const code of group.courses ?? []) out.add(code);
  for (const child of group.children ?? []) collectGroupCourses(child, out);
}

function collectCourseLeaves(expr: ReqExpr | null, out: Set<string>): void {
  if (expr === null) return;
  if (expr.kind === "and" || expr.kind === "or") {
    for (const item of expr.items) collectCourseLeaves(item, out);
  } else if (expr.kind === "course") {
    out.add(expr.code);
  }
}

function buildCard(
  cat: Catalogue,
  program: ProgramDef,
  choices: Record<string, string>,
  code: string,
  feas: ReturnType<typeof createFeasibility>,
  tdp: Set<string> | null,
): CourseCard {
  const course = cat.courses.get(code)!;
  const projectedTerms = TERMS.filter((term) => offeringStatus(course, term, cat.horizonYear) === "projected").map(
    (term) => term.index,
  );
  return {
    code: course.code,
    title: course.title,
    units: course.units,
    level: course.level,
    description: course.description,
    url: course.url,
    twoSemester: course.twoSemester,
    isStub: course.isStub,
    offeredLabel: offeredLabel(course),
    offeringUnknown: course.offerings.length === 0,
    verify: course.requisites.unverifiable,
    otherPrograms: course.requisites.otherPrograms,
    incompatible: course.requisites.incompatible,
    requisiteRaw: course.requisiteRaw,
    prereq: course.requisites.prereq,
    hardBlocked: feas.hardBlockedTerms(code),
    projectedTerms,
    eligibleGroups: activeEligibleLeaves(program, choices, course, tdp),
  };
}

// Used by search (Task 16): `choices` is the plan's own, or {} with no plan.
export function courseCard(
  cat: Catalogue,
  program: ProgramDef,
  choices: Record<string, string>,
  code: string,
): CourseCard {
  return buildCard(cat, program, choices, code, createFeasibility(cat), tdpSetOf(program));
}

function buildCheckView(
  check: ProgramCheckDef,
  placements: PlacementEval[],
  cat: Catalogue,
  tdp: Set<string> | null,
): CheckView {
  let completed = 0;
  let planned = 0;
  for (const placement of placements) {
    const course = cat.courses.get(placement.code);
    if (!course) continue;
    if (!matchesFilter(course, check.filter, tdp)) continue;
    const split = unitsSplit(course, placement);
    completed += split.completed;
    planned += split.planned;
  }

  let ok: boolean | null;
  if (check.filter.tdp && tdp === null) {
    ok = null; // FR36: no TDP source found, the check is untracked
  } else if (check.bound === "max") {
    ok = completed + planned <= check.units;
  } else {
    ok = completed + planned >= check.units;
  }

  return { id: check.id, label: check.label, bound: check.bound, units: check.units, completed, planned, ok };
}

export function buildPlanView(cat: Catalogue, program: ProgramDef, plan: PlanState): PlanView {
  const feas = createFeasibility(cat);
  const tdp = tdpSetOf(program);
  const { placements: placementEvals } = evaluatePlan(cat, feas, plan);
  const pinnedByCode = new Map(plan.placements.map((p) => [p.code, p.pinnedGroupId] as const));
  // A pin can outlive its group: pinned under one capstone option, then the
  // choice changed. setChoice clears those, but a plan saved before it did
  // must still render — so a pin that's no longer eligible counts as
  // Automatic here rather than reaching allocate(), which throws on it.
  const eligibleByCode = new Map<string, string[]>();
  for (const placement of plan.placements) {
    const course = cat.courses.get(placement.code);
    if (course) eligibleByCode.set(placement.code, activeEligibleLeaves(program, plan.choices, course, tdp));
  }
  const livePin = (code: string): string | null => {
    const pin = pinnedByCode.get(code) ?? null;
    return pin !== null && eligibleByCode.get(code)?.includes(pin) ? pin : null;
  };

  // FR20: a loser (the later-placed side of an incompatible pair) counts
  // toward no requirement group, unit-count leaf or program check.
  const nonLoserEvals = placementEvals.filter((p) => !p.loser);

  const groups = activeGroups(program, plan.choices);
  const items: AllocItem[] = [];
  for (const placement of nonLoserEvals) {
    const course = cat.courses.get(placement.code);
    if (!course) continue;
    items.push({
      code: placement.code,
      units: totalUnitsOf(course),
      eligible: eligibleByCode.get(placement.code) ?? [],
      pinned: livePin(placement.code),
    });
  }
  const allocation = items.length > 0 ? allocate(groups, items) : { byCourse: {}, unitsByGroup: {} };

  // Terms: units accrue once per term a course occupies (matching
  // evaluatePlan's termUnits — a two-semester course counts once in each
  // of its two terms, not doubled up in a single term).
  const unitsByTerm = new Map<number, number>();
  for (const placement of plan.placements) {
    const course = cat.courses.get(placement.code);
    if (!course) continue;
    const span = course.twoSemester ? 2 : 1;
    for (let t = placement.term; t < placement.term + span && t < TERMS.length; t++) {
      unitsByTerm.set(t, (unitsByTerm.get(t) ?? 0) + course.units);
    }
  }
  const terms: TermView[] = TERMS.map((term) => {
    const units = unitsByTerm.get(term.index) ?? 0;
    return { index: term.index, label: term.label, units, overload: units > NORMAL_TERM_UNITS };
  });

  const placements: PlacementView[] = placementEvals.map((p) => ({
    ...p,
    countsToward: allocation.byCourse[p.code] ?? null,
    pinned: livePin(p.code) !== null,
  }));

  // Every course in the tree, placed, or referenced (transitively) as a
  // prerequisite of one of those, so the overlay (Phase 06) and the detail
  // panel can always look up a course it needs to show.
  const relevantCodes = new Set<string>();
  for (const group of program.groups) collectGroupCourses(group, relevantCodes);
  for (const placement of plan.placements) relevantCodes.add(placement.code);
  let frontier = [...relevantCodes];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const code of frontier) {
      const course = cat.courses.get(code);
      if (!course) continue;
      const leaves = new Set<string>();
      collectCourseLeaves(course.requisites.prereq, leaves);
      for (const leaf of leaves) {
        if (cat.courses.has(leaf) && !relevantCodes.has(leaf)) {
          relevantCodes.add(leaf);
          next.push(leaf);
        }
      }
    }
    frontier = next;
  }

  const courses: Record<string, CourseCard> = {};
  for (const code of relevantCodes) {
    if (!cat.courses.has(code)) continue;
    courses[code] = buildCard(cat, program, plan.choices, code, feas, tdp);
  }

  const leafTotals = new Map<string, { completed: number; planned: number }>();
  // Which course codes actually landed in each leaf group, so rule-based
  // groups (electives, "3000/4000-level COMP" — no predefined `courses`
  // list) can display the placed courses the allocator counted toward
  // them, the same way predefined-list groups display theirs.
  const leafCourses = new Map<string, Set<string>>();
  for (const placement of nonLoserEvals) {
    const leaf = allocation.byCourse[placement.code];
    if (!leaf) continue;
    const course = cat.courses.get(placement.code);
    if (!course) continue;
    const split = unitsSplit(course, placement);
    const bucket = leafTotals.get(leaf) ?? { completed: 0, planned: 0 };
    bucket.completed += split.completed;
    bucket.planned += split.planned;
    leafTotals.set(leaf, bucket);
    const codes = leafCourses.get(leaf) ?? new Set<string>();
    codes.add(placement.code);
    leafCourses.set(leaf, codes);
  }

  function buildGroupView(group: GroupDef, family: Family): GroupView {
    const children = group.children ?? [];
    let activeChildren: GroupDef[] = [];
    let chosenId: string | null = null;
    if (group.selectable) {
      const chosen = plan.choices[group.id];
      chosenId = chosen ?? null;
      if (chosen !== undefined) {
        const child = children.find((c) => c.id === chosen);
        if (child) activeChildren = [child];
      }
    } else {
      activeChildren = children;
    }

    const childViews = activeChildren.map((c) => buildGroupView(c, family));
    const isLeaf = children.length === 0;

    let completed = 0;
    let planned = 0;
    if (isLeaf) {
      const bucket = leafTotals.get(group.id) ?? { completed: 0, planned: 0 };
      completed = bucket.completed;
      planned = bucket.planned;
    } else {
      for (const child of childViews) {
        completed += child.completed;
        planned += child.planned;
      }
    }

    const missing = (group.courses ?? []).filter((code) => allocation.byCourse[code] !== group.id);

    const predefined = group.courses ?? [];
    const placedExtras = isLeaf
      ? [...(leafCourses.get(group.id) ?? [])].filter((code) => !predefined.includes(code)).sort()
      : [];

    return {
      id: group.id,
      label: group.label,
      kind: group.kind,
      ruleType: group.ruleType,
      unitsRequired: group.unitsRequired,
      unitsMax: group.unitsMax ?? null,
      selectable: !!group.selectable,
      chosenId,
      options: group.selectable ? children.map((c) => ({ id: c.id, label: c.label })) : [],
      completed,
      planned,
      satisfied: completed + planned >= group.unitsRequired,
      courses: [...predefined, ...placedExtras],
      filterLabel: group.filter ? filterLabel(group.filter) : null,
      missing,
      children: childViews,
      family,
    };
  }
  const groupViews = program.groups.map((g) => buildGroupView(g, g.family ?? "neutral"));

  const checks = program.checks.map((check) => buildCheckView(check, nonLoserEvals, cat, tdp));

  let totalCompleted = 0;
  let totalPlanned = 0;
  for (const placement of nonLoserEvals) {
    const course = cat.courses.get(placement.code);
    if (!course) continue;
    const split = unitsSplit(course, placement);
    totalCompleted += split.completed;
    totalPlanned += split.planned;
  }

  return {
    plan: { id: plan.id, readOnly: plan.readOnly, cutoff: plan.cutoff },
    terms,
    placements,
    groups: groupViews,
    checks,
    total: { required: program.totalUnits, completed: totalCompleted, planned: totalPlanned },
    courses,
  };
}
