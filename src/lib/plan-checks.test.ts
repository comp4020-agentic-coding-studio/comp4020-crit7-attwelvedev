import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { AACOM_2027 } from "../data/aacom-2027";
import { EXAMPLE_PLAN } from "../data/example-plan";
import type { PandcCourseJson } from "./catalogue/from-pandc";
import { parseRequisites } from "./domain/requisites";
import { createPlan, deletePlacement, getPlan, setCheck, upsertPlacement, type Db } from "./repo";
import { seedReferenceData } from "./seed";

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

describe("plan checks", () => {
  let db: Db;
  let id: string;

  beforeEach(() => {
    db = makeDb();
    seedReferenceData(db, { courses: loadCourseFixtures(), program: AACOM_2027, example: EXAMPLE_PLAN }, parseRequisites);
    id = createPlan(db);
    upsertPlacement(db, id, "MATH1116", 1);
  });

  it("setCheck stores an answer that getPlan returns", () => {
    setCheck(db, id, "MATH1116", "with a mark of 60 or above", "met");
    expect(getPlan(db, id)!.checks).toEqual({ MATH1116: { "with a mark of 60 or above": "met" } });
  });

  it("answer null deletes it", () => {
    setCheck(db, id, "MATH1116", "with a mark of 60 or above", "met");
    setCheck(db, id, "MATH1116", "with a mark of 60 or above", null);
    expect(getPlan(db, id)!.checks).toEqual({});
  });

  // An answer is about the student, not the semester: an accidental remove
  // (or a remove then undo) mustn't lose it.
  it("answers survive removing and re-placing the course", () => {
    setCheck(db, id, "MATH1116", "with a mark of 60 or above", "met");
    deletePlacement(db, id, "MATH1116");
    upsertPlacement(db, id, "MATH1116", 2);
    expect(getPlan(db, id)!.checks).toEqual({ MATH1116: { "with a mark of 60 or above": "met" } });
  });

  it("a new plan has no checks", () => {
    expect(getPlan(db, createPlan(db))!.checks).toEqual({});
  });
});
