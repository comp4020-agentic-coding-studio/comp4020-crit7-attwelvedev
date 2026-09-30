# Specialisation details — Phase 05: Layout, Help and review

- **Date:** 2026-09-30
- **Status:** Approved
- **Requirements confirmed by user:** yes, 2026-09-29 (spec) and 2026-09-30
- **Part of:** `plans/2026-09-30-specialisation-details-00-overview.md`.
  Read it first, especially §2 (SD15, SD25, N1, N2), §3 and §6. Background:
  the spec's §4.1 wireframes "Desktop docked, wide" and "Phone sheet".
- **Depends on phases:** 02, 03 and 04.

## 1. Summary

This phase finishes the feature:

- the wide panel's two-column body for specialisations
- an all-states sweep (axe, overflow and fit) at both marking viewports
- the Help page's "Specialisation details" section
- a final end-to-end review with the user

## 2. Requirements (this phase)

### 2.1 Functional

- SD25: Task 13.
- SD15: the phone tab and peek, re-checked in Task 12's sweep.

### 2.2 Non-functional

- N1 and N2: the sweep (Task 12) and the review (Task 14).
- N5: the file stays under its line budget (split if needed, Task 12).

### 2.3 Out of scope for this phase

New behaviour. Anything found in review that changes behaviour goes back
through plan-feature (see the plan-feature skill), not a quiet fix.

### 2.4 Assumptions

See overview §2.4.

## 3. Existing code context (verified 2026-09-30)

**`src/styles.css`:**

- `.details-body { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 1.5rem; }`
  (1700).
- `@container details (min-width: 628px) { .details-body { grid-template-columns: repeat(2, minmax(0, 1fr)); } .details-body > .details-section:nth-child(2) { border-block-start: 0; } }`
  (1710). Phase 04 Task 11 amends this with `.details-lists` rules.
- `.details-body > .details-section:first-child { border-block-start: 0 }`
  (1696).

**Layout helpers:**

- `DETAILS_TWO_COLUMN` and `DETAILS_WIDE` (from `workspace-layout.ts`) set
  the docked width. The "Widen details" button
  (`aria-label="Widen details"`) toggles it.
- Sheet detents come from `sheet-detent.ts`: peek is 204px, half is
  0.56 × the viewport height, full is the viewport less 16px. The body is
  `hidden` at peek. The frosted `nav.tabbar` sits over the sheet's foot at
  peek and half.

**`spec/layout/helpers.ts`:**

- `settle(page)` waits for animations.
- `detailsPanel(page)` finds the Course details aside.
- `planWithPlacement(code, term = 0): Promise<string>` returns an editable
  plan's id, with nothing chosen.

To choose a spec in a test, select the panel's Choose button (state D).
Or, through the API: PUT `/api/plans/{id}/choices` with
`headers: { origin: baseUrl, "content-type": "application/json" }` and the
body `{"groupId":"spec","childId":"arin"}`. The spec panel is
`page.locator('aside[aria-label="Specialisation details"]')`.

**`spec/browser.ts`:** `axeViolations(page): Promise<string[]>`,
`horizontalOverflow(page): Promise<number>` and
`verticalOverflow(page): Promise<number>`.

**`spec/layout/workspace-states.test.ts`** (120 lines) is the
workspace-redesign's all-states sweep. Copy its loop shape (states ×
viewports, axe plus overflow) rather than adding to that file.

**`spec/suite-size.test.ts`:** `MAX_BROWSER_FILE_LINES = 1000`.

**`src/pages/help.astro`** (202 lines):

- Its h2s, in order: The basics, Undoing a change, Course details, What a
  course card is telling you, Completed semesters, Courses that run over
  two semesters, P&C and TDP, Pinning a course (`id="pinning"`), Arranging
  the workspace, On a phone, Keeping your plan.
- "Course details" (lines 56-92) opens with a paragraph ending "The arrows
  at the top step back and forward through the courses you've opened. The
  details are in sections:". A `<dl>` of sections follows, then a P&C
  caveat paragraph.
- The voice: second person, plain, with no marketing tone.

### Interfaces from earlier phases (exact)

