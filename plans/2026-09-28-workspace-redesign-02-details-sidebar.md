# Workspace redesign — Phase 02: details sidebar replaces the dialog

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read it
  first, especially §2.4 (the check key is the node's text), §3 and §4.2
  (`DetailsState`, `CourseDetailsView`).
- **Depends on phases:** 01.

## 1. Summary

A single `CourseDetailsPanel` replaces every per-card, per-row and
per-search-result `CourseDetail` `<dialog>`. It opens from every existing
Details entry point, and it's reflected in `?course=` and rendered on the
server when that parameter is present. It shows every WR9 section.

**Placement for this phase only:** a fixed drawer on the right edge,
`min(440px, 100vw)` wide, above the panes. That way it can't disturb the
existing snapping-resize layout or its tests. Phase 06 turns it into a
docked region or drawer, and Phase 07 into a phone sheet.

The phase ends with no `<dialog>` in the planner.

## 2. Requirements (this phase)

### 2.1 Functional

| WR | What this phase covers |
| --- | --- |
| WR5 | All |
| WR6 | Every existing entry point. Palette Enter comes in Phase 04. |
| WR7 | Header. The grip is rendered; its drag is wired in Phase 04, Task 12. |
| WR8 | All |
| WR9 | All sections: §1 and §5 in Task 5; §3 and §4 in Task 6; §2 and §6 in Task 7 |
| WR10 | All |
| WR11–WR12 | All |
| WR13–WR14 | All |
| WR15 | All |
| WR18 | `aria-current` only. The gold ring comes in Phase 03. |

### 2.2 Non-functional

- axe is clean with the panel open, at 1920×1080 and 390×844.
- Every control is at least 44px.
- `spec/invariants.test.ts` still passes, including for
  `/plan/example?course=COMP2100` (add it to the SSR check in Task 5).

### 2.3 Out of scope for this phase

| Item | Phase |
| --- | --- |
| Linked highlights and gold ring | 03 |
| Unified undo for moves | 03 |
| Palette | 04 |
| Region styling | 05 |
| Docked layout and resizing | 06 |
| Phone sheet | 07 |
| Help text | 08 |

The Help page still says "Details dialog" until Phase 08. Its current tests
check only Help's own text, so they stay green.

### 2.4 Assumptions

See overview §2.4. The strip's allowed and refused state comes from
`dropTargets(view, code, hardBlockedOverride)` (`planner-logic.ts:16`), the
same source as dragging.

## 3. Existing code context (verified 2026-09-28)

**`src/components/CourseDetail.tsx`** (to be deleted)
- Props: `{ view; code; course?: CourseCard; planId; open; focusChecks?;
  onChanged; onAnnounce; onClose }`.
- It renders a `<dialog aria-label="{code} details">` with:
  - Close
  - an h2 with the code and title
  - the description
  - the "View on Programs & Courses" link
  - `<h3>Requisites</h3>` and
    `<RequisiteTree node={placement.requisiteStatus}/>`, only when the
    course is placed
  - a "Your checks" radio fieldset per `placement.checks`, using
    `setCheck(planId, code, check.item, value)`
  - "Incompatible with", `otherPrograms`
  - a "Pin to" select using `setPin(planId, code, groupId || null)`, with
    options `course.eligibleGroups` labelled by `groupLabel(view, id)`
- It uses a `pendingCheck` state to show the chosen answer until the new
  view arrives.

**Where it's rendered.** Each call site keeps its own `detailsOpen` state:
- `CourseCard.tsx`:
  - Title: `onOpenDetails` sets focus "top" and opens.
  - Verify badge (`button.badge-verify`): sets focus "checks" and opens.
  - Menu "Details" button.
  - `<CourseDetail …/>` at lines 313-322.
- `AvailableCourseCard.tsx`: the title opens it; `<CourseDetail
  course={courseOverride}/>` at lines 111-120.
- `PlacedCourseRow.tsx`: `button.placed-row-title` with `aria-label="{title},
  details"`; `<CourseDetail/>` at lines 74-83.
- `CourseCardHeader.tsx`: props `{ code, title, units, grip, onOpenDetails:
  () => void }`. It renders `button.course-card-title` with
  `aria-label="{title}, details"`.

**`src/components/RequisiteTree.tsx`**
- Props: `{ node: RequisiteStatus }`.
- It renders `<li>` text with "✓ met", "✗ not met" or "not checked", and
  "(marked by you)" for answered unverifiable leaves.

**`RequisiteStatus`** (`src/lib/domain/evaluate.ts:20-26`) is a union of:
- `and` / `or`, with `items` and `ok: boolean | null`
- `course`, with `code`, `concurrent` and `ok`
- `units`, with `units`, `filter`, `text` and `ok`
- `program`, with `code`, `name`, `satisfied` and `ok`
- `unverifiable`, with `text`, `ok: boolean | null` and `answer: CheckAnswer
  | null`

**Other types**
- `VerifyCheck { item: string; label: string; answer: CheckAnswer | null }`.
- `PlacementView` extends `PlacementEval` with `countsToward: string |
  null; pinned: boolean`. It includes `term`, `span`, `lastTerm`, `state`,
  `checks`, `completed` and `requisiteStatus: RequisiteStatus | null`.
- `ReqExpr` (`types.ts`) has the same kinds without `ok`.

**`src/components/Planner.tsx`**
- It holds `view`, `searchBlocked`, `searchTwoSemester`, `openMenuCode`,
  `removed` and similar.
- `performPlace(term, code)` (line 141) checks `dropTargets`, then calls
  `placeCourse`.
- `performRemove(code)` (line 152) builds `RemovedPlacement` and shows the
  undo toast.
- It renders `.plan-title`, then `.planner-layout > .planner-panes > (Timeline
  area, Sidebar, ReqsResizeHandle)`, then the undo toast.

**`src/pages/plan/[id].astro`** calls `getView(id)` and renders `<Planner
client:load view={view} title={title}/>`.

**Helpers**
- `planner-logic.ts`: `dropTargets`, `menuTargets`, `groupLabel(view,
  groupId)` and `placedStatus(view, placement)`.
- `src/lib/domain/terms.ts`: `TERMS`, `termLabel(index)` and
  `termSpanLabel(index, span)`.

**Tests to rewrite, not delete**
- `spec/planner.test.ts:324-357`: the `(?!<dialog)` guards; "dialog closed";
  and the dialog for COMP4550 holding its P&C URL.
- `spec/layout.test.ts`:
  - "manual checks" at :2380-2518: `openDetails()` waits for
    `dialog[open]`; radio groups of 3; the verify badge focuses "Your
    checks"; read-only fieldsets disabled; the tree says "✓ met (marked by
    you)".
  - "placed rows" at :2657-2664: the row title opens
    `dialog[aria-label="COMP1130 details"]`.
  - "card header" at :2743-2775.
  - "course card menu" at :2818-2877: "Details" is first and opens the
    dialog.
  - Read-only at :2968-2983.
- `closest("dialog")` exclusions at :2532, :2579, :2604 and :3452; the
  `:not(dialog button)` selectors at :2981 and :2983; and the
  innerText-versus-closed-dialog workarounds at :2448 and :2726. Remove them
  once no dialogs exist.

### Interfaces from earlier phases (exact)

From Phase 01, Tasks 1 and 3:

```ts
// src/lib/domain/types.ts
export interface AssessmentItem { task: string; weight: string }
export interface ClassOffering { year: number; session: string; mode: string; classNumber: string | null }
export interface CourseExtras { learningOutcomes: string[]; assessment: AssessmentItem[]; cotaught: string[]; classes: ClassOffering[] }
// src/lib/domain/view.ts
export interface CourseDetailsView { course: CourseCard; scrapedAt: string; extras: CourseExtras | null }
// src/lib/plan-service.ts
export function getCourseDetails(code: string, planId?: string | null): CourseDetailsView | null;
// src/components/api.ts
export async function fetchCourseDetails(code: string, planId?: string): Promise<CourseDetailsView | { error: string }>;
// HTTP: GET /api/courses/{code}?plan= → 200 CourseDetailsView | 400 | 404 {error}
```

## 4. Approach

**State.**
- `Planner` owns `details: DetailsState` (overview §4.2), plus
  `knownCards: Record<string, CourseCard>`. `knownCards` is fed by search
  results (the existing `onSearchResults`) and by fetched details, so a
  course outside `view.courses` still has a card.
- `openDetails(code, focus = "top")` replaces every per-component
  `detailsOpen` state. It's passed down as `onOpenDetails: (code: string,
  focus?: DetailsFocus) => void`.
- A `useEffect` on `details.code` calls
  `history.replaceState(null, "", withCourseParam(location.href,
  details.code))`.

**Fetching.**
- `useCourseDetails(code, planId, initial)` keeps a module-level
  `Map<string, CourseDetailsView>` cache.
- It returns `{ status: "idle" | "loading" | "ready" | "error"; data:
  CourseDetailsView | null }`.
- Server-rendered details (`initial`) seed the cache, so there's no loading
  flash for `?course=`.

**Sections** (WR9):
- The panel reads the course's card from `view.courses[code] ?? knownCards[code]
  ?? fetched.course`.
- It reads `placement` from `view.placements`.
- It reads the extras from the fetched details.
- Sections 1–4 need only the card, the placement and the view (WR10).

**Unmarked tree.** For an unplaced course, `unmarkedStatus(expr: ReqExpr):
RequisiteStatus` maps the `ReqExpr` onto `RequisiteStatus` with `ok: null`
everywhere (and `answer: null`). The tree is then rendered with
`marks={false}`, which hides every status glyph.

**Interim CSS for this phase.**
- `.details-panel { position: fixed; inset-block: 0; inset-inline-end: 0;
  width: min(440px, 100vw); overflow: auto; z-index: 40; }`
- Plain surface and a left border. Phase 05 gives it the region styling.

## 5. Task breakdown

### Task 4: Details selection state and the `?course=` round trip

- [x] **Description:** Add the pure selection model and the URL helpers. Plumb
  server-rendered details from the page into `Planner`.
- **Files touched:**
  - new `src/components/details-state.ts`
  - new `src/components/details-state.test.ts`
  - `src/pages/plan/[id].astro`
  - `src/components/Planner.tsx`
- **Tests first (red):** in `details-state.test.ts`:
  - `openCourse(EMPTY_DETAILS, "COMP2100")` gives code "COMP2100", history
    ["COMP2100"], index 0 and focus "top".
  - Opening "A", "B", then stepping back and opening "C" gives history [A,
    C]: the forward entries are truncated.
  - Opening the code already open keeps the history and bumps `token`, so
    it re-focuses.
  - `stepHistory` is clamped at both ends.
  - `closeDetails` gives `code: null` and keeps the history.
  - `courseParam("?course=COMP2100")` is "COMP2100";
    `courseParam("?course=bad")` is null; `courseParam("")` is null.
  - `withCourseParam("https://x/plan/a?foo=1", "COMP2100")` keeps `foo` and
    sets `course`. With `null`, the `course` parameter is removed.
- **Implementation (green):**
  - `details-state.ts`: the exact exports from overview §4.2.
    `EMPTY_DETAILS = { code: null, history: [], index: -1, focus: "top",
    token: 0 }`.
  - `[id].astro`: `const courseCode = courseParam(Astro.url.search)`, and
    `const initialDetails = view && courseCode ? getCourseDetails(courseCode,
    id) : null`. Pass `initialDetails` to `<Planner>`.
  - `Planner`: add the prop `initialDetails?: CourseDetailsView | null` and
    the state `const [details, setDetails] = useState(() => initialDetails ?
    openCourse(EMPTY_DETAILS, initialDetails.course.code) : EMPTY_DETAILS)`.
    Add the `replaceState` effect from this file's §4.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm vitest run --project unit src/components/details-state.test.ts`
    passes.
  - `/plan/example?course=ZZZZ9999` renders exactly like `/plan/example`.
