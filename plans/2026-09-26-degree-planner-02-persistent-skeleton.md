# Degree Planner — Phase 02: Persistent skeleton & deploy checkpoint

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first,
  especially §3 conventions, §4.2 types, §4.3 `PlanView` and §4.4 API contract.
- **Depends on phases:** 01.

## 1. Summary

Replace the starter guestbook with the planner's schema, keeping the heartbeat
SSE endpoint CI expects. On boot, seed the committed catalogue, the AACOM tree
and the read-only example plan. Ship an end-to-end persistent flow: create a
plan, place/move/remove courses, reload, and see them. This is rendered by the
first Preact `Planner` island. The phase ends with the first deploy, after which
the crit's mechanical spec lines are met: it loads at fly.dev, it's wired end to
end, and it persists across reload.

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR1, FR2, FR3 (placements), FR4, FR5 (layout), FR6, FR9,
FR18, FR33, and FR35 (seeding). Feasibility refusals (409) arrive in Phase 04.
The full text is in overview §2.1.

### 2.2 Non-functional

- `fly.toml` and the `Dockerfile` are unchanged. Data is bundled via
  `import.meta.glob`.
- The invariants, including axe, pass on `/`, `/readme/` and `/plan/example`.
- CI deploy probes pass with `checks.yml` unedited:
  - `/` returns 200
  - `/api/events` streams
  - a same-origin form POST to `/` is not 403
  - a cross-site POST to `/` is 403 (so `/` must stay server-rendered)
  - internal links resolve

### 2.3 Out of scope for this phase

The requisite parser (`emptyParse` is used until Task 8), feasibility,
allocation, progress, the interactive UI, and search.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-26)

- **`src/lib/db.ts`**: side effects on import. It opens
  `process.env.DATABASE_PATH ?? "./.data/app.db"` (creating the dir), sets
  `client.pragma("journal_mode = WAL")`, then `export const db = drizzle(client);`
  and `migrate(db, { migrationsFolder: "./drizzle" })`. It also exports
  `listMessages(): Message[]`, `addMessage(body: string): Message` and
  `export type { Message }`.
- **`src/lib/schema.ts`**:
  `export const messages = sqliteTable("messages", { id: int().primaryKey({ autoIncrement: true }), body: text().notNull(), createdAt: text("created_at").notNull().default(sql\`(datetime('now'))\`) });`
  and `export type Message = typeof messages.$inferSelect;`. Its header comment
  gives the workflow: edit, `pnpm db:generate`, commit both. The existing
  migration is `drizzle/0000_dry_captain_flint.sql` (creates `messages`).
  `drizzle.config.ts` has dialect sqlite, schema `./src/lib/schema.ts` and out
  `./drizzle`.
- **`src/lib/events.ts`**: `export const bus = new EventEmitter(); bus.setMaxListeners(0);`.
- **`src/pages/api/events.ts`**: `export const GET: APIRoute = () => {…}`. It
  enqueues `": connected\n\n"`, pings `": ping\n\n"` every 30 s, and does
  `bus.on("message", …)`. `cancel()` clears the interval and unsubscribes. It
  returns
  `new Response(stream.pipeThrough(new TextEncoderStream()), { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } })`.
- **`src/pages/api/messages.ts`**:
  `export const POST: APIRoute = async ({ request, redirect }) => { …; return redirect("/", 303); }`.
- **`src/pages/index.astro`**: the guestbook page. It imports `listMessages` and
  `"../styles.css"`, has `<html lang="en-AU">`, a `<title>COMP4020 prototype</title>`,
  `<nav aria-label="site">` (Guestbook, About), `<main><h1>Guestbook</h1>…<form method="post" action="/api/messages">…`,
  and an EventSource script.
- **`src/pages/readme.astro`**: `import * as readme from "../../README.md"`. Its
  title comes from the first h1, and `public/` paths are rewritten to `/`. It has
  the same nav.
