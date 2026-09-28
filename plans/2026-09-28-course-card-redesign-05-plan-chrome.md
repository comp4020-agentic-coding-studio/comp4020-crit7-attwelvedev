# Course card redesign — Phase 05: Plan chrome

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes — 2026-09-27; E2's scope and
  placement ruled 2026-09-28 (overview §2.4); E6 revised 2026-09-28
  during execution (§2.4, "E6 revision")
- **Part of:** `plans/2026-09-28-course-card-redesign-00-overview.md`. Read
  it first: E2, E6, E7, E9, §2.4 and §3.
- **Depends on phases:** none. It touches only the title row, term
  headers, the sidebar's hide button and the Total section, so it can run
  before or after Phases 01–04.

## 1. Summary

Four clarity fixes around the planner:
- **E6:** the completed-semesters chevrons, which looked like carousel
  arrows, become a "Completed through S2 2027 ▾" disclosure menu styled
  like More options and Place in….
- **E7:** past terms say "Completed" in their headers.
- **E2:** "Hide requirements" becomes a chevron button on the resize
  handle, outside the scrolling sidebar, so it neither floats over the
  content nor takes a row of its own.
- **E9:** the "Checks" subheading gets breathing room.

## 2. Requirements (this phase)

### 2.1 Functional

- **E6:** Task 14.
- **E7:** Task 15.
- **E2:** Task 16.
- **E9:** Task 17.

### 2.2 Non-functional

- The Completed menu's toggle is at least 44px tall.
- The title row still fits on one row at 1920 (CW4).
- The page doesn't overflow at either viewport.
- Axe clean.

### 2.3 Out of scope for this phase

- Help copy (Task 19). Until then, `/help/` still describes the chevrons.
  The Help tests at `spec/layout.test.ts:1422` stay green because Help is
  unchanged; Task 19 updates both together.

### 2.4 Assumptions

- See overview §2.4.
- **E6's last option** is labelled "All semesters" (cutoff 8).
- **E6 revision (user, 2026-09-28, mid-Task 14):** the native `<select>`
  looked out of place next to the More options disclosure, so E6 becomes
  a disclosure in the same design:
  - the toggle's visible text is `completedReadout().short` ("Completed
    through S2 2027", "Nothing completed yet", "All semesters completed")
    plus a chevron. It is the accessible name, and `readout.full` is the
    description;
  - the panel lists `cutoffOptions` as buttons, and the current one has a
    ✓ and `aria-current="true"`;
  - on read-only plans the control is plain text with no button (like
    CR11), not a disabled control.
- **Toggle width:** the toggle is sized to its widest possible label (all
  labels stacked in one grid cell, only the current one visible), so
  changing the cutoff doesn't move it or More options. Task 14's test
  checks this rather than assuming it.
- **Own component, not `MoreOptions`:** `spec/layout.test.ts` reads
  `document.querySelector(".more-options-panel")` and `.more-options-toggle`
  as the page's More options. A second instance earlier in the DOM would
  silently retarget those. `CompletedMenu` has its own classes, shares the
  panel's look by grouped selectors, and repeats MoreOptions'
  outside-press/Escape handling, as `PlaceInMenu` already does.

## 3. Existing code context (verified 2026-09-28)

**`src/components/Planner.tsx`:**

```tsx
async function moveCutoff(delta: 1 | -1) {
  const next = view.plan.cutoff + delta;
  if (next < 0 || next > 8) return;
  setCutoffPending(true);
  try {
    const result = await setCutoff(view.plan.id, next);
    if (isError(result)) setAnnouncement(result.error);
    else setView(result);
  } finally {
    setCutoffPending(false);
  }
}
// …
const readout = completedReadout(view.plan.cutoff, view.terms);
// …
<div class="plan-actions">
  <div class="completed-control" aria-busy={cutoffPending}>
    <span class="completed-readout" aria-hidden="true">{readout.short}</span>
    <span class="visually-hidden">{readout.full}</span>
    <button type="button" class="completed-step" aria-label="One fewer semester completed"
      disabled={readOnly || cutoffPending || view.plan.cutoff <= 0} onClick={() => moveCutoff(-1)}>…‹ svg…</button>
    <button type="button" class="completed-step" aria-label="One more semester completed"
      disabled={readOnly || cutoffPending || view.plan.cutoff >= 8} onClick={() => moveCutoff(1)}>…› svg…</button>
  </div>
  <MoreOptions …>…</MoreOptions>
</div>
```

