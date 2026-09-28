# Workspace redesign — Phase 01: course data and details endpoint

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read it
  first, especially overview §2.4 (assumptions), §3 (commands, layering) and
  §4.2–4.3 (shared types, HTTP contract).
- **Depends on phases:** none.

## 1. Summary

This phase carries learning outcomes, assessment, co-taught codes and
per-class delivery mode and class number from the committed P&C JSON into
the database. It also adds `GET /api/courses/{code}`, which returns a
course's card plus those extras.

By the end, nothing in the UI has changed. `PlanView` is byte-for-byte what
it was, and the endpoint is ready for Phase 02.

## 2. Requirements (this phase)

### 2.1 Functional

- WR1: all of it.
- WR2: all of it.
- WR3: the data side. Stubs have `extras: null`.

### 2.2 Non-functional

- `PlanView` payload unchanged, so `CourseCard` gets no new fields.
- The existing 50ms view-build test (`src/lib/domain/view.test.ts:96`) still
  passes.

### 2.3 Out of scope for this phase

- Any UI. That's Phase 02.
- Workload (WR4).
- Live-fetch parsing of the extras: `fetch-pandc.ts` is unchanged, so stubs
  get `null`.

### 2.4 Assumptions

See overview §2.4.

Phase-specific: some JSON files may lack `learning_outcomes`, `assessment`
or `cotaught`, or an offering's `class_number`. So all the new
`PandcCourseJson` fields are optional and default to empty, or to `null` for
`class_number`.

## 3. Existing code context (verified 2026-09-28)

**`src/lib/catalogue/from-pandc.ts`**
- `export interface PandcCourseJson` has these fields: `code, url, title,
  units, level, prerequisites, incompatibilities, requisite_raw,
  description, scraped_at`, and `offerings: { year: string; semester:
  string; mode: string }[]`.
- `export function fromPandc(json, tdpCourses, parse = emptyParse):
  CatalogueCourse` reduces offerings to `{year, session}` and drops `mode`.
- `export function isUndergrad(code: string): boolean`.

**JSON shape** (`data/2027/courses/COMP2100.json`): it also has
- `learning_outcomes: string[]`
- `assessment: {task: string; weight: string}[]`, e.g. weight `"30"`
- `cotaught: string[]`
- per offering: `class_number: string`, `summary_url: string | null` and
  `topic: string`

**`src/lib/schema.ts`**
- Tables: `courses`; `courseOfferings`, with primary key (course_code, year,
  session); `courseRequisites`; and others.
- The file's header comment gives the migration flow: edit the schema, run
  `pnpm db:generate`, and commit both. The latest migration is
  `drizzle/0004_nosy_pretty_boy.sql`.

**`src/lib/seed.ts`**
- `function seedCourses(db: Db, jsonCourses: PandcCourseJson[], tdpCourses:
  string[] | null, parse: ParseFn): void` (line 131) upserts `courses`, then
  deletes and reinserts offerings and requisites per course.

**`src/lib/repo.ts`**
- `export type Db = BetterSQLite3Database`
- `export function loadCatalogue(db: Db): Catalogue` (cached in a WeakMap)
- `export function upsertFetchedCourse(db: Db, c: CatalogueCourse): void`
  (line 286)
- It never imports `db.ts`.

**`src/lib/domain/view.ts`**
- `export interface CourseCard` (lines 62-81).
- `export function courseCard(cat: Catalogue, program: ProgramDef, choices:
  Record<string, string>, code: string): CourseCard` (line 166).

**`src/pages/api/courses/search.ts`** is the route pattern to mirror:
- `const CODE_PATTERN = /^[A-Z]{4}\d{4}$/`
- a `json(body)` helper
- `getPlan(db, planId)?.choices ?? {}`
- `loadProgram(db)`

**`src/lib/plan-service.ts`**
- `export function getView(planId: string): PlanView | null` (line 33).
- `export type ServiceResult`.

**Tests**
- `src/lib/seed.test.ts` builds an in-memory DB with `makeDb()`, which runs
  `drizzle(new Database(":memory:"))` and then `migrate(...)`.
- It loads `data/2027/courses/*.json` with `loadCourseFixtures()`.
- `src/lib/catalogue/from-pandc.test.ts` exists for `fromPandc`.
- HTTP tests live in `spec/planner.test.ts` and use `inject("baseUrl")`.

