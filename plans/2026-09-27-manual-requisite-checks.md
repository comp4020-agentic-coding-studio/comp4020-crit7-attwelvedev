# Manual checks for "Verify on P&C" requisite items

- **Date:** 2026-09-27
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27 (via
  `specs/2026-09-27-manual-requisite-checks.md`, approved in brainstorm)

## 1. Summary

Requisites the planner can't evaluate (permission codes, marks, WAM,
project supervisors) currently leave a course in the neutral **Check
requirements** state with a "Verify on P&C: …" note it can never leave.
This feature lets a student answer each such item **Met / Not met / Not
sure** in the course's Details dialog. Answers are stored per plan +
course, feed the existing three-valued requisite evaluation, and the card
drops the note once the requisite works out met. The full design and its
rationale are in `specs/2026-09-27-manual-requisite-checks.md`; this plan
turns it into four TDD tasks.

## 2. Requirements

### 2.1 Functional requirements

Numbered as in the spec (§2.1 there); restated so this file stands alone.

1. Every verify item on a placed course — every entry of
   `CatalogueCourse.requisites.unverifiable`, advice lines included — can be
   answered Met, Not met or Not sure; Not sure = no stored answer.
2. The control lives in the course's Details dialog: one labelled
   three-way choice per item, keyboard- and screen-reader-operable.
3. Answers feed evaluation: Met → leaf `ok: true`, Not met → `ok: false`,
   none → `ok: null`. State follows the tree: `true` → `available`, `null`
   → `check`, `false` → `soft`, with one reason per contributing Not met
   item: `You marked "<label>" as not met`.
