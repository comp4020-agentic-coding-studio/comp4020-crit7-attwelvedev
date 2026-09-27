# Course card redesign — Phase 02: Compact rows for placed courses

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: §2.1.B (CR12–CR17), §2.4 (completed means
  `PlacementEval.completed`) and §3.
- **Depends on phases:** 01.

## 1. Summary

A course that's already on the timeline stops being a full card in the
sidebar. It becomes a one- or two-line row: code, title (opens Details),
and "Completed <term>" / "Planned <term>". The term locates the course on
the timeline. Rows sit below a group's unplaced cards, and search results
behave the same. At the end, `AvailableCourseCard` only ever renders
unplaced courses.

## 2. Requirements (this phase)

### 2.1 Functional

- **CR12:** groups (Task 5) and search (Task 6).
- **CR13–CR17:** Task 5.

### 2.2 Non-functional

- Axe stays clean.
- The row's title and term buttons get visible focus.
- No horizontal overflow at either viewport.

### 2.3 Out of scope for this phase

- Colour on rows (none, CR22).
- Help copy (Task 19).

### 2.4 Assumptions

- See overview §2.4.
- A fresh plan's cutoff is 0, so its placements are "Planned".
- The example plan's cutoff is 2, so COMP1130 in S1 2027 is "Completed".

## 3. Existing code context (verified 2026-09-28)

**`src/components/Sidebar.tsx`, `Group`** (leaf groups render courses):

```ts
const placedByCode = new Map(view.placements.map((p) => [p.code, p]));
const courses = group.children.length === 0 ? group.courses : [];
const columns = Math.min(courses.length, MAX_COLUMNS) || 1;
// …
{courses.length > 0 && (
  <ul class="available-courses" data-columns={columns}>
    {courses.map((code) => (
      <AvailableCourseCard key={code} view={view} code={code}
        placement={placedByCode.get(code) ?? null} planId={planId}
        onChanged={onChanged} onAnnounce={onAnnounce} onDragStart={onDragStart}
        onDragEnd={onDragEnd} openMenuCode={openMenuCode}
        onMenuOpenChange={onMenuOpenChange} onLocateCourse={onLocateCourse} />
    ))}
  </ul>
)}
```

`GroupProps` includes `onLocateCourse: (code: string) => void`.

**`src/components/CourseSearch.tsx`** renders `<ul class="available-courses
course-search-results" data-columns={Math.min(results.length, 3) || 1}>`.
It holds one `AvailableCourseCard` per result, with `course={course}`,
`placement={view.placements.find((p) => p.code === course.code) ?? null}`
and `onLocateCourse`.

**`src/components/AvailableCourseCard.tsx`** after Phase 01:
- its props are `view, code, course?, placement: PlacementView | null,
  planId, onChanged, onAnnounce, onDragStart?, onDragEnd?, openMenuCode,
  onMenuOpenChange, onLocateCourse`;
- it renders `CourseCardHeader`, `p.course-card-offered`, badges, then for
  `placement`: `<p class="course-card-placed-status">Placed in <button
  type="button" class="course-card-term-link" onClick={() =>
  onLocateCourse(code)} aria-label={\`${code} is placed in
  ${view.terms[placement.term].label} — locate it on the
  timeline\`}>{label}</button></p>`;
- otherwise (and `!readOnly`) it renders `.course-card-actions` with
  `PlaceInMenu`;
- then `CourseDetail`.

**`src/components/CourseDetail.tsx`** props `{ view; code; course?;
planId; open; onChanged; onAnnounce; onClose; focusChecks? }` (`focusChecks`
is from Task 3).

**`PlacementView`** (`src/lib/domain/view.ts`) extends `PlacementEval`,
with `term: number`, `lastTerm: number`, `completed: boolean` (`lastTerm <
plan.cutoff`), `countsToward`, `pinned`.

**Interaction wiring:** `onLocateCourse` → Planner `setLocateRequest({
code, token: Date.now() })` → Timeline scrolls to, focuses and highlights
`[data-placed=code]` (`course-card-highlighted`, 2s).

**CSS after Phase 01:**
- `.course-card-sidebar-placed, .course-card-hard { background:
  var(--paper); color: var(--muted); }` plus the muted `strong`,
  `.course-card-title` and `.course-card-offered`;
- `.course-card-placed-status` (flex, 0.85em);
- `.course-card-term-link` (padding `0.1rem 0.45rem`, `font-size:
  inherit`, radius `0.35rem`, base button border);
- `.available-courses` (grid, `data-columns`).