**`src/components/planner-logic.ts`:** `completedReadout(cutoff, terms) →
{ short; full }`. `full` for cutoff 2 is "Completed through S2 2027 —
planned from S1 2028 onward. The gold line on the timeline marks that
boundary."

**`src/components/api.ts`:** `setCutoff(planId: string, cutoff: number):
Promise<ApiResult>`.

**`src/components/Timeline.tsx`**, term header: `<h2>{term.label}</h2><p
class="term-units">{term.units}/{NORMAL_TERM_UNITS} units</p>`. Phase 03
(Task 10) may already have added `div.term-bar` after it. Either order
works, because this phase only adds inside `p.term-units`. **If Phase 03
has run,** the h2 and `p.term-units` sit together in `div.term-head`, a
flex row with the count right-aligned on the heading's line, so
"Completed" shares that line. Task 15's header-height check is what
catches it wrapping in a 15rem column.

**`src/components/Sidebar.tsx`:**
- `<aside id="requirements" …>` holds `<button type="button"
  class="reqs-hide" ref={hideRef} aria-controls="requirements-content"
  aria-expanded="true" onClick=…><svg class="section-toggle-icon"
  …/>Hide requirements</button>`, then `button.reqs-rail`, then
  `ul.requirements-scroll#requirements-content`;
- the Total section renders `<section aria-label="program checks"><h3>Checks</h3><ul
  class="checks-list">…`.

**CSS (`src/styles.css`):**
- lines 476–488:
  ```css
  .reqs-hide, .reqs-rail { display: none; }
  .reqs-hide { align-self: flex-end; position: sticky; top: 0; z-index: 1; margin-block-end: 0.5rem; min-height: 2.75rem; }
  ```
- `.completed-control` (inline-flex, gap `0.25rem`), `.completed-readout`
  (0.9rem, 600, ink) and `.completed-step` (2.75rem square), lines 537–557;
- side-by-side collapsed block (≈1686): `.reqs-hide { display:
  inline-flex; align-items: center; gap: 0.35rem; }`, and
  `:root[data-reqs="collapsed"] .requirements-scroll,
  :root[data-reqs="collapsed"] .reqs-hide { display: none; }`;
- stacked block (≈1720): `.reqs-hide { display: flex; align-items:
  center; gap: 0.35rem; width: fit-content; margin-inline-start: auto; }`,
  `.reqs-hide .section-toggle-icon { transform: rotate(-90deg); }`, and
  the same collapsed hide rule;
- the aside is the vertical scroller in both layouts: `overflow-y: auto`
  in the side-by-side tier block (≈1403) and in the fitted stacked block
  (≈1515);
- headings: `h1–h6 { margin: 0 0 0.5rem; }`.

**Tests this phase supersedes:**
- `spec/planner.test.ts:284`, "the completed semesters have keyboard
  buttons" (the two `aria-label`s).
- `spec/layout.test.ts` `describe("completed-semesters row")`, tests at
  1349, 1371 and 1383. They use `.completed-readout`, the chevron names
  `fewer`/`more`, and clicks.
- `spec/layout.test.ts` `describe("plan title row")`:
  - `rowRects` reads `readout: .completed-readout`;
  - 1729 compares readout and h1 centres;
  - 1778 compares More options and readout centres;
  - 1811 is "stepping the completed semesters doesn't move the buttons",
    and clicks "One more semester completed".
- `spec/layout.test.ts:1422`, "Help describes the chevrons by name…".
  Task 19 replaces it, not this phase.
- `.reqs-hide` tests (530–590, 846–955, 1298) select `button.reqs-hide`
  and check its focus/visibility. Keep that class on the button, so they
  stay valid.

### Interfaces from earlier phases (exact)

None required. If Phase 03 has run, `div.term-head` (h2 +
`p.term-units`, one flex row) is followed by `div.term-bar`. Only
Task 15's placement depends on it (see above).

## 4. Approach

