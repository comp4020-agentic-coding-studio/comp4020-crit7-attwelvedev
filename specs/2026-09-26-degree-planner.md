# ANU Degree Planner (AACOM 2027)

- **Date:** 2026-09-26
- **Status:** Approved
- **Approved by user:** yes — 2026-09-26

Source brief: `prompts/degree-planner-design-brief.md`. This spec refines and,
where noted, **overrides** that brief. Crit: C7 "Build the ANU system you wish
existed" (course site `crits/07-anu-system/`).

## 1. Problem / intent

ANU students plan their degree against requirements published on
programsandcourses.anu.edu.au (P&C), which has no API and no planning tool.
Working out what's satisfied, what's merely planned, and what's blocked (and
*why*) is manual and error-prone. This app is a full-stack replacement for that
slice: a student opens a plan for the **Bachelor of Advanced Computing
(Honours) (AACOM), 2027 cohort, starting Semester 1**, drags courses from a
requirement sidebar onto an 8-semester timeline, and sees per-requirement
progress (completed vs planned) and per-course feasibility (available /
soft-blocked / hard-blocked with a specific reason). Plans persist and are
shareable by URL.

The C7 spec lines this must meet: loads at its `*.fly.dev` URL by the cutoff;
models a real ANU system slice wired end to end; the core flow persists across
reload; process evidence (commits, `PROCESS.md`, `reflections/crit-7.md`).

## 2. Requirements

### 2.1 Functional requirements

**Plans & persistence**

1. `/` shows a short explainer and a **Start a new plan** control; submitting it
   (POST) creates a plan with an unguessable random id and redirects to
   `/plan/<id>`.
2. `/plan/<id>` renders the planner from the database. An unknown id returns a
   404 page.
3. Every plan mutation (place, move, remove, cutoff move, selectable-group
   choice, pin) is saved to the server immediately; reloading shows identical
   state.
4. Anyone with a plan URL can view and edit it (no auth).
5. `/readme/` continues to serve the whole of `README.md`.
6. A minimal `/api/events` endpoint remains, which responds as an SSE stream and
   immediately sends an opening comment (keeps the CI deploy check green). The
   guestbook (messages table, UI, API) is removed.

**Catalogue data**

7. An offline, committed Python script uses the installed `anu-pandc` to scrape
   **2027** data: the AACOM program page, the ARIN/HCCC/SYAR/THCS
   specialisations, every course they name, every course on the ICT list, and
   the full 2027 COMP catalogue. Raw JSON is committed under `data/2027/` with a
   source/attribution note.
8. A hand-curated, committed AACOM 2027 requirement-tree file defines the tree
   (§4.2), cross-checked against the scraped program page, and includes a
   hand-curated list of Transdisciplinary Problem-Solving (TDP) tagged courses.
9. A seed step loads the committed data into SQLite (idempotently; reference
   data may be refreshed on each deploy without touching user plan data).
10. Course search: entering a course code finds it in the DB. If the code is
    well-formed (`[A-Z]{4}\d{4}`) and not in the DB, the server fetches that
    course's 2027 P&C page, parses it in TypeScript (title, units, level,
    description, requisite text, incompatibilities, offerings), and caches it
    (`is_stub`, `scraped_at`). Outcomes: found → card; P&C says no such page →
    "No 2027 course with that code"; network/parse failure → error message,
    nothing cached; partial requisite parse → cached with the verify badge.

**Requisites**