- **Depends on:** None within this phase. It needs Phase 01's
  `getCourseDetails`.

### Task 5: `CourseDetailsPanel` shell, "In your plan", "About", loading and errors; remove the dialog

- [x] **Description:** Build the panel with its header (WR7), §1 In your plan
  and §5 About. Point every Details entry point at it, and delete
  `CourseDetail.tsx`.
- **Files touched:**
  - new `src/components/CourseDetailsPanel.tsx`
  - new `src/components/use-course-details.ts`
  - `src/components/Planner.tsx`
  - `CourseCard.tsx`, `AvailableCourseCard.tsx`, `PlacedCourseRow.tsx`
  - `Timeline.tsx`, `Sidebar.tsx`, `CourseSearch.tsx` (prop threading)
  - delete `src/components/CourseDetail.tsx`
  - `src/styles.css` (interim panel CSS)
  - `spec/planner.test.ts`, `spec/layout.test.ts`,
    `spec/invariants.test.ts` / `spec/routes.ts`
- **Tests first (red):**
  - `spec/planner.test.ts`, replacing the tests at :344-357:
    - "the plan page renders no dialogs": the HTML has no `<dialog`.
    - "?course= renders the details sidebar":
      `/plan/example?course=COMP4550` contains `<aside
      aria-label="Course details"`, the text "Computing Research Project",
      "https://programsandcourses.anu.edu.au/2027/course/COMP4550", and
      "Learning outcomes".
    - Drop the `(?:(?!<dialog)…)` guards from :324-336.
  - `spec/layout.test.ts`: rewrite the Details-opening tests (card header
    :2743-2775, placed rows :2657, menu :2818-2877, read-only :2968) so that:
    - activating a card title, a row title, or the menu's "Details" makes
      `aside[aria-label="Course details"]` visible, with an h2 containing
      the code
    - the URL gains `?course=<code>`
    - pressing Close hides it and removes the parameter
  - Also in `spec/layout.test.ts`:
    - "About loads after opening": opening COMP2100 shows "Learning
      outcomes" with 6 `li`s, and "Assessment" with "Final Exam" and "45%".
    - "stub course shows no extras": mock `/api/courses/*` with Playwright
      `page.route` to return `extras: null`. There's no "Learning outcomes"
      heading, and there's a P&C link line.
    - "details fetch failure": route `/api/courses/*` to a 500. About shows
      "Couldn't load the full details" and a P&C link, and sections 1–4
      still render.
    - "the sidebar stays open when its course is removed" (WR11): on an
      editable plan, open the placed course, then Remove from the panel.
      The aside is still visible and shows "Not planned".
    - "the sidebar follows plan changes made elsewhere" (WR12, as amended):
      with COMP2100 open, move it with its timeline card's ⋯ menu. The
      panel's semester and status pills show the new term without
      reopening. The panel reads everything from `view` props, so every
      `setView` re-derives it; the app has no cross-tab sync to listen to.
    - "read-only details": on `/plan/example?course=COMP2100` there's no
      Remove button, and the pin select is disabled.
    - "axe with details open": `axeViolations` is empty at 1920×1080 and
      390×844 with `?course=COMP2100`.
    - "details fetch failure" checks only the sections that exist by then
      (§1, and the interim Requisites block). Tasks 6 and 7 extend it to §2–§4.
    - **Interim (ruled 2026-09-28, keeps each task's commit green):** point
      the "manual checks" suite (:2380-2518) at
      `aside[aria-label="Course details"]` in place of `dialog[open]`, with the
      same assertions. The one exception is the verify-badge case, which now
      expects focus on the "Requisites" h3 (Task 6's wording).
  - `spec/routes.ts`: add `/plan/example?course=COMP2100` so
    `invariants.test.ts` covers it. **Ruled 2026-09-28:** it goes in a
    separate `STATE_ROUTES` list, read only by `invariants.test.ts`, not in
    `ROUTES`. The layout suite's nav-tab geometry test also loops over
    `ROUTES`, and at 390px the interim full-width drawer covers the nav tab
    by design. That's a known interim gap for Phase 07's phone sheet.
- **Implementation (green):**
  - `use-course-details.ts`: `export function useCourseDetails(code: string
    | null, planId: string, initial: CourseDetailsView | null): { status:
    "idle" | "loading" | "ready" | "error"; data: CourseDetailsView | null
    }`. It keeps a module-level cache Map and aborts stale fetches.
  - `CourseDetailsPanel.tsx`. Its default export takes these props:

    ```ts
    interface Props {
      view: PlanView;
      details: DetailsState;
      card: CourseCard | null;
      fetched: { status: "idle" | "loading" | "ready" | "error"; data: CourseDetailsView | null };
      onOpen: (code: string) => void;
      onBack: () => void;
      onForward: () => void;
      onClose: () => void;
      onPlace: (term: number) => void;   // Task 7 uses it
      onRemove: () => void;
      onChanged: (view: PlanView) => void;
      onAnnounce: (message: string) => void;
    }
    ```

    - It renders `<aside class="details-panel" aria-label="Course
      details">`.
    - Header (WR7):
      - "Previous course" / "Next course" icon buttons, disabled at the
        ends of the history
      - "Close details"
      - the grip (`span.course-card-grip`, `aria-hidden`, omitted when
        read-only or completed)
      - `<h2>`: code, a `span` with "N units, Level L", and the title
      - status pills: "Planned <term>" / "Completed <term>" / "Not in your
        plan"; "Counts toward <group>" with the family dot; and the
        requisite state from `placement.state`, one of "Requisites met",
        "Requisites need your check", "Needs prerequisites" or "Blocked"
    - Section headings (h3), exactly: "In your plan", "When it runs"
      (Task 7), "Requisites" and "Courses in your plan that need it"
      (Task 6), "About the course", "Learning outcomes" and "Assessment".
      Phase 08's Help names them.
    - §1 In your plan:
      - The semester, from `placedStatus`.
      - The pin select, moved from `CourseDetail`: the same `setPin` call,
        the same options and help text, disabled when read-only. Its label
        changes from "Pin to" to "Counts toward" (WR9 §1).
      - "Remove from plan" (`onRemove`), not shown when read-only, completed
        or unplaced.
    - §5 About:
      - The description, cut off with the CSS `-webkit-line-clamp: 5`.
        "Read the full description" / "Show less" toggles it.
      - "Learning outcomes" as an `ol`.
      - "Assessment": a `div.assess-bar` with `aria-hidden` and flex
        segments, then a `ul` of the task and its weight. The weight gets
        "%" appended when it matches `/^\d+(\.\d+)?$/`. The section is
        labelled "Indicative, may change".
    - Loading: About shows `p.details-loading` "Loading course details…".
    - Error: "Couldn't load the full details. See this course on Programs
      & Courses." with a link.
    - Stub (`extras === null`): "Only basic details are available for this
      course. See Programs & Courses for outcomes and assessment."
    - **Interim Requisites block (ruled 2026-09-28):** the dialog's
      requisites content moves over unchanged, under an h3 "Requisites"
      (`tabIndex={-1}`): the `RequisiteTree` for placed courses, the "Your
      checks" fieldsets with `pendingCheck`, and the `otherPrograms` list.
      Task 6 replaces the tree and the fieldsets.
    - **Focus effect, brought forward from Task 7:** an effect on
      `details.token` focuses the h2, or the "Requisites" h3 when
      `details.focus === "requisites"`. The server-rendered `?course=` state
      starts at `token: 0`, and the effect skips token 0, so a page load
      doesn't move focus or show a focus ring.
  - `Planner`:
    - Adds the `knownCards` state, merged from `onSearchResults` and from
      `fetched.data.course`.
    - `openDetails(code, focus)` calls `setDetails(s => openCourse(s, code,
      focus))`.
    - Renders `<CourseDetailsPanel>` when `details.code` is set, after
      `.planner-layout`.
    - `onRemove` calls `performRemove(details.code)`.
  - The three card components and `CourseSearch` take `onOpenDetails:
    (code: string, focus?: DetailsFocus) => void` and lose their
    `detailsOpen` state and `<CourseDetail>`.
    - The CourseCard verify badge calls `onOpenDetails(code,
      "requisites")`.
    - `Timeline` and `Sidebar` thread the prop down.
- **Refactor:**
  - Remove the dialog exclusions and the innerText workarounds listed in
    this file's §3.
  - Delete `CourseDetail.tsx` and any CSS rules left without markup.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `grep -rn "<dialog\|CourseDetail\b" src/components` finds nothing.
  - Every Details entry point opens the one panel.
- **Depends on:** Task 4.

### Task 6: Requisites section with checks inside the tree; incompatible, co-taught and "needs it"

- [x] **Description:** WR9 §3 and §4.
  - Rewrite `RequisiteTree` so each unverifiable leaf holds its own Met /
    Not met / Not sure control, and add an unmarked mode for unplaced
    courses.
  - Add P&C's original wording, "Can't take with", "Taught with", and
    "Courses in your plan that need it".
- **Files touched:**
  - `src/components/RequisiteTree.tsx`
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/CourseDetailsPanel.tsx`
  - `spec/layout.test.ts` ("manual checks" suite)
- **Tests first (red):**
  - `planner-logic.test.ts`:
    - `unmarkedStatus(expr)`: for `and[course A, unverifiable "X"]`, returns
      the same shape with `ok: null` at every node and `answer: null` on
      the leaf.
    - `prereqCodes(expr)` returns every `course` leaf's code, deduplicated.
    - `dependentsOf(view, "COMP2100")`, on the example view, includes
      "COMP2120" and excludes courses that aren't placed. It's ordered by
      term, then code.
    - `postgradLabel("COMP6442")` is "COMP6442 (postgraduate)", and
      `postgradLabel("COMP2100")` is "COMP2100".
  - `spec/layout.test.ts`, rewriting "manual checks" :2380-2518 to target
    the panel:
    - Each unverifiable node in the tree contains a `role="group"` with
      three buttons, "Met", "Not met" and "Not sure", using `aria-pressed`.
    - The verify badge opens the panel with focus on its "Requisites" h3.
    - Choosing "Met" updates the card's badge as before, and the node shows
      "Marked by you".
    - On read-only plans the three buttons are disabled.
    - "As written on Programs & Courses" contains COMP2100's
      `requisiteRaw`.
    - COMP2100's panel lists "COMP6442 (postgraduate)" under "Taught with"
      and "Can't take with".
    - "Courses in your plan that need it" lists COMP2120, and clicking it
      opens COMP2120's details. History back returns to COMP2100.
    - An unplaced course (open COMP4680 from its requirement card) shows
      the tree with no ✓ or ✗ glyphs.
- **Implementation (green):**
  - `planner-logic.ts` gains:
    - `export function unmarkedStatus(expr: ReqExpr): RequisiteStatus`
    - `export function prereqCodes(expr: ReqExpr | null): string[]`
    - `export function dependentsOf(view: PlanView, code: string): string[]`
      (placed courses whose `view.courses[c].prereq` contains `code`)
    - `export function postgradLabel(code: string): string` (a 6 or 8 as
      the first digit means postgraduate)
  - `RequisiteTree.tsx`. New props:

    ```ts
    interface Props {
      node: RequisiteStatus;
      marks: boolean;
      checks: VerifyCheck[];           // placement.checks, or [] when unplaced
      disabled: boolean;               // read-only or a save in flight
      pending: { item: string; value: CheckAnswer | null } | null;
      onAnswer: (item: string, value: CheckAnswer | null) => void;
      onOpen: (code: string) => void;  // a course leaf's code link
    }
    ```

    - A leaf's status glyph is a `span.mark` with an accessible label: Met,
      Not met, or Needs your check.
    - A `course` leaf's code is a button calling `onOpen` when the code is
      in `view.courses`. The panel passes that check in through `onOpen`'s
      closure.
    - An unverifiable leaf finds `checks.find(c => c.item === node.text)`,
      shows `check.label`, and renders the 3-button group. The
      `pendingCheck` behaviour moves here from the old dialog, calling
      `setCheck` through the panel.
  - The panel's §3 and §4 use these, plus `card.requisiteRaw`,
    `card.incompatible` and `fetched.data?.extras?.cotaught`. When an
    incompatible course is placed, show the warning "<CODE> is also in your
    plan".
  - `card.otherPrograms` (ruled 2026-09-28) stays as a small list in §3,
    below the tree and above "As written on Programs & Courses".
  - This replaces Task 5's interim Requisites block. The "Requisites" h3
    and its focus target stay.
  - **As built (2026-09-28), two signature corrections:**
    - `RequisiteStatus` types `ok` as `boolean` on course, units and
      program leaves, so an all-null tree can't be one. `unmarkedStatus`
      returns a UI-side `TreeStatus` from `planner-logic.ts`: the same union
      with `ok: boolean | null` everywhere. `RequisiteTree`'s `node` takes
      `TreeStatus`, and a `RequisiteStatus` is assignable to it. The domain
      type is unchanged.
    - A `(code) => void` callback can't tell the tree whether to draw a
      code as a button. `RequisiteTree` takes `canOpen: (code: string) =>
      boolean` alongside `onOpen`, and the panel passes
      `c => c in view.courses`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - The old "Your checks" fieldsets are gone.
  - Answers persist through the existing `/checks` API.
- **Depends on:** Task 5.

### Task 7: "When it runs" strip, offerings table, provenance footer; focus, Escape, scroll-to-card, `aria-current`

- **Description:** WR9 §2 and §6, WR13, WR14, and the `aria-current` part of
  WR18.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/CourseDetailsPanel.tsx`
  - `src/components/Planner.tsx`
  - `CourseCardHeader.tsx`, `PlacedCourseRow.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - `planner-logic.test.ts`, `stripCells(view, code, card)` on the example
    plan for COMP2100 (placed in term 2):
    - It returns 8 cells, in term order.
    - Cell 2 has `state: "here"`.
    - Cell 0 has `state: "offered"` and `allowed` as given by
      `dropTargets`. Completed terms can be allowed.
    - A term in `card.hardBlocked` gives `state: "not-offered"`,
      `allowed: false` and the `reason`.
    - A term in `card.projectedTerms` gives `state: "projected"`.
    - `card.offeringUnknown` gives `state: "unknown"`.
    - `units` equals `view.terms[i].units`.
    - `actionLabel` is "Move to S1 2027" for a placed course and "Place in
      S1 2027" for an unplaced one.
    - For a two-semester course, the second occupied term has
      `state: "part2"`.
  - `planner-logic.test.ts`, `weightLabel("30")` is "30%", and
    `weightLabel("Hurdle")` is "Hurdle".
  - `spec/layout.test.ts`, `describe("details sidebar")`:
    - "strip moves a course": on an editable plan with COMP2100 in term 2,
      activating the "Move to S2 2027" cell moves it. The card is now in
      `section[data-term="1"]`, and the panel stays open on COMP2100.
    - "strip refuses a non-offered term": the refused cell is disabled and
      its accessible description is the reason.
    - "offerings table": COMP2100 shows a row with "In Person" and "5103".
    - "footer provenance": the footer contains "Open COMP2100 on Programs &
      Courses" linking to the course URL, and "updated".
    - "focus": opening from a card title focuses the panel's h2; the verify
      badge focuses the Requisites h3; Close returns focus to the control
      that opened the panel.
    - "Escape closes when focus is inside": pressing Escape while focus is
      inside the panel closes it.
    - "scroll to card": opening a placed course from its requirement row
      scrolls its timeline card into view, without moving focus to it.
    - "aria-current": the open course's card title and row title have
      `aria-current="true"`, and no other title does.
- **Implementation (green):**
  - `planner-logic.ts`:

    ```ts
    export interface StripCell {
      term: number; label: string; year: number; session: "S1" | "S2";
      state: "here" | "part2" | "offered" | "projected" | "not-offered" | "unknown";
      units: number; allowed: boolean; reason: string | null; actionLabel: string;
    }
    export function stripCells(view: PlanView, code: string, card: CourseCard): StripCell[];
    export function weightLabel(weight: string): string;
    ```

  - The panel's §2 is a grid of `button.strip-cell`, one per year column.
    Each cell shows the session, the state word, and "N of 24u".
    - `disabled` when not allowed or read-only.
    - `aria-label = actionLabel`, and `aria-describedby` points at the
      reason.
    - Clicking calls `onPlace(term)`, which is Planner's `performPlace(term,
      code)`.
  - Below the strip: a `table` with columns Semester, Delivery and Class
    number, from `extras.classes`. A two-semester course adds the note
    "Runs over two semesters in a row: N units in each, 2N in total."
  - §6 footer: the link, then "Details from Programs & Courses <year>,
    updated <d Mon yyyy>", formatted from `scrapedAt`.
  - Focus (WR14):
    - An effect on `details.token` focuses `h2` or the Requisites h3,
      depending on `details.focus`. Task 5 already built this; Task 7 adds
      its tests.
    - Planner stores `document.activeElement` when opening and restores it
      on close.
    - `onKeyDown` on the aside closes on Escape.
  - WR13: Planner's existing `setLocateRequest({code, token})`
    scroll-and-flash moves focus to the card. Add a `focus: false` option
    to `locateRequest` (`{ code; token; part?: 2; focus?: boolean }`), and
    have `Timeline`'s locate effect skip `focus()` when `focus === false`.
    `openDetails` calls it for placed courses with `focus: false`.
  - WR18: `CourseCardHeader` and `PlacedCourseRow` take `current: boolean`
    and set `aria-current={current ? "true" : undefined}` on the title
    button. Planner passes it in through `Timeline` and `Sidebar` as
    `openCode`.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - Every test above passes at 1920×1080. The strip and focus tests also
    pass at 390×844.
- **Human review:** the rendered panel for COMP2100, COMP4550 and MATH1115
  at 1920×1080 and 390×844, running the app (CLAUDE.md). A pass means:
  - the header, sections and strip read clearly and in the WR9 order
  - nothing is clipped
  - the controls look interactive
  - you're happy with the wording

  Region styling comes later (Phase 05), so judge content and layout, not
  finish.
- **Depends on:** Task 6.

## 6. Phase Definition of Done

- [ ] Tasks 4–7 complete, with tests passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] No `<dialog` in any planner render
- [ ] `/plan/example?course=COMP2100` renders the panel on the server
- [ ] Task 7 human review accepted by the user
- [ ] Tick Phase 02 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR5, WR8, WR10–WR12 | Task 5 (WR8 plumbing in Task 4) |
| WR6 | Task 5 |
| WR7 | Task 5 |
| WR9 §1, §5 | Task 5 |
| WR9 §3, §4 | Task 6 |
| WR9 §2, §6 | Task 7 |
| WR13, WR14 | Task 7 |
| WR15 | Tasks 5, 6, 7 |
| WR18 (aria-current) | Task 7 |
| NFR axe / invariants | Task 5 |

## 8. Risks / open questions

None.
