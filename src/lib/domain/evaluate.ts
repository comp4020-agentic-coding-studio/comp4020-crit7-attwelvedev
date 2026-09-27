import { createFeasibility } from "./feasibility";
import { filterLabel, matchesFilter } from "./filters";
import { termLabel, TERMS } from "./terms";
import type { Catalogue, CatalogueCourse, CheckAnswer, CourseFilter, PlanState, Placement, ReqExpr } from "./types";
import { verifyItemLabels } from "./verify-labels";

export interface Suggestion {
  code: string;
  action: "place" | "move";
  term: number;
  text: string;
}

// The parsed ReqExpr tree, annotated per node with whether it's satisfied by
// the *current placements* (§4.2). `ok` is null for "unknown": an
// unverifiable leaf the student hasn't answered, which the app can never
// evaluate either way, and any and/or whose answer turns on one
// (three-valued: an unmet sibling still makes an AND false, a met one still
// makes an OR true). An answered leaf takes the student's answer.
export type RequisiteStatus =
  | { kind: "and"; items: RequisiteStatus[]; ok: boolean | null }
  | { kind: "or"; items: RequisiteStatus[]; ok: boolean | null }
  | { kind: "course"; code: string; concurrent: boolean; ok: boolean }
  | { kind: "units"; units: number; filter: CourseFilter; text: string; ok: boolean }
  | { kind: "program"; code: string | null; name: string; satisfied: boolean; ok: boolean }
  | { kind: "unverifiable"; text: string; ok: boolean | null; answer: CheckAnswer | null };

// One "Verify on P&C" item on a placement: its raw text (the answer key),
// how it's shown, and the student's answer (null = Not sure).
export interface VerifyCheck {
  item: string;
  label: string;
  answer: CheckAnswer | null;
}

export interface PlacementEval {
  code: string;
  term: number;
  span: number;
  lastTerm: number;
  // "check": every requisite the app can evaluate is met, but one it can't
  // (a permission code, a mark, a WAM) still decides it — see `verify`.
  state: "hard" | "soft" | "check" | "available";
  reasons: string[];
  suggestions: Suggestion[];
  // Labels of the items still unanswered; empty once "available".
  verify: string[];
  checks: VerifyCheck[];
  conflictWith: string[];
  loser: boolean;
  completed: boolean;
  placedPrereqs: string[];
  // The fewest more courses that would have to be placed to meet the
  // requisite (0 unless "soft"): an OR costs its cheapest branch, an AND the
  // sum of its unmet items. A course already placed (just too late) costs
  // 0 — that's a "Move" suggestion — and so do units pools, which get their
  // own reason, and unknown leaves.
  prereqsToPlace: number;
  requisiteStatus: RequisiteStatus | null;
}

function collectCourseCodes(expr: ReqExpr | null, out: Set<string>): void {
  if (expr === null) return;
  if (expr.kind === "and" || expr.kind === "or") {
    for (const item of expr.items) collectCourseCodes(item, out);
  } else if (expr.kind === "course") {
    out.add(expr.code);
  }
}

function collectFailingCourseLeaves(node: RequisiteStatus, out: { code: string; concurrent: boolean }[]): void {
  if (node.kind === "and" || node.kind === "or") {
    if (node.ok) return; // satisfied node: its unmet branches (e.g. the other side of an OR) aren't actually required
    for (const item of node.items) collectFailingCourseLeaves(item, out);
  } else if (node.kind === "course" && !node.ok) {
    out.push({ code: node.code, concurrent: node.concurrent });
  }
}

function coursesToPlace(node: RequisiteStatus, placed: ReadonlyMap<string, unknown>): number {
  if (node.ok !== false) return 0;
  switch (node.kind) {
    case "and":
      return node.items.reduce((sum, item) => sum + coursesToPlace(item, placed), 0);
    case "or":
      return Math.min(...node.items.map((item) => coursesToPlace(item, placed)));
    case "course":
      return placed.has(node.code) ? 0 : 1;
    default:
      return 0;
  }
}

function collectMarkedNotMet(node: RequisiteStatus, out: string[]): void {
  if (node.ok !== false) return; // only answers that actually sink the requisite are reasons
  if (node.kind === "and" || node.kind === "or") {
    for (const item of node.items) collectMarkedNotMet(item, out);
  } else if (node.kind === "unverifiable" && node.answer === "not-met") {
    out.push(node.text);
  }
}

