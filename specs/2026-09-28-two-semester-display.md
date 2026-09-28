# Two-semester courses shown across both semesters

- **Date:** 2026-09-28
- **Status:** Implemented
- **Approved by user:** yes — 2026-09-28

## 1. Problem / intent

Courses that "must be completed twice, in consecutive semesters" (COMP4550
12+12, COMP4500 6+6, and others) already *behave* as two-semester in the
planner's rules, but the UI only ever shows their start term:

- the timeline shows the card in the start term only — nothing in the
  second semester;
- the requirements sidebar's placed row says "Planned S1 2028" with no hint
  of the second semester;
- the "Place in…" / "Move to" menus list single term labels, so choosing
  "S1 2028" gives no indication it also occupies S2 2028.

The user's words: these courses "do not show up across two semesters like
it should, in the timeline. There is no indication it is placed in both
semesters in the requirements list either, nor does it indicate this in the
'Place in/Move to...' dropdown."

Intent: make every placement surface show both semesters, and make
completed/planned status per part, without changing the data model or the
placement rules.

## 2. Requirements

### 2.1 Functional requirements

1. **Timeline part 1.** The full card stays in the start term and carries a
   marker line under its title, shown only on two-semester cards:
   "Part 1 of 2 · continues in S2 2028" (just "Part 1 of 2" when there is
   no following term). *Revised in planning 2026-09-28:* the header line
   was measured with only ~35px free (read-only) / ~15px (with grip)
   against ~64px needed. A new line on one or two cards per plan doesn't
   move the median-based budget check or the phone check (which only reads
   term 0), so the user ruled for its own line.