11. A single TypeScript requisite parser is used both at seed time (on
    `anu-pandc`'s raw requisite text) and at runtime (on fetched pages). It
    produces an AND/OR expression tree whose leaves are:
    - `course(code, allowConcurrent)`: `allowConcurrent` is true when the text
      says "completed or (be) currently enrolled in";
    - `units(n, prefix?, level?)`: e.g. "24 units of COMP coded courses",
      "6 units of 1000 level MATH";
    - `program(code)`: enrolment clauses; true iff the code is AACOM;
    - `unverifiable(text)`: anything else (WAM, permission code, supervisor…).
    Incompatibilities are parsed into a list of course codes.
12. Any course with an `unverifiable` leaf, or whose text failed to parse, shows
    a **"verify on P&C"** badge listing what was not checked; the evaluable
    remainder is still checked. The app never presents unchecked requisites as
    satisfied.

**Timeline & feasibility**

13. The timeline has exactly 8 terms: S1 2027, S2 2027 … S1 2030, S2 2030.
14. Offerings for 2027–2028 come from P&C. For 2029–2030 each course is assumed
    to run in the same semesters as in its latest known year; such cells carry a
    visible "projected offering" marker.
15. Every placed course (before or after the cutoff) gets exactly one state:
    - **Hard-blocked**, with a specific human-readable reason, if any of:
      (a) not offered (known or projected) in its term; (b) its evaluable
      requisite cannot be met by *any* hypothetical plan over earlier terms
      (same term allowed for `allowConcurrent` leaves) — evaluated
      recursively/transitively per §4.4; (c) it is a two-semester course with
      no consecutive following term.
    - **Soft-blocked** if not hard-blocked but the *current* plan does not
      satisfy its evaluable requisite.
    - **Available** otherwise.
16. Soft-blocked courses offer suggestions: for each unmet course leaf (each OR
    alternative listed separately) a one-click "Place X in <term>" where term =
    the earliest term in which X would not be hard-blocked and which has < 24
    units placed (else the earliest non-hard-blocked term). Unmet unit leaves
    show a message such as "needs 12 more units of COMP before S1 2028" with no
    one-click action.
17. Dropping (or choosing via "Place in…") a course into a term where it would
    be hard-blocked is **refused**; while dragging, those terms are greyed with
    their reason, and the same terms are disabled with reasons in "Place in…".
    A placed course that later becomes hard-blocked (e.g. a prereq moved) stays
    placed, rendered greyed with a tooltip giving the reason.
18. A course can be placed at most once per plan; placing it again moves it.
    Courses can be moved between terms and removed (drag back to sidebar, or a
    remove control).
19. Two-semester courses (e.g. COMP4550 12+12, COMP4500 6+6, and any others the
    tree identifies) occupy two linked consecutive terms, are placed/moved/
    removed together, and are hard-blocked if the second term doesn't exist.
20. Placing incompatible courses together (e.g. COMP1100 + COMP1130, COMP4550 +
    COMP4500) is allowed; both are flagged as conflicting, and only one of them
    contributes units to requirements.
21. A term with more than 24 units placed shows a load warning in its header
    (not a block).
22. The **completion cutoff line** sits between terms, is movable by drag and by
    keyboard-operable controls, defaults to before S1 2027, and persists. Courses
    before it are "completed", after it "planned".

**Requirements & progress**

23. Each placed course counts toward **at most one** leaf requirement group
    (strict single allocation), solved to maximise satisfied units across groups
    (§4.5), respecting each group's `units_required` and optional `units_max`.
    Ties break by the tree's group order.
24. From a course's detail panel the student can **pin** it to a specific
    eligible group; pins are respected and everything else re-solves. Each card
    shows which group it currently counts toward; units counting toward no group
    are shown as such.
25. Selectable groups (specialisation; capstone) show their options until the
    student chooses one; unchosen, they count as unmet. Changing the choice keeps
    placed courses and re-allocates.
26. Every group, and the program overall (192 units), shows a **two-segment
    progress bar**: completed units and planned units as visually distinct
    segments.
27. Program-wide checks are shown and evaluated over the whole plan: max 60 units
    at 1000-level; min 48 units of 4000-level COMP; min 12 units of TDP-tagged
    courses.

**UI**

28. Sidebar: requirement tree with progress bars, course cards per group, the
    selectable-group choosers, program-wide checks, and the course search box.
29. Course card: units, title, offered semesters, brief description, state and
    verify/conflict/projected badges, allocation label, and a **"Place in…"**
    control.
30. Detail view: full description, link to the official P&C course page, the
    requisite as a compact AND/OR tree with ✓/✗ per evaluable leaf and
    unverifiable leaves labelled, incompatibilities, and the pin control.
31. Hover or keyboard focus on a placed course draws thin connector lines on the
    timeline to its prerequisite courses placed in earlier terms; unplaced
    prerequisites show as a small badge instead.
32. Empty plan state: groups show 0-unit progress and a hint to drag a course or
    use "Place in…".

### 2.2 Non-functional requirements

- Stack: the starter's Astro (server output, Node adapter) + Drizzle + SQLite on
  Fly (`fly.toml`, `Dockerfile` shape unchanged; one 256 MB machine). Schema
  changes go through `src/lib/schema.ts` → `pnpm db:generate` → committed
  migration.
- The spec harness stays green: `spec/invariants.test.ts` (landmark, one h1,
  lang, title, viewport, alt text, axe floor) over every route listed in
  `spec/routes.ts` — new pages must be added there; `spec/readme.test.ts`. The
  guestbook test retires with the guestbook.
- CI deploy checks stay green unedited: `/` returns 200; `/api/events` streams
  bytes immediately; same-origin form POST to `/` not 403; cross-site POST to
  `/` is 403 (so `/` must stay server-rendered, not prerendered); internal links
  resolve.
- Accessibility: every drag action has a keyboard/screen-reader/touch equivalent
  ("Place in…", cutoff controls); hard-block reasons are available as text, not
  only colour/greying.
- Responsive: usable at mobile width; the timeline scrolls horizontally within
  its region rather than the page.
- Runtime fetch to P&C is per-code, on demand, and never on page load.
- Feasibility/allocation recomputation must feel instant at this scale
  (~8 terms, ~50 placed courses, a few hundred catalogue courses).

### 2.3 Out of scope

- Authentication/accounts; plan privacy beyond an unguessable URL.
- Programs other than AACOM; cohort years other than 2027; start in S2.
- Summer/winter sessions on the timeline (the offering model stores session so
  they can be added later).
- Repeated/failed courses, part-time load, leave, cross-institution credit
  (single cutoff-line model).
- More than 8 terms.
- Checking WAM, permission codes, supervisors or other non-course conditions
  (shown via the verify badge).
- Live sync between tabs/users (SSE endpoint kept only as a heartbeat).
- Auto-parsing program pages into requirement trees (tree is hand-curated).
- Offline scraping of the whole ANU catalogue (runtime fallback covers
  non-seeded codes).

### 2.4 Assumptions (confirmed)

- Linear, uninterrupted, full-time progression represented by one cutoff line —
  from the brief; confirmed.
- 2029–2030 offerings follow each course's latest known pattern — confirmed
  (projected, visibly marked).
- 24 units/term is the full-time load, used for warnings and as the capacity
  bound in unit-count feasibility — confirmed.
- ANU's Machine Learning specialisation was merged into Artificial Intelligence
  (ARIN-SPEC) from 2027: MACL-SPEC 2027 is a 404 and 2027 ARIN-SPEC contains
  every 2026 ARIN and MACL course plus COMP3242. The AACOM 2027 page's
  "Machine Learning" line is stale. Confirmed by the user and by the data.
- **Overrides brief §7:** strict single allocation replaces "a placed course
  satisfies every group it's listed under". README must state this.
- **Overrides brief §8:** rule-based (filter) requirement groups are in v1,
  because AACOM cannot be tracked without them.
- P&C data licence is unconfirmed; scraped data is committed with attribution
  and the limitation stated in README — confirmed.

## 3. Existing context

- Starter (`comp4020-agentic-coding-studio/template-dynamic`): Astro 7 server
  output with `@astrojs/node` standalone (`astro.config.ts`, `allowedDomains`
  `**.fly.dev`); Drizzle + better-sqlite3 (`src/lib/db.ts` runs migrations at
  boot; `DATABASE_PATH` = `/data/app.db` on the Fly volume, `./.data/app.db`
  locally); guestbook demo in `src/lib/schema.ts` (`messages`),
  `src/pages/api/messages.ts`, `src/pages/api/events.ts`, `src/lib/events.ts`,
  `src/pages/index.astro`; `src/pages/readme.astro` serves README.
- Spec harness: `spec/global-setup.ts` boots the built server with a throwaway
  DB; `spec/routes.ts` is the explicit route list for `invariants.test.ts`;
  `spec/guestbook.test.ts` retires with the starter. `pnpm check` = typecheck +
  build + vitest.
- CI `.github/workflows/checks.yml`: runs checks + `check:evidence` + secret
  scans once public; deploy job verifies `/` 200, `/api/events` streams,
  same-origin POST not 403, cross-site POST 403, internal links.
- `Dockerfile` is Node 24 slim only — **no Python** in the runtime image, hence
  the TS runtime fetcher.
- `anu-pandc` 0.3.1 in `.venv/` (Python): `get CODE --year 2027 [--json]
  [--save DIR] [--recursive]`, `catalogue COMP --year 2027`, `offerings`.
  Course JSON has `code, title, units, level, prerequisites, prerequisite_codes
  (flat, AND/OR lost), incompatibilities, requisite_raw, cotaught, description,
  offerings[{year, semester, mode, class_number}]`. Offerings on 2027 pages list
  2027 and 2028 only. The Transdisciplinary tag is not a structured field (only
  occasional description text, e.g. SCOM3029, COMP4500, ENGN2300).
- Untracked `data/2026/` holds 2026 BCOMP/HCOMP/AACRD scrapes — not the target
  program/year; not used and not committed.
- AACOM 2027 structure (live P&C, 2026-09-26): 192 units; ≤60u 1000-level;
  ≥48u 4000-level COMP; ≥12u TDP; choose one of COMP1100/COMP1130; one of
  COMP1110/COMP1140; one of MATH1005/MATH2222; 48u compulsory (COMP2100, 2120,
  2300, 2310, 2400, 3600, 3630, 4450); 24u from one specialisation (ARIN, HCCC,
  SYAR, THCS); 18u 3000/4000-level COMP; 12u from the ICT list (19 courses);
  capstone Either COMP4550 (12+12) OR COMP4500 (6+6) + 12u further 4000-level
  COMP OR COMP4820 (12u) + 12u further 4000-level COMP; ≥48u electives.
- 2027 ARIN-SPEC: 24u, ≥12u 4000-level; max 12u from {COMP2620, 3242, 3620,
  3670}; min 12u from {COMP4528, 4620, 4650, 4670, 4680, 4691}.
- Example requisite texts: COMP3600 "24 units of COMP coded courses AND (6 units
  of MATH OR COMP1600)"; COMP4550 includes "completed or currently enrolled in
  COMP4450", WAM and permission-code clauses; COMP4450 includes program
  enrolment clauses including AACOM.

