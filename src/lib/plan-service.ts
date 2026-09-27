import { db } from "./db";
import { activeEligibleLeaves } from "./domain/allocation";
import { createFeasibility } from "./domain/feasibility";
import { buildPlanView, type PlanView } from "./domain/view";
import { TERMS } from "./domain/terms";
import type { Catalogue, CheckAnswer, GroupDef } from "./domain/types";
import {
  deletePlacement,
  getPlan,
  loadCatalogue,
  loadProgram,
  setCheck as repoSetCheck,
  setChoice as repoSetChoice,
  setCutoff as repoSetCutoff,
  setPin as repoSetPin,
  upsertPlacement,
} from "./repo";

export type ServiceResult = { status: 200; view: PlanView } | { status: 400 | 403 | 404 | 409; error: string };

// Hard-blocking is a pure function of the catalogue (overview §4.1), so the
// feasibility instance can be cached per catalogue object and rebuilt only
// when loadCatalogue's own cache is invalidated (a new Catalogue instance).
const feasibilityCache = new WeakMap<Catalogue, ReturnType<typeof createFeasibility>>();
function getFeasibility(catalogue: Catalogue) {
  const cached = feasibilityCache.get(catalogue);
  if (cached) return cached;
  const feasibility = createFeasibility(catalogue);
  feasibilityCache.set(catalogue, feasibility);
  return feasibility;
}

export function getView(planId: string): PlanView | null {
  const plan = getPlan(db, planId);
  if (!plan) return null;
  return buildPlanView(loadCatalogue(db), loadProgram(db), plan);
}

export function placeCourse(planId: string, code: string, term: number): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };
  if (!Number.isInteger(term) || term < 0 || term >= TERMS.length) {
    return { status: 400, error: `term must be 0..${TERMS.length - 1}` };
  }

  const catalogue = loadCatalogue(db);
  if (!catalogue.courses.has(code)) {
    return { status: 400, error: `unknown course ${code}` };
  }

  const hardBlockReason = getFeasibility(catalogue).hardBlock(code, term);
  if (hardBlockReason) {
    return { status: 409, error: hardBlockReason };
  }

  upsertPlacement(db, planId, code, term);
  return { status: 200, view: buildPlanView(catalogue, loadProgram(db), getPlan(db, planId)!) };
}

export function removeCourse(planId: string, code: string): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };

  deletePlacement(db, planId, code);
  return { status: 200, view: buildPlanView(loadCatalogue(db), loadProgram(db), getPlan(db, planId)!) };
}

function findGroup(groups: GroupDef[], groupId: string): GroupDef | null {
  for (const group of groups) {
    if (group.id === groupId) return group;
    const found = findGroup(group.children ?? [], groupId);
    if (found) return found;
  }
  return null;
}

export function setCutoff(planId: string, cutoff: number): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > TERMS.length) {
    return { status: 400, error: `cutoff must be 0..${TERMS.length}` };
  }

  repoSetCutoff(db, planId, cutoff);
  return { status: 200, view: buildPlanView(loadCatalogue(db), loadProgram(db), getPlan(db, planId)!) };
}

export function setChoice(planId: string, groupId: string, childId: string | null): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };

  const program = loadProgram(db);
  const group = findGroup(program.groups, groupId);
  if (!group || !group.selectable) {
    return { status: 400, error: `${groupId} is not a selectable group` };
  }
  if (childId !== null && !(group.children ?? []).some((c) => c.id === childId)) {
    return { status: 400, error: `${childId} is not an option of ${groupId}` };
  }

  // A pin into the option being left would stop being eligible — clear it
  // with the choice, so switching back later doesn't silently revive it.
  const catalogue = loadCatalogue(db);
  const tdp = program.tdpCourses ? new Set(program.tdpCourses) : null;
  const choices = { ...plan.choices };
  if (childId === null) delete choices[groupId];
  else choices[groupId] = childId;
  db.transaction((tx) => {
    repoSetChoice(tx, planId, groupId, childId);
    for (const placement of plan.placements) {
      const course = catalogue.courses.get(placement.code);
      if (placement.pinnedGroupId === null || !course) continue;
      if (!activeEligibleLeaves(program, choices, course, tdp).includes(placement.pinnedGroupId)) {
        repoSetPin(tx, planId, placement.code, null);
      }
    }
  });
  return { status: 200, view: buildPlanView(catalogue, program, getPlan(db, planId)!) };
}

export function setPin(planId: string, code: string, groupId: string | null): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };

  const placement = plan.placements.find((p) => p.code === code);
  if (!placement) return { status: 400, error: `${code} is not placed in this plan` };

  if (groupId !== null) {
    const catalogue = loadCatalogue(db);
    const course = catalogue.courses.get(code);
    if (!course) return { status: 400, error: `unknown course ${code}` };
    const program = loadProgram(db);
    const tdp = program.tdpCourses ? new Set(program.tdpCourses) : null;
    const eligible = activeEligibleLeaves(program, plan.choices, course, tdp);
    if (!eligible.includes(groupId)) {
      return { status: 409, error: `${code} cannot be pinned to ${groupId}: not an eligible group` };
    }
  }

  repoSetPin(db, planId, code, groupId);
  return { status: 200, view: buildPlanView(loadCatalogue(db), loadProgram(db), getPlan(db, planId)!) };
}

export function setCheck(planId: string, code: string, item: string, answer: CheckAnswer | null): ServiceResult {
  const plan = getPlan(db, planId);
  if (!plan) return { status: 404, error: "plan not found" };
  if (plan.readOnly) return { status: 403, error: "this plan is read-only" };

  if (!plan.placements.some((p) => p.code === code)) {
    return { status: 400, error: `${code} is not placed in this plan` };
  }
  if (!loadCatalogue(db).courses.get(code)?.requisites.unverifiable.includes(item)) {
    return { status: 400, error: `"${item}" is not a verify item of ${code}` };
  }

  repoSetCheck(db, planId, code, item, answer);
  return { status: 200, view: buildPlanView(loadCatalogue(db), loadProgram(db), getPlan(db, planId)!) };
}