- **Completed menu:** a disclosure matching More options (see §2.4, "E6
  revision"). `aria-describedby` points at the existing full sentence.
  One `changeCutoff(next)` replaces `moveCutoff`.
- **Hide on the handle:** see Task 16's ruling. The button leaves the
  scrolling aside entirely and rides the resize handle as a zero-size
  flex item, so it can't float over content or take a row.

## 5. Task breakdown

### Task 14: "Completed through" menu replaces the chevrons

- [x] **Description:**
  - Add `cutoffOptions`.
  - Replace the readout span and both chevron buttons with a
    `CompletedMenu` disclosure (read-only: plain text), and `moveCutoff`
    with `changeCutoff`.
  - Update the superseded tests.
- **Files touched:**
  - `src/components/planner-logic.ts`
  - `src/components/planner-logic.test.ts`
  - `src/components/CompletedMenu.tsx` (new)
  - `src/components/Planner.tsx`
  - `src/styles.css`
  - `spec/planner.test.ts`
  - `spec/layout.test.ts`
- **Tests first (red):**
  - **Unit, `describe("cutoffOptions")`,** with 8 terms labelled "S1
    2027"…"S2 2030":
    - it returns 9 options;
    - `[0]` is `{ value: 0, label: "Nothing yet" }`;
    - `[1]` is `{ value: 1, label: "S1 2027" }`;
    - `[7]` is `{ value: 7, label: "S1 2030" }`;
    - `[8]` is `{ value: 8, label: "All semesters" }`.
    - With 3 terms, the values are 0–3, and 3 is "All semesters".
  - **`spec/planner.test.ts:284`,** renamed "the completed semesters have
    a menu":
    - the fresh plan's HTML has `button.completed-toggle` with
      `aria-expanded="false"`, an `aria-controls` naming the panel, and the
      text "Nothing completed yet";
    - it contains option buttons "Nothing yet" and "All semesters";
    - it doesn't contain `One more semester completed`;
    - the example's HTML has no `completed-toggle` and does contain
      "Completed through S2 2027".
  - **`describe("completed-semesters row")`** (`toggle =
    page.locator("button.completed-toggle")`):
    - **1349,** renamed "shows the read-only readout and More options on
      one row": on the example, `.completed-control` has no button, the
      `.completed-readout` text is "Completed through S2 2027", More
      options' centre is within 4px of the readout's, and there's no
      overflow.
    - **1371,** on an editable plan: the toggle is ≥ 44px tall, and More
      options' centre is within 4px of the toggle's.
    - **1383,** renamed "choosing a later semester completes it": on an
      editable plan, open the toggle and click the "S1 2028" option. Then
      `.planner` `data-cutoff` polls to 3, the panel is hidden, focus is
      on the toggle, the toggle's text is "Completed through S1 2028", and
      on reopening, "S1 2028" has `aria-current="true"` and is the only
      option that does.
    - **New:** the toggle's `aria-describedby` element text is
      `readout.full` ("Nothing on the timeline counts as completed yet. The
      gold line…" on a fresh plan).
    - **New:** Escape closes the open panel and returns focus to the
      toggle. Opening More options closes it, and opening it closes More
      options.
    - **New:** with the panel open, axe is clean and there's no horizontal
      overflow at 1920×1080 and 390×844.
  - **`describe("plan title row")`:**
    - `rowRects.readout` becomes `box(document.querySelector(".completed-toggle,
      .completed-readout"))`, and 1729 and 1778 are unchanged otherwise;
    - **1811,** renamed "at %i×%i changing the completed semesters doesn't
      move the controls": record the toggle's and `.more-options-toggle`'s
      boxes, choose the "S1 2029" option (cutoff 5), poll `data-cutoff` to
      5, and assert both boxes moved ≤ 1px.
- **Implementation (green):**
  - `planner-logic.ts`: `export function cutoffOptions(terms: readonly {
    label: string }[]): { value: number; label: string }[]`.
  - `CompletedMenu.tsx`: `export default function CompletedMenu({ view,
    open, onOpenChange, onChoose, pending }: { view: PlanView; open:
    boolean; onOpenChange: (open: boolean) => void; onChoose: (cutoff:
    number) => void; pending: boolean })`:
    - root `div.completed-menu` with MoreOptions' outside-press close and
      Escape-to-toggle handling;
    - `button.completed-toggle` (`aria-expanded`, `aria-controls` = the
      panel's `useId()`, `aria-describedby` = the full sentence's
      `useId()`). Its content is a `span.completed-toggle-labels` grid
      holding `completedReadout(i, view.terms).short` for i = 0…terms.length.
      Every label but the current one gets `aria-hidden`, and the current
      one gets `data-current`. The chevron `svg` comes after;
    - `div.completed-panel` (`hidden={!open}`), holding one `button` per
      `cutoffOptions(view.terms)`, with `aria-current="true"` and a leading
      `✓` (`aria-hidden`) on the current one, disabled while `pending`.
      Clicking calls `onChoose(value)`, closes the panel, and focuses the
      toggle;
    - the visually hidden full sentence `span`.
  - `Planner.tsx`:
    - `async function changeCutoff(next: number)` is the same body as
      `moveCutoff` without the delta, with a `0..view.terms.length` guard;
    - a `COMPLETED_MENU` key shares `openMenuCode` with MORE_OPTIONS and
      the course menus;
    - in `.completed-control` (`aria-busy` kept): read-only renders the
      old `span.completed-readout` (`aria-hidden`) plus the visually hidden
      `readout.full`; editable renders `CompletedMenu`.
  - `styles.css`:
    - remove `.completed-step`. `.completed-readout` keeps its text style;
    - `.completed-menu` is positioned like `.more-options`;
    - `.completed-toggle` is inline-flex, 2.75rem tall, with the readout's
      text style and a chevron;
    - `.completed-toggle-labels` is a one-cell grid, and non-current labels
      get `visibility: hidden`;
    - `.completed-panel` joins the `.more-options-panel` rules (look,
      `[hidden]`, 2.75rem children). Its option buttons are borderless and
      start-aligned, like `.place-in-menu ul button`.
  - The `completedReadout` comment says the short form is the toggle's
    visible text and the full sentence is its description.
- **Refactor:** grep `src/` and `spec/` for `completed-step` and "One more
  semester completed". The only remaining hits may be in
  `src/pages/help.astro` and the Help test, which are left for Task 19.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - Screenshots of the title row, closed and open, at 1920×1080 and
    390×844.
- **Depends on:** none.

### Task 15: "Completed" in completed terms' headers

- [x] **Description:** each term whose index is below `view.plan.cutoff`
  shows a "Completed" label in its units line. Every term's unit count
  reads "24/24u", with "24 of 24 units" as its accessible text.
- **Ruling (user, 2026-09-28, mid-task):** with the plan's CSS alone, the
  heading, "24/24 units" and the pill don't fit in the 209px column. Both
  the heading and the count wrap, and the header grows by 20px (the height
  criterion caught it). The user chose to shorten the count to "24/24u",
  matching the cards' "6u" (CR1), over an icon-only badge or a taller
  header.
- **Files touched:**
  - `src/components/Timeline.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** a new `describe("completed terms")`:
  - on `withPlan`, the `.term-completed` count is 2, inside
    `[data-term="0"]` and `[data-term="1"]`, with text "Completed";
  - `[data-term="2"] .term-completed` has count 0;
  - `[data-term="0"] .term-units`' visible (`aria-hidden`) text starts
    with "24/24u", and its visually hidden text is "24 of 24 units";
  - on a fresh plan (cutoff 0) the count is 0, and after
    choosing the "S1 2027" option in the Completed menu it polls to 1.
    If Task 14 hasn't run, use the "One more semester completed" button
    instead.
- **Implementation (green):**
  - `Timeline.tsx`: `p.term-units` holds `<span
    aria-hidden="true">{term.units}/{NORMAL_TERM_UNITS}u</span><span
    class="visually-hidden">{term.units} of {NORMAL_TERM_UNITS}
    units</span>`, then `{term.index < view.plan.cutoff && <span
    class="term-completed">Completed</span>}`.
  - `styles.css`:
    - `.term-units { display: flex; align-items: center; gap: 0.5rem; }`
      (keep its margin);
    - `.term-completed { font-size: 0.75rem; font-weight: 600; color:
      var(--moss); background: var(--moss-tint); border-radius: 0.35rem;
      padding: 0.05rem 0.4rem; }`.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - `pnpm check` is green.
  - The header height is unchanged: `[data-term="0"] h2` to the first
    card top is within 2px of `[data-term="2"]`'s.
- **Depends on:** none.

### Task 16: "Hide requirements" moves onto the resize handle

- **Ruling (user, 2026-09-28, mid-task):** the opaque sticky bar (the
  original Task 16) broke the stacked resize handle's lower hit area.
  `position: sticky` is its own stacking context, so the handle can't sit
  above the bar while the button sits above the handle. Asked for
  alternatives, the user chose a collapse chevron on the handle (VS Code
  and Figma style): no bar, no row, nothing sticky. Snap-to-close by
  dragging and Enter on the handle were offered as extras and are **not**
  part of this task.
- [x] **Description:**
  - `Sidebar` returns a fragment: `button.reqs-hide`, then the `<aside>`.
    The button is icon-only, with the accessible name "Hide requirements"
    and the same text as its `title`.
  - The button is a zero-size flex item, drawn centred on the handle: at
    its top side by side, and at its right end when stacked. Where the
    handle is hidden (stacked, under 30rem tall), it's an ordinary
    right-aligned 2.75rem row above the aside.
- **Files touched:**
  - `src/components/Sidebar.tsx`
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** a new `describe("hide requirements on the
  handle")`, on `withPlan`:
  1. At 1920×1080 and 390×844:
     - `button.reqs-hide` isn't inside `#requirements`;
     - its accessible name is "Hide requirements";
     - its box is at least 44×44;
     - its centre is within 2px of the handle's centre line (x side by
       side, y stacked);
     - side by side, its top is within 1rem of the handle's top. Stacked,
       its right edge is within 1rem of `.planner-panes`' right edge;
     - the first `.requirement-group`'s top minus `#requirements`' top is
       ≤ 8px. Red today: ≈ 52px, the old button's row;
     - axe is clean.
  2. At 700×400 (stacked, not fitted), the button is visible, ≥ 44px tall,
     and its bottom is ≤ `#requirements`' top + 1. Scrolled up under the
     sticky timeline, the point at its centre belongs to the timeline, so
     it goes under like the requirements do. *(Added during execution:
     the first render had the chip floating over a timeline card. Fixed
     with `z-index: 1` in the stacked layouts.)*
  3. Existing tests pass unchanged:
     - `describe("requirements sidebar collapse")`,
       `describe("stacked requirements collapse")` and the resize handle
       tests, including the phone hit-area probe that failed under the bar;
     - every `button.reqs-hide` focus handoff.
- **Implementation (green):**
  - `Sidebar.tsx`: move the `<button class="reqs-hide" …>` (ref, aria and
    onClick unchanged) out of the aside into a leading fragment slot. Its
    content becomes the chevron `svg` plus `<span
    class="visually-hidden">Hide requirements</span>`, and it gains
    `title="Hide requirements"`.
  - `styles.css`:
    - base: `.reqs-hide` stays `display: none` until a layout block shows
      it. The old `align-self`/sticky/margin block goes. The button is a
      transparent 2.75rem square whose `::after` draws a 1.75rem round
      chip (surface, line border, chevron), so the target stays 44px while
      the chip is small;
    - side by side: `display: flex; order` placing it right after the
      handle, `flex: 0 0 0; width: 0; align-self: flex-start;
      position: sticky; top: 1rem` (fitted: `position: relative; top:
      auto`), with a `translate` centring the 2.75rem square on the
      handle's line;
    - stacked, fitted: `order: 1` right before the handle, `flex: 0 0 0;
      height: 0; align-self: flex-end`, translated to centre on the
      handle's line;
    - stacked, not fitted: `display: flex; align-self: flex-end;
      margin-block-end: 0.5rem`, an in-flow row;
    - both collapsed rules keep hiding `.reqs-hide`, and the rail and bar
      are unchanged;
    - update the comments that describe where the collapse controls
      live.
- **Refactor:** none.
- **Acceptance criteria:**
  - Tests pass.
  - Every existing `.reqs-hide` test passes unchanged.
  - `pnpm check` is green.
  - Screenshots at 1920×1080, 390×844 and 700×400, showing the chip on
    the handle and the sidebar content starting at the top.
- **Depends on:** none.

### Task 17: Space above the "Checks" subheading

- [x] **Description:** give the Total section's "Checks" `h3` top margin.
- **Files touched:**
  - `src/styles.css`
  - `spec/layout.test.ts`
- **Tests first (red):** a new `it` in `describe("layout")` (top of
  `spec/layout.test.ts`), "the Checks subheading has room above it". On
  `withPlan` at 1920×1080, `section[aria-label="program checks"] h3`'s
  top minus the Total section's `.progress-bar-text` bottom is ≥ 12px.
  Red today: ≈ 0 (the `h3` has no top margin).
- **Implementation (green):** `section[aria-label="program checks"] > h3 {
  margin-block-start: 0.9rem; }`.
- **Refactor:** none.
- **Acceptance criteria:**
  - The test passes.
  - `pnpm check` is green.
- **Depends on:** none.

## 6. Phase Definition of Done

- [x] Tasks 14–17 complete, their tests passing
- [x] `pnpm exec vitest run --project unit` passes
- [x] `pnpm check` passes
- [x] Screenshots at 1920×1080 and 390×844: title row, a completed term
      header, the hide chevron on the handle, and the Total section
- [x] Tick Phase 05 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| E6 | Task 14 |
| E7 | Task 15 |
| E2 (revised: chevron on the handle) | Task 16 |
| E9 | Task 17 |
| CR25 | Task 14 (superseded cutoff tests) |

## 8. Risks / open questions

None.
