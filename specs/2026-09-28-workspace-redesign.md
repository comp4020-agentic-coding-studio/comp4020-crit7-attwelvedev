# Workspace redesign: details sidebar, regions, free resizing

- **Date:** 2026-09-28
- **Status:** Approved
- **Approved by user:** yes, 2026-09-28
- **Visual reference:** the approved mockup, version 4:
  https://claude.ai/artifact/CYXpgf526edaSgxFHaUwwQ. It's a static
  prototype. Its requisite trees are hand-written and its allocation is
  fixed, so treat it as the source for look and interaction only, never for
  domain logic.

## 1. Problem / intent

The planner is meant to be a layer on top of Programs & Courses (P&C) that
adds the one thing P&C lacks: program planning. Today a course's details open
in a modal `<dialog>` that covers the plan. It shows little beyond the
description and the requisites, so students still go to P&C for outcomes,
assessment and delivery.

The user wants a professional, institutional details view that sits beside
the plan. That lets a student compare a course against their timeline and
requirements while still interacting with both. The user also wants the
dashboard refined: distinct regions with subtle borders and large radii in
the style of the IntelliJ New UI, plus a controlled use of Apple-style
frosted glass.

The agreed rule for combining the two: **solid regions for structure, glass
only for layers that float over scrolling content.**

## 2. Requirements

Numbering is local to this spec (WR = workspace redesign).

### 2.1 Functional requirements

**A. Course data**

- WR1. `fromPandc` and the seed carry these existing JSON fields through to
  the database and the domain:
  - `learning_outcomes`: an array of strings.
  - `assessment`: an array of `{task, weight}`, with weight kept as the
    verbatim string, e.g. "30%".
  - `cotaught`: course codes.
  - Each offering's `mode` and `class_number`, kept per offering. Offerings
    are no longer reduced to `{year, session}` in storage; feasibility still
    uses year and session.
- WR2. A new read-only endpoint returns one course's full details: all of
  `CourseCard`, plus the WR1 fields and `scrapedAt`. These fields are **not**
  added to `PlanView.courses`, so the plan payload doesn't grow.
- WR3. Courses fetched live from P&C through search (`isStub`) have none of
  the WR1 fields. The sidebar leaves those sections out and shows a line
  pointing to P&C for the full details.
- WR4. Workload and "Mode of delivery" (the page-level field) are out of
  scope (§2.3).

**B. Details sidebar, replacing `CourseDetail`'s dialog**

- WR5. A single `aside` labelled "Course details" replaces every per-card,
  per-row and per-search-result `<dialog>`. There is one instance per page.
- WR6. It opens from:
  - a card title, a placed-row title, or a search result
  - "Details" in a card's ⋯ menu
  - the verify badge, which lands focus on the Requisites section
  - any course-code link inside the sidebar
  - Enter in the search palette

  Opening a course never happens as a side effect of dragging, placing,
  searching or moving.
- WR7. The header has:
  - back and forward through the courses opened in this session
  - a narrow/wide toggle (WR36)
  - Close
  - ~~a drag grip (not on completed or read-only courses)~~ *Amended in Phase 02 review, 2026-09-29:*
    removed. Dragging a sidebar onto the timeline is an odd gesture, and
    the "When it runs" strip already places the course in one click.
  - the code, units, level and title
  - status pills: planned or completed term, "Counts toward", and the
    requisite state
- WR8. The open course is reflected as `?course=CODE` using
  `history.replaceState`, so no history entries are added.
  - A page load with `?course=` renders the sidebar open on the server,
    including the WR2 details.
  - An unknown code is ignored and the sidebar stays closed.
