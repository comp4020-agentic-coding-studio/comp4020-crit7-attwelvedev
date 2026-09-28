import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import { extrasFromPandc, fromPandc, type PandcCourseJson } from "./catalogue/from-pandc";
import type { GroupDef, ProgramDef } from "./domain/types";
import { getPlan, loadCatalogue, loadCourseExtras, loadProgram, upsertFetchedCourse, type Db } from "./repo";
import { courseExtras, courses, planCourses, plans, requirementGroups } from "./schema";
import { seedReferenceData, type SeedInput } from "./seed";

function loadCourseFixtures(): PandcCourseJson[] {
  const dir = "data/2027/courses";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(`${dir}/${name}`, "utf-8")));
}

function makeDb(): Db {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

// The join tables that back GroupDef.courses and ProgramCheckDef carry no
// order column, so the round trip is only guaranteed up to reordering those
// lists (see repo.ts / seed.ts).
function normalise(program: ProgramDef): unknown {
  const sortGroup = (group: GroupDef): GroupDef => ({
    ...group,
    courses: group.courses ? [...group.courses].sort() : group.courses,
    children: group.children?.map(sortGroup),
  });
  return {
    ...program,
    groups: program.groups.map(sortGroup),
    checks: [...program.checks].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe("seedReferenceData", () => {
  let db: Db;
  let input: SeedInput;

  beforeEach(() => {
    db = makeDb();
    input = { courses: loadCourseFixtures(), program: AACOM_2027, example: EXAMPLE_PLAN };
  });

  it("seeds only undergrad courses", () => {
    seedReferenceData(db, input);
    const catalogue = loadCatalogue(db);
    expect(catalogue.courses.has("COMP2100")).toBe(true);
    expect(catalogue.courses.has("COMP8280")).toBe(false);
  });

  it("seed is idempotent", () => {
    seedReferenceData(db, input);
    const coursesBefore = db.select().from(courses).all().length;
    const groupsBefore = db.select().from(requirementGroups).all().length;

    seedReferenceData(db, input);
    const coursesAfter = db.select().from(courses).all().length;
    const groupsAfter = db.select().from(requirementGroups).all().length;

    expect(coursesAfter).toBe(coursesBefore);
    expect(groupsAfter).toBe(groupsBefore);
  });

  it("seed keeps stub courses and user plans", () => {
    seedReferenceData(db, input);
    db.insert(courses)
      .values({
        code: "ABCD1234",
        title: "Stub course",
        units: 6,
        level: 1000,
        description: "",
        url: "",
        scrapedAt: new Date().toISOString(),
        parseStatus: "ok",
      })
      .run();
    db.insert(plans)
      .values({ id: "user-1", programCode: "AACOM", cohortYear: 2027, startSession: "S1", cutoff: 0, readOnly: 0 })
      .run();

    seedReferenceData(db, input);

    const stub = db.select().from(courses).where(eq(courses.code, "ABCD1234")).get();
    expect(stub).toBeDefined();
    expect(getPlan(db, "user-1")).not.toBeNull();
  });

  it("loadProgram round-trips AACOM_2027", () => {
    seedReferenceData(db, input);
    const program = loadProgram(db);
    expect(normalise(program)).toEqual(normalise(AACOM_2027));
  });

  it("example plan is reset on reseed", () => {
    seedReferenceData(db, input);
    db.update(planCourses)
      .set({ termIndex: 7 })
      .where(and(eq(planCourses.planId, "example"), eq(planCourses.courseCode, "COMP1130")))
      .run();

    seedReferenceData(db, input);

    const plan = getPlan(db, "example");
    expect(plan?.readOnly).toBe(true);
    const sortPlacements = (list: typeof EXAMPLE_PLAN.placements) =>
      [...list].sort((a, b) => a.code.localeCompare(b.code));
    expect(sortPlacements(plan?.placements ?? [])).toEqual(sortPlacements(EXAMPLE_PLAN.placements));
  });

  it("horizonYear is 2028", () => {
    seedReferenceData(db, input);
    expect(loadCatalogue(db).horizonYear).toBe(2028);
  });

  it("seeds course extras for every catalogue course", () => {
    seedReferenceData(db, input);
    const json = input.courses.find((course) => course.code === "COMP2100")!;
    expect(loadCourseExtras(db, "COMP2100")).toEqual(extrasFromPandc(json));
  });

  it("reseeding replaces extras rather than duplicating", () => {
    seedReferenceData(db, input);
    const first = loadCourseExtras(db, "COMP2100");
    seedReferenceData(db, input);
    expect(db.select().from(courseExtras).where(eq(courseExtras.courseCode, "COMP2100")).all()).toHaveLength(1);
    expect(loadCourseExtras(db, "COMP2100")).toEqual(first);
  });

  it("returns null for an unknown or stub course", () => {
    seedReferenceData(db, input);
    expect(loadCourseExtras(db, "ZZZZ9999")).toBeNull();

    const stub = { ...fromPandc({ ...input.courses.find((course) => course.code === "COMP2100")!, code: "ABCD1234" }, null), isStub: true };
    upsertFetchedCourse(db, stub);
    expect(loadCourseExtras(db, stub.code)).toBeNull();
  });
});
