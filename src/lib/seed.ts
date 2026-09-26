import { emptyParse, fromPandc, isUndergrad, type PandcCourseJson } from "./catalogue/from-pandc";
import type { GroupDef, ParsedRequisites, PlanState, ProgramDef } from "./domain/types";
import { invalidateCatalogue, type Db } from "./repo";
import {
  courseOfferings,
  courseRequisites,
  courses,
  planChoices,
  planCourses,
  plans,
  programChecks,
  programs,
  requirementCourses,
  requirementGroups,
} from "./schema";
import { eq, inArray } from "drizzle-orm";

export interface SeedInput {
  courses: PandcCourseJson[];
  program: ProgramDef;
  example: PlanState;
}

type ParseFn = (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites;

interface FlatGroup {
  id: string;
  parentId: string | null;
  label: string;
  kind: GroupDef["kind"];
  ruleType: GroupDef["ruleType"];
  unitsRequired: number;
  unitsMax: number | null;
  selectable: number;
  sortOrder: number;
  filter: string | null;
  courses: string[];
}

function flattenGroups(defs: GroupDef[], parentId: string | null, counter: { n: number }): FlatGroup[] {
  const out: FlatGroup[] = [];
  for (const def of defs) {
    out.push({
      id: def.id,
      parentId,
      label: def.label,
      kind: def.kind,
      ruleType: def.ruleType,
      unitsRequired: def.unitsRequired,
      unitsMax: def.unitsMax ?? null,
      selectable: def.selectable ? 1 : 0,
      sortOrder: counter.n++,
      filter: def.filter ? JSON.stringify(def.filter) : null,
      courses: def.courses ?? [],
    });
    if (def.children) {
      out.push(...flattenGroups(def.children, def.id, counter));
    }
  }
  return out;
}

// One transaction so a boot that seeds reference data never leaves it
// half-written if something throws partway through.
export function seedReferenceData(db: Db, input: SeedInput, parse: ParseFn = emptyParse): void {
  db.transaction((tx) => {
    seedProgram(tx, input.program);
    seedCourses(tx, input.courses, input.program.tdpCourses, parse);
    seedExamplePlan(tx, input.example, input.program);
  });
  invalidateCatalogue(db);
}

function seedProgram(db: Db, program: ProgramDef): void {
  db.insert(programs)
    .values({ code: program.code, name: program.name, year: program.year, totalUnits: program.totalUnits })
    .onConflictDoUpdate({
      target: programs.code,
      set: { name: program.name, year: program.year, totalUnits: program.totalUnits },
    })
    .run();

  const existingGroups = db.select({ id: requirementGroups.id }).from(requirementGroups).where(eq(requirementGroups.programCode, program.code)).all();
  const existingGroupIds = existingGroups.map((row) => row.id);
  if (existingGroupIds.length > 0) {
    db.delete(requirementCourses).where(inArray(requirementCourses.groupId, existingGroupIds)).run();
  }
  db.delete(requirementGroups).where(eq(requirementGroups.programCode, program.code)).run();

  const flat = flattenGroups(program.groups, null, { n: 0 });
  for (const group of flat) {
    db.insert(requirementGroups)
      .values({
        id: group.id,
        programCode: program.code,
        parentId: group.parentId,
        label: group.label,
        kind: group.kind,
        ruleType: group.ruleType,
        unitsRequired: group.unitsRequired,
        unitsMax: group.unitsMax,
        selectable: group.selectable,
        sortOrder: group.sortOrder,
        filter: group.filter,
      })
      .run();
    for (const code of group.courses) {
      db.insert(requirementCourses).values({ groupId: group.id, courseCode: code }).run();
    }
  }

  db.delete(programChecks).where(eq(programChecks.programCode, program.code)).run();
  for (const check of program.checks) {
    db.insert(programChecks)
      .values({
        id: check.id,
        programCode: program.code,
        label: check.label,
        bound: check.bound,
        units: check.units,
        filter: JSON.stringify(check.filter),
      })
      .run();
  }
}

function seedCourses(db: Db, jsonCourses: PandcCourseJson[], tdpCourses: string[] | null, parse: ParseFn): void {
  for (const json of jsonCourses) {
    if (!isUndergrad(json.code)) continue;
    const course = fromPandc(json, tdpCourses, parse);

    db.insert(courses)
      .values({
        code: course.code,
        title: course.title,
        units: course.units,
        level: course.level,
        description: course.description,
        url: course.url,
        isTdp: course.isTdp ? 1 : 0,
        twoSemester: course.twoSemester ? 1 : 0,
        isStub: 0,
        scrapedAt: course.scrapedAt,
        parseStatus: course.requisites.parseStatus,
      })
      .onConflictDoUpdate({
        target: courses.code,
        set: {
          title: course.title,
          units: course.units,
          level: course.level,
          description: course.description,
          url: course.url,
          isTdp: course.isTdp ? 1 : 0,
          twoSemester: course.twoSemester ? 1 : 0,
          isStub: 0,
          scrapedAt: course.scrapedAt,
          parseStatus: course.requisites.parseStatus,
        },
      })
      .run();

    db.delete(courseOfferings).where(eq(courseOfferings.courseCode, course.code)).run();
    for (const offering of course.offerings) {
      db.insert(courseOfferings).values({ courseCode: course.code, year: offering.year, session: offering.session }).run();
    }

    db.delete(courseRequisites).where(eq(courseRequisites.courseCode, course.code)).run();
    db.insert(courseRequisites)
      .values({
        courseCode: course.code,
        reqType: "prereq",
        expression: JSON.stringify(course.requisites.prereq),
        rawText: json.prerequisites,
        notes: JSON.stringify({ unverifiable: course.requisites.unverifiable, otherPrograms: course.requisites.otherPrograms }),
      })
      .run();
    db.insert(courseRequisites)
      .values({
        courseCode: course.code,
        reqType: "incompatible",
        expression: JSON.stringify(course.requisites.incompatible),
        rawText: json.incompatibilities,
        notes: JSON.stringify({ unverifiable: [], otherPrograms: [] }),
      })
      .run();
  }
}

function seedExamplePlan(db: Db, example: PlanState, program: ProgramDef): void {
  db.delete(planChoices).where(eq(planChoices.planId, example.id)).run();
  db.delete(planCourses).where(eq(planCourses.planId, example.id)).run();
  db.delete(plans).where(eq(plans.id, example.id)).run();

  db.insert(plans)
    .values({
      id: example.id,
      programCode: program.code,
      cohortYear: program.year,
      startSession: "S1",
      cutoff: example.cutoff,
      readOnly: example.readOnly ? 1 : 0,
    })
    .run();

  for (const [groupId, childId] of Object.entries(example.choices)) {
    db.insert(planChoices).values({ planId: example.id, groupId, childId }).run();
  }

  for (const placement of example.placements) {
    db.insert(planCourses)
      .values({
        planId: example.id,
        courseCode: placement.code,
        termIndex: placement.term,
        pinnedGroupId: placement.pinnedGroupId,
      })
      .run();
  }
}