- **`spec/routes.ts`**: `export const ROUTES = ["/", "/readme/"];`, the list
  `invariants.test.ts` visits (200, lang, title, viewport meta, nav, exactly one
  h1, img alt, axe in jsdom with color-contrast and link-in-text-block disabled).
- **`spec/guestbook.test.ts`**: the starter's own plumbing test ("delete it when
  you replace the starter"). It shows the HTTP test pattern:
  `const post = (path, body) => fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });`.
- **`astro.config.ts`**:
  `export default defineConfig({ output: "server", adapter: node({ mode: "standalone" }), security: { allowedDomains: [{ hostname: "**.fly.dev", protocol: "https" }] } });`
- **`Dockerfile`**: the runtime stage copies only `/app/node_modules`,
  `/app/dist` and `/app/drizzle`. Hence data must be bundled into `dist` via
  imports.
- **Deploy**: while the repo is private, run
  `flyctl deploy --remote-only --ha=false -a comp4020-crit7-attwelvedev`, with
  `FLY_API_TOKEN` in `mise.local.toml`. The live URL is
  `https://comp4020-crit7-attwelvedev.fly.dev`.
- **drizzle-kit** asks an interactive "created or renamed?" question when a
  generate both drops and creates tables. Hence Task 5 generates in two steps.

### Interfaces from Phase 01 (exact)

- `src/lib/domain/types.ts`: every type in overview §4.2.
- `src/lib/domain/terms.ts`: `export const TERMS: readonly Term[]` and
  `export function termLabel(index: number): string`.
- `src/lib/catalogue/from-pandc.ts`:
  - `export interface PandcCourseJson { code: string; url: string; title: string; units: string; level: string; prerequisites: string; incompatibilities: string; requisite_raw: string; description: string; scraped_at: string; offerings: { year: string; semester: string; mode: string }[] }`
  - `export function isUndergrad(code: string): boolean`
  - `export const emptyParse: (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites`
  - `export function fromPandc(json: PandcCourseJson, tdpCourses: string[] | null, parse?: (p: { prerequisites: string; incompatibilities: string }) => ParsedRequisites): CatalogueCourse`
- `src/data/aacom-2027.ts`: `export const AACOM_2027: ProgramDef`. The group ids
  are listed in Phase 01 §4 (e.g. `spec`, `arin`, `capstone`, `cap-research`).
- `data/2027/courses/*.json` and `data/2027/tdp.json`
  (`{ source: string | null, courses: string[] | null, note: string }`).

## 4. Approach

The server is the source of truth. Mutation endpoints call
`src/lib/plan-service.ts`, which uses `repo.ts` with the real `db` and returns a
`PlanView` built by `buildPlanView` in `src/lib/domain/view.ts`. In this phase
that is a subset of overview §4.3; later phases fill in the rest. `/plan/[id]`
server-renders `<Planner client:load view={view} />`, so the same Preact
component renders on the server and hydrates in the browser.

## 5. Task breakdown

### Task 5: Replace the guestbook schema with the planner schema; heartbeat-only SSE

- **Description:** Remove the starter demo, keep the CI stream check green, and
  add the tables.
- **Files touched:**
  - `src/lib/schema.ts`, `src/lib/db.ts` (remove message helpers)
  - `drizzle/0001_*.sql`, `drizzle/0002_*.sql` and `drizzle/meta/*` (generated)
  - delete `src/lib/events.ts`, `src/pages/api/messages.ts` and
    `spec/guestbook.test.ts`
  - `src/pages/api/events.ts`
  - `src/pages/index.astro`: temporary content, no guestbook; replaced in Task 7
  - `spec/events.test.ts` (new)
- **Tests first (red):** `spec/events.test.ts`:
  - `GET /api/events streams an opening comment`: content-type contains
    `text/event-stream`, and the first chunk contains `: connected`.
  - `/api/messages is gone`: a POST returns 404.
