# Compact plan workspace: completed-semesters row, tighter title, adjustable stacked split

- **Date:** 2026-09-27
- **Status:** Approved
- **Approved by user:** yes — 2026-09-27

## 1. Problem / intent

Phase 04 of the collapsible-panels feature fitted `/plan/*` to the viewport:
the page no longer scrolls, and in the stacked layout the timeline takes at
most half the planner height, with the requirements filling the rest. The
user accepted that, but judged the phone still cramped, and not because of
the fit itself. What sits inside each half is the problem:

- At 390×844 with the nav shown, the timeline half is about 300px tall.
  Roughly 150px of that is controls before any term card appears: the two
  cutoff buttons, the prerequisite toggle, and a three-line readout.
- The title block ("Example plan" plus the example note on its own line)
  costs another ~95px above the planner.
- The 50/50 split is fixed, so a student arranging terms can't give the
  timeline more room, and can't put the requirements away entirely, as
  they can in the side-by-side layout.

The intent is to reclaim that height without changing how dragging and
placing work. The user also judged "cutoff" to be confusing jargon for what
is simply "the semesters completed so far", so the control is renamed as
part of compacting it.

## 2. Requirements

These amend the collapsible-panels overview
(`plans/2026-09-27-collapsible-panels-00-overview.md` §2): FR5, FR15 and
FR29 change as stated below. Numbering here is local (CW = compact
workspace).

### 2.1 Functional requirements

**A. Completed-semesters row (every width)**

- CW1. The cutoff readout and the two cutoff buttons merge into one
  control. Its visible label is the short readout, followed by two chevron
  buttons (‹ then ›):
  - cutoff inside the timeline: "Completed through <last completed term
    label>", e.g. "Completed through S2 2027"
  - cutoff ≤ 0: "Nothing completed yet"
  - cutoff ≥ number of terms: "All semesters completed"
- CW2. The chevron buttons' accessible names are "One fewer semester
  completed" (‹) and "One more semester completed" (›). They're enabled and
  disabled exactly as the cutoff buttons are today, and on read-only plans
  they stay visible and disabled.
- CW3. The full sentence stays available to assistive technology in
  visually hidden text. That's today's readout sentence, including "The gold
  line on the timeline marks that boundary". It isn't shown on screen.
- CW4. "Show prerequisite links" and, on editable plans, "Copy plan link"
  sit on the same row as the completed-semesters control. They wrap onto a
  second line only when the row doesn't fit.
- CW5. The word "cutoff" leaves all user-facing text: visible labels,
  accessible names and the Help page. Internal names (`data-cutoff`,
  `moveCutoff`, `plan.cutoff`, the API) are unchanged.
- CW6. The Help page's instructions describe the new control by its new
  names and explain the gold line on the timeline.

**B. Title block (every width, `/plan/*` only)**

- CW7. The plan page's `h1` is smaller than the document pages' `h1`
  (default ≈ 1.4rem). Document pages (`/`, `/help/`, `/readme/`) are
  unchanged.
- CW8. On read-only plans, "This is an example — Start your own plan" is a
  small badge on the `h1`'s row. It wraps below the title only when the row
  doesn't fit. It keeps `role="note"` and its text.
- CW9. With the nav hidden below 1100px, the Task 9 tab still sits at the
  start of the title's row, and neither the tab nor the badge covers
  anything.

**C. Adjustable stacked split (stacked planner, viewport ≥ 30rem tall)**

- CW10. In the stacked layout of the fitted page, a resize handle sits
  between the timeline and the requirements. It snaps between four stops,
  where each percentage is the timeline's share of the planner height:
  30%, 50%, 70% and Collapsed (see D). The default is 50%, so nothing
  changes until someone moves it. It replaces FR29's fixed "at most half".
- CW11. The handle is a focusable `role="separator"` with
  `aria-orientation="horizontal"`, `aria-controls` and
  `aria-valuemin/max/now`. Its `aria-valuetext` is "Timeline 30%",
  "Timeline 50%", "Timeline 70%" or "Requirements hidden".
  - ↑ moves the boundary up (smaller timeline), and ↓ moves it down, through
    30 → 50 → 70 → Collapsed.
  - Home goes to 30%, and End goes to Collapsed.
