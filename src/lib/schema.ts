import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

// Reference data (program, groups, checks, catalogue) is reseeded from
// committed data on every boot (see seed.ts); user data (plans, choices,
// placements) is written once by the app and never touched by the seed.

export const programs = sqliteTable("programs", {
  code: text().primaryKey(),
  name: text().notNull(),
  year: int().notNull(),
  totalUnits: int("total_units").notNull(),
});

export const requirementGroups = sqliteTable("requirement_groups", {
  id: text().primaryKey(),
  programCode: text("program_code").notNull(),
  parentId: text("parent_id"),
  label: text().notNull(),
  kind: text().notNull(),
  ruleType: text("rule_type").notNull(),
  unitsRequired: int("units_required").notNull(),
  unitsMax: int("units_max"),
  selectable: int().notNull().default(0),
  sortOrder: int("sort_order").notNull(),
  filter: text(), // JSON CourseFilter
  family: text(), // top-level groups only; null = inherit (see view.ts)
});

export const requirementCourses = sqliteTable(
  "requirement_courses",
  {
    groupId: text("group_id").notNull(),
    courseCode: text("course_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.courseCode] })],
);

export const programChecks = sqliteTable("program_checks", {
  id: text().primaryKey(),
  programCode: text("program_code").notNull(),
  label: text().notNull(),
  bound: text().notNull(),
  units: int().notNull(),
  filter: text().notNull(),
});

export const courses = sqliteTable("courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  units: int().notNull(),
  level: int().notNull(),
  description: text().notNull(),
  url: text().notNull(),
  isTdp: int("is_tdp").notNull().default(0),
  twoSemester: int("two_semester").notNull().default(0),
  isStub: int("is_stub").notNull().default(0),
  scrapedAt: text("scraped_at").notNull(),
  parseStatus: text("parse_status").notNull(),
});

export const courseOfferings = sqliteTable(
  "course_offerings",
  {
    courseCode: text("course_code").notNull(),
    year: int().notNull(),
    session: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseCode, table.year, table.session] })],
);

export const courseRequisites = sqliteTable(
  "course_requisites",
  {
    courseCode: text("course_code").notNull(),
    reqType: text("req_type").notNull(), // "prereq" | "incompatible"
    expression: text().notNull(), // JSON
    rawText: text("raw_text").notNull(),
    notes: text().notNull(), // JSON {unverifiable, otherPrograms}
  },
  (table) => [primaryKey({ columns: [table.courseCode, table.reqType] })],
);

export const plans = sqliteTable("plans", {
  id: text().primaryKey(),
  programCode: text("program_code").notNull(),
  cohortYear: int("cohort_year").notNull(),
  startSession: text("start_session").notNull(),
  cutoff: int().notNull().default(0),
  readOnly: int("read_only").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const planChoices = sqliteTable(
  "plan_choices",
  {
    planId: text("plan_id").notNull(),
    groupId: text("group_id").notNull(),
    childId: text("child_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.groupId] })],
);

export const planCourses = sqliteTable(
  "plan_courses",
  {
    planId: text("plan_id").notNull(),
    courseCode: text("course_code").notNull(),
    termIndex: int("term_index").notNull(),
    pinnedGroupId: text("pinned_group_id"),
  },
  (table) => [primaryKey({ columns: [table.planId, table.courseCode] })],
);

// A student's own answer to a "Verify on P&C" item. Kept apart from
// plan_courses so removing a placement doesn't lose it; no row = "Not sure".
export const planChecks = sqliteTable(
  "plan_checks",
  {
    planId: text("plan_id").notNull(),
    courseCode: text("course_code").notNull(),
    itemText: text("item_text").notNull(),
    answer: text().notNull(), // "met" | "not-met"
  },
  (table) => [primaryKey({ columns: [table.planId, table.courseCode, table.itemText] })],
);