- **Implementation (green):**
  - `schema.ts` tables, each with an explanatory comment:
    - `programs(code text pk, name, year int, total_units int)`
    - `requirement_groups(id text pk, program_code, parent_id nullable, label, kind, rule_type, units_required int, units_max int nullable, selectable int default 0, sort_order int, filter text nullable /* JSON CourseFilter */)`
    - `requirement_courses(group_id, course_code, pk(group_id, course_code))`
    - `program_checks(id text pk, program_code, label, bound, units int, filter text)`
    - `courses(code text pk, title, units int, level int, description, url, is_tdp int, two_semester int, is_stub int, scraped_at, parse_status)`
    - `course_offerings(course_code, year int, session, pk(course_code, year, session))`
    - `course_requisites(course_code, req_type /* "prereq" | "incompatible" */, expression text /* JSON */, raw_text, notes text /* JSON {unverifiable, otherPrograms} */, pk(course_code, req_type))`
    - `plans(id text pk, program_code, cohort_year int, start_session, cutoff int default 0, read_only int default 0, created_at default datetime('now'))`
    - `plan_choices(plan_id, group_id, child_id, pk(plan_id, group_id))`
    - `plan_courses(plan_id, course_code, term_index int, pinned_group_id nullable, pk(plan_id, course_code))`
  - **Generate in two steps to avoid drizzle-kit's interactive rename prompt:**
    first remove `messages`, run `pnpm db:generate` (pure drop); then add the new
    tables and run `pnpm db:generate` (pure create).
  - `events.ts`: the same stream as now, but no `bus`. It keeps the opening
    comment and the 30 s ping, and `cancel()` clears the interval.
- **Refactor:** Remove now-unused exports and imports.
- **Acceptance criteria:**
  - `pnpm check` is green, with invariants passing on `/` and `/readme/`.
  - Migrations apply to a fresh DB at boot.
  - `grep -r "messages\|bus" src` finds nothing.
- **Depends on:** 1.

### Task 6: Boot-time seed, repository reads, example plan

- **Description:** Load the committed data and tree into SQLite on boot, read
  them back as domain objects, and create the read-only example plan.
- **Files touched:** `src/lib/seed.ts` (new), `src/lib/seed-input.ts` (new),
  `src/lib/repo.ts` (new), `src/lib/db.ts`, `src/data/example-plan.ts` (new),
  `src/lib/seed.test.ts` (new).
- **Tests first (red):** `src/lib/seed.test.ts` uses an in-memory better-sqlite3,
  runs drizzle `migrate` with `./drizzle`, builds the `SeedInput` by reading
  `data/2027` with `node:fs`, and exercises `repo` functions through a db
  parameter.
  - `seeds only undergrad courses`: `loadCatalogue(db).courses.has("COMP2100")`
    and `!has("COMP8280")`.
  - `seed is idempotent`: after seeding twice, the course and group row counts
    are unchanged.
  - `seed keeps stub courses and user plans`: insert a stub course `ABCD1234`
    and a plan, reseed, and both are still present.
  - `loadProgram round-trips AACOM_2027`: deep-equal, ignoring the order of
    course lists.
  - `example plan is reset on reseed`: modify a placement of `example`, reseed,
    and the placements equal `EXAMPLE_PLAN.placements`; `readOnly === true`.
  - `horizonYear is 2028`.