## 4. Design

### 4.1 Data pipeline

`scripts/` Python scrape (offline, dev machine, `.venv`) → `data/2027/*.json`
(committed, attributed) + hand-curated `AACOM-2027` tree file (committed) → TS
seed step (runs the TS requisite parser over `requisite_raw`) → SQLite reference
tables. Runtime fallback: TS fetcher + the same parser → same tables with
`is_stub`/`scraped_at`.

*Alternatives rejected:* Python in the Docker image (bigger image on 256 MB,
deviates from starter); scraping at first boot (first boot depends on P&C);
seed-only with no fallback (user chose fallback for coverage).

### 4.2 Data model

Following brief §3, with changes:

- `PROGRAM(id, code, name, total_units)`.
- `REQUIREMENT_GROUP(id, program_id, parent_id, label, kind, rule_type
  ALL|UNITS|CHOOSE_N, units_required, units_max?, selectable, order,
  filter?)` — `filter` = {subject prefixes?, min_level?, max_level?} or "any";
  explicit lists use `REQUIREMENT_COURSE`. Selectable nodes: specialisation
  (children ARIN, HCCC, SYAR, THCS subtrees) and capstone (three option
  subtrees).
- `PROGRAM_CHECK` (or equivalent) for program-wide constraints: max 60u
  1000-level, min 48u 4000-level COMP, min 12u TDP.
