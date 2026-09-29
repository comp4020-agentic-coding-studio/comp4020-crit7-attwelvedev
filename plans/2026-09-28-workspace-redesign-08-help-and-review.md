# Workspace redesign — Phase 08: Help rewrite and final review

- **Date:** 2026-09-28
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-28
- **Part of:** `plans/2026-09-28-workspace-redesign-00-overview.md`. Read §2.2
  (every non-functional requirement is checked here) and §6 (the
  feature-level Definition of Done).
- **Depends on phases:** 01–07.

## 1. Summary

This phase:
- rewrites the Help page for the new workspace and updates its phrase
  tests
- adds one browser test that runs axe across every workspace state
- runs the manual checks the harness can't: glass scroll performance, and
  the final visual review at the four viewports
- ends with the user's sign-off on the whole feature

## 2. Requirements (this phase)

### 2.1 Functional

WR48: all.

### 2.2 Non-functional

Final verification of every overview §2.2 item:
- axe across all states
- overflow and fit
- the card-height budget
- motion
- glass performance
- the visual review

### 2.3 Out of scope for this phase

New behaviour. Any defect found here goes back through plan-feature
against the phase that owns it; don't fix it freelance.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-28)

**`src/pages/help.astro`** h2 sections:
- "The basics" (:12)
- "What a course card is telling you" (:35)
- "Completed semesters" (:60)
- "Courses that run over two semesters" (:72)
- "P&C and TDP" (:84)
- "Pinning a course" (:97)
- "Keeping your plan" (:104)

Passages tied to the old UI:
- :12-19: drag by the grip, "Place in…", "More options" (⋯), "Click a
  course's title to open its Details".
- :44-52: the verify badge "open[s] the course's Details at 'Your checks'".
- :97-102: "'Pin to' option (in its Details dialog)".
- Nothing about resizing, search, or phones.

**`spec/layout.test.ts`**
- :1811-1836, "Help describes the new controls by name". It requires
  "Completed through", "gold line", "More options", "Place in…", "Counts
  toward", "Verify on P&C", "Your checks", "Completed", "Planned" and colour
  wording. It forbids "One more semester completed", "One fewer semester
  completed", "‹" and "Move to…".
- :1838, "explains courses that run over two semesters". It requires the
  h2 "Courses that run over two semesters", followed by a `<p>` with "Part 1
  of 2", "Part 2 of 2", "S1 2028 – S2 2028" and "Completed S1 2028 · planned
  S2 2028". Keep it.
- :2371, "Help says the control sits beside the title" (`/beside the plan's
  title/i`). Keep it.

**Helpers** in `spec/browser.ts`: `openPage(browser, url, viewport,
{storage})` and `axeViolations(page)`.

### Interfaces from earlier phases (exact)

User-facing names this phase documents, as built:

| Phase | Names |
| --- | --- |
| 02 | Details sidebar `aside[aria-label="Course details"]`; sections "In your plan", "When it runs", "Requisites", "Courses in your plan that need it", "About the course", "Learning outcomes", "Assessment"; strip actions "Move to <term>" / "Place in <term>"; check answers "Met" / "Not met" / "Not sure"; "Open <CODE> on Programs & Courses" |
| 03 | Toasts "Moved X to T" / "Placed X in T" / "Removed X"; knock-on text "… now misses a prerequisite" |
| 04 | `button.search-trigger` "Search courses", shortcut ⌘K / Ctrl-K |
| 06 | Dividers; "Release to fold requirements"; "Release to close details"; double-click resets; "Requirements folded to make room for course details"; "Widen details" / "Narrow details" |
| 07 | Tabs "Timeline" / "Requirements"; the details sheet's "Resize details" handle |

## 4. Approach

**Help rewrite.** Keep the page's structure and voice (plain, second
person, sentence case). The changes:
- **"The basics"**: clicking a course's title opens its details beside the
  plan; the plan stays usable; search with the header's search button or ⌘K (an icon button since the
  WR27 amendment, 2026-09-29); drag
  results onto the timeline.
- **New section "Course details"**: what each section shows, including the
  strip, and that the details come from Programs & Courses with the date
  they were updated.
- **"What a course card is telling you"**: the verify badge opens details
  at the requisites, and each item has its own Met / Not met / Not sure
  answer. Replace the "Your checks" wording and update the required phrase.
- **"Pinning a course"**: "Counts toward" in the details sidebar.
- **New section "Arranging the workspace"**: drag the dividers; snapping;
  folding; double-click to reset; what gives way on smaller screens; the
  drawer.
- **New section "On a phone"**: tabs, and the details sheet.