- **Implementation (green):**
  - `seed-input.ts`:
    `export function loadSeedInput(): SeedInput` uses
    `import.meta.glob("/data/2027/courses/*.json", { eager: true, import: "default" })`
    and `import tdp from "../../data/2027/tdp.json"`, so the data is bundled and
    the Dockerfile doesn't need to copy it.
  - `seed.ts`:
    - `export interface SeedInput { courses: PandcCourseJson[]; program: ProgramDef; example: PlanState }`
    - `export function seedReferenceData(db: BetterSQLite3Database, input: SeedInput, parse = emptyParse): void`:
      in one transaction, upsert the program; delete and reinsert that program's
      groups, requirement_courses and checks; upsert undergrad courses with
      `is_stub=0`, replacing their offerings and requisite rows; delete and
      reinsert the `example` plan and its choices and courses.
  - `repo.ts` never imports `db.ts`. Importing `db.ts` opens and seeds the real
    database, which unit tests must not touch, so every function takes an
    explicit `db`:
    - `export type Db = BetterSQLite3Database`
    - `loadCatalogue(db: Db): Catalogue` (memoised in a `WeakMap` keyed by db)
    - `invalidateCatalogue(db: Db): void`
    - `loadProgram(db: Db): ProgramDef`
    - `getPlan(db: Db, id: string): PlanState | null`

    Only `plan-service.ts` and the API routes import `db` from `db.ts`.
  - In `db.ts`, after `migrate`:
    `seedReferenceData(db, loadSeedInput(), parseRequisites)`. The parser is
    wired in Task 8; until then, `emptyParse`.
  - `example-plan.ts` exports `export const EXAMPLE_PLAN: PlanState` with id
    `"example"`, `readOnly: true`, `cutoff: 2`,
    `choices: { spec: "arin", capstone: "cap-research" }`, and these placements
    by term:
    - T0: COMP1130, MATH1005, MATH1115, INFS1001
    - T1: COMP1140, COMP1600, MATH1116, STAT1008
    - T2: COMP2100, COMP2300, COMP2400, COMP2620
    - T3: COMP2120, COMP2310, COMP3600, COMP3670
    - T4: COMP3630, COMP3620, COMP3242, COMP4450
    - T5: COMP4620, COMP4650, COMP3900, COMP3320
    - T6: COMP4550 (spans T6–T7), COMP4670, COMP4528
    - T7: COMP4011, SCOM3029
- **Refactor:** None expected.
- **Acceptance criteria:**
  - The tests pass.
  - `pnpm check` is green (the server boots with seeding).
  - `repo.ts` is the only module besides `db.ts` and `seed.ts` that touches
    tables.
- **Depends on:** 3, 4, 5.

### Task 7: Plan creation, placement CRUD API, and the first `/plan/[id]` page (Preact) — deploy checkpoint

- **Description:** An end-to-end persistent flow. Basic validation only
  (feasibility is added in Task 10). After this task, the C7 spec lines "loads
  at fly.dev", "wired end to end" and "persists across reload" are met.
- **Files touched:**
  - `package.json` and `pnpm-lock.yaml`: add `@astrojs/preact@^6.0.5` and
    `preact@^10.29.8`
  - `astro.config.ts` (`integrations: [preact()]`)
  - `tsconfig.json` (`"compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact" }`)
  - `src/lib/repo.ts` (writes), `src/lib/plan-service.ts` (new),
    `src/lib/domain/view.ts` (new; initial subset of `buildPlanView`)
  - `src/pages/api/plans.ts`, `src/pages/api/plans/[id]/placements.ts`,
    `src/pages/api/plans/[id]/placements/[code].ts` (all new)
  - `src/pages/plan/[id].astro` (new), `src/components/Planner.tsx` (new)
  - `src/pages/index.astro`, `src/pages/readme.astro` (nav labels),
    `spec/routes.ts`, `spec/planner.test.ts` (new)