**Tests this phase supersedes:**
- `spec/planner.test.ts:267`, "a placed course stays in its group's list,
  saying where it's placed…": it matches `class="course-card
  course-card-sidebar-placed" draggable="false"` and `Placed in` +
  `class="course-card-term-link"`.
- `spec/layout.test.ts:746`, "shows an already-placed search result as the
  requirement lists do…": it expects class `course-card
  course-card-sidebar-placed` and `.course-card-placed-status` text
  "Placed in S1 2027".
- `spec/layout.test.ts:814`, "clears every card's highlight…": it uses
  `getByRole("button", { name: /^COMP1100 is placed in/ })`.
- `spec/layout.test.ts` `describe("course cards")`:
  - "a placed course's term button keeps its border on hover" uses
    `.course-card-sidebar-placed .course-card-term-link`;
  - "a placed sidebar card recedes without fading its buttons" uses
    `.course-card-sidebar-placed` and `titleColour(".course-card-sidebar-placed")`
    (`${selector} strong`).

### Interfaces from earlier phases (exact)

- `CourseCardHeader` (Task 1): default export, props `{ code: string;
  title: string; units: { units: number; twoSemester: boolean }; grip:
  boolean; onOpenDetails: () => void }`. It renders `div.course-card-head`
  (`.course-card-grip`?, `strong.course-card-code`,
  `.course-card-unit-count`) and `button.course-card-title`.
- `.course-card-title` and `.course-card-offered` classes (Task 1).
- `CourseDetail` prop `focusChecks?: boolean` (Task 3). It isn't used
  here, but it's part of the props.
- As built in Phase 01 (2026-09-28): `button.course-card-title` gets its
  name from `aria-label="{title}, details"`, with no hidden span;
  `.course-card` is `position: relative`; `MoreOptions` also takes
  `fixed?: boolean`, which the timeline card passes to float its panel.

## 4. Approach

Row layout: two lines by default, one line when the list is wide enough,
decided by a container query on the list, so it follows the group's width,
not the viewport's:

```
narrow (< 24rem list):             wide (≥ 24rem list):
COMP1130  Programming as Pro…      COMP1130  Programming as Problem So…  Completed [S1 2027]
Completed [S1 2027]
```

`.placed-rows { container-type: inline-size }`. `.placed-row` is a grid
with areas `"code title" "status status"`, becoming `"code title status"`
under `@container (min-width: 24rem)`. The title button is
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.

## 5. Task breakdown

### Task 5: `PlacedCourseRow` in requirement groups

- [ ] **Description:**
  - Add `placedStatus`.
  - Create `PlacedCourseRow`.
  - In `Group`, split the leaf's courses into unplaced (the card grid, as
    today) and placed (a `ul.placed-rows` list below the grid).
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/PlacedCourseRow.tsx` (new)
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/planner.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("placedStatus")`:**
    - build a view with `{ ...emptyPlan(), cutoff: 1, placements: [{
      code: "COMP1100", term: 0, pinnedGroupId: null }, { code:
      "COMP1110", term: 1, pinnedGroupId: null }] }`;
    - COMP1100 → `{ word: "Completed", termLabel: "S1 2027" }`;
    - COMP1110 → `{ word: "Planned", termLabel: "S2 2027" }`.
  - **`spec/planner.test.ts:267`** (renamed "a placed course stays in its
    group's list as a compact row, and is no longer draggable"):
    - the fresh plan's HTML with COMP1100 in term 0 matches
      `/<li class="placed-row"[^>]*>[\s\S]{0,80}COMP1100/`;
    - it matches `/COMP1100[\s\S]{0,600}Planned[\s\S]{0,60}class="course-card-term-link"[^>]*>S1 2027</`;
    - it does **not** match `/draggable="true"[^>]*>[\s\S]{0,200}course-card-code">COMP1100</`.
  - **`spec/layout.test.ts`, new `describe("placed rows")`:**
    1. On `withPlan` at 1920×1080, the group section containing COMP1130
       (`.requirement-group` with the text "Programming as Problem
       Solving"):
       - `.placed-rows .placed-row` has count 1;
       - its `.placed-row-status` `innerText` is "Completed S1 2027";
       - its top is ≥ the bottom of that group's last
         `.available-courses .course-card` (below the cards);
       - it has no `draggable` attribute.
    2. On a fresh `planWithPlacement("COMP1130")` plan: the status is
       "Planned S1 2027", and `getByRole("button", { name: /^COMP1130 is
       planned for S1 2027/ })` exists. Clicking it gives
       `[data-placed="COMP1130"]` the class `course-card-highlighted`.
    3. The row's title button:
       - has `title` "Programming as Problem Solving (Advanced)";
       - has accessible name "Programming as Problem Solving (Advanced),
         details";
       - clicking it opens `dialog[open]` with `aria-label="COMP1130
         details"`.
    4. **Layout:**
       - at 390×844, the row's `.placed-row-status` top is ≥ its
         `.placed-row-code` bottom (two lines);
       - at 1920×1080 (3-column sidebar), their vertical centres are
         within 4px (one line);
       - when the title overflows (`scrollWidth > clientWidth`), its
         `text-overflow` is "ellipsis";
       - `horizontalOverflow` is 0 at both.
    5. `axeViolations` is `[]` on `withPlan` at 1920×1080.
  - **Superseded in `describe("course cards")`:**
    - the hover-border test uses `.placed-row .course-card-term-link`;
    - the recede test uses `.placed-row` and
      `titleColour(".placed-row")` vs `titleColour(".course-card-unplaced")`.
      Both still assert the same properties.
  - **`spec/layout.test.ts:814`:** the regexes become `/^COMP1100 is
    (completed in|planned for)/` and the same for COMP1110. The
    one-highlight expectations are unchanged.
- **Implementation (green):**
  - `planner-logic.ts`:
    ```ts
    export interface PlacedStatus { word: "Completed" | "Planned"; termLabel: string }
    export function placedStatus(view: PlanView, placement: PlacementView): PlacedStatus
    ```
    It returns `word: placement.completed ? "Completed" : "Planned"` and
    `termLabel: view.terms[placement.term].label`. Import `PlacementView`
    from `../lib/domain/view`.
  - `PlacedCourseRow.tsx`, default export:
    ```ts
    interface Props {
      view: PlanView;
      code: string;
      course?: CourseCard;
      placement: PlacementView;
      planId: string;
      onChanged: (view: PlanView) => void;
      onAnnounce: (message: string) => void;
      onLocateCourse: (code: string) => void;
    }
    ```
    - `course = courseOverride ?? view.courses[code]`; return `null` if it
      is missing.
    - Local `detailsOpen` state.
    - Renders `<li class="placed-row">`, containing:
      - `<strong class="placed-row-code">{code}</strong>`
      - `<button type="button" class="placed-row-title"
        title={course.title} aria-label={\`${course.title}, details\`}
        onClick={() => setDetailsOpen(true)}>{course.title}</button>`
        (aria-label, not a visually-hidden span: Phase 01 found the span,
        being absolutely positioned, makes Chromium name the button
        "… , details" with a stray space, and it can escape a scrolling
        strip and widen the page)
      - `<p class="placed-row-status">{word} <button type="button"
        class="course-card-term-link" onClick={() =>
        onLocateCourse(code)} aria-label={\`${code} is ${word ===
        "Completed" ? "completed in" : "planned for"} ${termLabel} —
        locate it on the timeline\`}>{termLabel}</button></p>`
      - `<CourseDetail view={view} code={code} course={courseOverride}
        planId={planId} open={detailsOpen} onChanged={onChanged}
        onAnnounce={onAnnounce} onClose={() => setDetailsOpen(false)} />`
  - `Sidebar.tsx` `Group`:
    - `const unplaced = courses.filter((c) => !placedByCode.has(c));`
    - `const placed = courses.filter((c) => placedByCode.has(c));`
    - `columns` from `unplaced.length`;
    - render the grid only if `unplaced.length > 0`, passing `placement={null}`;
    - then, if `placed.length > 0`, `<ul class="placed-rows">` of
      `<PlacedCourseRow key={code} view={view} code={code}
      placement={placedByCode.get(code)!} planId={planId}
      onChanged={onChanged} onAnnounce={onAnnounce}
      onLocateCourse={onLocateCourse} />`.
    - Update the placed-courses comment above (it now says "as compact
      rows below the cards").
  - `styles.css`:
    - `.placed-rows` (list reset; `margin: 0.6rem 0 0`; flex column; gap
      `0.35rem`; `container-type: inline-size`)
    - `.placed-row`: `display: grid; grid-template-areas: "code title"
      "status status"; grid-template-columns: auto minmax(0, 1fr); gap:
      0.15rem 0.5rem; align-items: center; padding: 0.35rem 0.6rem;
      background: var(--paper); border: 1px solid var(--line);
      border-radius: 0.5rem; color: var(--muted); font-size: 0.9rem;`
    - `@container (min-width: 24rem) { .placed-row {
      grid-template-areas: "code title status"; grid-template-columns:
      auto minmax(0, 1fr) auto; } }`
    - `.placed-row-code { grid-area: code; color: var(--muted); }`
    - `.placed-row-title` (the `.course-card-title` reset, plus
      `grid-area: title; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; color: var(--muted);`)
    - `.placed-row-status { grid-area: status; margin: 0; display: flex;
      align-items: center; gap: 0.35rem; }`
- **Refactor:** none. `AvailableCourseCard`'s placed branch is still used
  by search until Task 6.
- **Acceptance criteria:**
  - Tests pass. The "placed rows" layout test fails on the pre-task build
    (there's no `.placed-row`), confirming red.
  - `pnpm check` is green.
  - Screenshots: finished groups are a tidy list under their cards.
- **Depends on:** Phase 01 (Task 1's classes).

### Task 6: Placed search results as rows; `AvailableCourseCard` drops its placed branch

- [ ] **Description:**
  - Split search results the same way.
  - Remove `placement` and `onLocateCourse` from `AvailableCourseCard` and
    its placed-status markup, now that nothing passes a placement.
  - Remove the dead `.course-card-sidebar-placed` and
    `.course-card-placed-status` CSS.
- **Files touched:**
  - `src/components/CourseSearch.tsx`
  - `src/components/AvailableCourseCard.tsx`
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **`spec/layout.test.ts:746`**, renamed "shows an already-placed search
    result as the requirement lists do: a compact row". It uses a fresh
    `planWithPlacement("COMP1130")` plan and searches "COMP1130":
    - `.course-search-results .placed-row` containing "COMP1130" has
      count 1;
    - `.course-search-results .course-card` containing "COMP1130" has
      count 0;
    - `.placed-row-status` `innerText` is "Planned S1 2027";
    - clicking its `.course-card-term-link` focuses `[data-placed="COMP1130"]`
      (the same poll as today).
  - **New:** a search for "COMP11" (several results, some unplaced) shows
    unplaced cards in `ul.available-courses.course-search-results` and
    the placed one as a row after them. The row's top is ≥ the last
    card's bottom.
- **Implementation (green):**
  - `CourseSearch.tsx`:
    - `const placedOf = (code: string) => view.placements.find((p) =>
      p.code === code) ?? null;`
    - `unplacedResults = results.filter((c) => !placedOf(c.code))`, and
      `placedResults` is the rest;
    - render the grid from `unplacedResults` (`data-columns` from its
      length), without the `placement`/`onLocateCourse` props;
    - then `<ul class="placed-rows course-search-placed">` of
      `<PlacedCourseRow … course={course} placement={placedOf(course.code)!} />`.
    - Keep the code comment that the requirement groups' own components
      are reused.
  - `AvailableCourseCard.tsx`:
    - delete the `placement` and `onLocateCourse` props, the placed-status
      JSX, and the `course-card-sidebar-placed` class branch;
    - the class becomes `course-card ${allBlocked ? "course-card-hard" :
      "course-card-unplaced"}`;
    - `draggable = !readOnly`;
    - `targets` uses `readOnly ? [] : dropTargets(…)`.
  - `Sidebar.tsx`: drop `placement={null}` from the `Group` grid call.
  - `styles.css`:
    - remove `.course-card-sidebar-placed` from the receding selector list
      (leaving `.course-card-hard`), its `strong`/`.course-card-offered`
      variants, and `.course-card-placed-status`;
    - keep `.course-card-term-link`, which rows use.
- **Refactor:** grep `src/` and `spec/` for `course-card-sidebar-placed`
  and `course-card-placed-status`. Both must have 0 hits outside
  `PROCESS_LOG.md`.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green (typecheck proves no caller still passes the
    removed props).
- **Depends on:** Task 5.

## 6. Phase Definition of Done

- [ ] Tasks 5–6 complete, their tests passing
- [ ] `pnpm exec vitest run --project unit` passes
- [ ] `pnpm check` passes
- [ ] Screenshots at 1920×1080 and 390×844 of `/plan/example` (Completed
      rows) and a fresh plan (Planned rows, a search with a placed
      result)
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| CR12 | Task 5 (groups), Task 6 (search) |
| CR13 | Task 5 (test 1) |
| CR14 | Task 5 (test 3, 4) |
| CR15 | Task 5 (unit, tests 1–2) |
| CR16 | Task 5 (test 4) |
| CR17 | Task 5 (test 1), planner.test.ts:267 |
| CR25 | Tasks 5–6 (superseded tests in §3) |

## 8. Risks / open questions

None.