- WR9. Content, in order:
  1. **In your plan.** *Amended in Phase 02 review, 2026-09-29:* shown only for a placed course; the
     header pills already say the semester, so there's no status line.
     - The "Counts toward" pin menu, with today's `setPin` behaviour and help
       text, built from the same popup as the header's "Completed through"
       menu (no native picker).
     - A Remove button (today's remove with undo), styled as destructive
       (red), as is the card menu's Remove. Completed courses have it too,
       as the card menu does.
  2. **When it runs.**
     - A strip of every term in the plan, grouped by year. Each cell shows
       its state (in your plan / part 2 / offered / projected / not offered /
       unknown) and that term's load, e.g. "18 of 24u".
       *Amended in Phase 02 review, 2026-09-29:* a term that runs the course but is refused has its own state
       and look: "Needs prereqs" (unreachable requisites) or "Can't
       start" (a two-semester course with no valid second term). "Not
       offered" is only for terms that don't run the course. On a
       read-only plan, cells keep their true state and are only disabled.
       A legend under the strip keys every cell style shown.
     - Selecting a cell moves or places the course, using the same
       allowed/refused rules and reasons as dragging (`dropTargets` /
       `hardBlocked`).
     - **Completed terms are allowed**, as today.
     - Accessible names read "Move to <term>" for a placed course and "Place
       in <term>" for an unplaced one.
     - Below the strip, a table of offerings with the columns Semester,
       Delivery and Class number. The semester reads "S1 2027", the format
       used everywhere else.
     - Two-semester courses explain their per-semester and total units.
  3. **Requisites.**
     - The requisite tree with each manual check's Met / Not met / Not sure
       control built into its node. This replaces the separate "Your checks"
       fieldsets.
     - P&C's original requisite text, labelled "As written on Programs &
       Courses".
     - "Can't take with" (incompatible) and "Taught with" (co-taught), with
       postgraduate 6xxx/8xxx codes labelled. A warning shows if an
       incompatible course is in the plan.
     - For a course not in the plan, the tree renders without met or not-met
       marks. *Amended in Phase 02 review, 2026-09-29:* plain dots stand in for the marks.
     - *Amended in Phase 02 review, 2026-09-29:* guide lines run from each "All of" / "One of" down to the
       items it governs. A course leaf shows its code (a link when it has
       details), its title, and a second line with its place in this plan:
       "Completed <term>", "Planned <term>" or "Not in your plan".
  4. **Courses in your plan that need it.** Placed courses whose prerequisite
     expression references this course, each linking to its own details.
  5. **About.**
     - The description, cut off after about 5 lines with "Read the full
       description" / "Show less".
     - Learning outcomes as a numbered list.
     - Assessment as a proportional bar plus a list of task and weight,
       labelled "Indicative, may change". *Amended in Phase 02 review, 2026-09-29:* each list item has a dot
       in its segment's colour, from an assessment palette of its own (not
       the requirement family colours).
  6. **Footer.** "Open <CODE> on Programs & Courses" and "Details from
     Programs & Courses <year>, updated <date>". *Amended in Phase 02 review, 2026-09-29:* every P&C link in
     the sidebar shows a ↗ icon, with "(opens in a new tab)" for screen
     readers.
- WR10. Loading and errors.
  - Sections 1–4 render immediately from `PlanView`. Only the WR2 fields
    load.
  - While they load, About shows a placeholder.
  - If the load fails, About says it couldn't load and links to P&C.
- WR11. When the open course leaves the plan (removed by menu, drag, the
  strip or Undo), the sidebar stays open in its unplaced state. It never
  closes on its own.