function collectFailingUnitsLeaves(node: RequisiteStatus, out: Extract<RequisiteStatus, { kind: "units" }>[]): void {
  if (node.kind === "and" || node.kind === "or") {
    for (const item of node.items) collectFailingUnitsLeaves(item, out);
  } else if (node.kind === "units" && !node.ok) {
    out.push(node);
  }
}

export function evaluatePlan(
  cat: Catalogue,
  feas: ReturnType<typeof createFeasibility>,
  plan: PlanState,
): { placements: PlacementEval[]; termUnits: number[] } {
  const placedByCode = new Map(plan.placements.map((p) => [p.code, p] as const));

  const spanOf = (code: string): number => (cat.courses.get(code)?.twoSemester ? 2 : 1);
  const lastTermOf = (placement: Placement): number => placement.term + spanOf(placement.code) - 1;

  // FR20: incompatible placed pairs are both flagged; the one in the later
  // term (tie: alphabetically later code) is the loser.
  const conflictWith = new Map<string, Set<string>>();
  const addConflict = (a: string, b: string) => {
    if (!conflictWith.has(a)) conflictWith.set(a, new Set());
    conflictWith.get(a)!.add(b);
  };
  for (const p of plan.placements) {
    const course = cat.courses.get(p.code);
    if (!course) continue;
    for (const other of course.requisites.incompatible) {
      if (placedByCode.has(other)) {
        addConflict(p.code, other);
        addConflict(other, p.code);
      }
    }
  }
  const loserSet = new Set<string>();
  for (const [code, partners] of conflictWith) {
    const self = placedByCode.get(code)!;
    for (const partnerCode of partners) {
      const partner = placedByCode.get(partnerCode)!;
      const selfLoses = self.term !== partner.term ? self.term > partner.term : code > partnerCode;
      if (selfLoses) loserSet.add(code);
    }
  }

  const termUnits = new Array<number>(TERMS.length).fill(0);
  for (const p of plan.placements) {
    const course = cat.courses.get(p.code);
    if (!course) continue;
    for (let t = p.term; t <= lastTermOf(p) && t < TERMS.length; t++) {
      termUnits[t]! += course.units;
    }
  }

  function unitsAchieved(filter: CourseFilter, t: number): number {
    let total = 0;
    for (const p of plan.placements) {
      if (loserSet.has(p.code)) continue;
      const course = cat.courses.get(p.code);
      if (!course) continue;
      if (!matchesFilter(course, filter, null)) continue;
      if (lastTermOf(p) < t) total += course.units;
    }
    return total;
  }

  function evalNode(expr: ReqExpr, t: number, answers: Readonly<Record<string, CheckAnswer>>): RequisiteStatus {
    switch (expr.kind) {
      case "course": {
        const placement = placedByCode.get(expr.code);
        let ok = false;
        if (placement) {
          const last = lastTermOf(placement);
          ok = expr.concurrent ? last <= t : last < t;
        }
        return { kind: "course", code: expr.code, concurrent: expr.concurrent, ok };
      }
      case "units": {
        const ok = unitsAchieved(expr.filter, t) >= expr.units;
        return { kind: "units", units: expr.units, filter: expr.filter, text: expr.text, ok };
      }
      case "and": {
        const items = expr.items.map((item) => evalNode(item, t, answers));
        const ok = items.some((item) => item.ok === false) ? false : items.some((item) => item.ok === null) ? null : true;
        return { kind: "and", items, ok };
      }
      case "or": {
        const items = expr.items.map((item) => evalNode(item, t, answers));
        const ok = items.some((item) => item.ok === true) ? true : items.some((item) => item.ok === null) ? null : false;
        return { kind: "or", items, ok };
      }
      case "program":
        return { kind: "program", code: expr.code, name: expr.name, satisfied: expr.satisfied, ok: expr.satisfied };
      case "unverifiable": {
        const answer = answers[expr.text] ?? null;
        const ok = answer === "met" ? true : answer === "not-met" ? false : null;
        return { kind: "unverifiable", text: expr.text, ok, answer };
      }
    }
  }

  // FR16: the earliest term at or before the dependent (same term allowed
  // for a concurrent leaf) with room under the 24-unit load cap; failing
  // that, just the earliest term the leaf isn't hard-blocked in.
  function conflictsWithPlaced(code: string): boolean {
    const course = cat.courses.get(code);
    if (course?.requisites.incompatible.some((other) => placedByCode.has(other) && other !== code)) return true;
    for (const p of plan.placements) {
      if (p.code === code) continue;
      if (cat.courses.get(p.code)?.requisites.incompatible.includes(code)) return true;
    }
    return false;
  }

  function suggestionFor(code: string, concurrent: boolean, depTerm: number): Suggestion | null {
    const course = cat.courses.get(code);
    if (!course) return null;
    if (conflictsWithPlaced(code)) return null;
    const maxT = concurrent ? depTerm : depTerm - 1;
    let target = -1;
    for (let t = 0; t <= maxT; t++) {
      if (feas.hardBlock(code, t)) continue;
      if (termUnits[t]! + course.units > 24) continue;
      target = t;
      break;
    }
    if (target === -1) {
      for (let t = 0; t < TERMS.length; t++) {
        if (!feas.hardBlock(code, t)) {
          target = t;
          break;
        }
      }
    }
    if (target === -1) return null;
    const action: "place" | "move" = placedByCode.has(code) ? "move" : "place";
    const text = action === "place" ? `Place ${code} in ${termLabel(target)}` : `Move ${code} to ${termLabel(target)}`;
    return { code, action, term: target, text };
  }

  const placements: PlacementEval[] = plan.placements.map((p) => {
    const course: CatalogueCourse | undefined = cat.courses.get(p.code);
    const span = spanOf(p.code);
    const lastTerm = lastTermOf(p);
    const completed = lastTerm < plan.cutoff;

    // FR 10: only answers to the course's current items count — one left
    // over from older wording is never shown and reads as unanswered.
    const answers = plan.checks?.[p.code] ?? {};
    const items = course?.requisites.unverifiable ?? [];
    const labels = verifyItemLabels(course?.requisites.prereq ?? null, items);
    const checks: VerifyCheck[] = items.map((item) => ({ item, label: labels.get(item)!, answer: answers[item] ?? null }));
    const verify = checks.filter((check) => check.answer === null).map((check) => check.label);

    const allPrereqCodes = new Set<string>();
    collectCourseCodes(course?.requisites.prereq ?? null, allPrereqCodes);
    const placedPrereqs = [...allPrereqCodes].filter((code) => placedByCode.has(code));

    const conflicts = [...(conflictWith.get(p.code) ?? [])];
    const loser = loserSet.has(p.code);

    const hardReason = feas.hardBlock(p.code, p.term);
    if (hardReason) {
      return {
        code: p.code,
        term: p.term,
        span,
        lastTerm,
        state: "hard",
        reasons: [hardReason],
        suggestions: [],
        verify,
        checks,
        conflictWith: conflicts,
        loser,
        completed,
        placedPrereqs,
        prereqsToPlace: 0,
        requisiteStatus: null,
      };
    }

    const prereq = course?.requisites.prereq ?? null;
    const requisiteStatus = prereq ? evalNode(prereq, p.term, answers) : null;
    const available = requisiteStatus === null || requisiteStatus.ok === true;

    if (available || requisiteStatus.ok === null) {
      return {
        code: p.code,
        term: p.term,
        span,
        lastTerm,
        state: available ? "available" : "check",
        reasons: [],
        suggestions: [],
        // Met overall: whatever's left blank (e.g. the other side of an OR)
        // isn't needed, so there's nothing to verify.
        verify: available ? [] : verify,
        checks,
        conflictWith: conflicts,
        loser,
        completed,
        placedPrereqs,
        prereqsToPlace: 0,
        requisiteStatus,
      };
    }

    const failingCourses: { code: string; concurrent: boolean }[] = [];
    collectFailingCourseLeaves(requisiteStatus!, failingCourses);
    const suggestions = failingCourses
      .map(({ code, concurrent }) => suggestionFor(code, concurrent, p.term))
      .filter((s): s is Suggestion => s !== null);

    const failingUnits: Extract<RequisiteStatus, { kind: "units" }>[] = [];
    collectFailingUnitsLeaves(requisiteStatus!, failingUnits);
    const reasons = failingUnits.map((leaf) => {
      const achieved = unitsAchieved(leaf.filter, p.term);
      const missing = leaf.units - achieved;
      return `Needs ${missing} more units of ${filterLabel(leaf.filter)} before ${termLabel(p.term)}`;
    });
    const markedNotMet: string[] = [];
    collectMarkedNotMet(requisiteStatus!, markedNotMet);
    for (const item of markedNotMet) reasons.push(`You marked "${labels.get(item) ?? item}" as not met`);

    return {
      code: p.code,
      term: p.term,
      span,
      lastTerm,
      state: "soft",
      reasons,
      suggestions,
      verify,
      checks,
      conflictWith: conflicts,
      loser,
      completed,
      placedPrereqs,
      prereqsToPlace: coursesToPlace(requisiteStatus!, placedByCode),
      requisiteStatus,
    };
  });

  return { placements, termUnits };
}
