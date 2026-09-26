# Degree Planner — Phase 06: Planner UI

- **Date:** 2026-09-26
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-26
- **Part of:** `plans/2026-09-26-degree-planner-00-overview.md`. Read it first:
  §4.3 `PlanView` (the whole UI renders from it) and §4.4 API contract.
- **Depends on phases:** 05.

## 1. Summary

Turn the server-rendered skeleton into the interactive planner:
- an 8-column timeline and the requirement sidebar with two-segment progress bars
- course cards with state badges and a keyboard-accessible "Place in…" control
- native drag-and-drop that greys hard-blocked terms with their reasons
- the movable cutoff line, selectable-group choosers and suggestion buttons
- a detail dialog with the requisite tree and pinning
- a hover/focus SVG overlay linking a course to its placed prerequisites

## 2. Requirements (this phase)

### 2.1 Functional

This phase implements the UI side of FR12, FR16, FR17, FR21, FR22, FR24 and
FR25, plus FR26, FR28, FR29, FR30, FR31, FR32 and FR34 (the badge). The full
text is in overview §2.1.

### 2.2 Non-functional

- Every drag action has a keyboard, screen-reader and touch equivalent.
- States and reasons are available as text, not only colour.
- axe passes on `/plan/example`.
- At 375 px the page doesn't scroll horizontally; the timeline scrolls within
  its own region.

### 2.3 Out of scope for this phase

Course search and fetch (Phase 07).

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-26)