- CW12. Dragging previews live, snapping at the midpoints between stops.
  Releasing a drag, or pressing a key, saves the choice. Pointer moves only
  preview.
- CW13. The chosen ratio is stored per browser under a new key (default
  name `panel-split`, values `"30"`, `"50"`, `"70"`, or absent for 50). It's
  applied to `<html>` by the inline head script before first paint, with
  every storage access in try/catch and invalid values falling back to 50.
- CW14. Below 30rem of viewport height the page isn't fitted (FR30), so the
  handle is hidden and the split doesn't apply.

**D. Collapsible requirements in the stacked layout (reverses FR15)**

- CW15. In the stacked layout there is a "Hide requirements" button. It,
  and the split's Collapsed stop, collapse the requirements.
- CW16. Collapsed, the requirements become a slim bar along the bottom of
  the planner, at least 44px tall. It shows "Requirements" and a
  horizontal program-progress bar. Its accessible name matches the
  side-by-side rail's: "Show requirements: X completed, Y planned of 192".
- CW17. Activating the bar expands the requirements to the saved split
  ratio (50% if none is saved).
- CW18. The bar is inside the requirements `<aside>`, so it's a drop target
  for removing a course, by native and touch drag. It shows the same
  drop-ready highlight as the rail while a placed course is being dragged.
- CW19. The collapsed state uses the existing shared `panel-reqs` key.
  Collapsing on a phone collapses the desktop sidebar to its rail, and vice
  versa, like the nav's single `panel-nav` key.
- CW20. Collapsing moves focus to the bar, and expanding moves it back to
  "Hide requirements", as with the rail.
- CW21. The collapse button and the bar work at every viewport height,
  including below 30rem tall. Only the handle is hidden there (CW14).
- CW22. While the stacked requirements are collapsed, the undo toast sits
  above the bar, so it never covers the drop target the course was just
  dropped on.

**Amended overview requirements**

- FR5 becomes: 1920×1080 renders as today apart from the removed overflow,
  the fitted height (FR27–28), the completed-semesters row (CW1–6) and the
  title block (CW7–8). 390×844 changes only as FR9, FR26, FR29 and CW1–22
  describe.
- FR15 is replaced by CW15–21.
- FR29 becomes: in stacked, the timeline takes the saved split share of the
  planner's height (30, 50 or 70%, default 50), or all of it but the
  collapsed bar. The requirements fill the rest, and each scrolls on its
  own.

### 2.2 Non-functional requirements

- FR1 (no horizontal overflow) and FR27 (no vertical page scroll on the
  fitted page) hold in every new state: every split stop, collapsed
  stacked, and with the nav hidden.
- All new controls (chevrons, handle, bar, stacked "Hide requirements") are
  at least 44px on their short side.
- In-browser axe is clean at 390×844 in every split stop and collapsed, and
  at 1920×1080 with the new row and title, with the same disabled rules as
  the invariants.
- `spec/invariants.test.ts` stays green: one `h1` per page, and the nav
  landmark in the DOM.
- No new animation.
- Human review of the renders at 1920×1080, 900×800 and 390×844, including
  every split stop and collapsed on the phone.

### 2.3 Out of scope

- Per-group scrolling in the requirements strip, and making requirement
  cards stop stretching to the tallest group. Stretching costs no height,
  since the strip is as tall as its tallest group either way.
- Hiding the timeline entirely.
- Hiding the cutoff controls on read-only plans.
- Any side-by-side layout change beyond the row (A) and the title (B).
- Renaming internal "cutoff" identifiers, the API or stored data.
- Smaller `h1` or badges on non-plan pages.

### 2.4 Assumptions (confirmed)

- The compaction applies at every width, not just stacked, and FR5 is
  amended to allow it (confirmed by the user).
- Split stops 30/50/70 with default 50 (confirmed).
- One shared `panel-reqs` key across layouts (confirmed; the user chose it
  over the recommended separate key).
- Built after collapsible-panels Phase 05, reusing its snapping helpers and
  separator pattern (confirmed).
