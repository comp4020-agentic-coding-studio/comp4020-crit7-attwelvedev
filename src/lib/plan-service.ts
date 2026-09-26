import { db } from "./db";
import { buildPlanView, type PlanView } from "./domain/view";
import { TERMS } from "./domain/terms";
import { deletePlacement, getPlan, loadCatalogue, loadProgram, upsertPlacement } from "./repo";

export type ServiceResult = { status: 200; view: PlanView } | { status: 400 | 403 | 404 | 409; error: string };

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