- **`spec/invariants.test.ts`** (don't edit) runs on every route in
  `spec/routes.ts` (`["/", "/readme/", "/plan/example"]` after Phase 02). It
  parses the server-rendered HTML in jsdom (`runScripts: "outside-only"`, so
  **client JS does not run**). It asserts exactly one `h1`, a `nav`, `lang`, a
  title, a viewport meta tag and img alt, and runs axe with `color-contrast` and
  `link-in-text-block` disabled. The server render therefore has to be
  accessible on its own. For example, the `<dialog>` must be closed in the
  server render.
- **`src/pages/plan/[id].astro`** (Phase 02) uses `src/layouts/Base.astro` (the
  shared head and nav) and renders `<Planner client:load view={view} />`, with
  a 404 "Plan not found" branch.
- **`src/components/Planner.tsx`** (Phase 02): `props: { view: PlanView }`. It
  renders `<section data-term={i}>` columns with placed cards
  (`data-placed={code}`) and a list of group labels. The page also shows
  `data-cutoff` after Phase 05.
- **`src/styles.css`**: the starter's global stylesheet, imported by the pages.
- Preact is integrated via `@astrojs/preact` (`astro.config.ts`
  `integrations: [preact()]`). `tsconfig.json` has `"jsx": "react-jsx"` and
  `"jsxImportSource": "preact"`.
- `spec/planner.test.ts` (HTTP) already covers plan creation, placement,
  persistence, read-only and the cutoff/choice/pin APIs.

### Interfaces from earlier phases (exact)

- `PlanView`, `GroupView`, `CheckView`, `CourseCard` and `PlacementView`
  (overview §4.3). `PlacementView` includes `state`, `reasons`, `suggestions`
  (`{ code, action: "place" | "move", term, text }`), `verify`, `conflictWith`,
  `loser`, `completed`, `placedPrereqs`, `unplacedPrereqs`, `requisiteStatus`
  (a `ReqExpr` with `ok: boolean | null` per node), `countsToward` and `pinned`.
  `CourseCard.hardBlocked: Record<number, string>` is plan-independent and
  drives drag feedback.
- The endpoints in overview §4.4. Errors are `{ error }` with 400, 403, 404
  or 409.

## 4. Approach

Keep interaction logic that can be unit-tested in
`src/components/planner-logic.ts` (pure functions over `PlanView`) and network
calls in `src/components/api.ts`. Every successful call replaces the component's
`view` state with the returned `PlanView`, and every error is announced in an
`aria-live` region. Nothing is recomputed client-side except drag feedback,
which reads `hardBlocked`.

## 5. Task breakdown

### Task 14: Planner UI: timeline, sidebar, cards, "Place in…", drag-and-drop, cutoff, choosers

- **Description:** FR17 (UI side), FR18, FR22 (UI), FR25 (UI), FR26, FR27 (UI),
  FR28 (incl. course cards per group), FR29 and FR32, with the responsive and
  accessible layout.
- **Files touched:**
  - `src/components/Planner.tsx`
  - `src/components/Timeline.tsx`, `Sidebar.tsx`, `CourseCard.tsx`,
    `PlaceInMenu.tsx`, `ProgressBar.tsx`, `AvailableCourseCard.tsx` (new)
  - `src/components/planner-logic.ts` (new), `src/components/api.ts` (new)
  - `src/components/planner-logic.test.ts` (new)
  - `src/styles.css`, `spec/planner.test.ts`
- **Tests first (red):**
  - `planner-logic.test.ts`:
    - `dropTargets(view, code)` returns, for each of the 8 terms,
      `{ term, allowed: boolean, reason: string | null }`, matching
      `courses[code].hardBlocked`.
    - `progressSegments(completed, planned, required)` returns percentages
      clamped to 100 in total.
    - `readOnly disables every target`.
  - `spec/planner.test.ts` (server-rendered HTML):
    - `/plan/example` renders a two-segment progress bar per group as
      `role="progressbar"` elements with `aria-valuenow`, and text
      "N completed, M planned of R".
    - `Place in… for COMP3630 omits S1 2027`, the term it can't be placed in
      (changed post-review — see §8 note).
    - `soft-blocked cards expose their state as text` ("Needs prerequisites").
    - `the empty plan shows the hint` "Drag a course onto a semester, or use
      Place in…".
    - `the cutoff has keyboard buttons` ("Move cutoff earlier" / "later").
    - the program checks (`lvl1000-max`, `comp4000-min`, `tdp-min`) render
      using the same two-segment progress bar as groups (`role="progressbar"`,
      text "N completed, M planned of R"); `tdp-min` (`ok: null`, untracked)
      shows "not tracked — verify on P&C" instead of a progress bar.
- **Implementation (green):**
  - Native HTML5 drag-and-drop on cards (`draggable`, `dataTransfer` carrying the
    code). While dragging, a column is greyed and shows its reason when
    `dropTargets` says it isn't allowed; a disallowed drop does nothing and
    announces the reason in an `aria-live="polite"` region.
  - `PlaceInMenu`: a `<button aria-haspopup>` opening a list of only the terms
    `dropTargets` says are allowed (changed post-review: matches what a drag
    can actually do, rather than listing every term with the blocked ones
    merely marked `aria-disabled`).
  - `api.ts`: `placeCourse(planId, code, term): Promise<PlanView | { error: string }>`,
    plus the equivalents for remove, cutoff, choice and pin. On a 409, the error
    is shown in the live region.
  - Hard-blocked placed cards are greyed, with the reason shown as text and as a
    `title`. Soft-blocked cards get an amber dashed border, the text "Needs
    prerequisites", and suggestion buttons.
  - The timeline sits in an `overflow-x: auto` region, and the page doesn't
    scroll horizontally at 375 px.
  - Read-only mode shows the banner and disables all controls.
  - The sidebar renders `view.checks` above (or below) the group list: each
    check as a labelled progress element, except `ok === null` which renders
    the "not tracked — verify on P&C" text instead (FR27, FR36).
  - Each leaf group (`children.length === 0`) lists its `courses` not
    currently in `view.placements` as small draggable `AvailableCourseCard`s
    (code, title, units, offered label, a "Place in…") — the only way to get
    an unplaced course onto the page to drag before Phase 07's course search
    exists. `draggingCode` state moves up to `Planner.tsx` so a drag started
    from the sidebar still greys disallowed timeline columns.
- **Refactor:** None expected.
- **Acceptance criteria:**
  - The tests pass, and the invariants and axe pass on `/plan/example`.
  - No horizontal page scroll at 375 px (checked in the browser).
- **Human review:** the user drives `/plan/<new id>` in Chrome at desktop width
  and at 375 px. They drag a course in, try a hard-blocked term (greyed, with a
  clear reason), use "Place in…" by keyboard only, move the cutoff, and choose a
  specialisation. It passes when the user explicitly accepts the look, feel and
  clarity.
- **Depends on:** 13.

### Task 15: Detail panel, pinning UI, badges, and the hover/focus prerequisite overlay

- **Description:** FR12 (UI), FR24 (UI), FR30, FR31 and FR34 (badge).
- **Files touched:** `src/components/CourseDetail.tsx`, `RequisiteTree.tsx`,
  `PrereqOverlay.tsx` (new), `src/components/Planner.tsx`,
  `src/components/planner-logic.ts`, `planner-logic.test.ts`, `src/styles.css`,
  `spec/planner.test.ts`.
- **Tests first (red):**
  - `planner-logic.test.ts`: `overlayEdges(view, code)` returns
    `{ from: string; to: string }[]` only for prereqs placed in earlier terms (or
    the same term for concurrent), and `unplacedCount(view, code)` is correct for
    COMP2100 alone.
  - `spec/planner.test.ts`:
    - the example page renders the verify badge on COMP4550 (text "Verify on
      P&C")
    - the "No published offering" badge appears on a placed COMP4600 in a new
      plan
    - each card has a "Details" button
    - the details for a course contain its P&C URL
- **Implementation (green):**
  - `CourseDetail`: a `<dialog>` (focus-trapped, Esc closes) showing the full
    description, the P&C link, `RequisiteTree` (nested lists with ✓/✗/"not
    checked" text), incompatibilities, `otherPrograms` notes, and a pin
    `<select>` of eligible groups plus "Automatic".
  - `PrereqOverlay`: an absolutely positioned SVG over the timeline, drawing thin
    lines between card centres from `overlayEdges`, for every placed course at
    once when a "Show prerequisite links" checkbox (`Planner.tsx`) is on
    (changed post-review — see §8 note; originally hover/focus-only).
- **Refactor:** None expected.
- **Acceptance criteria:** the tests pass, and axe passes (the dialog is closed in
  the server render).
- **Human review:** the user hovers or tabs to COMP3600 in the example plan and
  confirms the lines are legible and not noisy. They open the details for
  COMP4550 and confirm the requisite tree reads clearly, then pin MATH1013 and
  see its allocation label change. It passes when the user explicitly accepts it.
  (Superseded post-review by the "Show prerequisite links" checkbox — see §8.)
- **Depends on:** 14.


## 6. Phase Definition of Done

- [ ] Every task in §5 is complete and its tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` passes
- [ ] Invariants and axe pass on `/plan/example`
- [ ] In Chrome at 1280 px and 375 px: drag in, a hard-blocked term is refused with a reason, keyboard-only Place in…, cutoff move, choose ARIN, pin a course, open details, overlay on hover and focus, no horizontal page scroll
- [ ] Tasks 14 and 15's human reviews have been explicitly accepted by the user
- [ ] Tick this phase in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| FR12 (badge UI) | Task 15 |
| FR16 (buttons) | Task 14 |
| FR17 (UI) | Task 14 |
| FR21 (UI) | Task 14 |
| FR22 (UI) | Task 14 |
| FR24 (UI) | Task 15 |
| FR25 (UI) | Task 14 |
| FR26 | Task 14 |
| FR27 (UI) | Task 14 |
| FR28 | Task 14 |
| FR29 | Task 14 |
| FR30 | Task 15 |
| FR31 | Task 15 |
| FR32 | Task 14 |
| FR34 (badge) | Task 15 |
| NFR accessibility | Tasks 14, 15 |
| NFR responsive | Task 14 |

## 8. Risks / open questions

None. (Execution notes, 2026-09-26:
1. Phase 1 review found FR27 — program-wide checks — computed by Task 13 but
   never rendered by any task in the overview. Resolved by folding its
   rendering into Task 14's Sidebar, per user decision; overview §7 updated
   to match.
2. Mid-Task-14, found that no task in the overview ever renders a draggable
   card for a course that isn't already placed — that only arrives with
   Phase 07's `CourseSearch`. Task 14's own Human Review script ("drag a
   course in" on a brand-new plan) can't be run as written without it.
   Resolved, per user decision, by adding a minimal per-group
   `AvailableCourseCard` list to Task 14 (see §5 Task 14, files/implementation
   above) rather than deferring the review or improvising unscoped.
3. First Human Review pass on Task 14 was rejected on layout, not
   correctness, through two rounds:
   - Round 1: the plan's "sidebar" (a fixed-width column beside the
     timeline) made dragging a course from the requirement tree into the
     timeline inconvenient. Tried: `Sidebar` as a horizontal, `overflow-x:
     auto` strip of group cards below a sticky timeline, at all widths.
   - Round 2: full-width semester columns read better as a side-by-side
     layout, so the timeline needs to stay sticky beside a wide (not
     narrow) vertical sidebar on desktop, while keeping round 1's stacked
     layout on mobile.
   - Settled on (no interface/test changes either round): mobile-first CSS
     has `.planner` column, sticky `.planner-timeline-area` on top, and
     `Sidebar`'s `.requirements-scroll` as a horizontal strip below it; a
     `min-width: 768px` media query switches `.planner` to a row (`aside`
     at `order: -1`, `flex: 0 0 40%`) and `.requirements-scroll` back to a
     plain vertical list, with the timeline still sticky.
4. Two more findings from that same review round, both fixed directly:
   - Real bug: `.term ul` (a descendant selector) was matching every `<ul>`
     inside `.term`, including `PlaceInMenu`'s nested `<ul role="menu">` —
     its `display: flex` beat the `[hidden]` UA rule on specificity, so
     every "Place in…" menu rendered permanently open. Renamed the term's
     card-list class to `.term-cards` (an exact class, not a descendant
     selector) so it can no longer match unrelated nested lists.
   - Design ask, two more rounds: `.course-card` keeps a fixed `width: 13rem`
     everywhere (matching the timeline's term content width), including in
     the sidebar — but `.available-courses` (the per-group unplaced-course
     list) is `display: grid; grid-template-columns: repeat(auto-fill,
     13rem); justify-content: center`, so a group with several available
     courses wraps them into a multi-column grid of timeline-sized cards
     instead of one narrow column, and `justify-content: center` centers
     that block of whole columns so the sidebar's leftover width (rarely an
     exact multiple of the column width) splits into equal left/right
     padding rather than a single ragged gap on one side.
5. Real bug from that grid: cards touched/overlapped with no visible gap.
   `.course-card` used the browser default `content-box` sizing, so its
   `width: 13rem` plus its own padding and border rendered *wider* than the
   grid's 13rem column track, overflowing into the gap. Fixed by adding a
   standard `*, *::before, *::after { box-sizing: border-box }` reset (and
   dropping the now-redundant one-off `box-sizing` on `main`) rather than
   patching just this one card.
6. Several more rounds chasing a 3-column-grid card that visually crossed
   into the timeline. Two real, distinct bugs, found only by comparing
   `getBoundingClientRect()` numbers the user pasted from their own
   (Retina, 1124px-wide) browser against the same measurement in the
   session's own browser — identical numbers both times, which is what
   finally pointed at a rendering-vs-layout-box mismatch rather than a
   viewport/zoom difference:
   - `justify-content: center` (removed) plus `fit-content`-sizing the group
     box (also since reverted) fought CSS Grid's own rules in ways covered
     above; settled on left-aligned, uniform-width (`100%`) groups with an
     explicit per-group `repeat(min(courseCount, MAX_COLUMNS), 13rem)`
     column count (`Sidebar.tsx`) instead of `auto-fill`.
   - The actual root cause of the last, most persistent report:
     `.requirements-scroll` (a `<ul>`) reset only `padding-block-end`, never
     `padding-inline-start` — the ~40px UA default list indent silently
     narrowed every group's available content width, so the three explicit
     13rem grid tracks (plus gaps) needed more room than their container
     had. Because CSS Grid's explicit tracks don't shrink to fit and
     `overflow: visible` doesn't clip, the *painted* cards overflowed the
     group's border while `getBoundingClientRect()` on the grid container
     kept reporting its own (correctly-sized, non-overflowing) box — which
     is exactly why repeated DOM measurements kept saying "no overflow"
     while screenshots kept showing one. Fixed by resetting the list's
     padding fully (`padding: 0 0 0.5rem`).
   Also raised the desktop breakpoint 768px→1100px after finding a genuine
   page-level overflow in between (the fixed 42rem sidebar didn't fit
   alongside the timeline's non-shrinking cutoff-button controls at those
   widths), and switched unplaced-card borders from dotted to solid, since
   a dotted border's uneven rendering near a corner was hard to visually
   distinguish from a real overflow — both real fixes, though neither was
   this bug's actual cause.
7. The selectable-group `<label>`s (radio + text) rendered as plain inline
   elements with no styling, wrapping unpredictably. Made each `label` a
   `display: flex` row (one option per line, small gap, tight margin) — but
   the site-wide starter rule `input { flex: 1; min-width: 12rem }` (meant
   for the homepage's plan-id text field) was inherited by these radio
   inputs too, stretching each one into an invisible ~12rem box with the
   small circle painted only at its start — exactly the "huge gap before
   the label text" the user reported. Fixed by scoping an override
   (`.requirement-group label input { flex: 0 0 auto; min-width: 0 }`)
   rather than touching the shared `input` rule.
8. Four more design asks from the same review round, all implemented:
   - `PlaceInMenu` now filters to only `dropTargets`-allowed terms (see the
     note on Task 14's own test list above) instead of listing every term
     with blocked ones merely disabled.
   - Dragging an already-placed card onto the sidebar (`Sidebar.tsx`'s
     `<aside>`) now removes it, mirroring the drag-to-place flow: `onDrop`
     calls `removeCourse` when the dragged code is currently placed, a
     no-op otherwise (e.g. dragging an already-unplaced card onto itself).
   - The sidebar and timeline are now independent scroll regions at desktop
     (`position: sticky` plus `max-height: calc(100vh - 2rem); overflow-y:
     auto` on both `.planner > aside` and `.planner-timeline-area`) instead
     of one shared page scroll, so scrolling a long requirements list no
     longer requires scrolling past it to reach the bottom of a term
     column.
   - Real bug found while checking that suggestions claim: the suggestion
     button called `move(suggestion.term)`, which placed the *card's own*
     course at that term — not the suggested prerequisite
     (`suggestion.code`), so e.g. "Place COMP1100 in S1 2027" on COMP1110's
     card silently tried to move COMP1110 itself instead. Fixed with a
     dedicated `applySuggestion(code, term)` that places `suggestion.code`.
     The underlying claim (a suggestion always targets a non-hard-blocked
     term) still holds — the bug was the UI calling it with the wrong
     course, not evaluate.ts computing the wrong term.)
9. Task 15 human review, one round: three fixes, one design change.
   - The "N prereqs not placed" badge (FR31) showed on every card with any
     unplaced prereq, including `state: "available"` cards where an OR
     alternative was already satisfied — read as an error when it wasn't
     one. Scoped to `placement.state === "soft"` only.
   - `AvailableCourseCard.tsx` (unplaced/sidebar cards) had no "Details"
     button — added one, reusing `CourseDetail` (already handled a missing
     `placement` for the pin control and requisite-status display).
   - Design change: hover/focus-only prerequisite lines (as planned above)
     made a link spanning several off-screen terms hard to trace — hovering
     the source card to scroll away lost the line. Replaced with a
     "Show prerequisite links" checkbox (`Planner.tsx`) that, when on, draws
     every placed course's edges at once via `view.placements.flatMap(p =>
     overlayEdges(view, p.code))`, rather than only the hovered course's.)