- Details marked "default" (the h1 ≈ 1.4rem, the `panel-split` key name,
  the keyboard mapping, the hidden handle below 30rem tall) were presented
  as proposals and approved with the design.
- CW21 (collapse works at every height) and CW22 (the toast sits above the
  bar) are obvious defaults added in the final probe sweep. The planner
  may revisit them if the code argues otherwise.

## 3. Existing context

Verified at `d4d9b93`:

- `src/components/Planner.tsx`:
  - `cutoffReadout` has three branches: "Nothing on the timeline counts as
    completed yet.", "Every semester on the timeline counts as
    completed.", and "Completed through X — planned from Y onward.".
  - It renders `div.cutoff-controls` containing "Move cutoff earlier",
    "Move cutoff later", the "Show prerequisite links" label, and, when not
    read-only, "Copy plan link". Then comes `p.cutoff-readout` with the
    readout plus "The gold line on the timeline marks that boundary.", all
    inside `.planner-timeline-area` before `<Timeline>`.
  - The cutoff buttons are disabled when read-only, while pending, or at
    the ends.
- `src/pages/plan/[id].astro` renders `<h1>{title}</h1>`, then on
  read-only plans `<p role="note">This is an example — Start your own
  plan</p>`, then `<Planner client:load>`.
- `spec/planner.test.ts:215–216` checks that the page contains "Move cutoff
  earlier" and "Move cutoff later". Line 107 checks for "This is an
  example".
- `src/pages/help.astro:38` tells users to set the boundary with "Move
  cutoff earlier/later".
- `src/styles.css`:
  - `.requirements-scroll` is a horizontal flex row with default
    `align-items: stretch`, so every group is as tall as the tallest. Hence
    idea 2 was dropped.
  - `.undo-toast` is `position: fixed; bottom: 1.5rem`, centred.
  - The Phase 04 fit group sits after the tier blocks and before the
    collapsed block. Its stacked part sets the timeline to `max-height:
    50%` and the aside to `flex: 1 1 0`.
  - `.reqs-hide` and `.reqs-rail` are `display: none` outside side-by-side
    (FR15, "the stacked strip has nothing to collapse into").
- `spec/layout.test.ts`:
  - "ignores the saved state in the stacked layout at 390×844 / 800×800"
    (Phase 03) encodes FR15 and is superseded by CW15–21.
  - "on a phone with the nav shown/hidden the timeline and requirements
    split the height" (Phase 04) encodes the fixed half and must follow the
    amended FR29.
- The collapsible-panels head script (`src/layouts/Base.astro`) applies
  `panel-nav` and `panel-reqs`. Phase 05 adds `panel-reqs-cols`, `snapSize`
  / `stepSize` / `sizeLabel`, and a `role="separator"` handle for the
  sidebar width. None of that exists yet.

## 4. Design

- **One row, not two.** The readout *is* the label of the control that
  changes it, so the explanation and the action sit together, and the word
  "cutoff" goes away. Alternatives considered:
  - a separate "Completed:" label with "‹ Earlier / Later ›" buttons, which
    keeps the readout as its own line and saves less
  - keeping the "Cutoff" wording, with no Help or test changes

  The user chose the merge.
- **The gold-line explanation** moves to screen-reader text and Help rather
  than a tooltip (no use on touch) or a visible hint (costs the space being
  reclaimed).
- **The split mirrors Phase 05 on the other axis.** Snapping stops, a
  collapsed stop past the smallest, keyboard stepping, saving on release,
  and an expand that restores the saved size (as FR12 restores the
  preferred columns). It reuses Phase 05's pure helpers where they fit,
  rather than writing a second snapping model. Free drag was rejected, for
  the same reason Phase 05 rejected free widths.
- **Collapsed stacked is a bottom bar,** the stacked analogue of the 3rem
  rail. It keeps the requirements aside in the DOM and a drop target, so
  dragging a course off the timeline to remove it still works when
  collapsed.