- **Tests first (red):** `spec/planner.test.ts` (HTTP, following the guestbook
  test's conventions):
  - `POST /api/plans creates a plan and redirects`: 303, with `location`
    matching `^/plan/[A-Za-z0-9_-]{22}$`.
  - `placing a course persists across reload`: POST
    `/api/plans/<id>/placements` with `{ "code": "COMP1130", "term": 0 }`
    returns 200 JSON whose `placements` includes COMP1130 at term 0. A fresh GET
    of `/plan/<id>` then contains `data-placed="COMP1130"` in the term-0 column
    (`data-term="0"`).
  - `moving re-places, not duplicates`: placing again at term 2 leaves one
    placement, at term 2.
  - `DELETE /api/plans/<id>/placements/COMP1130` removes it.
  - `unknown course → 400`; `term 8 → 400`.
  - `unknown plan → 404` for both the page and the API.
  - `example plan is read-only`: POST placement to `example` returns 403.
  - `/plan/example renders COMP1130 and the read-only banner` (text "This is an
    example").
  - `index links to the example plan and has the start form`: the page contains
    `href="/plan/example"` and `action="/api/plans"`.
  - `ROUTES` includes `/plan/example`, so the invariants cover it.
- **Implementation (green):**
  - `repo.ts`: `createPlan(db: Db): string` (id =
    `randomBytes(16).toString("base64url")`),
    `upsertPlacement(db: Db, id: string, code: string, term: number): void`,
    `deletePlacement(db: Db, id: string, code: string): void`.
  - `plan-service.ts`:
    - `export type ServiceResult = { status: 200; view: PlanView } | { status: 400 | 403 | 404 | 409; error: string }`
    - `export function placeCourse(planId: string, code: string, term: number): ServiceResult`
    - `export function removeCourse(planId: string, code: string): ServiceResult`
    - `export function getView(planId: string): PlanView | null`
  - `view.ts`: `buildPlanView` returns `plan`, `terms` (label, units, overload)
    and `placements` (code, term, span, completed), plus `courses` for placed
    and tree-listed courses (title, units, url, description). `offeredLabel`
    (the function comes from Task 9) is wired in by Task 10, and the other
    `PlanView` fields (overview §4.3) arrive in Tasks 10–13.
  - API routes: `POST /api/plans` is a form POST that returns
    `redirect('/plan/'+id, 303)`. The JSON routes return
    `new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })`.
  - `[id].astro`:
    - load the view, or set `Astro.response.status = 404` and render "Plan not
      found"
    - `<html lang="en-AU">`, `<title>`, `<nav aria-label="site">` (Home,
      Example plan, About), one `<h1>` ("Your AACOM 2027 plan" or "Example
      plan")
    - `<Planner client:load view={view} />`
  - `Planner.tsx`: an 8-column timeline of `<section data-term>` with placed
    course cards (`data-placed`), and an ordered list of the sidebar group
    labels.
  - `index.astro`: an explainer, `<form method="post" action="/api/plans"><button>Start a new plan</button></form>`,
    and a link to `/plan/example`.
  - `routes.ts`: `["/", "/readme/", "/plan/example"]`.
- **Refactor:** Extract the shared page shell (head and nav) into
  `src/layouts/Base.astro` and use it in all three pages.
- **Acceptance criteria:**
  - The tests pass, and the invariants (including axe) pass on `/plan/example`.
  - **Deploy**: ask the user before the first deploy (it's outward-facing).
    Then `flyctl deploy --remote-only --ha=false -a comp4020-crit7-attwelvedev`,
    and on the live URL: `/` returns 200, creating a plan and placing a course
    survives a reload, and `/api/events` streams.
- **Depends on:** 6.


## 6. Phase Definition of Done

- [x] Every task in §5 is complete and its tests pass
- [x] `pnpm test:unit` passes
- [x] `pnpm check` passes
- [x] Invariants (including axe) pass on `/`, `/readme/` and `/plan/example`
- [x] With the user's go-ahead, deployed with `flyctl deploy --remote-only --ha=false -a comp4020-crit7-attwelvedev`; on the live URL `/` returns 200, a created plan's placement survives a reload, `/api/events` streams, and `/plan/example` renders
- [x] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR1 | Task 7 |
| FR2 | Task 7 |
| FR3 (placements) | Task 7 |
| FR4 | Task 7 |
| FR5 (layout) | Task 7 |
| FR6 | Task 5 |
| FR9 | Task 6 |
| FR18 | Task 7 |
| FR33 | Tasks 6, 7 |
| FR35 (seed) | Task 6 |
| NFR stack / Dockerfile / bundled data | Tasks 5, 6, 7 |
| NFR harness + CI probes | Tasks 5, 7 |

## 8. Risks / open questions

None.
