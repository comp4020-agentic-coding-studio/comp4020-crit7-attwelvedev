# ANU Degree Planner (AACOM 2027) — Plan overview

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26 (design spec
  `specs/2026-09-26-degree-planner.md`, plus planning-phase rulings in §2.4)

## 0. How to use these plans

This feature is split across one overview and seven phase plans, so that each
can run in its own conversation with a small context:

- `plans/2026-09-26-degree-planner-00-overview.md` (this file): requirements
  FR1–FR37, shared types and API contract, conventions, phase map, the
  feature-level Definition of Done and full coverage.
- `plans/2026-09-26-degree-planner-01-data-foundations.md` … `-07-search-readme.md`:
  each phase's tasks, only the codebase context that phase needs, and the exact
  signatures it uses from earlier phases.

**A session reads this overview plus exactly one phase file.** Open the design
spec only if a phase file says to, or if a design question comes up.

Tasks keep their global numbers (Task 1–17) across files. When a phase finishes,
tick it in §5 and commit.

## 1. Summary

A full-stack degree planner for ANU's **Bachelor of Advanced Computing (Honours)
(AACOM), 2027 cohort, starting Semester 1**, replacing the manual process of
reading programsandcourses.anu.edu.au (P&C). A student opens a plan (a shareable,
unguessable URL), sees the AACOM requirement tree in a sidebar, and places
courses onto an 8-semester timeline by drag-and-drop or a keyboard-accessible
"Place in…" control. For every placed course the app computes one of
**available / soft-blocked / hard-blocked**, with a specific reason, using a
recursive prerequisite check. Every requirement group gets a **two-segment
progress bar** (completed vs planned, split by a movable cutoff line). Each
course counts toward at most one group, via an optimal allocation the student
can override by pinning. Course data is scraped offline with `anu-pandc`,
committed, and seeded into SQLite on boot. Unknown course codes are fetched live
from P&C by a TypeScript fetcher. It is the C7 crit deliverable ("Build the ANU
system you wish existed") on the starter's Astro + Drizzle + SQLite + Fly stack.

## 2. Requirements

Numbering follows the approved design spec (FR1–FR32). FR33–FR37 were added
during planning (§2.4).

### 2.1 Functional requirements

**Plans & persistence**

1. `/` shows an explainer and a **Start a new plan** form. It POSTs to
   `/api/plans`, which creates a plan with a 22-character base64url random id and
   303-redirects to `/plan/<id>`.
2. `/plan/<id>` renders the planner from the database. An unknown id renders a
   "Plan not found" page with HTTP 404.
3. Every mutation (place, move, remove, cutoff, selectable choice, pin) is
   persisted immediately. A reload shows identical state.
4. Anyone with a plan URL can view and edit it (no auth), except the read-only
   example plan (FR33).
5. `/readme/` keeps serving the whole of `README.md`.
6. `GET /api/events` responds `content-type: text/event-stream` and immediately
   sends `: connected\n\n`. The guestbook (messages table, UI, `/api/messages`,
   `src/lib/events.ts`, `spec/guestbook.test.ts`) is removed.

**Catalogue data**

7. `scripts/scrape-2027.sh` uses the installed `anu-pandc` to scrape 2027 data:
   AACOM; ARIN-SPEC, HCCC-SPEC, SYAR-SPEC and THCS-SPEC; every course they name;
   the COMP catalogue; and all courses in `course-codes.txt`. It writes JSON and
   Markdown under `data/2027/` and tolerates per-page errors (e.g. COMP4801 has no
   page). `data/2027/SOURCE.md` records the source, date, command and attribution.
8. `src/data/aacom-2027.ts` is the hand-curated AACOM 2027 requirement tree
   (Phase 01 §4.1). Its test validates it against the scraped data.
9. On boot, reference data (program, groups, checks, seeded courses, offerings,
   requisites) is upserted idempotently. User plans are never touched, apart from
   resetting the example plan.
10. Course search: `GET /api/courses/search?q=` returns DB matches (code prefix
    or title substring). If `q` is a well-formed code (`^[A-Z]{4}\d{4}$`) that
    isn't in the DB, the server fetches `https://programsandcourses.anu.edu.au/2027/course/<CODE>`,
    parses it in TypeScript, caches it with `is_stub=1` and `scraped_at`, and
    returns it. Each outcome has a status: `found`, `fetched`, `not_found`
    (P&C redirects to `/Error/`), or `error` (network or parse failure; nothing
    cached). A partial requisite parse is cached, and the course carries the
    verify badge.

**Requisites**

11. `parseRequisites()` (TypeScript) is used both at seed time and on fetched
    pages. It produces a `ReqExpr` tree with these node types: `and`/`or`;
    `course{code, concurrent}`; `units{units, filter}`; `program{code, name,
    satisfied}`, which is satisfied iff the program is AACOM or is named
    "Bachelor of Advanced Computing" without a qualifier; and
    `unverifiable{text}`. Incompatibilities come out as a code list.
    Unparenthesised OR binds tighter than AND. Sentences that condition on other
    programs go into `otherPrograms` and are not evaluated.
12. A course with any `unverifiable` leaf, or `parseStatus = "partial"`, shows a
    **"verify on P&C"** badge listing the unchecked text. The rest of its
    requisite is still evaluated.

**Timeline & feasibility**

13. There are exactly 8 terms, index 0–7: S1 2027, S2 2027, S1 2028, S2 2028,
    S1 2029, S2 2029, S1 2030, S2 2030.
14. Offering status per (course, term) is one of `offered`, `not-offered`,
    `projected` or `unknown`:
    - Years ≤ the catalogue horizon (the maximum offering year across all
      courses, currently 2028) use the scraped rows exactly.
    - Later years copy the sessions of the course's latest year that has rows,
      and are marked **projected**.
    - A course with no rows at all is **unknown** (FR34).
15. Each placed course (before or after the cutoff) has exactly one state:
    - **Hard-blocked** if any of these holds, with a specific reason:
      (a) its term is `not-offered`;
      (b) its requisite can't be met by any plan over earlier terms, evaluated
      recursively via `earliestTerm()`;
      (c) it is a two-semester course whose next term doesn't exist or is
      `not-offered`.
    - **Soft-blocked** if not hard-blocked, but the current placements don't
      satisfy its requisite.
    - **Available** otherwise.
16. Soft-blocked courses get suggestions. Each unmet course leaf that is in the
    catalogue gets one ("Place X in <term>", or "Move X to <term>" if X is
    already placed too late), and each OR alternative is listed separately. The
    target term is the earliest one before the dependent (same term allowed for
    concurrent leaves) where X isn't hard-blocked and term load plus X's units
    ≤ 24; failing that, the earliest non-hard-blocked term. Unmet unit leaves
    give a message instead: "Needs N more units of <filter> before <term>".
17. A place or move into a term where the course would be hard-blocked is
    **refused** (HTTP 409 with the reason). The UI greys those terms while
    dragging and disables them, with reasons, in "Place in…". A course that
    becomes hard-blocked later stays placed and renders greyed, with the reason
    as text and as a tooltip.
18. Each course can be placed at most once per plan. Placing it again moves it.
    Courses can be removed.
19. Two-semester courses (detected from descriptions containing "completed
    twice, in consecutive semesters", e.g. COMP4500 6+6 and COMP4550 12+12)
    occupy terms t and t+1 and move and remove as one unit.
20. Incompatible courses can both be placed. Both are flagged `conflictWith`. The
    one in the later term (tie: the alphabetically later code) is the **loser**
    and contributes no units to requirements, unit-count requisites or checks.
21. A term with more than 24 units shows a load warning in its header. This is
    not a block.
22. The cutoff is an integer 0–8 (the number of completed terms), defaults to 0,
    persists, and can be moved by drag and by keyboard-operable buttons. A course
    is **completed** iff its last term < cutoff.

**Requirements & progress**

23. Each placed, non-loser course counts toward at most one leaf group. The
    assignment maximises satisfied units (minimums first, then surplus) and
    respects `unitsRequired` and `unitsMax`. Ties break by tree order (Phase 05 §4.1).
24. A course can be **pinned** to an eligible group. Pins are respected and the
    rest re-solves. Pinning to an ineligible group returns 409. Every card shows
    the group it counts toward, or "Not counting toward any requirement".
25. Selectable groups (specialisation, capstone) show their options until one is
    chosen. An unchosen selectable group counts as unmet. Changing the choice
    keeps placements and re-allocates.
26. Every group, and the program total (192 units), has a two-segment progress
    bar (completed, planned).
27. Program-wide checks: at most 60 units at 1000-level; at least 48 units of
    4000-level COMP; at least 12 units of TDP-tagged courses, shown as
    "not tracked — verify on P&C" if no TDP source was found (FR36).

**UI**

28. The sidebar shows the requirement tree with progress bars, course cards per
    group, selectable choosers, program checks and course search.
29. A course card shows units, title, offered semesters, a short description,
    badges (state, verify, conflict, projected/unknown offering), the allocation
    label and a "Place in…" control.
30. The detail panel shows the full description, the P&C link, the requisite as
    an AND/OR tree with ✓/✗ per evaluable leaf and unverifiable leaves labelled,
    incompatibilities, `otherPrograms` notes, and the pin control.
31. Hover or focus on a placed course draws SVG connector lines to its
    prerequisite courses placed in earlier terms. Unplaced prerequisites appear
    as a badge ("2 prereqs not placed").
32. An empty plan shows 0-unit progress and the hint "Drag a course onto a
    semester, or use Place in…".

**Added during planning**

33. `/plan/example` is a fixed, **read-only** example plan, reset on every boot
    from `src/data/example-plan.ts`. `/` links to it. It shows a "This is an
    example — Start your own plan" banner, and mutations to it return 403.
34. A course with no published offerings is never hard-blocked on offering. It
    carries the badge "No published offering — verify on P&C".
35. Only undergraduate courses (code level digit 1–4) are seeded. Other codes in
    requisite text are still recognised, and can be added via search and fetch.
36. The scrape task spends at most about an hour looking for a TD filter on
    P&C's course search API. If one is found, `data/2027/tdp.json` records the
    tagged codes and their source. If not, it records `{ "courses": null }`, and
    the TDP check shows as not tracked. No tag is ever guessed.
37. `data/2026/` and `.venv/` are gitignored so they never get committed.

### 2.2 Non-functional requirements

- **Stack**: the starter's Astro 7 (server output, `@astrojs/node` standalone),
  Drizzle and SQLite on Fly. `fly.toml` and the `Dockerfile` are unchanged.
  Scraped data reaches the runtime by being bundled with `import.meta.glob`, so
  the Dockerfile doesn't need to copy it. Schema changes go `schema.ts` →
  `pnpm db:generate` → committed migration.
- **Harness stays green**: `spec/invariants.test.ts` over every route in
  `spec/routes.ts` (now including `/plan/example`) and `spec/readme.test.ts`.
- **CI deploy checks pass with `checks.yml` unedited**:
  - `/` returns 200
  - `/api/events` streams bytes
  - a same-origin form POST to `/` is not 403
  - a cross-site form POST to `/` is 403 (so `/` stays server-rendered)
  - internal links resolve
- **Accessibility**: every drag action has a keyboard, screen-reader and touch
  equivalent. States and reasons are available as text, not only as colour.
  axe finds no violations on `/`, `/readme/` or `/plan/example`.
- **Responsive**: at 375px the page doesn't scroll horizontally. The timeline
  scrolls within its own region.
- P&C is fetched only on an explicit search for an unknown code, never on page
  load. Requests carry a self-identifying User-Agent.
- Recomputing a plan view (feasibility, allocation, progress) for the example
  plan takes under 50 ms on a dev machine (unit-tested).

### 2.3 Out of scope

- Auth and accounts; plan privacy beyond an unguessable URL; copying plans.
- Programs other than AACOM; cohort years other than 2027; starting in S2.
- Summer, winter and spring sessions on the timeline (offerings store the session
  name, so these can be added later).
- Repeated or failed courses, part-time study, leave, credit; more than 8 terms.
- Checking WAM, marks, permission codes or supervisors (these become
  unverifiable leaves).
- Live sync between tabs (the SSE endpoint is kept as a heartbeat only).
- Auto-parsing program pages into requirement trees.
- `CLAUDE.md`, `PROCESS.md` and `reflections/crit-7.md`: these are C7
  deliverables, but outside this feature.

### 2.4 Assumptions

All confirmed with the user on 2026-09-26:

- Linear full-time progression with one cutoff line; 24 units per term is the
  load cap and the capacity bound for unit-count feasibility.
- 2029–30 offerings are projected, visibly.
- ML was merged into ARIN from 2027, so the specialisation options are ARIN,
  HCCC, SYAR and THCS.
- Strict single allocation overrides the brief's double-counting assumption, and
  filter groups are in v1. The README must say both.
- Courses are allocated whole. This corrects spec §4.5's "6-unit slots" wording
  so it agrees with FR23.
- Planning-phase rulings:
  - a read-only example plan (FR33)
  - a Preact island for the planner UI
  - time-boxed TD discovery, else untracked (FR36)
  - no-offering courses are placeable and badged (FR34)
  - undergraduate courses only (FR35)
- The P&C licence is unconfirmed. Scraped data is committed with attribution,
  and the limitation is stated in the README.
- A prerequisite code that isn't in the catalogue (e.g. `ENGN2219`) counts as
  **reachable** for hard-block purposes, since the app can't know it's
  impossible. For soft-block purposes it counts as **unmet** unless it's placed.
  This follows the spec's rule that the app never claims certainty it doesn't
  have. A hard block asserts impossibility, so it errs lenient.
- Parser precedence (OR binds tighter than AND) matches most P&C phrasings. The
  known exception is COMP4350, whose "either A or B and C" gets parsed too
  strictly. That is accepted, because over-strict parsing only produces a false
  soft-block.

## 3. Shared context & conventions

All verified by reading the repo on 2026-09-26. Each phase file carries the
file-level context it needs.

- **Stack** (node_modules): astro 7.3.3, @astrojs/node 11.1.6, vitest 4.1.10,
  drizzle-orm 0.45.2, drizzle-kit 0.31.10, better-sqlite3 13.0.3,
  typescript 6.0.3, vite 8.1.5, Node v24.18.1, pnpm 11.9.0.
- **Additions** (checked on the npm registry): `@astrojs/preact@^6.0.5` (peer
  `preact ^10.6.5`, needs vite ^8) and `preact@^10.29.8`, both in Phase 02;
  `node-html-parser@^9.0.4` in Phase 07. `jsdom` is a devDependency and is pruned
  from the production image, so it can't be used at runtime.
- **Commands**:
  - `pnpm test:unit`: the fast loop; Vitest `unit` project, no build, no server.
    It exists from Task 1 onward.
  - `pnpm check`: typecheck, build, and both Vitest projects. The `spec` project
    boots the built server via `spec/global-setup.ts`.
  - `pnpm db:generate`: turns a `src/lib/schema.ts` diff into a migration.
- **Code conventions**:
  - 2-space indentation, double quotes, semicolons.
  - `//` comments explain *why*, at the density of the starter files.
  - Astro pages use `<html lang="en-AU">`, a viewport meta tag,
    `<nav aria-label="site">` and exactly one `<h1>`.
  - API routes are typed `APIRoute` from `astro`.
  - Migrations are generated, never hand-written.
- **Layering rule**:
  - `src/lib/domain/**` and `src/lib/catalogue/**` are pure. They never import
    `src/lib/db.ts`, which opens and seeds the real database as a side effect
    of being imported.
  - `src/lib/repo.ts` takes an explicit `db: Db` parameter.
  - Only `src/lib/plan-service.ts` and API routes import `db` from `db.ts`.
- **Tests**:
  - Unit tests: `src/**/*.test.ts`. They read the committed `data/2027/**` with
    `node:fs` as real fixtures.
  - HTTP spec tests: `spec/*.test.ts`. They use
    `const baseUrl = inject("baseUrl")`; POSTs send `headers: { origin: baseUrl }`
    and `redirect: "manual"`.
  - Don't edit `spec/invariants.test.ts`.
- **Every task** ends with `pnpm check` green and a commit. Commit messages end
  with the session's `Co-Authored-By` attribution line.
- **Outward-facing actions** (the first deploy, making the repo public) need the
  user's go-ahead in chat.

## 4. Shared design

Phase-specific design lives in each phase file: the AACOM tree is in 01,
feasibility and evaluation in 04, the allocation algorithm in 05.

### 4.1 Architecture

```
offline: scripts/scrape-2027.sh ──anu-pandc──▶ data/2027/**.json (committed)
                                                   │ import.meta.glob (bundled)
src/data/aacom-2027.ts (tree) ─┐                   ▼
src/data/example-plan.ts ──────┼──▶ src/lib/seed.ts ──▶ SQLite reference tables
                               │                        + example plan
runtime:                       │
 HTTP ─▶ src/pages/api/** ─▶ src/lib/plan-service.ts ─▶ src/lib/repo.ts (DB)
                                  │
                                  ▼  pure, no DB imports
              src/lib/domain/{terms,requisites,feasibility,evaluate,allocation,view}.ts
                                  │ PlanView (plain JSON)
 /plan/[id].astro ─ SSR ─▶ <Planner client:load view={…}/> (Preact) ─ fetch ─▶ API ─▶ new PlanView
```

The server is the single source of truth. Every mutation endpoint returns the
recomputed `PlanView`, and the Preact island re-renders from it. Hard-block is
**plan-independent**: it depends only on the course, the term and the catalogue.
So `PlanView.courses[code].hardBlocked` (a per-term reason map) gives the client
instant drag feedback without duplicating any logic. Only soft-blocking,
conflicts, allocation and progress depend on the plan.

*Rejected alternatives*: vanilla TS DOM patching (markup duplicated between the
Astro server render and client-side rendering); Python in the Docker image;
scraping at first boot; Vitest over the dev server. Spec-level alternatives are
recorded in the spec.

### 4.2 Domain types (`src/lib/domain/types.ts`)

```ts
export type Session = "S1" | "S2";
export interface Term { index: number; year: number; session: Session; label: string } // label "S1 2027"
export interface CourseFilter {
  prefixes?: string[]; minLevel?: number; maxLevel?: number;
  codes?: string[]; excludeCodes?: string[]; tdp?: boolean;
}
export type ReqExpr =
  | { kind: "and"; items: ReqExpr[] }
  | { kind: "or"; items: ReqExpr[] }
  | { kind: "course"; code: string; concurrent: boolean }
  | { kind: "units"; units: number; filter: CourseFilter; text: string }
  | { kind: "program"; code: string | null; name: string; satisfied: boolean }
  | { kind: "unverifiable"; text: string };
export interface ParsedRequisites {
  prereq: ReqExpr | null; incompatible: string[];
  unverifiable: string[]; otherPrograms: string[]; parseStatus: "ok" | "partial";
}
export interface Offering { year: number; session: string } // session verbatim, e.g. "First Semester"
export interface CatalogueCourse {
  code: string; title: string; units: number; level: number; description: string; url: string;
  offerings: Offering[]; requisites: ParsedRequisites; requisiteRaw: string;
  twoSemester: boolean; isTdp: boolean; isStub: boolean; scrapedAt: string;
}
export interface Catalogue { courses: Map<string, CatalogueCourse>; horizonYear: number }
export type OfferingStatus = "offered" | "not-offered" | "projected" | "unknown";
export interface Placement { code: string; term: number; pinnedGroupId: string | null }
export interface PlanState {
  id: string; readOnly: boolean; cutoff: number;
  choices: Record<string, string>; // selectable groupId -> chosen child groupId
  placements: Placement[];
}
export type GroupKind = "core" | "major" | "minor" | "specialisation" | "elective";
export type RuleType = "ALL" | "UNITS" | "CHOOSE_N";
export interface GroupDef {
  id: string; label: string; kind: GroupKind; ruleType: RuleType;
  unitsRequired: number; unitsMax?: number; selectable?: boolean;
  courses?: string[]; filter?: CourseFilter; children?: GroupDef[];
}
export interface ProgramCheckDef { id: string; label: string; bound: "min" | "max"; units: number; filter: CourseFilter }
export interface ProgramDef {
  code: string; name: string; year: number; totalUnits: number;
  groups: GroupDef[]; checks: ProgramCheckDef[]; tdpCourses: string[] | null;
}
```

### 4.3 Plan view (`src/lib/domain/view.ts`)

```ts
export interface GroupView {
  id: string; label: string; kind: GroupKind; ruleType: RuleType;
  unitsRequired: number; unitsMax: number | null; selectable: boolean;
  chosenId: string | null; options: { id: string; label: string }[];
  completed: number; planned: number; satisfied: boolean;
  courses: string[]; filterLabel: string | null; missing: string[]; children: GroupView[];
}
export interface CheckView { id: string; label: string; bound: "min" | "max"; units: number; completed: number; planned: number; ok: boolean | null } // null = not tracked
export interface CourseCard {
  code: string; title: string; units: number; level: number; description: string; url: string;
  twoSemester: boolean; isStub: boolean; offeredLabel: string; // e.g. "S1, S2" / "S2 (projected 2029–30)" / "No published offering"
  offeringUnknown: boolean; verify: string[]; otherPrograms: string[]; incompatible: string[];
  requisiteRaw: string; prereq: ReqExpr | null;
  hardBlocked: Record<number, string>; projectedTerms: number[]; eligibleGroups: string[];
}
export interface PlacementView extends PlacementEval { countsToward: string | null; pinned: boolean }
export interface PlanView {
  plan: { id: string; readOnly: boolean; cutoff: number };
  terms: { index: number; label: string; units: number; overload: boolean }[];
  placements: PlacementView[];
  groups: GroupView[]; checks: CheckView[];
  total: { required: number; completed: number; planned: number };
  courses: Record<string, CourseCard>; // every course in the tree lists, placed, or prerequisite-referenced and in the catalogue
}
export function buildPlanView(cat: Catalogue, program: ProgramDef, plan: PlanState): PlanView;
export function courseCard(cat: Catalogue, program: ProgramDef, choices: Record<string, string>, code: string): CourseCard; // Task 13, used by search
```

### 4.4 HTTP API contract

Mutating JSON endpoints answer:
- `200` with a `PlanView` body, or
- `{ "error": string }` with status 400 (bad input), 403 (read-only plan),
  404 (unknown plan or course) or 409 (hard-blocked placement, or ineligible pin
  target).

All JSON responses carry `content-type: application/json`.

| Method & path | Body / query | Success | Introduced |
| --- | --- | --- | --- |
| `POST /api/plans` | HTML form, no fields | `303` → `/plan/<22-char id>` | Task 7 |
| `POST /api/plans/[id]/placements` | `{ "code": string, "term": 0..7 }`, which places or moves | `200 PlanView` | Task 7 (409 from Task 10) |
| `DELETE /api/plans/[id]/placements/[code]` | — | `200 PlanView` | Task 7 |
| `PUT /api/plans/[id]/cutoff` | `{ "cutoff": 0..8 }` | `200 PlanView` | Task 13 |
| `PUT /api/plans/[id]/choices` | `{ "groupId": string, "childId": string \| null }` | `200 PlanView` | Task 13 |
| `PUT /api/plans/[id]/pins` | `{ "code": string, "groupId": string \| null }` (null = automatic) | `200 PlanView` | Task 13 |
| `GET /api/courses/search` | `?q=<text>&plan=<id?>` | `200 { status: "found" \| "fetched" \| "not_found" \| "error" \| "invalid"; courses: CourseCard[]; message?: string }` | Task 16 |
| `GET /api/events` | — | `text/event-stream`; first bytes `: connected\n\n` | Task 5 |

Pages:
- `/`: explainer, start form, link to the example plan.
- `/plan/[id]`: the planner, or a "Plan not found" page with status 404.
- `/plan/example`: read-only.
- `/readme/`: the README.

## 5. Phases

Run the phases in order. Each phase lists its prerequisites and ends green and
committed.

| Phase | File | Tasks | Needs | Ends with | Done |
| --- | --- | --- | --- | --- | --- |
| 01 | `…-01-data-foundations.md` | 1–4 | — | Committed 2027 data, the AACOM tree file, and the Vitest unit project; **user reviews the tree** | [x] |
| 02 | `…-02-persistent-skeleton.md` | 5–7 | 01 | Schema, seed, example plan, plan CRUD, first Preact page; **deploy checkpoint** (the crit's mechanical spec lines are met) | [x] |
| 03 | `…-03-requisites-offerings.md` | 8–9 | 01, 02 | Requisite parser (wired into the seed) and offering status/projection | [x] |
| 04 | `…-04-feasibility.md` | 10–11 | 03 | Hard/soft blocking, conflicts, suggestions, load; the API refuses hard-blocked placements | [x] |
| 05 | `…-05-allocation-view.md` | 12–13 | 04 | Allocation solver, the full `PlanView`, and the cutoff/choice/pin APIs | [ ] |
| 06 | `…-06-planner-ui.md` | 14–15 | 05 | Interactive planner UI, detail panel and overlay; **user reviews the UI** | [ ] |
| 07 | `…-07-search-readme.md` | 16–17 | 05, 06 | Runtime P&C fetch, search, README; **user reviews the README**; feature-level Definition of Done (§6) | [ ] |

## 6. Feature-level Definition of Done

- [ ] Every phase in §5 is ticked, and all 17 tasks are complete with tests passing
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes (typecheck, build, unit and spec projects)
- [ ] Manually verified on the deployed `https://comp4020-crit7-attwelvedev.fly.dev`,
  in Chrome at 1280 px and 375 px:
  - create a plan
  - drag COMP1130 to S1 2027
  - try COMP3630 in S1 2027 (refused, with the 24-unit reason)
  - place COMP2100 alone (soft, with a working suggestion)
  - place COMP1100 with COMP1130 (conflict)
  - move the cutoff
  - choose ARIN and pin a course
  - reload (everything persists)
  - open `/plan/example` (read-only)
  - search and fetch an uncached code
  - the CI deploy probes pass
- [ ] Every requirement in §2 is covered (see §7)
- [ ] Tasks 4, 14, 15 and 17 (`Human review:`) have been shown to the user and
  explicitly accepted
- [ ] No item remains in §8

## 7. Requirements coverage check

| Requirement | Covered by |
| --- | --- |
| FR1 create plan + redirect | Task 7 |
| FR2 plan page / 404 | Task 7 |
| FR3 persistence | Tasks 7, 13 |
| FR4 URL editing, no auth | Task 7 |
| FR5 /readme/ | Tasks 7 (layout), 17 |
| FR6 heartbeat SSE, guestbook removed | Task 5 |
| FR7 scrape script + SOURCE | Task 2 |
| FR8 hand-curated tree | Task 4 |
| FR9 idempotent boot seed | Task 6 |
| FR10 search + runtime fetch | Task 16 |
| FR11 requisite parser | Task 8 |
| FR12 verify badge | Tasks 8, 11 (`verify`), 15 (UI) |
| FR13 8 terms | Task 1 |
| FR14 offering status/projection | Task 9 |
| FR15 hard/soft/available | Tasks 10, 11 |
| FR16 suggestions | Task 11 (logic), 14 (buttons) |
| FR17 refused drops, greyed UI | Task 10 (409), 14 (UI) |
| FR18 place-once / move / remove | Task 7 |
| FR19 two-semester courses | Tasks 3 (detect), 10, 11, 12 |
| FR20 incompatibility conflicts | Task 11 (logic), 12/13 (excluded from allocation), 15 (badge) |
| FR21 load warning | Tasks 11, 14 |
| FR22 cutoff | Tasks 13 (API), 14 (UI) |
| FR23 single optimal allocation | Task 12 |
| FR24 pins | Tasks 12, 13, 15 |
| FR25 selectable groups | Tasks 12, 13, 14 |
| FR26 two-segment bars | Tasks 13, 14 |
| FR27 program checks | Task 13 |
| FR28 sidebar | Task 14 |
| FR29 course card | Task 14 |
| FR30 detail panel | Task 15 |
| FR31 overlay | Task 15 |
| FR32 empty state | Task 14 |
| FR33 read-only example plan | Tasks 6, 7 |
| FR34 no-offering badge | Tasks 9, 10, 15 |
| FR35 undergrad seed | Tasks 3, 6 |
| FR36 TDP time-box | Tasks 2, 4, 13 |
| FR37 gitignore | Task 2 |
| NFR stack / Dockerfile unchanged / bundled data | Tasks 5, 6, 7 |
| NFR harness green, routes | Tasks 5, 7 |
| NFR CI deploy probes | Tasks 5, 7 (deploy checkpoint) |
| NFR accessibility | Tasks 7, 14, 15 (axe + keyboard); human review 14/15 |
| NFR responsive 375 px | Task 14 (+ human review) |
| NFR fetch only on search, UA | Task 16 |
| NFR performance < 50 ms | Tasks 12, 13 |

## 8. Risks / open questions

None. Risks accepted during the design are recorded in the spec's §6: P&C HTML
may change (the fetcher fails gracefully), TDP tracking may end up untracked,
and projections may be wrong.