2. **Timeline part 2.** The next term shows a compact stub —
   "COMP4550 · part 2 of 2" — in the same family colour as part 1. It is
   not draggable and has no menu. Activating it locates and focuses part 1
   (same behaviour as the sidebar's locate link). Its accessible name reads
   e.g. "COMP4550 part 2 of 2, continued from S1 2028".
3. **Linked behaviour.** Part 1 and the stub recede together when a
   sidebar group is under hover/focus; both flash when the course is
   located from the sidebar. While dragging a two-semester course over term
   T, both T and T+1 show the drop-hover outline.
4. **Menus.** In "Place in…" and "Move to", every option for a two-semester
   course reads as a range: "S1 2028 – S2 2028". This includes search
   results that have no `view.courses` entry (the menu must know the
   course is two-semester from the search result's own course data).
5. **Per-part completion.** Each part is completed if its own term is
   before the cutoff, planned otherwise.
   - Progress bars (overall, each group, program checks) split units per
     part: a COMP4550 straddling the cutoff contributes 12 completed + 12
     planned. The course's total (24) and its allocation are unchanged.
   - Each timeline part shows its own completed/planned state.
6. **Sidebar placed row.**
   - Both parts on the same side of the cutoff: "Planned S1 2028 – S2 2028"
     (or "Completed S1 2028 – S2 2028").
   - Straddling: "Completed S1 2028 · planned S2 2028".
   - ~~The locate link targets part 1; its accessible label describes the
     range / per-part status.~~ *Amended 2026-09-28, during planning after
     Phase 02:* each semester is its own locate button. The first goes to
     part 1 and the second to the part 2 stub (focused, with both parts
     flashing), and each button's accessible label names its part. See
     overview TS6.
7. **Prerequisite overlay.** Arrows from the course's prerequisites attach
   to part 1; arrows to courses that depend on it leave from part 2 (the
   stub), matching the existing rule that dependents wait for the last
   term (`lastTerm`).
8. **Messages.** Any user-facing message that names a placement's term
   (e.g. remove/undo text, if it names one) uses the range for a
   two-semester course.
9. **Help.** `src/pages/help.astro` gets a short explanation of
   two-semester courses: part 1 / part 2, the range in menus, per-part
   completion.

### 2.2 Non-functional requirements

- Card height budget spec (`spec/layout.test.ts` "card height budget")
  stays green; the stub must be compact and must not use the
  `.course-card` class (the budget measures `.term-cards .course-card`).
- Accessibility: the stub, part marker, menu ranges, and sidebar status all
  have accurate accessible names (not just visual text).
- Verified visually at both marking viewports, 1920×1080 and 390×844.
- `pnpm check` green.

### 2.3 Out of scope

- A single card visually spanning both term columns.
- Dragging/moving the course by its part-2 stub.
- A distinct "In progress" status.
- Any change to two-semester detection, the DB schema, placement or
  hard-block rules, allocation, term-unit counting, or prereq satisfaction.
- The unplaced sidebar card (already shows "12+12u").

### 2.4 Assumptions (confirmed)

- Two-semester courses are exactly those with `twoSemester === true`,
  detected in `from-pandc.ts` from the description — confirmed in code;
  currently COMP3500, COMP3770, COMP4500, COMP4550, COMP8715, COMP8800.
- `units` is the per-semester amount (COMP4550 is `units: 12`; `view.ts`
  doubles it for requirement totals) — confirmed in code.
- A placement remains one row at its start term; part 2 is derived as
  `term + 1` (`lastTerm`) — confirmed in `evaluate.ts`.

## 3. Existing context

- `src/lib/domain/types.ts` — `CatalogueCourse.twoSemester`; `Placement`
  is `{code, term, pinnedGroupId}`.
- `src/lib/domain/evaluate.ts` — `spanOf`/`lastTermOf`; `lastTerm` and
  `completed = lastTerm < plan.cutoff` on each placement eval (line ~247).
  The latter is what currently makes a straddling course "Planned".
- `src/lib/domain/view.ts` — `totalUnitsOf` doubles two-semester units;
  per-term units already count each occupied term; progress uses
  `placement.completed` for completed vs planned (lines ~180, ~299, ~375).
- `src/lib/domain/feasibility.ts` — already hard-blocks when there is no
  next term or part 2 isn't offered.
- `src/components/Timeline.tsx` — groups placements by `placement.term`
  only; renders `CourseCard` per placement; drag-hover outline per term.
- `src/components/planner-logic.ts` — `termFamilyUnits` already uses
  `lastTerm`; `placedStatus` uses `placement.term` only; `menuTargets` /
  `dropTargets` produce single-term targets.
- `src/components/PlaceInMenu.tsx`, `CourseCard.tsx` ("Move to") — render
  `view.terms[target.term].label`.
- `src/components/PlacedCourseRow.tsx` — sidebar placed row + locate link.
- `src/components/PrereqOverlay.tsx` — finds endpoints via
  `[data-placed="CODE"]`.
- `src/components/CourseCardHeader.tsx` / `unitsLabel` — "12+12u".
- `src/data/example-plan.ts` — COMP4550 placed at T6 spanning T6–T7 (a
  ready fixture for tests/visual checks).

## 4. Design

**Timeline.** Keep one `CourseCard` in the start column with a "Part 1 of
2" marker. For each two-semester placement whose `lastTerm` exists, render
a compact part-2 stub element in the `lastTerm` column's card list. The
stub shares the course's family colour, receded state, and highlight;
activating it runs the same locate path as the sidebar badge. It is a
distinct element from part 1 (so part 1 stays the sole `data-placed`
drag/menu/locate target), but the overlay can address it as the "out"
endpoint.

**Per-part completion.** Replace the single whole-course `completed`
decision with per-part status (e.g. part 1 completed iff `term < cutoff`,
part 2 iff `lastTerm < cutoff`). Progress aggregation attributes each
part's per-semester units to completed or planned independently; for a
one-semester course this reduces to today's behaviour.

**Labels.** One helper produces a placement's term text: a single label, a
range "S1 2028 – S2 2028", or the straddle form "Completed S1 2028 ·
planned S2 2028". Menus use the range form for a candidate start term.

**Overlay.** Incoming edges end at part 1; outgoing edges start at the
part-2 stub (fall back to part 1 if no stub is rendered).

Alternatives considered and rejected:
- *Two full cards* — costs height budget, and dragging part 2 needs a
  confusing rule for what "drop here" means.
- *One card spanning both columns* — the timeline is a flex row of
  independent per-term lists; crossing the gap is fragile across resizing
  and phone width.
- *Whole-course completion with per-part labels only* — bars would
  contradict the labels.
- *"In progress" state* — hides which part is done; adds a new state.

## 5. Probes raised and resolved

| # | Type | What was raised | Resolution |
| --- | --- | --- | --- |
| 1 | assumption | Is two-semester support missing entirely? | No — detection, term units, feasibility, prereq timing already handle it; only display is missing. Confirmed in code. |
| 2 | ambiguity | "Show up across two semesters" — duplicate card, stub, or spanning card? | Slim part-2 stub; full card stays in start term. |
| 3 | ambiguity | How menus indicate both semesters | Range label "S1 2028 – S2 2028". |
| 4 | gap | Cutoff between the two parts | Per part: part 1 completed, part 2 planned (user's call). |
| 5 | contradiction | Per-part labels vs whole-course `completed` feeding progress bars | Units split per part in all progress bars; totals/allocation unchanged. |
| 6 | ambiguity | Sidebar wording when straddling | "Completed S1 2028 · planned S2 2028"; range when not straddling. |
| 7 | gap | Where prereq arrows attach | In to part 1, out of part 2. |
| 8 | gap | Course blocked in the final term (no part 2 term) | Part 1 only, existing blocked reason, no stub. |
| 9 | gap | Drag hover, recede, locate highlight | Both parts treated together; hover outlines T and T+1. |
| 10 | gap | Search results lacking a `view.courses` entry in menus | Menu must read twoSemester from the result's own course data. |
| 11 | gap | Card height budget | Part marker on an existing line; stub compact; budget spec stays green. |
| 12 | gap | Documentation | Help page note. |
| 13 | contradiction | (Planning) "Part 1 of 2" doesn't fit the 180px header line | Own marker line on two-semester cards only, with the continuation term; budget spec unaffected (median / term 0). |
| 14 | gap | (Planning) Suggestion buttons ("Place COMP4550 in S1 2028") name a term | Covered by FR8: they use the range too. |

## 6. Handoff notes for planning

- Do not re-open: stub (not duplicate/spanning), range wording, per-part
  completion *including* units, arrow endpoints, no "In progress" state.
- Domain first: per-part completion changes `evaluate.ts`/`view.ts` and
  their tests — do this before UI so labels/bars read from it.
- Risk: existing tests that assert `placement.completed` or totals for
  COMP4550 in the example plan may need updating; the cutoff in the
  example plan determines whether it straddles.
- `data-placed` is used by locate, overlay, spec tests, and drag — keep it
  on part 1 only; give the stub its own attribute.
- Visual verification at 1920×1080 and 390×844 is required (CLAUDE.md).
- One commit per unit of work; consider logging a PROCESS_LOG.md moment if
  the per-part-completion contradiction (probe 5) lands as a spec check.
