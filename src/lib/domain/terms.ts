import type { CatalogueCourse, OfferingStatus, Session, Term } from "./types";

function buildTerms(): Term[] {
  const terms: Term[] = [];
  let year = 2027;
  let session: Session = "S1";
  for (let index = 0; index < 8; index++) {
    terms.push({ index, year, session, label: `${session} ${year}` });
    if (session === "S1") {
      session = "S2";
    } else {
      session = "S1";
      year++;
    }
  }
  return terms;
}

export const TERMS: readonly Term[] = buildTerms();

export function termLabel(index: number): string {
  const term = TERMS[index];
  if (!term) {
    throw new RangeError(`term index out of range: ${index}`);
  }
  return term.label;
}

// The range a placement starting at `index` occupies: "S1 2028 – S2 2028"
// for a two-semester course, the single label when it has no following term.
export function termSpanLabel(index: number, span: number): string {
  const first = termLabel(index);
  const next = span === 2 ? TERMS[index + 1] : undefined;
  return next ? `${first} – ${next.label}` : first;
}

// "Other" sessions (Summer, Winter, Spring) don't have a slot on the 8-term
// S1/S2 timeline, so they're ignored here (FR13, FR14).
function sessionOf(semester: string): Session | null {
  if (semester === "First Semester") return "S1";
  if (semester === "Second Semester") return "S2";
  return null;
}

export function horizonYear(courses: Iterable<CatalogueCourse>): number {
  let max = 0;
  for (const course of courses) {
    for (const offering of course.offerings) {
      if (offering.year > max) max = offering.year;
    }
  }
  return max;
}

function sessionsInYear(course: CatalogueCourse, year: number): Set<Session> {
  const sessions = new Set<Session>();
  for (const offering of course.offerings) {
    if (offering.year !== year) continue;
    const session = sessionOf(offering.session);
    if (session) sessions.add(session);
  }
  return sessions;
}

// A course scraped or fetched with rows only in an out-of-scope session
// (Summer, Winter, Spring — overview §2.3) has a non-empty `offerings`
// array but no S1/S2 row at all, which is exactly the situation FR34 means
// by "no published offering": it never blocks on offering, same as a course
// with a genuinely empty `offerings` array. `offeredLabel` below already
// checks S1/S2 sessions the same way; this keeps the two in agreement,
// rather than the badge reading "No published offering" while the term
// grid quietly hard-blocks the course anyway.
function hasAnyS1OrS2Offering(course: CatalogueCourse): boolean {
  return course.offerings.some((offering) => sessionOf(offering.session) !== null);
}

// Hard-blocking (Phase 04) needs this to be a pure function of the course,
// the term and the catalogue horizon — it never looks at a specific plan.
export function offeringStatus(course: CatalogueCourse, term: Term, horizon: number): OfferingStatus {
  if (!hasAnyS1OrS2Offering(course)) return "unknown";

  if (term.year <= horizon) {
    return sessionsInYear(course, term.year).has(term.session) ? "offered" : "not-offered";
  }

  // Years beyond the horizon copy the sessions of the course's latest year
  // that has rows, marked "projected" (FR14).
  const latestYear = Math.max(...course.offerings.map((o) => o.year));
  return sessionsInYear(course, latestYear).has(term.session) ? "projected" : "not-offered";
}

export function offeredLabel(course: CatalogueCourse): string {
  const sessions = new Set<Session>();
  for (const offering of course.offerings) {
    const session = sessionOf(offering.session);
    if (session) sessions.add(session);
  }
  if (sessions.size === 0) return "No published offering";
  return (["S1", "S2"] as const).filter((s) => sessions.has(s)).join(", ");
}