**The all-states axe sweep.** One parameterised test visits each state and
asserts `axeViolations(page)` is empty:
- 1920×1080:
  - details closed
  - details open at 440
  - details at 760
  - palette open
  - a course open with linked highlights
- 1280×800: auto-folded
- 900×800: the drawer
- 390×844: each tab; the sheet at peek, half and full; the palette
  full-screen

## 5. Task breakdown

### Task 22: Rewrite Help for the details sidebar, search, resizing and phones

- **Description:** WR48.
- **Files touched:**
  - `src/pages/help.astro`
  - `spec/layout.test.ts` (the :1811-1836 test)
- **Tests first (red):** update "Help describes the new controls by name":
  - Required: "Completed through", "More options", "Place in…",
    "Counts toward", "Verify on P&C", "Completed", "Planned", "When it
    runs", "Met", "Not sure", "⌘K", "Search courses", "double-click",
    "fold", "Timeline", "Requirements", "Programs & Courses", "Undo",
    "Redo", "⌘Z" and "Ctrl+Y".
  - Forbidden: the existing four, plus "gold line" (already forbidden,
    since Phase 05 Task 15 removed the line), "Your checks", "Details
    dialog" and "Pin to". The existing "‹" ban is left over from the old
    completed-semester chevrons. If Help describes the timeline's scroll
    buttons, name them in words ("Scroll to later semesters"), or change
    that ban deliberately.

  Add "Help has a section for each new area": h2s "Course details",
  "Arranging the workspace" and "On a phone" exist. Keep the :1838 and
  :2371 tests unchanged.
- **Implementation (green):** the rewrite described in this file's §4.
  It also covers undo and redo (from the undo-redo plan, which ran after
  this file was written):
  - every change to the plan can be undone and redone: placing, moving
    and removing, "Counts toward", check answers, choices and "Completed
    through"
  - the Undo/Redo buttons in the header, whose names and tooltips say
    which change
  - the toast's Undo/Redo
  - the shortcuts: ⌘Z / ⌘⇧Z on a Mac; Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y
    elsewhere. They're not active while typing in a text field.
  - history lasts for the page visit, and is gone after a reload
- **Refactor:** None expected.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - `spec/invariants.test.ts` still passes for `/help/` (one h1, axe floor).
- **Human review:** the rendered `/help/` page at 1920×1080 and 390×844. A
  pass means the new sections are accurate to the built app, use the same
  names as the UI, are easy to scan, and match the page's existing voice.
  The user must accept the wording.
- **Depends on:** Phases 02–07.

### Task 23: All-states axe sweep, manual performance check, and final visual sign-off

- **Description:** The overview §2.2 closing checks, and the feature-level
  Definition of Done.
- **Files touched:** `spec/layout.test.ts` only (the new
  `describe("workspace states")`).
- **Tests first (red):** `describe("workspace states")` with an `it.each`
  over the states in this file's §4. Each case:
  - opens the state
  - asserts `axeViolations(page)` is `[]`
  - asserts `horizontalOverflow(page) === 0`
  - asserts `verticalOverflow(page) === 0` wherever the page is fitted
    (the viewport is ≥ 30rem tall)
- **Implementation (green):** None expected beyond the test. If a case
  fails, the fix belongs to the phase that built that state. Record it and
  route it back (this file's §2.3).
- **Refactor:** None.
- **Acceptance criteria:**
  - `pnpm check` passes.
  - A manual scroll check on the marking machine, in Chrome with
    Performance recording, scrolling the timeline and details vertically
    and sideways for 10 seconds:
    - no long frames above 50ms attributed to paint, per the Performance
      panel summary
    - a record of the result in the task's commit message
    - if it fails, switch that layer's `.glass` to solid (spec §2.2) and
      note it
  - The overview §6 manual end-to-end steps run and pass.
- **Human review:** the whole feature, in the running app at 1920×1080,
  1280×800, 900×800 and 390×844, following overview §6's steps. A pass is
  the user's explicit sign-off that the workspace matches the approved
  design and is ready to count as done. Log a PROCESS_LOG entry if the
  review changes anything.
- **Depends on:** Task 22.

## 6. Phase Definition of Done

- [ ] Tasks 22–23 complete, with tests passing
- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] Task 22 and Task 23 human reviews accepted by the user
- [ ] Every box in overview §6 is ticked
- [ ] Tick Phase 08 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| WR48 | Task 22 |
| NFR axe / overflow / fit (final) | Task 23 |
| NFR glass performance | Task 23 |
| NFR visual review (final) | Task 23 |

## 8. Risks / open questions

None.
