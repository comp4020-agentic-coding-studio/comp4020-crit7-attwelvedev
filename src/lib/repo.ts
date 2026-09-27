import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { emptyParse } from "./catalogue/from-pandc";
import type {
  Catalogue,
  CatalogueCourse,
  CheckAnswer,
  CourseFilter,
  GroupDef,
  Offering,
  ParsedRequisites,
  PlanChecks,
  PlanState,
  ProgramCheckDef,
  ProgramDef,
} from "./domain/types";
import {
  courseOfferings,
  courseRequisites,
  courses,
  planChecks,
  planChoices,
  planCourses,
  plans,
  programChecks,
  programs,
  requirementCourses,
  requirementGroups,
} from "./schema";

// This module never imports src/lib/db.ts, which opens and seeds the real
// database as a side effect of being imported — a plain unit test must be
// able to exercise these functions against a throwaway in-memory db instead.
// Only src/lib/plan-service.ts and the API routes import `db` from db.ts.
export type Db = BetterSQLite3Database;

const catalogueCache = new WeakMap<Db, Catalogue>();

export function invalidateCatalogue(db: Db): void {
  catalogueCache.delete(db);
}

export function loadCatalogue(db: Db): Catalogue {
  const cached = catalogueCache.get(db);
  if (cached) return cached;

  const courseRows = db.select().from(courses).all();
  const offeringRows = db.select().from(courseOfferings).all();
  const requisiteRows = db.select().from(courseRequisites).all();

  const offeringsByCourse = new Map<string, Offering[]>();
  for (const row of offeringRows) {
    const list = offeringsByCourse.get(row.courseCode) ?? [];
    list.push({ year: row.year, session: row.session });
    offeringsByCourse.set(row.courseCode, list);
  }

  const requisitesByCourse = new Map<string, ParsedRequisites>();
  for (const row of requisiteRows) {
    const parsed = requisitesByCourse.get(row.courseCode) ?? { ...emptyParse({ prerequisites: "", incompatibilities: "" }) };
    if (row.reqType === "prereq") {
      parsed.prereq = JSON.parse(row.expression);
      const notes = JSON.parse(row.notes) as { unverifiable: string[]; otherPrograms: string[] };
      parsed.unverifiable = notes.unverifiable;
      parsed.otherPrograms = notes.otherPrograms;
    } else {
      parsed.incompatible = JSON.parse(row.expression);
    }
    requisitesByCourse.set(row.courseCode, parsed);
  }

  const map = new Map<string, CatalogueCourse>();
  for (const row of courseRows) {
    map.set(row.code, {
      code: row.code,
      title: row.title,
      units: row.units,
      level: row.level,
      description: row.description,
      url: row.url,
      offerings: offeringsByCourse.get(row.code) ?? [],
      requisites: {
        ...(requisitesByCourse.get(row.code) ?? emptyParse({ prerequisites: "", incompatibilities: "" })),
        parseStatus: row.parseStatus as "ok" | "partial",
      },
      requisiteRaw: requisiteRows.find((r) => r.courseCode === row.code && r.reqType === "prereq")?.rawText ?? "",
      twoSemester: row.twoSemester === 1,
      isTdp: row.isTdp === 1,
      isStub: row.isStub === 1,
      scrapedAt: row.scrapedAt,
    });
  }

  const horizonYear = offeringRows.reduce((max, row) => Math.max(max, row.year), 0);
  const catalogue: Catalogue = { courses: map, horizonYear };
  catalogueCache.set(db, catalogue);
  return catalogue;
}