- `COURSE(id, code, title, units, level, description, url, is_tdp, is_stub,
  scraped_at, parse_status)`; two-semester courses identified (e.g.
  `split_terms` = 2 with per-term units).
- `COURSE_OFFERING(course_id, year, session, mode)`.
- `COURSE_REQUISITE(course_id, req_type prereq|coreq|incompatible, expression
  JSON, raw_text)`.
- `PLAN(id random, program_id, cohort_year, start_session, cutoff_index,
  created_at)` — the brief's USER_PROGRAM, keyed by plan id instead of user.
- `PLAN_GROUP_CHOICE(plan_id, group_id, chosen_child_id)`.
- `PLAN_COURSE(plan_id, course_id, term_index, pinned_group_id?)` — the brief's
  USER_COURSE_STATUS; completed/planned is derived from `cutoff_index`, not
  stored.

Exact column names/types are left to planning.

### 4.3 Requisite parser

Tokenise requisite text; recognise course codes, `AND`/`OR`/parentheses, "N
units of [level] PREFIX", "N units of PREFIX coded courses", program-enrolment
phrases, and "completed or (be) currently enrolled in". Anything not recognised
becomes `unverifiable(text)` at the smallest enclosing position. Must be tested
against real texts from the seeded catalogue (every seeded course either parses
or yields explicit unverifiable leaves, never a silent drop).