- WR12. It re-derives from every new `PlanView`, whatever produced it.
  *Amended in planning, 2026-09-28:* the first version also named changes
  from another tab arriving through `/api/events`. No client code listens
  to that endpoint (it's only an SSE stub, per `spec/events.test.ts`), so
  there's no cross-tab sync to follow. Adding one is out of scope.
- WR13. Opening a placed course scrolls its timeline card into view without
  moving focus.
- WR14. Focus.
  - Opening moves focus to the course heading. Opening from the verify badge
    moves it to the Requisites heading.
  - Close returns focus to the control that opened the sidebar.
  - Escape closes the sidebar when focus is inside it.
- WR15. Read-only plans.
  - Everything reads normally.
  - Strip cells, Remove, the pin menu and check controls are
    inactive or absent, following today's read-only rules (CR11).

**C. Linked highlighting (while a course is open)**

- WR16. The requirement group it counts toward is tinted and tagged "<CODE>
  counts here". Other groups it's eligible for are tagged "<CODE> could count
  here".
- WR17. Timeline cards show chips:
  - "Prerequisite of <CODE>", or "Prerequisite, planned too late" when it's
    placed after the open course.
  - "Needs <CODE>".
- WR18. The open course's card and row are marked selected: a gold ring, plus
  `aria-current="true"` on the title control.
- WR19. The "Show prerequisite links" overlay is unchanged and independent of
  these highlights.

**D. Region restyle**

- WR20. The planner becomes solid rounded regions (large radius, about 16px)
  on a slightly darker page background: Requirements, Timeline, and Details
  when open. Inside a region, structure is hairlines and headers, not nested
  boxes.
- WR21. Radius follows hierarchy: regions ≈16px, cards ≈9px, controls ≈8px.
  Draggable cards are the only card-shaped objects inside regions.
- WR22. Frosted glass is used only on floating layers:
  - sticky year headers
  - the sidebar's sticky header
  - the search palette
  - toasts
  - drag ghosts
  - the resize size label
  - the phone tab bar
  - the phone sheet header

  Each falls back to a solid surface under
  `prefers-reduced-transparency: reduce`.
- WR23. Timeline.
  - Terms are grouped into years under sticky, frosted year headers.
  - Each term head shows its units, the family colour bar (E1), and
    "Completed".
  - The region has fades at the scroll edges and ‹ › scroll buttons.
  - Term columns keep a fixed width and the region scrolls sideways.
- WR24. Requirements, in order:
  1. "What's left"
  2. "Total" with its bar
  3. "Checks": each check shows its progress bar and a plain note, such as
     "Room for 12 more units" or "Covered, with 12 units to spare"
  4. the groups

  The TDP check appears only under Checks, never in "What's left".
- WR25. Groups keep their current content and behaviour:
  - family dot and bar (CR21, E3)
  - choice radios
  - nested groups
  - placed-course rows (CR12–17; not draggable, and the term button locates
    the card)
  - option cards (CR7: draggable, "Place in…", offered sessions, no family
    stripe per CR22)

  Only spacing and chrome change. The card-height budget rules
  (course-card-redesign 06) still apply.
- WR26. The "Search courses" section is removed from Requirements (moved to
  WR27).

**E. Search palette**

- WR27. The plan page's header row, next to the title and the
  Completed-through control, holds a search field. On phones it's a 44px
  search button.
  - The field, the button and ⌘K / Ctrl-K each open a palette.
  - ⌘K or Escape closes it.
  - The site nav is unchanged.
- WR28. The palette keeps everything today's search does:
  - the same API
  - results as draggable cards with "Place in…", or as placed rows
  - the live P&C lookup, with today's outcome messages (`outcomeMessage`)
- WR29. Arrow keys move through results, and Enter opens the result in the
  sidebar.
- WR30. Starting a drag from a result hides the palette until the drag ends.
  The drop behaves like any other drop, and the palette closes afterwards.
- WR31. On phones the palette is full-screen.

**F. Free resizing (side-by-side layout)**

- WR32. Two focusable `role="separator"` dividers: Requirements|Timeline and
  Timeline|Details. The visible line is thin; the hit area is at least 44px.
- WR33. The Requirements divider resizes freely.
  - It has **soft snaps** at the rail and the 1, 2 and 3-column widths
    (today's 17.5 / 31.1 / 44.7rem, checked against the rendered grid).
  - Within about 16px of a snap, the divider is pulled to it. Otherwise it
    rests where released, and option cards stretch to fill the row.
  - The starting preference is as many columns as fit, up to 3.
  - Dragging well below the minimum folds to the rail.
  - The "Hide requirements" chevron stays on this divider (the
    course-card-redesign final ruling).
- WR34. The Details divider resizes freely.
  - Minimum about 360px, maximum about 960px.
  - Soft snaps at the default width (about 440px) and at 680px.
  - Dragging well past the minimum closes the sidebar.
- WR35. **What gives way.**
  - The timeline never goes below one academic year (`--timeline-min`).
  - When the three regions don't fit, Requirements steps down by whole
    columns (3 → 2 → 1 → rail) before the sidebar shrinks toward its
    minimum.
  - Auto-folding shows the notice "Requirements folded to make room for
    course details". The rail's accessible name says so.
  - Closing details, or widening the window, restores the preference.
  - Activating the rail while it's auto-folded narrows the sidebar to make
    room, or explains why it can't.
- WR36. The sidebar's body switches to two columns from its **own width**
  (a container query at ≥680px), not from a mode. The header toggle switches
  between the default and wide widths. Its pressed state reflects the actual
  width.
- WR37. The dividers show a frosted label while dragging: the snap name or
  the width, plus warnings such as "The timeline needs room for one year",
  "Release to fold requirements" or "Release to close details".
- WR38. Keyboard: with a divider focused:
  - ←/→ move 16px, Shift+←/→ move 64px.
  - Enter folds or unfolds Requirements, or switches Details between narrow
    and wide.
  - Home and End jump to the limits.

  `aria-valuenow/min/max` and `aria-valuetext` stay current.
- WR39. Double-clicking a divider resets it to its default.
- WR40. Widths are saved per browser (not per plan) in new `localStorage`
  keys.
  - They're applied before first paint by the `Base.astro` inline script.
  - Every access is in try/catch, and invalid values fall back to the
    defaults.
  - `panel-reqs` (folded) is kept.
  - `panel-reqs-cols` and `panel-split` are retired; old values are ignored.
- WR41. The rail and the expanded Requirements are still drop targets for
  removal (native and touch), with today's highlight.

**G. Mid widths**

- WR42. When the planner can't dock the sidebar beside a one-year timeline
  even with Requirements on the rail, but it's still above the phone
  threshold:
  - Details open as a drawer over the timeline from the right edge, with a
    frosted edge and shadow.
  - The drawer can't be resized, and the timeline stays scrollable and
    interactive underneath.
  - It docks again once there's room.

**H. Phones (below the existing stacked threshold, container < 49.5rem)**

- WR43. A floating, frosted Timeline / Requirements tab bar shows one region
  at a time. It replaces the stacked split, its handle, the stacked "Hide
  requirements" button and the collapsed bar (CW10–CW22).
- WR44. Details open as a bottom sheet.
  - It has three heights: peek (header only), half and full.
  - It floats above the tab bar at peek and half, and covers everything at
    full.
  - The handle cycles through the heights on tap and follows the finger on
    drag, settling at the nearest height.
- WR45. Dragging uses today's press-and-hold touch drag onto terms. Removing
  on phones is done from the ⋯ menu or the sheet's Remove.

**I. Undo toast and knock-on warnings**

- WR46. Every move, place or remove, whatever started it (drag, menu, strip,
  palette, sidebar), uses the existing undo toast. The wording matches the
  action names: "Moved X to T", "Placed X in T", "Removed X".
- WR47. If the change newly breaks another planned course's requisites, the
  toast names it, e.g. "COMP2120 now misses a prerequisite". Several broken
  courses are summarised as "N courses now miss a prerequisite", with the
  first one named.

**J. Help**

- WR48. The Help page is rewritten for:
  - the sidebar and its sections
  - the strip
  - the search palette and ⌘K
  - resizing, folding and resetting
  - the phone tabs and sheet

  Its tests are updated to match. Phrases that no longer exist are dropped
  from the required list.

### 2.2 Non-functional requirements

- **Accessibility**
  - Every control is at least 44px on its short side.
  - axe is clean in a real browser in each of these states:
    - sidebar closed
    - sidebar open, narrow
    - sidebar open, wide
    - drawer open
    - palette open
    - phone on each tab, with the sheet at each height
  - `spec/invariants.test.ts` still passes: one h1, the nav landmark, the SSR
    axe floor.
  - The sidebar is a complementary landmark.
- **Layout**
  - No horizontal page overflow at any desktop width, in any state.
  - The fitted page doesn't scroll vertically.
  - The card-height budget test passes, measured with no course open.
- **Motion**
  - Only in response to user actions: the sidebar opening, closing and
    changing width, sheet height changes, and the drawer.
  - All of it is disabled under `prefers-reduced-motion`.
  - This deliberately supersedes the earlier specs' "no new animation" rule.
- **Performance**
  - The `PlanView` payload doesn't grow (WR2).
  - The view build test (under 50ms) still holds.
  - Glass on the sticky headers must not make scrolling visibly stutter on
    the marking machine. If it does, the solid fallback becomes the default
    for that layer.
- **Verification**
  - `pnpm check` is green before every commit.
  - Visual review at 1920×1080 and 390×844 (CLAUDE.md), plus 1280×800 (the
    fold order) and 900×800 (the drawer).

### 2.3 Out of scope

- Workload and page-level "Mode of delivery" (needs a scraper change and a
  re-scrape). This is a follow-up.
- Comparing two courses at once (pinning a course in the sidebar).
- Previewing requisite satisfaction per strip cell.
- Per-plan widths.
- Changes to the site nav, including its collapse.
- Making placed rows draggable (CR17 stands).
- Dropping onto Requirements on phones.
- Escape closing details when focus is outside them.
- Dark mode.

### 2.4 Assumptions (confirmed)

| Assumption | How confirmed |
| --- | --- |
| Details are fetched when a course opens, not bundled in PlanView | In the approved final summary (A) |
| The phone layout starts at the existing stacked threshold | In the approved summary (H) |
| The drawer is used exactly when docking can't keep a one-year timeline | User chose "Overlay drawer" |
| Timeline card anatomy is unchanged except the WR17 chips | Final sweep; earlier approved rulings apply |
| The "Hide requirements" chevron stays on the Requirements divider | Final sweep; the course-card-redesign final ruling applies |
| Per-section collapse (`sidebar-compact`) is unchanged | Final sweep |
| Completed terms are valid move targets | Verified in code (`dropTargets` uses `hardBlocked` only); stated in the summary |

## 3. Existing context

Verified by reading the code on 2026-09-28.

- **Catalogue**
  - Only `data/2027/courses/*.json` is loaded, through `import.meta.glob` in
    `src/lib/seed-input.ts:9`.
  - `db.ts` seeds the database on every boot through `seed.ts:131`, which
    calls `from-pandc.ts:32` (`fromPandc`).
  - `PandcCourseJson` (`from-pandc.ts:3-15`) ignores `learning_outcomes`,
    `assessment`, `cotaught` and `class_number`, and drops `mode` at :43.
  - The DB tables (`schema.ts:55-90`) are courses, course_offerings and
    course_requisites, with no columns for the WR1 fields.
  - `repo.ts:44` (`loadCatalogue`) rebuilds `CatalogueCourse`.
- **Live P&C fetch**
  - `fetch-pandc.ts` extracts title, units, requisites, description and
    offerings `{year, semester, mode}` only.
  - It's used at runtime by `api/courses/search.ts:44-56` for exact codes
    not in the DB, which marks them `isStub`.
- **View**
  - `CourseCard` is at `view.ts:62-81`, and `buildPlanView` at :204 includes
    every tree course, every placed course and their prerequisites
    transitively.
  - There's no payload budget. The only size-like check is the 50ms timing
    test, `view.test.ts:96`.
- **Dialog**
  - `CourseDetail.tsx` is rendered by `CourseCard.tsx:313`,
    `AvailableCourseCard.tsx:111` and `PlacedCourseRow.tsx:74`, each with its
    own `detailsOpen` state.
  - Only CourseCard passes `focusChecks`.
  - Search results render these same components.
- **Tests that depend on the dialog**
  - `spec/planner.test.ts:324-357`: `<dialog` markers, and the dialog
    holding the P&C URL.
  - `spec/layout.test.ts`: manual checks at :2380-2518 (radios, focus on
    "Your checks", read-only disabled), the row title at :2657, titles at
    :2743-2775, the menu's Details at :2818-2877, read-only at :2968, many
    `closest("dialog")` exclusions (:2532, 2579, 2604, 3452), and the Help
    phrases at :1811-1836.
- **Layout and resizing**
  - `Planner.tsx:263-320`: `.planner-layout` (container `planner`) >
    `.planner-panes`.
  - Snapping resize lives in `reqs-resize.ts`, `split-resize.ts` and
    `ReqsResizeHandle.tsx`. `reqs-fit.ts` reads `--reqs-fit` from CSS
    container queries: stacked below 49.5rem, 1/2/3 columns at
    49.5/63.1/76.7rem (`styles.css:1901-1965`).
  - `panel-state.ts` stores the keys `panel-nav`, `panel-reqs`,
    `panel-reqs-cols` and `panel-split`, applied by `Base.astro:18-27`.
  - Tests: `reqs-resize.test.ts`, `split-resize.test.ts`,
    `panel-state.test.ts`, and `spec/layout.test.ts` :88 and :114 (exact
    widths and columns), :375, :548, :1191, :1356-1690 and :2145.
- **Drag and drop**
  - Native drag on `CourseCard.tsx:141` and `AvailableCourseCard.tsx:71`.
  - Drop targets are `section[data-term]` (`Timeline.tsx:172`) and
    `aside#requirements` (removal, `Sidebar.tsx:376`).
  - Touch drag is `touch-drag.ts`: a 300ms hold, cancelled by more than 10px
    of movement, with `data-drag-code`.
  - Refusals come from `dropTargets()` (`planner-logic.ts:16-25`), with
    `hardBlocked` from `feasibility.ts:29`, and the server's 409
    (`plan-service.ts:53`).
- **Search**
  - `CourseSearch.tsx` is a `SidebarSection` between "What's left" and
    "Total" (`Sidebar.tsx:457`).
  - `api/courses/search.ts` returns `{status, courses, message}`.
  - There's no keyboard shortcut anywhere.
- **Requirements**
  - `Sidebar.tsx`: "What's left" at :418, Total and Checks at :472-505
    (`li[data-check]` with a ProgressBar), `Group` at :97-266.
- **Read-only**
  - `CourseCard.tsx:258` renders no menu, and there's no drag or grip.
  - `AvailableCourseCard.tsx:42/97` renders no "Place in…".
  - The dialog's controls are disabled.
  - `dropTargets` refuses every drop.
  - The server returns 403.
- **Help**
  - `help.astro` :12-19, :44-52 and :97-102 describe Details, "Your checks"
    and "Pin to".

## 4. Design

- **Data flow**
  - The WR1 fields are stored in the DB (new columns or tables through a
    Drizzle migration; planning decides which).
  - `PlanView` is unchanged apart from anything the sidebar needs that's
    cheap.
  - A `GET` course-details endpoint serves WR2.
  - The plan page reads `?course` on the server, fetches the same details,
    and renders the sidebar open, so there's no loading flash and the SSR
    tests have something to check.
- **Selection state**
  - Held once in `Planner` as `{open code, history stack, index}`.
  - Every former `detailsOpen` call site calls `openDetails(code, {focus})`
    instead.
  - The sidebar, the linked highlights (WR16–18) and the URL (WR8) all
    derive from it.
- **Layout engine**
  - A pure function, `(container width, preferences, sidebar open) →
    {reqs width | rail, details width, auto-folded, docked | drawer}`,
    unit-tested like `reqs-resize.ts` is today.
  - CSS sets the grid columns from custom properties that the head script
    sets before paint.
  - Snap targets come from the rendered card grid's overhead, measured once
    per drag start, not hard-coded. In the mockup a hard-coded 444px
    "two-column" snap still rendered one column.
- **Why this over the alternatives**
  - **Sidebar over a modal:** the user wants to compare in context; a modal
    blocks that.
  - **Wide as a width, not full screen:** full screen is the modal again.
  - **Soft snaps over hard snaps:** the user chose finer control. Stretched
    cards between snaps are accepted.
  - **Free with fixed-width cards:** rejected because of the empty space it
    leaves.
  - **Details fetched on open, not bundled:** bundling would add
    outcomes and assessment for every course in the tree and its
    prerequisites to every plan load.
  - **Tabs over the stacked split on phones:** three layers (timeline,
    requirements, sheet) don't fit 844px of height.
  - **Glass only for floating layers:** glass over dense text lowers
    contrast and costs scroll performance, and it clashes with ANU's flat
    identity. Solid regions carry the structure.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | gap | Dragging missing from the mockup; is it retained? | Retained everywhere it exists today; the mockup gained it in v2 |
| 2 | contradiction | Mockup hid requirement option cards, the drag sources | Restored as draggable cards (WR25) |
| 3 | gap | Check progress bars and "What's left" lost in the mockup | Restored (WR24) |
| 4 | ambiguity | TDP shown twice | Only under Checks (WR24) |
| 5 | assumption | Drops on non-offered terms | Refused, as the real app does |
| 6 | contradiction | Collapsible-panels ruled free widths out of scope and saved column counts | Superseded by WR33–40 at the user's request |
| 7 | ambiguity | "Same snap points as before?" | Same 1/2/3-column targets, soft rather than hard (WR33) |
| 8 | contradiction | Mockup refused moves into completed terms; the app allows them | Follow the app (WR9) |
| 9 | contradiction | Mockup made placed rows draggable (CR17 says not) | CR17 stands |
| 10 | contradiction | Mockup dropped the ⋯ menu and "Place in…" (CR5, CR7) | Kept; they're the keyboard and touch route; Details opens the sidebar |
| 11 | contradiction | Mockup replaced the left nav with a top bar | Nav unchanged; search goes in the plan header row (WR27) |
| 12 | contradiction | Approved phone stacked split (CW10–22) | Replaced by tabs and a sheet (WR43–45) |
| 13 | gap | Mid widths can't dock details | Overlay drawer (WR42) |
| 14 | gap | Inline search section vs palette | Section removed; palette keeps all behaviour (WR26–31) |
| 15 | gap | SSR tests assert the dialog; selection had no URL | `?course=` with replaceState; SSR renders the sidebar (WR8) |
| 16 | gap | Workload isn't scraped | Out of scope, follow-up (WR4) |
| 17 | gap | Payload growth from adding the new fields to every course | Fetched when a course opens (WR2, WR10) |
| 18 | gap | Loading and error states for fetched details | WR10 |
| 19 | ambiguity | Action vocabulary (Add / Place / Move) | Matches existing names (WR9, WR46) |
| 20 | gap | Open course removed, or plan changed elsewhere | Sidebar stays and re-derives (WR11–12) |
| 21 | gap | Selection changing as a side effect | Never (WR6) |
| 22 | gap | Selected state shown only by colour | `aria-current` (WR18) |
| 23 | contradiction | 44px targets vs thin dividers and icon buttons | Visible lines thin, hit areas at least 44px |
| 24 | contradiction | Earlier specs' "no new animation" | Superseded for action-driven motion only, with reduced motion respected |
| 25 | gap | Timeline gives no cue that it scrolls sideways | Year headers, edge fades, scroll buttons (WR23) |
| 26 | gap | Hard-coded snap widths ignored padding and the scrollbar (found in the mockup) | Snaps measured from the rendered grid (§4) |
| 27 | gap | Knock-on breakage after a move is silent | Toast names it (WR47) |
| 28 | gap | Moves can overload a term unnoticed | Units per term in the strip (WR9) |
| 29 | gap | Phone sheet only responds to taps | The handle follows a drag too (WR44) |
| 30 | assumption | Unplaced course's tree status | Rendered without marks (WR9) |
| 31 | assumption | Hide-requirements chevron and per-section collapse | Unchanged, per earlier rulings |
| 32 | contradiction | WR12 assumed cross-tab updates through `/api/events`; planning found no client listener | WR12 narrowed to re-deriving from every new view; cross-tab sync out of scope |

## 6. Handoff notes for planning

- **Supersedes these approved rules:**
  - collapsible-panels FR17 and FR21, and its out-of-scope "free widths"
  - compact-plan-workspace CW10–CW22
  - the search section's placement
  - course-card-redesign CR2, CR9 and CR5.1: "Details" now opens the
    sidebar, not a dialog
  - the Help phrase requirements that mention the dialog
  - "no new animation"

  Everything else in earlier specs stands, especially the CR card anatomy,
  CR17, CR22 and the card-height budget.
- **Suggested phases**, each shippable on its own:
  1. Course data and the details endpoint.
  2. The sidebar and its content, replacing the dialog, with `?course=` and
     rewriting the dialog-dependent tests.
  3. Linked highlighting and knock-on toasts.
  4. The search palette, removing the inline section.
  5. The region restyle and timeline chrome.
  6. Free resizing, the layout engine and the mid-width drawer.
  7. Phone tabs and sheet.
  8. Help and final review.

  Phases 5 and 6 don't depend on the sidebar's content.
- **Tests to rewrite, not just delete:** `spec/layout.test.ts`'s exact width
  and column assertions (:88, :114) and the resize-handle suite
  (:1356-1690). Keep equivalent guarantees: the timeline's one-year minimum,
  snapping, keyboard control, saving, and no overflow.
- **Suggestion, not a requirement:** after phase 2, run a short test with
  2–3 students on the working sidebar before the restyle. Example tasks:
  "When does COMP3600 run? Move it to your final year." "Which requirement
  could COMP3670 count toward?" "What's assessed in COMP2100?" This is
  PROCESS.md evidence, and anything it changes can go into phase 5.
- **Don't reopen:**
  - soft snaps
  - the fold order (Requirements first)
  - the drawer at mid widths
  - tabs and sheet on phones
  - search in the header
  - `?course` with replaceState
  - workload out of scope
  - rows not draggable
- **Mockup source for reference:** see the published artifact above. It
  isn't committed.
