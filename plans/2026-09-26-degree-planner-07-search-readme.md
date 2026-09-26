# Degree Planner — Phase 07: Runtime P&C search & README

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first:
  §4.4 API contract (search) and §6, the feature-level Definition of Done, which
  this phase closes.
- **Depends on phases:** 05, 06.

## 1. Summary

Let students add any course. Search the seeded catalogue. For an unknown
well-formed code, fetch its 2027 P&C page live with a TypeScript port of
`anu-pandc`'s parser, run it through the same requisite parser, and cache it as
a stub. Then replace the starter README, which is served in full at `/readme/`,
with the app's account of itself, its brief overrides, its limitations and its
data attribution.

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements FR10, FR35 (fetching non-seeded codes) and FR5 (the
README content). The full text is in overview §2.1.

### 2.2 Non-functional

- P&C is fetched only on an explicit search, never on page load.
- Requests carry a self-identifying User-Agent and a 10 s timeout.
- At most one in-flight fetch per code.
- No live-network calls in automated tests.

### 2.3 Out of scope for this phase

Offline bulk scraping (Phase 01).

### 2.4 Assumptions

See overview §2.4. The README must state every limitation in overview §2.3 and
§2.4.

## 3. Existing code context (verified 2026-09-26)

**Reference parser: `.venv/lib/python3.12/site-packages/anu_pandc/parse/courses.py`.**
Port its behaviour:
- **Title**: `h1.intro__degree-title`.
- **Units**: in `dl.student-contribution-band`, the `dt` whose text includes
  "unit value", then its next `dd`, first integer. Fallback:
  `li.degree-summary__requirements-units`, `(\d+)\s*unit`.
- **Level**: first digit of the code × 1000.
- **Requisites**: find the first `h1`–`h6` whose text starts
  "requisite and incompatibility" (case-insensitive), and join the text of its
  following siblings up to the next heading. If there's no such heading, use
  `div.requisite`. Collapse newlines. Split at the earliest of "You are not able
  to enrol", "You cannot enrol", "You may not enrol" and "Incompatible with":
  the head is `prerequisites` (or `"None"`), the tail is `incompatibilities`
  (or `"None"`), and the whole is `requisite_raw`.
- **Description**: the `p` texts in `div.introduction`, joined with spaces.
- **Offerings**: `#class` → `#tabs-container`. Map year labels from
  `div.course-tabs-menu a[href]` (href without `#` → link text). Each
  `div.course-tab-content` gets its year from its id. Each `h3` is a semester
  name, whose next sibling `table` has rows. Skip a row with one `td[colspan]`
  (a topic label). Rows with ≥ 6 `td`s give class number `td[0]` and mode
  `td[5]`.

P&C answers an unknown code with **HTTP 302** to `/Error/Index/404?aspxerrorpath=…`
(verified with curl on 2026-09-26). `anu-pandc`'s User-Agent is
`anu-pandc/<version> (+https://github.com/smcclab/anu-pandc)`.

**README**:
- `spec/readme.test.ts` renders `README.md` with `@astrojs/markdown-remark`,
  keeps letters and digits only, lowercases, and asserts that the text served at
  `/readme/` contains the whole of it.
- `src/pages/readme.astro` serves it, rewriting `public/` image paths.
- The current `README.md` is the starter template, headed "# Your prototype",
  with an HTML comment telling you to replace everything.
- Data attribution text is in `data/2027/SOURCE.md` (Phase 01).

### Interfaces from earlier phases (exact)

- `src/lib/catalogue/from-pandc.ts`: `PandcCourseJson`,
  `fromPandc(json, tdpCourses, parse?)`, `isUndergrad(code)`.
- `src/lib/domain/requisites.ts`: `parseRequisites(input)`.
- `src/lib/repo.ts`: `Db`, `loadCatalogue(db)`, `invalidateCatalogue(db)`,
  `loadProgram(db)`, `getPlan(db, id)`.
- `src/lib/domain/view.ts`:
  `courseCard(cat: Catalogue, program: ProgramDef, choices: Record<string, string>, code: string): CourseCard`.
- `data/2027/tdp.json` → `tdpCourses` (`string[] | null`).
- `src/components/Sidebar.tsx`, `CourseCard.tsx` and `PlaceInMenu.tsx`
  (Phase 06). Cards are draggable (`dataTransfer` carries the code) and have
  "Place in…".

## 4. Approach

`fetchCourseFromPandc(code, fetchImpl = fetch)` takes an injectable `fetch`, so
tests run against saved real HTML fixtures with no network. The search endpoint
checks the DB first, and fetches only for a well-formed code with no DB hit. It
de-duplicates concurrent fetches through a `Map<string, Promise<FetchOutcome>>`.

## 5. Task breakdown

### Task 16: Runtime P&C fallback fetcher and course search [x]