export function loadProgram(db: Db): ProgramDef {
  const programRow = db.select().from(programs).get();
  if (!programRow) {
    throw new Error("no program has been seeded");
  }

  const groupRows = db
    .select()
    .from(requirementGroups)
    .where(eq(requirementGroups.programCode, programRow.code))
    .orderBy(requirementGroups.sortOrder)
    .all();

  const groupIds = groupRows.map((row) => row.id);
  const courseRows = groupIds.length
    ? db.select().from(requirementCourses).where(inArray(requirementCourses.groupId, groupIds)).all()
    : [];
  const coursesByGroup = new Map<string, string[]>();
  for (const row of courseRows) {
    const list = coursesByGroup.get(row.groupId) ?? [];
    list.push(row.courseCode);
    coursesByGroup.set(row.groupId, list);
  }

  const nodes = new Map<string, GroupDef>();
  for (const row of groupRows) {
    const node: GroupDef = {
      id: row.id,
      label: row.label,
      kind: row.kind as GroupDef["kind"],
      ruleType: row.ruleType as GroupDef["ruleType"],
      unitsRequired: row.unitsRequired,
    };
    if (row.unitsMax != null) node.unitsMax = row.unitsMax;
    if (row.selectable === 1) node.selectable = true;
    if (row.filter != null) node.filter = JSON.parse(row.filter) as CourseFilter;
    const groupCourses = coursesByGroup.get(row.id);
    if (groupCourses && groupCourses.length > 0) node.courses = groupCourses;
    nodes.set(row.id, node);
  }

  const roots: GroupDef[] = [];
  for (const row of groupRows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  const checkRows = db.select().from(programChecks).where(eq(programChecks.programCode, programRow.code)).all();
  const checks: ProgramCheckDef[] = checkRows.map((row) => ({
    id: row.id,
    label: row.label,
    bound: row.bound as ProgramCheckDef["bound"],
    units: row.units,
    filter: JSON.parse(row.filter) as CourseFilter,
  }));

  const tdpRows = db.select().from(courses).where(eq(courses.isTdp, 1)).all();
  const tdpCourses = tdpRows.length > 0 ? tdpRows.map((row) => row.code).sort() : null;

  return {
    code: programRow.code,
    name: programRow.name,
    year: programRow.year,
    totalUnits: programRow.totalUnits,
    groups: roots,
    checks,
    tdpCourses,
  };
}

export function getPlan(db: Db, id: string): PlanState | null {
  const planRow = db.select().from(plans).where(eq(plans.id, id)).get();
  if (!planRow) return null;

  const choiceRows = db.select().from(planChoices).where(eq(planChoices.planId, id)).all();
  const choices: Record<string, string> = {};
  for (const row of choiceRows) {
    choices[row.groupId] = row.childId;
  }

  const placementRows = db.select().from(planCourses).where(eq(planCourses.planId, id)).all();

  const checkRows = db.select().from(planChecks).where(eq(planChecks.planId, id)).all();
  const checks: PlanChecks = {};
  for (const row of checkRows) {
    (checks[row.courseCode] ??= {})[row.itemText] = row.answer as CheckAnswer;
  }

  return {
    id: planRow.id,
    readOnly: planRow.readOnly === 1,
    cutoff: planRow.cutoff,
    choices,
    placements: placementRows.map((row) => ({
      code: row.courseCode,
      term: row.termIndex,
      pinnedGroupId: row.pinnedGroupId,
    })),
    checks,
  };
}

export function createPlan(db: Db): string {
  const programRow = db.select().from(programs).get();
  if (!programRow) {
    throw new Error("no program has been seeded");
  }
  const id = randomBytes(16).toString("base64url");
  db.insert(plans)
    .values({
      id,
      programCode: programRow.code,
      cohortYear: programRow.year,
      startSession: "S1",
      cutoff: 0,
      readOnly: 0,
    })
    .run();
  return id;
}

export function upsertPlacement(db: Db, planId: string, code: string, term: number): void {
  db.insert(planCourses)
    .values({ planId, courseCode: code, termIndex: term, pinnedGroupId: null })
    .onConflictDoUpdate({
      target: [planCourses.planId, planCourses.courseCode],
      set: { termIndex: term },
    })
    .run();
}

export function deletePlacement(db: Db, planId: string, code: string): void {
  db.delete(planCourses).where(and(eq(planCourses.planId, planId), eq(planCourses.courseCode, code))).run();
}

export function setCutoff(db: Db, planId: string, cutoff: number): void {
  db.update(plans).set({ cutoff }).where(eq(plans.id, planId)).run();
}

// planChoices.childId is NOT NULL (schema): "no choice recorded" is
// represented by row absence, not a null column.
export function setChoice(db: Db, planId: string, groupId: string, childId: string | null): void {
  if (childId === null) {
    db.delete(planChoices).where(and(eq(planChoices.planId, planId), eq(planChoices.groupId, groupId))).run();
    return;
  }
  db.insert(planChoices)
    .values({ planId, groupId, childId })
    .onConflictDoUpdate({ target: [planChoices.planId, planChoices.groupId], set: { childId } })
    .run();
}

export function setPin(db: Db, planId: string, code: string, groupId: string | null): void {
  db.update(planCourses)
    .set({ pinnedGroupId: groupId })
    .where(and(eq(planCourses.planId, planId), eq(planCourses.courseCode, code)))
    .run();
}

// Like planChoices, "Not sure" is row absence: a null answer deletes the row.
export function setCheck(db: Db, planId: string, code: string, item: string, answer: CheckAnswer | null): void {
  const key = and(eq(planChecks.planId, planId), eq(planChecks.courseCode, code), eq(planChecks.itemText, item));
  if (answer === null) {
    db.delete(planChecks).where(key).run();
    return;
  }
  db.insert(planChecks)
    .values({ planId, courseCode: code, itemText: item, answer })
    .onConflictDoUpdate({ target: [planChecks.planId, planChecks.courseCode, planChecks.itemText], set: { answer } })
    .run();
}

// Caches a course fetched live from P&C (Task 16), the same upsert shape
// `seedCourses` uses, but with `is_stub` forced to 1 — the boot-time reseed
// never runs against it again, so it's the only source of truth for it.
export function upsertFetchedCourse(db: Db, c: CatalogueCourse): void {
  db.insert(courses)
    .values({
      code: c.code,
      title: c.title,
      units: c.units,
      level: c.level,
      description: c.description,
      url: c.url,
      isTdp: c.isTdp ? 1 : 0,
      twoSemester: c.twoSemester ? 1 : 0,
      isStub: 1,
      scrapedAt: c.scrapedAt,
      parseStatus: c.requisites.parseStatus,
    })
    .onConflictDoUpdate({
      target: courses.code,
      set: {
        title: c.title,
        units: c.units,
        level: c.level,
        description: c.description,
        url: c.url,
        isTdp: c.isTdp ? 1 : 0,
        twoSemester: c.twoSemester ? 1 : 0,
        isStub: 1,
        scrapedAt: c.scrapedAt,
        parseStatus: c.requisites.parseStatus,
      },
    })
    .run();

  db.delete(courseOfferings).where(eq(courseOfferings.courseCode, c.code)).run();
  for (const offering of c.offerings) {
    db.insert(courseOfferings).values({ courseCode: c.code, year: offering.year, session: offering.session }).run();
  }

  db.delete(courseRequisites).where(eq(courseRequisites.courseCode, c.code)).run();
  db.insert(courseRequisites)
    .values({
      courseCode: c.code,
      reqType: "prereq",
      expression: JSON.stringify(c.requisites.prereq),
      rawText: c.requisiteRaw,
      notes: JSON.stringify({ unverifiable: c.requisites.unverifiable, otherPrograms: c.requisites.otherPrograms }),
    })
    .run();
  db.insert(courseRequisites)
    .values({
      courseCode: c.code,
      reqType: "incompatible",
      expression: JSON.stringify(c.requisites.incompatible),
      rawText: c.requisiteRaw,
      notes: JSON.stringify({ unverifiable: [], otherPrograms: [] }),
    })
    .run();
}

// DB matches only (FR10): code prefix or title substring. The catalogue Map
// is already cached by loadCatalogue, so this filters in memory rather than
// adding a second, SQL-level search path to keep in sync.
export function searchCourses(db: Db, q: string, limit = 20): CatalogueCourse[] {
  const query = q.trim();
  if (!query) return [];
  const upperQuery = query.toUpperCase();
  const lowerQuery = query.toLowerCase();

  const matches: CatalogueCourse[] = [];
  for (const course of loadCatalogue(db).courses.values()) {
    if (course.code.startsWith(upperQuery) || course.title.toLowerCase().includes(lowerQuery)) {
      matches.push(course);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