### 4.4 Feasibility

- `reachable(course X, before term t, allowSame)`: exists t' < t (≤ t if
  allowSame) where X is offered (known/projected) and X's evaluable requisite is
  reachable before t'; memoised on (X, t); a course encountered on its own
  recursion stack is unreachable (cycles).
- `units(n, prefix, level)` reachable before t iff the sum of units of reachable
  matching courses before t ≥ n **and** n ≤ 24 × (number of terms before t).
- AND = all children reachable; OR = any; `program` = constant; `unverifiable` =
  treated as satisfied for feasibility (but badged).
- Hard-block (a)/(b)/(c) per FR15; reason strings name the specific failing leaf
  and, for transitive failures, the chain (e.g. "Needs COMP2310, which can't be
  completed before S1 2028: only offered in S2, and requires COMP2300").
- Soft-block: evaluate the expression against actual placements (earlier terms,
  or same term for concurrent leaves; incompatible duplicates don't double
  count).
- Recomputed on every mutation. Server-side is the source of truth for refused
  drops; the client may compute the same for instant drag feedback.

### 4.5 Allocation

Split each placed, non-conflicting course's units into 6-unit slots. Build a
bipartite graph slot → eligible leaf group (explicit list membership or filter
match, within the chosen selectable options only). Solve max assignment subject
to group capacities (`units_required`, capped by `units_max` where set); break
ties by group order; pinned courses are fixed to their pinned group first.
Report completed vs planned units per group from the assignment. Program-wide
checks are computed independently over all placed courses.

*Alternatives rejected:* the brief's double-counting (filter groups over-report);
fixed-order greedy (misallocates, e.g. MATH1013 between the maths and ICT
lists).

### 4.6 UI

Astro server-rendered pages with client-side interactivity for drag-and-drop,
overlay and live recomputation (framework choice left to planning). Routes:
`/`, `/plan/[id]`, `/readme/`, `/api/events`, plus plan-mutation and course
search/fetch API endpoints. Layout per brief §4: sidebar + 8-column timeline,
cutoff line, two-segment bars, cards, detail panel, hover/focus overlay (SVG).

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | contradiction | `data/2026/` holds 2026 AACRD/HCOMP/BCOMP, not AACOM 2027 | Re-scrape 2027 (confirmed available live); 2026 data unused |
| 2 | contradiction | Brief defers rule-based lists, but AACOM needs "18u 3000/4000 COMP", "12u further 4000 COMP", "48u electives", global caps | Filter groups + program-wide checks in v1 |
| 3 | gap | Requisite text includes unit counts, program enrolment, WAM, permission codes; anu-pandc loses AND/OR | TS parser: codes + unit counts + program clauses; rest → verify badge, remainder still checked |
| 4 | gap | P&C offerings only cover 2027–2028; degree runs to 2030 | Project latest pattern for 2029–30, visibly marked; used for hard-blocks |
| 5 | contradiction | Lazy fetch vs Node runtime / Python scraper | Pre-seed wide via anu-pandc + TS runtime fallback fetcher |
| 6 | gap | Brief's USER_* tables but no auth in starter | Shareable unguessable plan URL; no auth |
| 7 | gap | TDP tag has no structured source | Hand-tag in seed |
| 8 | gap | Two-semester courses, incompatibilities, load cap, same-semester co-reqs | All four in v1 |
| 9 | contradiction | Brief's double-counting vs filter groups over-reporting | Strict single allocation (overrides brief §7) |
| 10 | ambiguity | How single allocation chooses between eligible groups | Optimal assignment + manual pin |
| 11 | gap | Tree source: markdown flattens Either/OR | Hand-curated tree file; course data scraped |
| 12 | ambiguity | "Greyed out" for hard-block: drop allowed or refused? Completed courses checked? | Drop refused (greyed during drag); later-blocked stays placed greyed; completed courses also checked |
| 13 | gap | Committing scraped data to a repo that goes public; licence unknown | Commit with attribution; limitation in README |
| 14 | gap | Drag-and-drop not keyboard/touch accessible | "Place in…" control on each card; keyboard cutoff controls |
| 15 | gap | Live sync scope; CI checks `/api/events` streams | No live sync; keep minimal `/api/events` heartbeat endpoint; remove guestbook |
| 16 | contradiction | AACOM page lists ML specialisation, MACL-SPEC 2027 is 404 | ML merged into ARIN from 2027 (user; verified in data); 4 options |
| 17 | gap | 2027 ARIN is "max 12u list A + min 12u list B"; schema can't express a max | `units_max` on REQUIREMENT_GROUP, respected by allocation |
| 18 | gap | Empty-plan state | 0-unit progress + hint to drag or use "Place in…" |
| 19 | gap | Suggestion target term for soft-block | Earliest non-hard-blocked term under 24u load, else earliest non-hard-blocked |
| 20 | gap | Unknown plan id, fetch failures, requisite cycles, two-semester in last term | 404; clear errors and no caching; cycles unreachable; hard-block |

## 6. Handoff notes for planning

- Time budget: **3–5 days**. Suggested sequencing: (1) scrape + hand-curated tree
  + schema/seed; (2) requisite parser tested against the real seeded texts;
  (3) plan CRUD + persistence + routes (earliest point the C7 spec's "persists
  across reload" is met — deploy here); (4) feasibility engine; (5) allocation +
  progress; (6) planner UI (drag, Place in…, cutoff, bars, detail, overlay);
  (7) runtime fallback fetcher; (8) README/limitations. Keep deploys green
  throughout.
- The feasibility engine, parser and allocation solver are pure logic — ideal
  for TDD with fixtures drawn from the real 2027 data (e.g. COMP3600 in S1 2027
  → hard-blocked by the 24-unit clause; COMP3670 in S1 → not offered).
- Keep `/` server-rendered (CSRF CI check) and `/api/events` streaming.
  Add new pages to `spec/routes.ts`. Retire `spec/guestbook.test.ts` with the
  guestbook.
- Do **not** re-litigate: strict single allocation, filter groups in v1,
  hand-curated tree, shareable URL w/o auth, TS runtime fallback, refused drops,
  completed courses checked, projected 2029–30 offerings, ML→ARIN merge, heartbeat
  SSE endpoint.
- Accepted risks: P&C HTML may change (fallback fetcher breaks gracefully with an
  error); hand-curated TDP tags may be incomplete; projected offerings may be
  wrong.
- README must state all limitations in §2.3 and the brief overrides in §2.4.
  `PROCESS.md`, `reflections/crit-7.md` and `CLAUDE.md` are C7 deliverables
  outside this feature's scope but should not be forgotten.