### Interfaces from earlier phases (exact)

None.

## 4. Approach

- **Storage.** The extras go in **one new table**, `course_extras`, with
  JSON text columns. Class rows can have null class numbers and duplicate
  sessions (topics), so they don't fit `course_offerings`' primary key.
  Keeping feasibility on the untouched `course_offerings` means no domain
  code changes.
- **Loading.** The extras are read per course (`loadCourseExtras`), never
  through `loadCatalogue`, so plan views don't pay for them.
- **Stubs.** They never get a `course_extras` row, so they come back as
  `null`.
- **Re-seeding.** Every boot deletes and reinserts each seeded course's row,
  like offerings.

## 5. Task breakdown

### Task 1: Parse course extras from P&C JSON (`extrasFromPandc`)

- [x] **Description:** Add the WR1 types and a pure function that pulls them out
  of a `PandcCourseJson`.
- **Files touched:**
  - `src/lib/domain/types.ts`
  - `src/lib/catalogue/from-pandc.ts`
  - `src/lib/catalogue/from-pandc.test.ts`
- **Tests first (red):** in `from-pandc.test.ts`, add
  `describe("extrasFromPandc")` with these cases:
  - "carries learning outcomes, assessment and co-taught codes": given the
    real `data/2027/courses/COMP2100.json`, it returns
    - 6 learning outcomes, with the first being "Apply object-oriented
      programming concepts for medium-scale software projects"
    - `assessment` equal to `[{task:"Assignments",weight:"30"},{task:"Labs
      and Video Assignments",weight:"25"},{task:"Final Exam",weight:"45"}]`
    - `cotaught` equal to `["COMP6442"]`
  - "keeps every class with its mode and class number": COMP2100's
    `classes[0]` equals `{year:2027, session:"First Semester", mode:"In
    Person", classNumber:"5103"}`, and `classes.length` equals the JSON's
    `offerings.length`.
  - "defaults missing fields": a minimal JSON with no `learning_outcomes`,
    `assessment` or `cotaught`, and an offering with no `class_number`,
    gives `{learningOutcomes:[], assessment:[], cotaught:[], classes:[{…,
    classNumber:null}]}`.
  - "drops the course's own code from co-taught": if `cotaught` contains
    `json.code`, the result doesn't.