- **Description:** FR10 and FR35 (fetching non-seeded codes).
- **Files touched:**
  - `package.json` and `pnpm-lock.yaml` (`node-html-parser@^9.0.4`)
  - `src/lib/catalogue/fetch-pandc.ts` (new),
    `src/lib/catalogue/fetch-pandc.test.ts` (new)
  - `src/lib/catalogue/__fixtures__/COMP2100.html` and
    `__fixtures__/MATH1116.html` (new; real pages saved once with curl)
  - `src/lib/repo.ts` (`upsertFetchedCourse`, `searchCourses`)
  - `src/pages/api/courses/search.ts` (new)
  - `src/components/CourseSearch.tsx` (new), `src/components/Sidebar.tsx`
  - `spec/planner.test.ts`
- **Tests first (red):**
  - `fetch-pandc.test.ts` injects a fake `fetch`:
    - `parses COMP2100.html like the scraped JSON`: title, units 6, requisite
      text, and offerings equal to those in `data/2027/courses/COMP2100.json`.
    - `302 to /Error/ → not_found`.
    - `network error → error, nothing returned`.
    - `sends a self-identifying User-Agent`.
    - `rejects malformed codes without fetching`.
  - `spec/planner.test.ts`:
    - `search COMP21 returns COMP2100 with status found`
    - `search "software" matches titles`
    - (no live-network test in the spec)
- **Implementation (green):**
  - `export type FetchOutcome = { status: "fetched"; course: CatalogueCourse } | { status: "not_found" } | { status: "error"; message: string }`
  - `export async function fetchCourseFromPandc(code: string, fetchImpl: typeof fetch = fetch): Promise<FetchOutcome>`:
    `redirect: "manual"`, a 10 s `AbortSignal.timeout`, and the User-Agent
    `anu-degree-planner (+https://comp4020-crit7-attwelvedev.fly.dev/readme/)`.
    The parse is ported from `anu_pandc/parse/courses.py` (this file's §3) into a
    `PandcCourseJson`, then run through `fromPandc(json, tdp, parseRequisites)`.
  - `repo.ts`: `upsertFetchedCourse(db: Db, c: CatalogueCourse): void`
    (`is_stub=1`), then `invalidateCatalogue(db)`;
    `searchCourses(db: Db, q: string, limit = 20): CatalogueCourse[]`.
  - `search.ts` handles `GET /api/courses/search?q=<text>&plan=<id?>`; `plan` is
    optional and supplies `choices` to `courseCard`. DB first. If there's no DB hit and the query is a well-formed
    code, fetch. The response is
    `{ status: "found" | "fetched" | "not_found" | "error" | "invalid"; courses: CourseCard[]; message?: string }`.
    At most one in-flight fetch per code (a Map of promises).
  - `CourseSearch`: an input with a label and a result list of draggable cards
    with "Place in…"; the outcome messages are shown in a live region.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - The tests pass.
  - A manual check on the deployed app: searching an uncached real code (e.g.
    `PHIL1001`) fetches, caches, and is placeable after a reload.
- **Depends on:** 8, 13, 14.

### Task 17: README: what it is, what good means, limitations, attribution

- **Description:** Replace the starter README (served in full at `/readme/`).
- **Files touched:** `README.md`, optionally `public/*.png` screenshots.
- **Tests first (red):** `spec/readme-content.test.ts`: `/readme/` contains each
  of "Limitations", "Programs & Courses", "2027", "single allocation" and
  "projected", and does **not** contain "Your prototype" (the starter heading).
- **Implementation (green):** The README covers:
  - the app in a paragraph
  - what good looks like, and which parts the tests enforce vs judgement calls
  - the brief overrides: strict single allocation replaces double-counting, and
    filter groups are in v1
  - every limitation from overview §2.3 and §2.4 (projected offerings, unknown offerings,
    TDP tracking status, the ML→ARIN merge, the parser's known over-strict
    reading, the unconfirmed licence)
  - data attribution
- **Refactor:** None expected.
- **Acceptance criteria:** `spec/readme.test.ts` and the new test pass.
- **Human review:** the user reads `/readme/` on the running app and confirms it
  says what they want, in their voice. It passes when the user explicitly accepts
  it.
- **Depends on:** 16.


## 6. Phase Definition of Done

- [ ] Every task in §5 is complete and its tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] On the deployed app: search an uncached real code (e.g. `PHIL1001`); it's fetched, cached, placeable, and still present after a reload
- [ ] Task 17's README has been explicitly accepted by the user
- [ ] **Feature-level Definition of Done in overview §6 is complete**
- [ ] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR5 (README content) | Task 17 |
| FR10 | Task 16 |
| FR35 (fetch non-seeded) | Task 16 |
| NFR fetch on search only, UA, timeout | Task 16 |

## 8. Risks / open questions

None.
