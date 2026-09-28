import { filterLabel, matchesFilter } from "./filters";
import { offeringStatus, TERMS, termLabel } from "./terms";
import type { Catalogue, CatalogueCourse, ReqExpr, Session } from "./types";

// A hard-block reason is just text by the time it reaches the client, so the
// offering reasons are built from, and recognised by, these phrases. The
// details strip uses them to tell "not offered" and "can't start here"
// apart from "offered, but its prerequisites can't be met by then".
const NOT_OFFERED_IN = " isn't offered in ";
const TWO_SEMESTER = " runs over two consecutive semesters; ";

export type HardBlockKind = "not-offered" | "two-semester" | "requisites";

export function hardBlockKind(reason: string): HardBlockKind {
  // The offering reasons start with the (eight-character) course code.
  if (reason.startsWith(NOT_OFFERED_IN, 8)) return "not-offered";
  if (reason.startsWith(TWO_SEMESTER, 8)) return "two-semester";
  return "requisites";
}

// Hard-blocking is plan-independent (overview §4.1): it depends only on the
// course, the term and the catalogue, so it's safe to memoise per catalogue
// instance and share across every plan that uses it.
export function createFeasibility(cat: Catalogue): {
  earliestTerm(code: string): number;
  hardBlock(code: string, term: number): string | null;
  hardBlockedTerms(code: string): Record<number, string>;
} {
  const earliestCache = new Map<string, number>();
  const computing = new Set<string>();

  function offeredThatYear(course: CatalogueCourse, year: number): string {
    const sessions: Session[] = [];
    for (const session of ["S1", "S2"] as const) {
      const status = offeringStatus(course, { index: -1, year, session, label: "" }, cat.horizonYear);
      if (status === "offered" || status === "projected") sessions.push(session);
    }
    return sessions.length > 0 ? sessions.join(", ") : "none";
  }

  // A two-semester course occupies t and t+1, so it also needs a next term
  // that isn't not-offered (part (c) of FR15). A course with no published
  // offerings at all is "unknown", never "not-offered" (FR34): it never
  // blocks on offering.
  function offeringReason(code: string, course: CatalogueCourse, t: number): string | null {
    const term = TERMS[t]!;
    const status = offeringStatus(course, term, cat.horizonYear);
    if (status === "not-offered") {
      return `${code}${NOT_OFFERED_IN}${term.label} (offered that year: ${offeredThatYear(course, term.year)})`;
    }
    if (course.twoSemester) {
      const next = TERMS[t + 1];
      if (!next) {
        return `${code}${TWO_SEMESTER}there is no semester after ${term.label}`;
      }
      const nextStatus = offeringStatus(course, next, cat.horizonYear);
      if (nextStatus === "not-offered") {
        return `${code}${TWO_SEMESTER}part 2 isn't offered in ${next.label}`;
      }
    }
    return null;
  }

  function achievableUnits(filter: Parameters<typeof matchesFilter>[1], t: number): number {
    let total = 0;
    for (const course of cat.courses.values()) {
      if (!matchesFilter(course, filter, null)) continue;
      const et = earliestTerm(course.code);
      if (et === Infinity) continue;
      if (et < t) total += course.units;
    }
    return total;
  }

  function reachableBefore(expr: ReqExpr | null, t: number): boolean {
    if (expr === null) return true;
    switch (expr.kind) {
      case "course": {
        const et = earliestTerm(expr.code);
        if (et === -1) return true; // not in the catalogue: unknown, not impossible
        if (et === Infinity) return false;
        const course = cat.courses.get(expr.code);
        const finish = course?.twoSemester ? et + 1 : et;
        return expr.concurrent ? finish <= t : finish < t;
      }
      case "units": {
        if (expr.units > 24 * t) return false;
        return achievableUnits(expr.filter, t) >= expr.units;
      }
      case "and":
        return expr.items.every((item) => reachableBefore(item, t));
      case "or":
        return expr.items.some((item) => reachableBefore(item, t));
      case "program":
        return expr.satisfied;
      case "unverifiable":
        return true;
    }
  }

  function explainUnreachable(expr: ReqExpr, t: number): string {
    const label = termLabel(t);
    switch (expr.kind) {
      case "course": {
        const et = earliestTerm(expr.code);
        const earliestLabel = et === Infinity || et === -1 ? "never" : termLabel(et);
        return `Needs ${expr.code}, which can't be completed before ${label} (earliest: ${earliestLabel})`;
      }
      case "units": {
        const achievable = achievableUnits(expr.filter, t);
        return `Needs ${expr.units} units of ${filterLabel(expr.filter)} before ${label}; at most ${achievable} are achievable by then`;
      }
      case "or": {
        const codes = expr.items.filter((item): item is Extract<ReqExpr, { kind: "course" }> => item.kind === "course");
        if (codes.length === expr.items.length) {
          return `Needs one of ${codes.map((c) => c.code).join(", ")}; none can be completed before ${label}`;
        }
        return expr.items.map((item) => explainUnreachable(item, t)).join("; ");
      }
      case "and":
        return expr.items
          .filter((item) => !reachableBefore(item, t))
          .map((item) => explainUnreachable(item, t))
          .join("; ");
      case "program":
      case "unverifiable":
        return "";
    }
  }

  function earliestTerm(code: string): number {
    const cached = earliestCache.get(code);
    if (cached !== undefined) return cached;
    const course = cat.courses.get(code);
    if (!course) return -1;
    if (computing.has(code)) return Infinity; // cycle: don't cache, let the outer call resolve

    computing.add(code);
    try {
      let result = Infinity;
      for (let t = 0; t < TERMS.length; t++) {
        if (offeringReason(code, course, t)) continue;
        if (reachableBefore(course.requisites.prereq, t)) {
          result = t;
          break;
        }
      }
      earliestCache.set(code, result);
      return result;
    } finally {
      computing.delete(code);
    }
  }

  function hardBlock(code: string, t: number): string | null {
    const course = cat.courses.get(code);
    if (!course) return null;

    const offering = offeringReason(code, course, t);
    if (offering) return offering;

    if (!reachableBefore(course.requisites.prereq, t)) {
      return explainUnreachable(course.requisites.prereq!, t);
    }
    return null;
  }

  function hardBlockedTerms(code: string): Record<number, string> {
    const reasons: Record<number, string> = {};
    for (let t = 0; t < TERMS.length; t++) {
      const reason = hardBlock(code, t);
      if (reason) reasons[t] = reason;
    }
    return reasons;
  }

  return { earliestTerm, hardBlock, hardBlockedTerms };
}