From Task 5 (`SpecialisationDetailsPanel.tsx`), the body order: (chosen)
`section` "In your plan", or (unchosen, Task 8) `section.spec-fit` "Fit
with your plan"; then "Requirements", "About the specialisation", "Other
information" and "Relevant degrees" as `section.details-section`s.

From Task 8: the Choose/Switch button (`.details-choose` / "Switch to this
specialisation"), and the what-if route `**/api/plans/*/what-if*`.

From Task 9:

- the sidebar buttons `Details: <label>`
- `[data-group="<id>"] > h3 button.choice-heading-link`

From Task 10, the palette's `.palette-spec-row` and `.palette-spec-title`.
From Task 11, `p.details-lists` in the course panel.

From Task 4 (`DetailsFrame.tsx`): the aside keeps `id="course-details"`,
`data-mode` and `data-detent`, and the nav has Back, Forward, Widen/Narrow
details and Close details.

## 4. Approach

### 4.1 Two columns (Task 12)

`SpecialisationDetailsPanel` wraps its sections in two
`div.details-column`s:

- the first holds the planning block ("In your plan" or "Fit with your
  plan") and Requirements
- the second holds About, Other information and Relevant degrees

These are the body grid's two items. The course panel keeps its
auto-placed sections.

CSS:

- `.details-column { display: grid; align-content: start; min-width: 0; }`
- `.details-column > .details-section:first-child { border-block-start: 0 }`
- narrow only:
  `.details-column + .details-column > .details-section:first-child { border-block-start: 1px solid var(--line) }`
- in the container query, the second column's first section goes back to
  `border-block-start: 0`

### 4.2 The sweep (Task 12)

**States:**

| State | Page |
| --- | --- |
| A. chosen | `/plan/example?spec=ARIN-SPEC` |
| B. unchosen, read-only | `/plan/example?spec=SYAR-SPEC` |
| C. none chosen, editable | `planWithPlacement("COMP3670", 5)` then `?spec=ARIN-SPEC` |
| D. switch, editable | as C, after choosing ARIN, then `?spec=HCCC-SPEC` |
| E. what-if loading | B, with the route delayed 3s |
| F. what-if error | B, with the route fulfilling 500 |
| G. HCCC | `?spec=HCCC-SPEC` (AND and the heading) |

**Viewports:** desktop 1920×1080 narrow docked (the default); 1920×1080
wide (after "Widen details"); phone 390×844 (sheet).

**For every state × viewport:**

- `axeViolations` is `[]`
- `horizontalOverflow` is 0

**Extra checks:**

- **Wide, A and C:** the two `.details-column`s have equal
  `getBoundingClientRect().top` (±1px), the second's left is greater than
  the first's right, and neither column's first section has a top border.
- **Phone, C:** at half height (the default on open), the "Choose this
  specialisation" button's bottom is at most the top of `nav.tabbar`.
  Selecting the handle steps to full, and at full the footer's P&C link
  can be scrolled into view and is reachable (`elementFromPoint` at its
  centre is the link or inside it).
- **Phone, A:** the progress jump turns the Requirements tab
  `aria-pressed="true"` and the panel's `data-detent` to "peek" (SD15
  re-check).
- **Phone, B and E:** the sheet at peek shows the header only, with the
  body `hidden`.

The sweep goes in a new `spec/layout/specialisation-states.test.ts`
*(amended 2026-09-30 at execution, by the user's ruling)*. Its 21 page
opens, run serially inside one file, would make
`specialisation-details.test.ts` the slowest file in `pnpm check`, even
though it would stay under 1000 lines. `workspace-states.test.ts` has its
own file for the same reason.

### 4.3 Help copy (Task 13)

- **A new `<h2 id="specialisations">Specialisation details</h2>`,** right
  after "Course details". It covers:
  - Where it opens: "Details" beside each option under Specialisation, the
    chosen specialisation's name, search, and "On the lists of" in a
    course's details.
  - That everything in it comes from its Programs & Courses page (the
    requirements word for word, the introduction, learning outcomes,
    other information and relevant degrees), with the same caveat to check
    P&C.
  - For your chosen specialisation, the link to your progress in
    Requirements.
  - For one you haven't chosen, "Fit with your plan", worked out as if you
    had chosen it: what would count, where each course counts now, what
    would stop counting, and any requirement that would fall short. Also
    the Choose / Switch button, and that Undo reverses it.
- **"Course details" updates:**
  - "The arrows at the top step back and forward through the courses and
    specialisations you've opened."
  - A `<dt>On the lists of</dt><dd>…</dd>` first in the `<dl>`: which
    specialisations list the course, each opening its details.

## 5. Task breakdown

### Task 12: Two-column wide body and the all-states sweep

- [x] **Description.** This file's §4.1 and §4.2.
- **Files touched:**
  - `src/components/SpecialisationDetailsPanel.tsx`
  - `src/styles.css`
  - a new `spec/layout/specialisation-states.test.ts` (§4.2)
- **Tests first (red).** The wide equal-tops check fails before the
  wrappers exist. Write the whole sweep first, then fix whatever it finds.
- **Implementation (green).** The wrappers and CSS per §4.1, plus any fix
  the sweep calls for, as long as it doesn't change behaviour.
- **Refactor.** None.
- **Acceptance criteria:**
  - Every state × viewport passes.
  - `spec/suite-size.test.ts` passes.
  - `pnpm check` is green.
- **Depends on:** Tasks 8, 9, 10 and 11.

### Task 13: Help, "Specialisation details" section

- [ ] **Description.** This file's §4.3.
- **Files touched:**
  - `src/pages/help.astro`
  - `spec/layout/specialisation-details.test.ts`
- **Tests first (red).** Fetching `/help/`:
  - The HTML has an `h2#specialisations` reading "Specialisation details".
    It comes after the "Course details" h2 and before "What a course card
    is telling you".
  - The "Course details" section contains "courses and specialisations
    you've opened" and a `<dt>` "On the lists of".
  - `spec/invariants.test.ts` still passes for `/help/`.
- **Implementation (green).** Write the copy in the page's own voice.
- **Refactor.** None.
- **Acceptance criteria:**
  - The tests pass.
  - `pnpm check` is green.
- **Human review.** The user reads the new and changed Help text at
  `/help/#specialisations`. A pass means:
  - It's accurate against the running app.
  - It's plain and second-person, like the rest of Help.
  - It doesn't over-explain.

  The task isn't done until the user says so explicitly.
- **Depends on:** Task 12.

### Task 14: Final review and wrap-up

- [ ] **Description.**
  - Run the overview §6 manual steps at 1920×1080 and 390×844, and fix
    only defects that don't change behaviour.
  - Confirm `pnpm check` and `pnpm check:evidence`.
  - Tick every phase, and set the overview's DoD boxes.
  - Consider whether any moment this feature produced beats the Phase 01
    PROCESS_LOG entry, and append it if it qualifies (per CLAUDE.md).
- **Files touched:**
  - `plans/2026-09-30-specialisation-details-00-overview.md` (ticks)
  - `PROCESS_LOG.md` (only if a new moment qualifies)
- **Tests first (red).** None new; this is a verification task. Any defect
  found gets a failing test first, in the area's spec file, before its fix.
- **Implementation (green).** Fixes for defects found, if any.
- **Refactor.** None.
- **Acceptance criteria:**
  - Every overview §6 box is ticked except the user's sign-off.
  - `pnpm check` and `pnpm check:evidence` are green.
- **Human review.** The user walks the overview §6 manual steps (or
  watches them) at both viewports. A pass means the feature feels like P&C
  plus a planning layer:
  - Content is complete and verbatim.
  - The what-if is believable against their own plan.
  - Entry points are findable.
  - Nothing is cramped on the phone.

  The feature isn't complete until the user says so explicitly.
- **Depends on:** Task 13.

## 6. Phase Definition of Done

- [ ] Tasks 12–14 are complete and their tests pass
- [ ] `pnpm test:unit` passes
- [ ] `pnpm check` and `pnpm check:evidence` pass
- [ ] The sweep covers states A–G × three viewports
- [ ] The human reviews for Tasks 13 and 14 are explicitly accepted by the
  user
- [ ] Tick Phase 05 in overview §5 and commit

## 7. Requirements coverage (this phase)

| Requirement | Covered by |
| --- | --- |
| SD25 | Task 13 |
| SD15 (phone re-check) | Task 12 |
| N1 | Task 12 |
| N2 | Tasks 12, 14 |
| N5 | Task 12 |

## 8. Risks / open questions

None.