4. `PlacementEval.verify` (the card's "Verify on P&C" line) lists only
   unanswered items, as labels, and is `[]` when `state === "available"`.
5. An unverifiable leaf whose parent AND has exactly two items — one course
   leaf and this unverifiable leaf (the parser's shape for a code directly
   followed by its qualifier) — is labelled `"<CODE> <text>"` (MATH1116 →
   "MATH1115 with a mark of 60 or above"); others are labelled with their
   text. Labels are display only. *(Narrowed 2026-09-27 during execution:
   "parent AND contains exactly one course leaf" also caught sentence-level
   ANDs, e.g. COMP4820 → "COMP2100 Competitive entry…".)*
6. Code-less sentences from the incompatibility bucket (today only in
   `unverifiable`, never in `prereq`) become unverifiable leaves AND'ed into
   `prereq` (standing alone if there's no other prereq).
7. `RequisiteTree` shows an answered leaf as `✓ met (marked by you)` /
   `✗ not met (marked by you)`; unanswered stays `not checked`.
8. Answers are stored per plan + course + item text, independent of
   placement: they survive Move to, remove + re-place and undo.
9. The same item text on two courses is answered independently.
10. A stored answer whose item text no longer appears on the course is
    ignored (the item reads as unanswered) and never displayed.
11. Read-only plans: controls disabled; the API returns 403.
12. The help page's "Check requirements" entry explains marking items.

### 2.2 Non-functional requirements

1. Accessibility: each item is a `<fieldset>` with a `<legend>` (the
   label) and three radio inputs; `axeViolations` stays `[]`.
2. Details dialog has no horizontal page overflow at 1920×1080 and
   390×844.
3. API validation mirrors pins/choices: 404 unknown plan, 403 read-only,
   400 course not placed, 400 item not a verify item of the course, 400
   malformed body.

### 2.3 Out of scope

- "No published offering — verify on P&C" badge; `otherPrograms` notes;
  program leaves (not overridable).
- Feasibility / Blocked (stays optimistic about unverifiable leaves).
- Allocation and progress bars.
- Classifying items as advice vs requirement.

### 2.4 Assumptions

- Item text is the answer key; wording drift resets an item to blank
  (FR 10) — accepted in the approved spec.

## 3. Existing code context

All verified by reading the files on 2026-09-27.

- **`src/lib/domain/types.ts`**
  - `export type ReqExpr = | { kind: "and"; items: ReqExpr[] } | { kind: "or"; items: ReqExpr[] } | { kind: "course"; code: string; concurrent: boolean } | { kind: "units"; units: number; filter: CourseFilter; text: string } | { kind: "program"; code: string | null; name: string; satisfied: boolean } | { kind: "unverifiable"; text: string };`
  - `export interface ParsedRequisites { prereq: ReqExpr | null; incompatible: string[]; unverifiable: string[]; otherPrograms: string[]; parseStatus: "ok" | "partial"; }`
  - `export interface PlanState { id: string; readOnly: boolean; cutoff: number; choices: Record<string, string>; placements: Placement[]; }`
- **`src/lib/domain/requisites.ts`** `export function parseRequisites(input: { prerequisites: string; incompatibilities: string }): ParsedRequisites` — loops `incompatBucket`; a sentence with no course code is `unverifiable.push(sentence)`; later `const prereq = combineAnd(prereqParts); collectUnverifiable(prereq, unverifiable);`. `combineAnd(parts: ReqExpr[]): ReqExpr | null` flattens top-level ANDs.
- **`src/lib/domain/evaluate.ts`**
  - `export type RequisiteStatus = … | { kind: "unverifiable"; text: string; ok: null };` (and/or `ok: boolean | null`)
  - `export interface PlacementEval { code; term; span; lastTerm; state: "hard" | "soft" | "check" | "available"; reasons: string[]; suggestions: Suggestion[]; verify: string[]; conflictWith: string[]; loser: boolean; completed: boolean; placedPrereqs: string[]; prereqsToPlace: number; requisiteStatus: RequisiteStatus | null; }`
  - `export function evaluatePlan(cat: Catalogue, feas: ReturnType<typeof createFeasibility>, plan: PlanState): { placements: PlacementEval[]; termUnits: number[] }`
  - inner `function evalNode(expr: ReqExpr, t: number): RequisiteStatus`; `const verify = course?.requisites.unverifiable ?? [];` set on every branch; soft reasons built from `collectFailingUnitsLeaves`.
- **`src/lib/domain/view.ts`** `export interface PlacementView extends PlacementEval { countsToward: string | null; pinned: boolean; }` — new PlacementEval fields flow through automatically. `buildPlanView(cat, program, plan)` calls `evaluatePlan(cat, feas, plan)` (line ~196).
- **`src/lib/schema.ts`** — `planCourses` (`plan_courses`, PK `(planId, courseCode)`, `pinnedGroupId`), `planChoices` (`plan_choices`, PK `(planId, groupId)`); pattern: `sqliteTable("name", { col: text("col_name").notNull() }, (table) => [primaryKey({ columns: [...] })])`.
- **Migrations:** `drizzle/0000…0002_*.sql` + `drizzle/meta`, generated by `pnpm db:generate` (`drizzle.config.ts`: schema `./src/lib/schema.ts`, out `./drizzle`). Never hand-edit.
- **`src/lib/repo.ts`** — `export type Db = BetterSQLite3Database;` `export function getPlan(db: Db, id: string): PlanState | null` (reads `plans`, `planChoices`, `planCourses`); `export function setPin(db: Db, planId: string, code: string, groupId: string | null): void`; `export function deletePlacement(db: Db, planId: string, code: string): void` deletes the `plan_courses` row. Never imports `db.ts`.
- **`src/lib/seed.ts`** `function seedExamplePlan(db: Db, example: PlanState, program: ProgramDef): void` deletes the example's `planChoices`/`planCourses`/`plans` rows, then reinserts. Parsed requisites are stored in `course_requisites` at boot and read back by `loadCatalogue`, so parser changes reach the app on restart.
- **`src/lib/plan-service.ts`** — `export type ServiceResult = { status: 200; view: PlanView } | { status: 400 | 403 | 404 | 409; error: string };` `export function setPin(planId: string, code: string, groupId: string | null): ServiceResult` (404 `"plan not found"`, 403 `"this plan is read-only"`, 400 `` `${code} is not placed in this plan` ``, then `repoSetPin` and `buildPlanView(loadCatalogue(db), loadProgram(db), getPlan(db, planId)!)`).
- **`src/pages/api/plans/[id]/pins.ts`** — `export const PUT: APIRoute`, local `json(body, status)` helper, validates body fields, maps `ServiceResult` to a response. Copy this shape.
- **`src/components/api.ts`** — `export function setPin(planId: string, code: string, groupId: string | null): Promise<ApiResult>` via `request(path, jsonInit("PUT", body))`.
- **`src/components/CourseDetail.tsx`** — `Props { view; code; course?; planId; open; onChanged; onAnnounce; onClose }`; renders `<h3>Requisites</h3>` + `<RequisiteTree node={placement.requisiteStatus} />`, then Pin to (`disabled={readOnly || pinPending}`, `useState(false)` pending flag, `isError(result) ? onAnnounce : onChanged`). Always rendered (closed) in SSR HTML — one per placed card, so radio `name`s must be unique per course + item.
- **`src/components/RequisiteTree.tsx`** — final `return (<li>{node.text} — not checked</li>)` for unverifiable.
- **`src/components/CourseCard.tsx:139`** — `{placement.verify.length > 0 && (<p class="badge badge-verify">Verify on P&C: {placement.verify.join("; ")}</p>)}`; state badge text map `{ hard: "Blocked", soft: "Needs prerequisites", check: "Check requirements", available: "Available" }`.
- **`src/pages/help.astro`** — `<dt>Check requirements</dt><dd>…The "Verify on P&amp;C" note on the card says what; confirm it with the course's Programs and Courses page or the school.</dd>`.
- **Real data used by tests:** MATH1116 prereq `OR(AND(MATH1115, ?"with a mark of 60 or above"), AND(MATH1113, ?"with a mark of 80 or above"))`; COMP4820 prereq `AND(P:null, COMP2100, [12u COMP 3000])`, incompatibility text adds "Competitive entry based on application and interviews with Hosts" and "You will need to contact the School of Computing to request a permission code to enrol in this course"; COMP4550 has four verify items; COMP4011 and COMP4020 both carry "You will need to contact the School of Computing to request a permission code to enrol in this course".
- **Tests:** Vitest. Unit: `src/**/*.test.ts` (`pnpm test:unit`). Spec: `spec/**/*.test.ts` against the built server with a throwaway DB (`pnpm test` builds first). Full gate: `pnpm check`. Helpers: `spec/planner.test.ts` `postJson`/`putJson`/`createPlan()`; `spec/layout.test.ts` `withPlan(viewport, check)`, `openPage`, `axeViolations`, `horizontalOverflow`; `src/lib/seed.test.ts` `makeDb()` (in-memory + `migrate`). `evaluate.test.ts` has `loadRealCatalogue()`, `plan(placements, cutoff?)`, `synthetic(code, opts)`, `syntheticCatalogue(courses)`.

## 4. Approach

Four slices, each one commit, in dependency order: parse change (FR 6)
first so every verify item is a tree leaf; then storage/API (answers can
be saved before anything reads them); then evaluation (answers change
states, labels, verify list); then UI. `PlanState.checks` is **optional**
(`checks?: PlanChecks`, absent = no answers) so the many existing
`PlanState` literals (example plan, test helpers) don't all need editing.
Answers are keyed by raw item text; labels are derived at evaluation time
and never stored. Alternatives are recorded in the spec §4.

Data flow: `plan_checks` rows → `getPlan` → `PlanState.checks` →
`evaluatePlan` (leaf lookup by `plan.checks?.[code]?.[text]`) →
`PlacementEval.{checks, verify, reasons, state}` → card + Details.

## 5. Task breakdown

### Task 1: Make incompatibility-field prose required unverifiable leaves

- [x] Done
- **Description:** In `parseRequisites`, code-less incompatibility-bucket
  sentences become `{ kind: "unverifiable", text }` leaves AND'ed after the
  parsed prereq parts; `unverifiable` is then collected from the tree only,
  so each item appears once and every item is a leaf.
- **Files touched:** `src/lib/domain/requisites.ts`,
  `src/lib/domain/requisites.test.ts`, `src/lib/domain/evaluate.test.ts`.
- **Tests first (red):**
  - `requisites.test.ts` › fixtures › `"COMP4820: incompatibility-field prose becomes a required leaf"` — `expectPrereq("COMP4820", AND(P(null, true), C("COMP2100"), U(12, { prefixes: ["COMP"], minLevel: 3000, maxLevel: 3000 }), { kind: "unverifiable" }, { kind: "unverifiable" }))`. This **replaces** the existing `"COMP4820: program leaf, course leaf and a units clause"` fixture (which pins the pre-FR 6 tree `AND(P, C, U)`) — ruled 2026-09-27 during execution review.
  - `requisites.test.ts` › invariants › `"every verify item is exactly one unverifiable leaf of the prereq tree"` — for every course file, the multiset of `result.unverifiable` equals the multiset of unverifiable leaf texts collected from `result.prereq`.
  - `evaluate.test.ts` › "'check' on the real catalogue" › `"COMP4820 with its courses met is 'check' until its permission items are answered"` — plan `COMP2100` t2, `COMP3600` t3, `COMP3620` t4, `COMP4820` t6 → state `"check"`.
- **Implementation (green):** in `parseRequisites` replace `unverifiable.push(sentence)` in the incompat loop with pushing `{ kind: "unverifiable", text: sentence }` onto a new `const incompatProse: ReqExpr[] = []`; `const prereq = combineAnd([...prereqParts, ...incompatProse]);`; keep `collectUnverifiable(prereq, unverifiable)` as the sole filler of `unverifiable` (initialised `[]`). Comment citing COMP4820.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - New tests pass; all other existing `requisites.test.ts` / `evaluate.test.ts` tests pass unchanged (incl. "example plan has nothing still flagged 'soft'").
  - A before/after dump of every course's parsed tree (scratch script, as in commits b8a9cf0/09b79ac) changes only COMP3820, COMP4550, COMP4620, COMP4820, MATH4343 (+ any postgrad course with code-less incompat prose), each by gaining trailing unverifiable leaves.
  - `pnpm check` green; one commit.
- **Depends on:** None.

### Task 2: Store answers — `plan_checks` table, repo, service, API, client

- [x] Done
- **Description:** Persist answers per plan + course + item text and
  expose `PUT /api/plans/:id/checks`. No evaluation change yet.
- **Files touched:** `src/lib/domain/types.ts`, `src/lib/schema.ts`,
  `drizzle/0003_*.sql` + `drizzle/meta/*` (generated), `src/lib/repo.ts`,
  `src/lib/seed.ts`, `src/lib/plan-service.ts`,
  `src/pages/api/plans/[id]/checks.ts` (new), `src/components/api.ts`,
  `src/lib/plan-checks.test.ts` (new), `spec/planner.test.ts`.
- **Tests first (red):**
  - `src/lib/plan-checks.test.ts` (new; `makeDb()` + `seedReferenceData(db, { courses, program: AACOM_2027, example: EXAMPLE_PLAN }, parseRequisites)` as in `seed.test.ts`, then `createPlan(db)`, `upsertPlacement(db, id, "MATH1116", 1)`):
    - `"setCheck stores an answer that getPlan returns"` — `setCheck(db, id, "MATH1116", "with a mark of 60 or above", "met")` → `getPlan(db, id)!.checks` equals `{ MATH1116: { "with a mark of 60 or above": "met" } }`.
    - `"answer null deletes it"` — then `setCheck(..., null)` → `checks` equals `{}`.
    - `"answers survive removing and re-placing the course"` — set, `deletePlacement`, `upsertPlacement` → answer still present.
    - `"a new plan has no checks"` — `getPlan(db, createPlan(db))!.checks` equals `{}`.
  - `spec/planner.test.ts`:
    - `"PUT checks stores an answer (200)"` — plan with MATH1116 placed; `putJson(\`/api/plans/${id}/checks\`, { code: "MATH1116", item: "with a mark of 60 or above", answer: "met" })` → 200.
    - `"PUT checks on the read-only example returns 403"` — `{ code: "COMP4550", item: "find a project/supervisor", answer: "met" }` on `/api/plans/example/checks` → 403 (the read-only check runs before item validation, so the item's order doesn't matter).
    - `"PUT checks for an unplaced course returns 400"`, `"PUT checks with an item the course doesn't have returns 400"`, `"PUT checks with a bad answer returns 400"` (`answer: "yes"`).
- **Implementation (green):**
  - `types.ts`: `export type CheckAnswer = "met" | "not-met";` `export type PlanChecks = Record<string, Record<string, CheckAnswer>>; // course code -> verify item text -> answer; absent = "Not sure"`; `PlanState` gains `checks?: PlanChecks;`.
  - `schema.ts`: `export const planChecks = sqliteTable("plan_checks", { planId: text("plan_id").notNull(), courseCode: text("course_code").notNull(), itemText: text("item_text").notNull(), answer: text().notNull() }, (table) => [primaryKey({ columns: [table.planId, table.courseCode, table.itemText] })]);` then run `pnpm db:generate`.
  - `repo.ts`: `export function setCheck(db: Db, planId: string, code: string, item: string, answer: CheckAnswer | null): void` (null → delete row; else insert `onConflictDoUpdate` on the PK setting `answer`); `getPlan` reads `planChecks` rows into `checks: PlanChecks` (always present, `{}` when none).
  - `seed.ts` `seedExamplePlan`: also `db.delete(planChecks).where(eq(planChecks.planId, example.id)).run();`.
  - `plan-service.ts`: `export function setCheck(planId: string, code: string, item: string, answer: CheckAnswer | null): ServiceResult` — 404 / 403 as `setPin`; 400 `` `${code} is not placed in this plan` ``; 400 `` `"${item}" is not a verify item of ${code}` `` unless `loadCatalogue(db).courses.get(code)?.requisites.unverifiable.includes(item)`; then `repoSetCheck` and the usual `buildPlanView(...)`.
  - `src/pages/api/plans/[id]/checks.ts`: `export const PUT: APIRoute` copying `pins.ts`; body `{ code, item, answer }`, 400 `"code (string), item (string) and answer (\"met\", \"not-met\" or null) are required"` unless `typeof code === "string" && typeof item === "string" && (answer === null || answer === "met" || answer === "not-met")`.
  - `api.ts`: `export function setCheck(planId: string, code: string, item: string, answer: CheckAnswer | null): Promise<ApiResult>` → `request(\`/api/plans/${planId}/checks\`, jsonInit("PUT", { code, item, answer }))`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - All listed tests pass; migration generated by `pnpm db:generate`, not hand-written.
  - Existing plans load unchanged (no answers).
  - `pnpm check` green; one commit.
- **Depends on:** None (Task 1 only affects which items exist; the tests here use MATH1116, unaffected by it).

### Task 3: Evaluate answers — states, Not met reasons, labels, unanswered-only verify

- [x] Done
- **Description:** Answers change leaf results; placements expose each
  item with its label and answer; `verify` shows only unanswered labels
  and nothing when available.
- **Files touched:** `src/lib/domain/verify-labels.ts` (new),
  `src/lib/domain/verify-labels.test.ts` (new),
  `src/lib/domain/evaluate.ts`, `src/lib/domain/evaluate.test.ts`.
- **Tests first (red):**
  - `verify-labels.test.ts`:
    - `"an item AND'ed with exactly one course is labelled with it"` — real MATH1116 prereq → `verifyItemLabels(prereq, unverifiable)` maps `"with a mark of 60 or above"` → `"MATH1115 with a mark of 60 or above"` and `"with a mark of 80 or above"` → `"MATH1113 with a mark of 80 or above"`.
    - `"other items keep their text"` — COMP4550: every label equals its text.
    - `"an item AND'ed with two courses keeps its text"` — synthetic `AND(course A, course B, unverifiable x)` → `x` → `x`.
    - `"an item in a sentence-level AND with one course keeps its text"` — real COMP4820 and COMP4020: every label equals its text (added 2026-09-27 with the FR 5 narrowing).
  - `evaluate.test.ts`: extend the helper to `function plan(placements: { code: string; term: number }[], cutoff = 0, checks: PlanChecks = {}): PlanState` (existing calls unchanged). New `describe("manual checks")` (synthetic: its own copies of the `unverifiable leaves` fixtures — `met` = course `ZZDD1000` placed t0, `unknown` = `{ kind: "unverifiable", text: "request a permission code" }`, dependent `ZZDD2000` t1 with prereq `AND(met, unknown)` and `unverifiable: ["request a permission code"]` — `SyntheticOpts` gains `unverifiable?: string[]` (default `[]`) for this, ruled 2026-09-27 during execution review):
    - `"Met on the only unknown makes met AND unknown available, with no verify line"` — `state` `"available"`, `verify` `[]`.
    - `"Not met gives soft with a 'You marked … as not met' reason"` — `reasons` contains `You marked "ZZDD1000 request a permission code" as not met` (FR 5 labels it: the AND is exactly course + item).
    - `"Not sure stays check, and verify lists it"` — `verify` equals `["ZZDD1000 request a permission code"]`.
    - `"a stored answer for text the course no longer has is ignored"` — `checks: { ZZDD2000: { "old wording": "met" } }` → `"check"`, `checks[0].answer` `null`.
  - `evaluate.test.ts` › real catalogue:
    - `"MATH1116: Met on the MATH1115 mark is Available with the MATH1113 item blank"` — `MATH1115` t0, `MATH1116` t1, `checks: { MATH1116: { "with a mark of 60 or above": "met" } }` → `"available"`; `checks` entries carry labels `"MATH1115 with a mark of 60 or above"` / `"MATH1113 with a mark of 80 or above"`.
    - `"the same sentence on two courses is answered separately"` — `COMP4011` t5 and `COMP4020` t7 (both not hard-blocked there, verified 2026-09-27); `checks: { COMP4011: { "You will need to contact the School of Computing to request a permission code to enrol in this course": "met" } }` → COMP4011's matching `checks` entry has `answer: "met"`, COMP4020's has `answer: null`.
- **Implementation (green):**
  - `verify-labels.ts`: `export function verifyItemLabels(prereq: ReqExpr | null, items: string[]): Map<string, string>` — walk the tree; for an `and` of exactly two items, one `course` leaf and one `unverifiable` leaf, that child maps to `` `${course.code} ${text}` ``; every other item in `items` maps to itself.
  - `evaluate.ts`:
    - `export interface VerifyCheck { item: string; label: string; answer: CheckAnswer | null }`.
    - `RequisiteStatus` unverifiable variant → `{ kind: "unverifiable"; text: string; ok: boolean | null; answer: CheckAnswer | null }`.
    - `evalNode(expr: ReqExpr, t: number, answers: Readonly<Record<string, CheckAnswer>>): RequisiteStatus` — unverifiable: `answer = answers[expr.text] ?? null`, `ok = answer === "met" ? true : answer === "not-met" ? false : null`; recursive calls pass `answers`. Called with `plan.checks?.[p.code] ?? {}`.
    - `PlacementEval` gains `checks: VerifyCheck[]` (every verify item, in `unverifiable` order, label from `verifyItemLabels`, answer from the plan only if the text is a current item — FR 10).
    - `verify` = labels of `checks` with `answer === null`, and `[]` when `state === "available"`.
    - soft branch: add `function collectMarkedNotMet(node: RequisiteStatus, out: string[]): void` (skips subtrees with `ok !== false`, like `collectFailingCourseLeaves`; pushes unverifiable texts with `answer === "not-met"`); append `` `You marked "${label}" as not met` `` reasons after the units reasons.
- **Refactor:** Build `checks`/labels once per placement before the state branches rather than in each return.
- **Acceptance criteria:**
  - All new tests pass; existing `evaluate.test.ts`, `view.test.ts`, `planner-logic.test.ts` pass unchanged (including the example-plan "no soft" invariant — the example has no answers).
  - `pnpm check` green; one commit.
- **Depends on:** Task 2 (`CheckAnswer`, `PlanState.checks`). Task 1 recommended first (so incompat items are leaves and get evaluated), not required for these tests.

### Task 4: Details "Your checks" controls, tree answers, help text

- [x] Done
- **Description:** Let the student answer items in Details; show answers in
  the requisite tree; explain it on the help page.
- **Files touched:** `src/components/CourseDetail.tsx`,
  `src/components/RequisiteTree.tsx`, `src/styles.css`,
  `src/pages/help.astro`, `spec/layout.test.ts`.
- **Tests first (red):** `spec/layout.test.ts` › new `describe("manual checks")`, with a local helper creating a plan via the API with `MATH1115` t0 and `MATH1116` t1:
  - `it.each([[1920, 1080], [390, 844]])("at %i×%i Details offers Met / Not met / Not sure per item, labelled with its course")` — open MATH1116 Details; `dialog[open] fieldset` count 2; legends `"MATH1115 with a mark of 60 or above"`, `"MATH1113 with a mark of 80 or above"`; each has radios named Met, Not met, Not sure with Not sure checked; `horizontalOverflow(page)` 0; `axeViolations(page)` `[]`.
  - `"answering Met on the MATH1115 mark makes the card Available and drops its verify line"` — check Met in the first fieldset; card `[data-placed="MATH1116"]` has no `.badge-verify`, its state badge text is `"Available"`; after reload the Met radio is still checked (persisted).
  - `"Not met turns the card amber with its reason"` — check Not met → card has `.badge-state-soft` and text `You marked "MATH1115 with a mark of 60 or above" as not met`.
  - `"the read-only example's check controls are disabled"` — `/plan/example`, open COMP4550 Details → every `dialog[open] fieldset` is disabled.
  - `"the requisite tree says an answer was marked by you"` — after Met, dialog text contains `✓ met (marked by you)`.
- **Implementation (green):**
  - `CourseDetail.tsx`: import `setCheck` from `./api` and `type CheckAnswer` from `../lib/domain/types`; `const [checkPending, setCheckPending] = useState(false);` `async function answer(item: string, value: CheckAnswer | null)` mirroring `pin`. After the requisite tree, when `placement && placement.checks.length > 0`: `<h3>Your checks</h3>`, a one-sentence `<small>` explainer, then per `check` (index `i`) a `<fieldset class="verify-check" disabled={readOnly || checkPending}><legend>{check.label}</legend>` and three `<label><input type="radio" name={\`check-${code}-${i}\`} checked={check.answer === value} onChange={() => answer(check.item, value)} /> {text}</label>` for `[["met", "Met"], ["not-met", "Not met"], [null, "Not sure"]]`.
  - `RequisiteTree.tsx`: unverifiable → `{node.text} — {node.answer === "met" ? "✓ met (marked by you)" : node.answer === "not-met" ? "✗ not met (marked by you)" : "not checked"}`.
  - `styles.css`: `.verify-check` (no default fieldset chrome beyond a light border, options in a wrapping flex row with gap, legend wraps within the dialog width).
  - `help.astro` Check requirements `<dd>`: add that each item can be marked Met / Not met / Not sure under "Your checks" in the course's Details, that Met on everything that matters makes it Available and Not met flags it as needing prerequisites.
- **Execution notes (2026-09-27):** the dialog renders twice per placed course (timeline card + sidebar entry), so radio names get a per-instance `useId()` prefix (the first spec asserts every item's group has exactly 3 radios page-wide); a `pendingCheck` state keeps the clicked radio checked while saving, replacing the boolean `checkPending`; the legend is floated inside the box so long items don't straddle the border; the read-only spec reads `HTMLFieldSetElement.disabled` (Playwright's `isDisabled()` ignores fieldsets) and checks every radio is disabled. Human review accepted by the user 2026-09-27.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - All listed specs pass at both viewports; `pnpm check` green; one commit.
- **Human review:** the rendered MATH1116 and COMP4550 Details dialogs at 1920×1080 and 390×844 (screenshots) — pass = "Your checks" reads clearly as the student's own answers, long COMP4550 items wrap without crowding the radios, and the explainer wording is plain and accurate. The user must explicitly accept.
- **Depends on:** Tasks 2 and 3.

## 6. Feature-level Definition of Done

- [ ] Every task in §5 complete and its tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Manually verified against the built server with a throwaway DB
  (`HOST=127.0.0.1 PORT=… DATABASE_PATH=<scratch>/x.db node dist/server/entry.mjs`)
  at 1920×1080 and 390×844: MATH1116 golden path (Met → Available, verify
  line gone), Not met → amber with reason, Not sure → back to Check
  requirements, answer survives remove + re-place, example plan controls
  disabled, COMP4820 shows Check requirements until answered
- [ ] Every requirement in §2 is covered — see §7
- [ ] Task 4's Human review explicitly accepted by the user
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| 2.1.1 every item answerable | Task 2 (API accepts any verify item), Task 4 (control per item) |
| 2.1.2 control in Details | Task 4 |
| 2.1.3 answers drive state + Not met reason | Task 3 |
| 2.1.4 verify = unanswered, empty when available | Task 3 |
| 2.1.5 labels with course | Task 3 (helper), Task 4 (legend) |
| 2.1.6 incompat prose required | Task 1 |
| 2.1.7 tree shows answers | Task 3 (`answer` on status), Task 4 (render) |
| 2.1.8 per plan+course, survives remove | Task 2 |
| 2.1.9 per-course independence | Task 2 (key), Task 3 (test) |
| 2.1.10 orphaned answers ignored | Task 3 |
| 2.1.11 read-only | Task 2 (403), Task 4 (disabled) |
| 2.1.12 help text | Task 4 |
| 2.2.1 accessibility | Task 4 (fieldset/legend, axe) |
| 2.2.2 no overflow at both viewports | Task 4 |
| 2.2.3 API validation | Task 2 |

## 8. Risks / open questions

None.