- **Shared state:** `panel-reqs` stays one key. The split ratio is a
  separate `panel-split` key, because the side-by-side width preference
  (`panel-reqs-cols`) and the stacked height share mean different things.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | assumption | Idea 2 assumed stretched requirement cards waste height | The user challenged it. The strip's height is the tallest group's either way, so it's looks-only. Dropped. |
| 2 | gap | Per-group scrolling (headers scroll away in the shared vertical scroll) was offered as the real requirements-half issue | Out of scope (user) |
| 3 | ambiguity | Should the compaction apply stacked-only, phone-only or everywhere? | Everywhere (user) |
| 4 | contradiction | "Everywhere" conflicts with FR5's "1920 renders as today" | FR5 amended; desktop gets a human review (user) |
| 5 | gap | An editable plan's fourth control, "Copy plan link", wasn't in any screenshot | Same row, wraps when it doesn't fit (CW4) |
| 6 | gap | The readout has three branches, not one | Short forms for all three (CW1) |
| 7 | ambiguity | How much of the readout stays visible | A short line starting "Completed"; the full sentence for AT (user) |
| 8 | contradiction | Renaming the labels touches `spec/planner.test.ts` and Help | The requirement changes, so the test's expected labels change with it; that's not weakening. Help is rewritten (CW5–6) |
| 9 | ambiguity | "Cutoff" is jargon (raised by the user) | Merged row with "One fewer/more semester completed" names (user) |
| 10 | gap | Where the gold-line explanation lives | AT text + Help (user) |
| 11 | gap | Always-disabled cutoff buttons on read-only plans | Left as is (user) |
| 12 | ambiguity | Which title changes | Badge beside the title + smaller plan `h1`; not tighter spacing (user) |
| 13 | ambiguity | Split stops, free or snapping, remembered or not | Snapping 30/50/70, default 50, remembered (user) |
| 14 | contradiction | Collapsing in stacked (raised by the user) reverses FR15 and a Phase 03 test | FR15 replaced by CW15–21; the test is superseded (user) |
| 15 | ambiguity | Collapse by button, split, or both | Both; collapsed = the split's lowest stop (user) |
| 16 | ambiguity | Shared or separate collapsed state across layouts | Shared `panel-reqs` (user) |
| 17 | gap | Sequencing against unbuilt Phase 05 | After Phase 05, reusing its helpers (user) |
| 18 | gap | Handle and collapse below 30rem tall, where the page isn't fitted | Handle hidden; button and bar still work (CW14, CW21) |
| 19 | gap | The fixed undo toast would cover the bottom bar, the drop target just used | The toast sits above the bar while collapsed (CW22) |

## 6. Handoff notes for planning

- **Prerequisite:** collapsible-panels Phase 05 must be complete. Verify its
  helpers' actual signatures (`snapSize`, `stepSize`, `sizeLabel`, the
  separator markup) against the code, not the Phase 05 plan. Adapt or
  generalise them rather than duplicating them. If generalising changes
  their signatures, keep Phase 05's tests green unchanged.
- **Check Phase 05 for FR15 conflicts.** Check whether any Phase 05 test
  asserts stacked-layout behaviour that CW15–21 reverses. If so, that test
  is superseded by this spec, like the Phase 03 one.
- **Cascade order.** New stacked rules must respect the collapsible-panels
  overview §4.4 cascade order: the fit group, then the preference caps and
  handle, then the collapsed block last. The stacked collapsed rules
  probably join the collapsed section under a `(width < 49.5rem)` container
  query.
- **Superseded tests.** Replacing the Phase 03 stacked test and adjusting
  the Phase 04 split test are requirement changes (FR15 and FR29 amended
  here), not weakening. Say so in the plan.
- **Settled; don't re-litigate:**
  - everywhere scope
  - the merged row and its wording
  - no visible gold-line hint
  - shared `panel-reqs`
  - stops 30/50/70 with default 50
  - after Phase 05
  - idea 2 dropped
- **This is likely two or three units of work.** Planning decides the
  breakdown and commit points:
  - the row and the title (A+B), which have no dependency on Phase 05
  - the stacked collapse (D)
  - the split handle (C)
- **Human review is needed** for the row and title at 1920/900/390, and for
  the split and the collapsed bar on the phone.
