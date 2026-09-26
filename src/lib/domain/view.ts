import { createFeasibility } from "./feasibility";
import { offeredLabel, offeringStatus, TERMS } from "./terms";
import type { Catalogue, GroupDef, PlanState, ProgramDef } from "./types";

// The full PlanView (overview §4.3 — groups with progress, checks, badges,
// suggestions…) arrives across Phases 03–05. This phase ships the subset the
// first Preact island needs: the timeline and the cards it places on it.
export interface TermView {
  index: number;
  label: string;
  units: number;
  overload: boolean;
}

export interface PlacementView {
  code: string;
  term: number;
  span: number;
  completed: boolean;
}

export interface CourseCardView {
  title: string;
  units: number;
  url: string;
  description: string;
  hardBlocked: Record<number, string>;
  projectedTerms: number[];
  offeredLabel: string;
  offeringUnknown: boolean;
}

export interface PlanView {
  plan: { id: string; readOnly: boolean; cutoff: number };
  terms: TermView[];
  placements: PlacementView[];
  courses: Record<string, CourseCardView>;
  // A flat, top-level preview of the sidebar tree; Phase 05 replaces this
  // with the full GroupView[] (progress bars, nesting, choices).
  groupLabels: { id: string; label: string }[];
}

function collectGroupCourses(group: GroupDef, out: Set<string>): void {
  for (const code of group.courses ?? []) out.add(code);
  for (const child of group.children ?? []) collectGroupCourses(child, out);
}

export function buildPlanView(cat: Catalogue, program: ProgramDef, plan: PlanState): PlanView {
  const feasibility = createFeasibility(cat);
  const unitsByTerm = new Map<number, number>();
  const placements: PlacementView[] = plan.placements.map((placement) => {
    const course = cat.courses.get(placement.code);
    const span = course?.twoSemester ? 2 : 1;
    const lastTerm = placement.term + span - 1;
    unitsByTerm.set(placement.term, (unitsByTerm.get(placement.term) ?? 0) + (course?.units ?? 0));
    return { code: placement.code, term: placement.term, span, completed: lastTerm < plan.cutoff };
  });

  const terms: TermView[] = TERMS.map((term) => {
    const units = unitsByTerm.get(term.index) ?? 0;
    return { index: term.index, label: term.label, units, overload: units > 24 };
  });

  const relevantCodes = new Set<string>();
  for (const placement of plan.placements) relevantCodes.add(placement.code);
  for (const group of program.groups) collectGroupCourses(group, relevantCodes);

  const courses: Record<string, CourseCardView> = {};
  for (const code of relevantCodes) {
    const course = cat.courses.get(code);
    if (!course) continue;
    const projectedTerms = TERMS.filter((term) => offeringStatus(course, term, cat.horizonYear) === "projected").map(
      (term) => term.index,
    );
    courses[code] = {
      title: course.title,
      units: course.units,
      url: course.url,
      description: course.description,
      hardBlocked: feasibility.hardBlockedTerms(code),
      projectedTerms,
      offeredLabel: offeredLabel(course),
      offeringUnknown: course.offerings.length === 0,
    };
  }

  return {
    plan: { id: plan.id, readOnly: plan.readOnly, cutoff: plan.cutoff },
    terms,
    placements,
    courses,
    groupLabels: program.groups.map((group) => ({ id: group.id, label: group.label })),
  };
}