- **Implementation (green):**
  - In `types.ts`, add `AssessmentItem`, `ClassOffering` and `CourseExtras`
    exactly as in overview §4.2.
  - In `from-pandc.ts`, widen `PandcCourseJson` with:
    - `learning_outcomes?: string[]`
    - `assessment?: { task: string; weight: string }[]`
    - `cotaught?: string[]`
    - on each offering, `class_number?: string | null`
  - Add `export function extrasFromPandc(json: PandcCourseJson):
    CourseExtras`. It trims strings, and turns `year` into a number with
    `Number(o.year)`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm vitest run --project unit src/lib/catalogue/from-pandc.test.ts`
    passes.
  - `fromPandc`'s output is unchanged, and its existing tests still pass.
- **Depends on:** None.

### Task 2: Store and load course extras (`course_extras` table, seed, `loadCourseExtras`)

- **Description:** Persist the extras for every seeded course and read them
  back per course.
- **Files touched:**
  - `src/lib/schema.ts`
  - a new generated `drizzle/0005_*.sql`, plus `drizzle/meta/*`
  - `src/lib/seed.ts`
  - `src/lib/repo.ts`
  - `src/lib/seed.test.ts`
- **Tests first (red):** in `seed.test.ts`:
  - "seeds course extras for every catalogue course": after
    `seedReferenceData`, `loadCourseExtras(db, "COMP2100")` deep-equals
    `extrasFromPandc(<COMP2100 json>)`.
  - "reseeding replaces extras rather than duplicating": seeding twice
    still gives exactly one row for COMP2100, and the same value.
  - "returns null for an unknown or stub course":
    - `loadCourseExtras(db, "ZZZZ9999") === null`
    - after `upsertFetchedCourse(db, stub)`,
      `loadCourseExtras(db, stub.code) === null`
- **Implementation (green):**
  - `schema.ts`:

    ```ts
    export const courseExtras = sqliteTable("course_extras", {
      courseCode: text("course_code").primaryKey(),
      learningOutcomes: text("learning_outcomes").notNull(), // JSON string[]
      assessment: text().notNull(),                         // JSON AssessmentItem[]
      cotaught: text().notNull(),                           // JSON string[]
      classes: text().notNull(),                            // JSON ClassOffering[]
    });
    ```

    Then run `pnpm db:generate` and commit the migration it writes.
  - `seed.ts`, in `seedCourses`: after the requisite inserts, delete the
    course's `courseExtras` row, then insert
    `extrasFromPandc(json)`, with each field `JSON.stringify`'d.
  - `repo.ts`: add `export function loadCourseExtras(db: Db, code: string):
    CourseExtras | null`, which does a single-row select and parses the four
    JSON columns.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm test:unit` passes.
  - The generated migration contains only `CREATE TABLE course_extras`.
  - `loadCatalogue` is untouched.
- **Depends on:** Task 1.

### Task 3: `GET /api/courses/{code}` and `courseDetailsView`

- **Description:** Assemble a course's card plus extras. Serve it over HTTP,
  and make it callable from the plan page for server rendering.
- **Files touched:**
  - `src/lib/domain/view.ts`
  - `src/lib/domain/view.test.ts`
  - `src/lib/plan-service.ts`
  - a new `src/pages/api/courses/[code].ts`
  - `src/components/api.ts`
  - `spec/planner.test.ts`
- **Tests first (red):**
  - `view.test.ts`, "courseDetailsView":
    - it returns `{course: courseCard(...), scrapedAt: <the course's
      scrapedAt>, extras}` for a catalogue code
    - it returns `null` for a code not in the catalogue
    - it passes `extras: null` through unchanged
  - `view.test.ts`, "buildPlanView's CourseCards gain no extras fields": the
    set of keys on `buildPlanView(...).courses.COMP2100` equals the 18
    `CourseCard` keys listed in view.ts:62-81.
  - `spec/planner.test.ts`, `describe("course details endpoint")`:
    - `GET /api/courses/COMP2100` returns 200, with
      `course.code === "COMP2100"`,
      `extras.learningOutcomes.length === 6`,
      `extras.classes[0].classNumber === "5103"`,
      `extras.cotaught` containing "COMP6442", and `scrapedAt` a non-empty
      string.
    - `?plan=example` is accepted with the same shape.
    - `GET /api/courses/comp2100x` returns 400 `{error}`.
    - `GET /api/courses/ZZZZ9999` returns 404 `{error}` and doesn't contact
      P&C: it responds in under 1s, with no `fetchCourseFromPandc` import
      in the route.
- **Implementation (green):**
  - `view.ts`: add `CourseDetailsView` and `courseDetailsView(...)` exactly
    as in overview §4.2. It returns `null` when `!cat.courses.has(code)`;
    otherwise
    `{ course: courseCard(cat, program, choices, code), scrapedAt:
    cat.courses.get(code)!.scrapedAt, extras }`.
  - `plan-service.ts`: add `export function getCourseDetails(code: string,
    planId?: string | null): CourseDetailsView | null`. It uses `db`,
    `loadCatalogue`, `loadProgram`, `getPlan(db, planId)?.choices ?? {}` and
    `loadCourseExtras`.
  - `src/pages/api/courses/[code].ts`: `export const GET: APIRoute`.
    - It validates with `/^[A-Z]{4}\d{4}$/` and returns 400 otherwise.
    - It calls `getCourseDetails(code, url.searchParams.get("plan"))`.
    - It returns 404 `{error: "No course <code> in the catalogue"}` when
      that gives null, and 200 JSON otherwise.
  - `api.ts`: add `export async function fetchCourseDetails(code: string,
    planId?: string): Promise<CourseDetailsView | { error: string }>`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - The existing view timing test still passes.
  - A new test pins the `CourseCard` key set.
- **Depends on:** Task 2.

## 6. Phase Definition of Done

- [ ] Tasks 1–3 complete, with tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] `curl localhost:4321/api/courses/COMP2100` (with `pnpm dev` running)
  shows outcomes, assessment, classes and co-taught
- [ ] Tick Phase 01 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR1 | Tasks 1, 2 |
| WR2 | Task 3 |
| WR3 (data) | Tasks 2, 3 |
| NFR payload / 50ms | Task 3 |

## 8. Risks / open questions

None.
